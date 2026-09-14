"use client";

/**
 * El escenario: la imagen cargada, y cuando hay resultado, el antes y el después
 * uno encima del otro con una línea que se arrastra.
 *
 * Las dos capas se dibujan en una caja del tamaño exacto al que cabe la imagen
 * —medido con ResizeObserver— y no con `object-fit` sobre todo el escenario:
 * así el damero de "transparente" queda justo detrás de la foto, y la línea del
 * comparador corta las dos capas en el mismo píxel.
 */
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { Button, Segmented } from "../ui";
import { IconArrowsH, IconImage, IconRefresh, IconX } from "../icons";
import type { JobResult, JobStatus } from "./use-job";
import type { Mode } from "./settings";
import { formatBytes, formatDims, formatSeconds, megapixels } from "./format";

export interface LoadedImage {
  file: File;
  url: string;
  width?: number;
  height?: number;
  /** `false` cuando el navegador no sabe dibujarla (TIFF en Chrome): se sube igual. */
  previewable: boolean;
}

export type View = "compare" | "before" | "after";
export type BackdropKind = "checker" | "checker-light" | "white" | "black" | "custom";
export interface Backdrop {
  kind: BackdropKind;
  color: string;
}

const BACKDROPS: Array<{ kind: Exclude<BackdropKind, "custom">; label: string; className: string }> = [
  { kind: "checker", label: "Dark checkerboard", className: "checker" },
  { kind: "checker-light", label: "Light checkerboard", className: "checker checker-light" },
  { kind: "white", label: "White", className: "bg-white" },
  { kind: "black", label: "Black", className: "bg-black" },
];

