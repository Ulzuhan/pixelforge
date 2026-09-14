"use client";

/**
 * La herramienta, para quien ya ha entrado.
 *
 * Un escenario grande a la izquierda y un carril de ajustes a la derecha, como
 * cualquier editor: la imagen es lo importante y ocupa el sitio. La misma imagen
 * sirve para las dos operaciones —cambiar de una a otra no la descarta—, los
 * ajustes se pueden tocar después de un resultado y volver a lanzar, y todo lo
 * que se carga se puede soltar en cualquier punto de la página, pegar desde el
 * portapapeles o elegir con el teclado.
 *
 * Sobre los `<img>`: sus imágenes no existen en el servidor, son `blob:` del
 * navegador, así que `next/image` no tiene nada que optimizar.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Kbd, Segmented } from "../ui";
import { IconAlert, IconBezier, IconScissors, IconShield, IconSliders, IconUpload } from "../icons";
import { Canvas, type Backdrop, type LoadedImage, type View } from "./canvas";
import { Dropzone } from "./dropzone";
import { ResultCard } from "./result";
import {
  DEFAULT_REMOVEBG,
  DEFAULT_VECTORIZE,
  MODELS,
  RemoveBgPanel,
  VectorizePanel,
  presetOf,
  toFormFields,
  type Mode,
  type RemoveBgSettings,
  type VectorizeSettings,
} from "./settings";
import { useJob, useNow, type JobError } from "./use-job";
import { ACCEPT, MAX_UPLOAD_BYTES, formatBytes, formatSeconds, imageDims, looksLikeImage } from "./format";

const MODE_OPTIONS = [
  { value: "removebg" as const, label: "Remove background", icon: <IconScissors /> },
  { value: "vectorize" as const, label: "Vectorize", icon: <IconBezier /> },
];

const MODE_LABEL: Record<Mode, string> = { removebg: "Remove background", vectorize: "Vectorize" };

function settingsKey(mode: Mode, bg: RemoveBgSettings, vec: VectorizeSettings): string {
  return JSON.stringify(mode === "removebg" ? bg : vec);
}

function summarize(mode: Mode, bg: RemoveBgSettings, vec: VectorizeSettings): string {
  if (mode === "removebg") {
    const model = MODELS.find((m) => m.id === bg.model)?.name ?? bg.model;
    return `${model} · matting ${bg.alphaMatting ? "on" : "off"} · cleanup ${bg.postProcess ? "on" : "off"}`;
  }
  const preset = presetOf(vec);
  const style = preset ? preset[0].toUpperCase() + preset.slice(1) : "Custom";
  return `${style} · ${vec.colormode === "binary" ? "black & white" : "full colour"} · ${vec.curveMode}`;
}

function errorTitle(error: JobError): string {
  switch (error.status) {
    case 401: return "Your session ended";
    case 429: return "Too many requests";
    case 503: return "The machine is busy";
    case 413: return "That image is too big";
    case 400: return "That image was rejected";
    default: return "Processing failed";
  }
}

export function Tool() {
  const [mode, setMode] = useState<Mode>("removebg");
  const [bg, setBg] = useState<RemoveBgSettings>(DEFAULT_REMOVEBG);
  const [vec, setVec] = useState<VectorizeSettings>(DEFAULT_VECTORIZE);
  const [input, setInput] = useState<LoadedImage | null>(null);
  const [view, setView] = useState<View>("compare");
  const [backdrop, setBackdrop] = useState<Backdrop>({ kind: "checker", color: "#ff9a3c" });
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const { status, progress, startedAt, result, error, busy, run, cancel, clear } = useJob();
  const now = useNow(busy || Boolean(error?.retryAt));

  const notify = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const inputUrl = input?.url ?? null;

  const loadFile = useCallback(
    async (file: File) => {
      if (!looksLikeImage(file)) {
        notify("That is not an image we can read. Use PNG, JPEG, WebP, BMP or TIFF.");
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        notify(`That file is ${formatBytes(file.size)}. The limit is 50 MB.`);
        return;
      }
      const url = URL.createObjectURL(file);
      let loaded: LoadedImage;
      try {
        loaded = { file, url, previewable: true, ...(await imageDims(url)) };
      } catch {
        // El navegador no la sabe dibujar (un TIFF en Chrome, por ejemplo); el
        // servidor sí, así que se acepta sin vista previa.
        loaded = { file, url, previewable: false };
      }
      if (inputUrl) URL.revokeObjectURL(inputUrl);
      clear();
      setView("compare");
      setInput(loaded);
    },
    [inputUrl, clear, notify]
  );

  const runJob = useCallback(() => {
    if (!input || busy) return;
    run({
      file: input.file,
      mode,
      fields: toFormFields(mode, bg, vec),
      settingsKey: settingsKey(mode, bg, vec),
      summary: summarize(mode, bg, vec),
    });
  }, [input, busy, run, mode, bg, vec]);

  const switchMode = useCallback(
    (next: Mode) => {
      if (next === mode) return;
      clear();
      setView("compare");
      setMode(next);
    },
    [mode, clear]
  );

  const clearAll = useCallback(() => {
    clear();
    if (inputUrl) URL.revokeObjectURL(inputUrl);
    setInput(null);
    if (fileInput.current) fileInput.current.value = "";
  }, [clear, inputUrl]);

  const openPicker = useCallback(() => fileInput.current?.click(), []);

  const copyResult = useCallback(async () => {
    if (!result) return;
    try {
      if (result.kind === "svg") {
        await navigator.clipboard.writeText(await result.blob.text());
        notify("SVG markup copied to the clipboard");
      } else {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": result.blob })]);
        notify("PNG copied to the clipboard");
      }
    } catch {
      notify("The browser would not allow copying here. Download it instead.");
    }
  }, [result, notify]);

  // Arrastrar a cualquier punto de la página, pegar, y los atajos.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setDragging(true);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const file = e.dataTransfer?.files[0];
      if (file) void loadFile(file);
    };
    const paste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find(looksLikeImage);
      if (!file) return;
      e.preventDefault();
      void loadFile(file);
    };
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        runJob();
      } else if (e.key === "Escape" && busy) {
        cancel();
      }
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    window.addEventListener("paste", paste);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
      window.removeEventListener("paste", paste);
      window.removeEventListener("keydown", key);
    };
  }, [loadFile, runJob, cancel, busy]);

  const stale = Boolean(result && result.settingsKey !== settingsKey(mode, bg, vec));
  const retryIn = error?.retryAt ? Math.max(0, Math.ceil((error.retryAt - now) / 1000)) : 0;
  const elapsedMs = busy && startedAt ? Math.max(0, now - startedAt) : 0;

  const runLabel = busy
    ? status === "uploading" ? "Uploading…" : "Working…"
    : result ? (stale ? "Run with new settings" : "Run again") : MODE_LABEL[mode];
  const runHint = !input
    ? "Add an image to start"
    : busy
      ? `Running for ${formatSeconds(elapsedMs)} · Esc to cancel`
      : stale
        ? "Settings changed since the last run"
        : null;

  const runButton = (
    <Button variant="primary" size="lg" className="w-full" disabled={!input || busy} loading={busy} onClick={runJob} icon={mode === "removebg" ? <IconScissors /> : <IconBezier />}>
      {runLabel}
    </Button>
  );

  return (
    <div className="relative flex-1">
      {dragging && (
        <div className="drop-overlay" aria-hidden>
          <div>
            <IconUpload size="2.5rem" className="mx-auto text-accent" />
            <p className="mt-3 text-lg font-semibold">Drop to load it</p>
            <p className="mt-1 text-sm text-ink-3">PNG, JPEG, WebP, BMP or TIFF · up to 50 MB</p>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-[1440px] px-4 pb-28 pt-5 sm:px-6 lg:pb-10 lg:pt-7">
        {/* ── Cabecera de la herramienta ───────────────────────────────── */}
        <div className="rise mb-5 flex flex-wrap items-center justify-between gap-3">
          <Segmented size="lg" label="Tool" value={mode} onChange={switchMode} options={MODE_OPTIONS} />
          <div className="hidden items-center gap-3 text-xs text-ink-3 md:flex">
            <span className="inline-flex items-center gap-1.5">
              <IconShield className="text-ok" /> Runs on this machine
            </span>
            <span className="h-3 w-px bg-line-2" aria-hidden />
            <span>Nothing is stored</span>
            {input && (
              <>
                <span className="h-3 w-px bg-line-2" aria-hidden />
                <span className="inline-flex items-center gap-1">
                  <Kbd>⌘</Kbd>
                  <Kbd>↵</Kbd>
                  <span className="ml-1">run</span>
                </span>
              </>
            )}
          </div>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_23.5rem]">
          {/* ── Escenario ────────────────────────────────────────────── */}
          <div className="rise rise-1 min-w-0">
            {input ? (
              <Canvas
                input={input}
                result={result}
                status={status}
                progress={progress}
                elapsedMs={elapsedMs}
                mode={mode}
                view={view}
                onView={setView}
                backdrop={backdrop}
                onBackdrop={setBackdrop}
                onReplace={openPicker}
                onClear={clearAll}
                onCancel={cancel}
              />
            ) : (
              <Dropzone onOpen={openPicker} active={dragging} />
            )}
          </div>

          {/* ── Carril de ajustes ────────────────────────────────────── */}
          <aside className="rise rise-2 flex flex-col lg:sticky lg:top-[4.5rem] lg:max-h-[clamp(30rem,calc(100vh-11.5rem),52rem)]">
            <div className="min-h-0 flex-1 space-y-4 lg:overflow-y-auto lg:pr-1">
              {result && <ResultCard result={result} onCopy={copyResult} onClear={clear} />}

              {error && (
                <section role="alert" className="panel pop border-danger/30 p-4">
                  <div className="flex gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-danger/15 text-danger">
                      <IconAlert />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{errorTitle(error)}</p>
                      <p className="mt-1 text-sm leading-relaxed text-ink-2">{error.message}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {error.signIn ? (
                          <a href="/api/auth/login" className="btn btn-primary btn-sm">Sign in</a>
                        ) : (
                          <Button size="sm" variant="primary" disabled={retryIn > 0 || !input} onClick={runJob}>
                            {retryIn > 0 ? `Retry in ${retryIn} s` : "Retry"}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={clear}>Dismiss</Button>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              <section className="panel" aria-label="Settings">
                <header className="flex items-center gap-2 border-b border-line px-4 py-3">
                  <IconSliders className="text-accent" />
                  <h2 className="text-sm font-semibold">Settings</h2>
                  <span className="ml-auto text-xs text-ink-3">{MODE_LABEL[mode]}</span>
                </header>
                <div className="p-4">
                  {mode === "removebg" ? <RemoveBgPanel value={bg} onChange={setBg} /> : <VectorizePanel value={vec} onChange={setVec} />}
                </div>
              </section>
            </div>

            <div className="hidden pt-4 lg:block">
              {runButton}
              <p className="mt-2 min-h-4 text-center text-xs text-ink-3" aria-live="polite">{runHint}</p>
            </div>
          </aside>
        </div>
      </div>

      {/* ── Acción principal en móvil ───────────────────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/85 p-3 backdrop-blur-md lg:hidden">
        {result && !stale ? (
          <a href={result.url} download={result.filename} className="btn btn-primary btn-lg w-full">
            Download {result.kind.toUpperCase()}
          </a>
        ) : (
          runButton
        )}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void loadFile(file);
          e.target.value = "";
        }}
      />

      {toast && (
        <div className="toast" role="status">{toast}</div>
      )}
    </div>
  );
}