const PAD = 28;

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function Canvas({ input, result, status, progress, elapsedMs, mode, view, onView, backdrop, onBackdrop, onReplace, onClear, onCancel }: {
  input: LoadedImage;
  result: JobResult | null;
  status: JobStatus;
  progress: number;
  elapsedMs: number;
  mode: Mode;
  view: View;
  onView: (view: View) => void;
  backdrop: Backdrop;
  onBackdrop: (b: Backdrop) => void;
  onReplace: () => void;
  onClear: () => void;
  onCancel: () => void;
}) {
  const [stageRef, stage] = useElementSize<HTMLDivElement>();
  const [pos, setPos] = useState(50);
  const dragging = useRef(false);
  const colorInput = useRef<HTMLInputElement>(null);

  const busy = status === "uploading" || status === "processing";
  const hasResult = Boolean(result);
  // Sin vista previa del original no hay nada que comparar: se enseña el resultado.
  const effectiveView: View = !input.previewable && hasResult ? "after" : hasResult ? view : "before";

  // Dimensiones de referencia: las del original, o las del resultado cuando el
  // original no se pudo leer en el navegador.
  const refW = input.width ?? result?.width ?? 4;
  const refH = input.height ?? result?.height ?? 3;
  const availW = Math.max(0, stage.width - PAD * 2);
  const availH = Math.max(0, stage.height - PAD * 2);
  const scale = availW && availH ? Math.min(availW / refW, availH / refH) : 0;
  const boxW = Math.max(1, Math.round(refW * scale));
  const boxH = Math.max(1, Math.round(refH * scale));

  const backdropClass = backdrop.kind === "custom" ? "" : BACKDROPS.find((b) => b.kind === backdrop.kind)?.className ?? "checker";
  const boxStyle: CSSProperties = {
    width: boxW,
    height: boxH,
    visibility: scale ? "visible" : "hidden",
    "--pos": `${pos}%`,
    ...(backdrop.kind === "custom" ? { backgroundColor: backdrop.color } : {}),
  } as CSSProperties;

  const comparing = effectiveView === "compare";

  const updateFromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    setPos(clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100));
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!comparing || e.button !== 0) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromPointer(e);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) updateFromPointer(e);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };
  const onHandleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === "ArrowLeft") setPos((p) => clamp(p - step, 0, 100));
    else if (e.key === "ArrowRight") setPos((p) => clamp(p + step, 0, 100));
    else if (e.key === "Home") setPos(0);
    else if (e.key === "End") setPos(100);
    else return;
    e.preventDefault();
  };

  const phase =
    status === "uploading"
      ? { title: `Uploading ${Math.round(progress * 100)}%`, hint: "Sending the original at full resolution." }
      : mode === "removebg"
        ? { title: "Removing the background", hint: "The first run downloads the model (about 180 MB) and takes longer. After that, a matter of seconds." }
        : { title: "Tracing curves", hint: "Large images are scaled to 2048 px on the long side before tracing." };

  return (
    <section className="panel flex flex-col overflow-hidden" aria-label="Canvas">
      {/* ── Barra superior ─────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <IconImage className="shrink-0 text-ink-3" />
          <span className="truncate font-medium" title={input.file.name}>{input.file.name}</span>
          <span className="hidden shrink-0 font-mono text-[11px] text-ink-3 sm:inline">
            {input.width && input.height ? `${formatDims(input.width, input.height)} · ${megapixels(input.width, input.height)} · ` : ""}
            {formatBytes(input.file.size)}
          </span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {hasResult && input.previewable && (
            <Segmented
              label="View"
              value={view}
              onChange={onView}
              options={[
                { value: "compare", label: "Compare", icon: <IconArrowsH /> },
                { value: "before", label: "Original" },
                { value: "after", label: "Result" },
              ]}
            />
          )}

          <div role="radiogroup" aria-label="Preview background" className="flex items-center gap-1.5 rounded-xl border border-line bg-bg-2 p-1.5">
            {BACKDROPS.map((b) => (
              <button
                key={b.kind}
                type="button"
                role="radio"
                aria-checked={backdrop.kind === b.kind}
                aria-label={b.label}
                title={b.label}
                className={`swatch ${b.className}`}
                onClick={() => onBackdrop({ ...backdrop, kind: b.kind })}
              />
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={backdrop.kind === "custom"}
              aria-label="Custom colour"
              title="Custom colour"
              className="swatch"
              style={{ background: backdrop.kind === "custom" ? backdrop.color : "conic-gradient(#ff6b6b, #ffc247, #43d787, #45e0f5, #a78bfa, #ff6b6b)" }}
              onClick={() => colorInput.current?.click()}
            />
            <input
              ref={colorInput}
              type="color"
              value={backdrop.color}
              aria-hidden
              tabIndex={-1}
              className="pointer-events-none absolute size-0 opacity-0"
              onChange={(e) => onBackdrop({ kind: "custom", color: e.target.value })}
            />
          </div>

          <Button size="sm" variant="ghost" icon={<IconRefresh />} onClick={onReplace} disabled={busy}>
            <span className="hidden sm:inline">Replace</span>
          </Button>
          <Button size="sm" variant="ghost" className="btn-icon" aria-label="Remove image" title="Remove image" onClick={onClear} disabled={busy}>
            <IconX />
          </Button>
        </div>
      </header>

      {/* ── Escenario ──────────────────────────────────────────────────── */}
      <div ref={stageRef} className="stage stage-vignette h-[clamp(340px,calc(100vh-15rem),760px)]">
        <div
          className={`compare relative overflow-hidden rounded-lg shadow-[0_20px_60px_-20px_rgba(0,0,0,.8)] ${backdropClass} ${comparing ? "cursor-ew-resize" : ""}`}
          style={boxStyle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {input.previewable ? (
            effectiveView !== "after" && (
              // eslint-disable-next-line @next/next/no-img-element -- es un blob: del navegador, no un fichero del servidor
              <img src={input.url} alt="Original" draggable={false} className="absolute inset-0 h-full w-full select-none object-contain" />
            )
          ) : (
            !hasResult && (
              <div className="grid h-full w-full place-items-center bg-surface-2 p-6 text-center">
                <div>
                  <IconImage size="2rem" className="mx-auto text-ink-3" />
                  <p className="mt-3 text-sm font-medium">No preview for this format in your browser</p>
                  <p className="mt-1 text-xs text-ink-3">It will be processed all the same; the result will show here.</p>
                </div>
              </div>
            )
          )}

          {result && effectiveView !== "before" && (
            // eslint-disable-next-line @next/next/no-img-element -- ídem: un blob: recién generado
            <img
              src={result.url}
              alt={result.mode === "removebg" ? "Background removed" : "Vectorized"}
              draggable={false}
              className={`absolute inset-0 h-full w-full select-none object-contain ${comparing ? "compare-after" : ""}`}
            />
          )}

          {result && comparing && (
            <>
              <div className="compare-line" aria-hidden />
              <div
                role="slider"
                tabIndex={0}
                aria-label="Reveal the result"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(pos)}
                className="compare-handle"
                onKeyDown={onHandleKey}
              >
                <IconArrowsH />
              </div>
              <span className="compare-label left-3">Before</span>
              <span className="compare-label right-3">After</span>
            </>
          )}
        </div>

        {busy && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-bg/55 backdrop-blur-[3px]" role="status" aria-live="polite">
            <div className="panel-glass pop flex w-[min(92%,22rem)] flex-col items-center rounded-2xl px-6 py-7 text-center">
              <div className="ring" aria-hidden />
              <p className="mt-5 text-base font-semibold">{phase.title}</p>
              <p className="mt-1 font-mono text-xs text-accent tabular-nums">{formatSeconds(elapsedMs)}</p>
              <p className="mt-3 text-xs leading-relaxed text-ink-3">{phase.hint}</p>
              <Button size="sm" variant="ghost" className="mt-4" onClick={onCancel}>Cancel</Button>
            </div>
          </div>
        )}
      </div>

      {busy && (
        <div className="progress rounded-none" data-indeterminate={status === "processing"} aria-hidden>
          <span style={{ width: `${progress * 100}%` }} />
        </div>
      )}
    </section>
  );
}
