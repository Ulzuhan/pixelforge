"use client";

import { useState, useCallback, useRef } from "react";

/*
 * Sobre los `<img>` de este fichero.
 *
 * Sus imágenes NO existen en el servidor: son `data:` (las crea FileReader al
 * elegir un fichero) y `blob:` (las crea createObjectURL con el resultado).
 * `next/image` no puede optimizar lo que no puede descargar, así que aquí
 * `<img>` no es un descuido sino lo correcto.
 *
 * La regla se calla línea a línea y no en todo el fichero, para que un `<img>`
 * nuevo sobre un fichero de verdad siga avisando.
 */


type ToolMode = "removebg" | "vectorize";

interface ProcessingState {
  loading: boolean;
  progress: number;
  error: string | null;
  resultUrl: string | null;
  resultBlob: Blob | null;
  resultFilename: string | null;
  resultType: "png" | "svg" | null;
}

const BG_MODELS = [
  { id: "isnet-general-use", label: "ISNet", tip: "Most precise (default)" },
  { id: "u2net", label: "U²-Net", tip: "Best all-round quality" },
  { id: "silueta", label: "Silueta", tip: "Good edges, fast" },
  { id: "u2netp", label: "U²-Net Lite", tip: "Fastest, lightest" },
];

/**
 * La herramienta. Antes era la portada; ahora la portada decide en el servidor
 * si enseñar esto o la landing, según haya sesión.
 */
export function Tool({ email }: { email: string }) {
  const [mode, setMode] = useState<ToolMode>("removebg");
  const [model, setModel] = useState("isnet-general-use");
  const [alphaMatting, setAlphaMatting] = useState(true);
  const [postProcess, setPostProcess] = useState(true);
  // Vectorize options
  const [colormode, setColormode] = useState<"color" | "binary">("color");
  const [hierarchical, setHierarchical] = useState<"stacked" | "cutout">("stacked");
  const [curveMode, setCurveMode] = useState<"spline" | "polygon" | "pixel">("spline");
  const [colorPrecision, setColorPrecision] = useState(6);
  const [filterSpeckle, setFilterSpeckle] = useState(4);
  const [cornerThreshold, setCornerThreshold] = useState(60);
  const [spliceThreshold, setSpliceThreshold] = useState(45);

  const [inputPreview, setInputPreview] = useState<string | null>(null);
  const [inputFile, setInputFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState<ProcessingState>({
    loading: false,
    progress: 0,
    error: null,
    resultUrl: null,
    resultBlob: null,
    resultFilename: null,
    resultType: null,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const validExtensions = /\.(png|jpe?g|webp|bmp|tiff?)$/i;
    const validMimes = ["image/png", "image/jpeg", "image/webp", "image/bmp", "image/tiff"];
    if (!validMimes.includes(file.type) && !validExtensions.test(file.name)) {
      setProcessing((p) => ({ ...p, error: "Unsupported file type. Use PNG, JPEG, WebP, BMP, or TIFF." }));
      return;
    }

    setInputFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setInputPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    if (processing.resultUrl) URL.revokeObjectURL(processing.resultUrl);
    setProcessing({
      loading: false,
      progress: 0,
      error: null,
      resultUrl: null,
      resultBlob: null,
      resultFilename: null,
      resultType: null,
    });
  }, [processing.resultUrl]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const processImage = useCallback(async () => {
    if (!inputFile) return;

    setProcessing((p) => ({ ...p, loading: true, progress: 0, error: null }));

    const formData = new FormData();
    formData.append("file", inputFile);

    if (mode === "removebg") {
      formData.append("model", model);
      formData.append("alphaMatting", alphaMatting ? "true" : "false");
      formData.append("postProcess", postProcess ? "true" : "false");
    } else {
      formData.append("colormode", colormode);
      formData.append("hierarchical", hierarchical);
      formData.append("curveMode", curveMode);
      formData.append("filterSpeckle", filterSpeckle.toString());
      formData.append("colorPrecision", colorPrecision.toString());
      formData.append("layerDifference", "16");
      formData.append("cornerThreshold", cornerThreshold.toString());
      formData.append("lengthThreshold", "4");
      formData.append("spliceThreshold", spliceThreshold.toString());
      formData.append("pathPrecision", "8");
    }

    try {
      const xhr = new XMLHttpRequest();

      const result = await new Promise<Blob>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setProcessing((p) => ({ ...p, progress: Math.round((e.loaded / e.total) * 50) }));
          }
        });

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response);
          } else {
            try {
              const err = JSON.parse(xhr.responseText);
              reject(new Error(err.error || err.details || "Processing failed"));
            } catch {
              reject(new Error(`Processing failed (HTTP ${xhr.status})`));
            }
          }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.ontimeout = () => reject(new Error("Request timed out (image may be too large for CPU processing)"));

        xhr.responseType = "blob";
        xhr.open("POST", mode === "removebg" ? "/api/removebg" : "/api/vectorize");
        xhr.timeout = 180000;

        xhr.upload.onload = () => {
          setProcessing((p) => ({ ...p, progress: 50 }));
          let simProgress = 50;
          const simInterval = setInterval(() => {
            simProgress = Math.min(simProgress + 1, 95);
            setProcessing((p) => ({ ...p, progress: simProgress }));
          }, 500);
          xhr.onloadend = () => clearInterval(simInterval);
        };

        xhr.send(formData);
      });

      const contentType = result.type;
      const isSvg = contentType.includes("svg") || mode === "vectorize";
      const url = URL.createObjectURL(result);
      const ext = isSvg ? "svg" : "png";
      const baseName = inputFile.name.replace(/\.[^.]+$/, "");

      setProcessing({
        loading: false,
        progress: 100,
        error: null,
        resultUrl: url,
        resultBlob: result,
        resultFilename: mode === "removebg" ? `${baseName}-nobg.${ext}` : `${baseName}.${ext}`,
        resultType: isSvg ? "svg" : "png",
      });
    } catch (err) {
      setProcessing((p) => ({
        ...p,
        loading: false,
        error: err instanceof Error ? err.message : "Processing failed",
      }));
    }
  }, [inputFile, mode, model, alphaMatting, postProcess, colormode, hierarchical, curveMode, colorPrecision, filterSpeckle, cornerThreshold, spliceThreshold]);

  const downloadResult = useCallback(() => {
    if (!processing.resultBlob || !processing.resultFilename) return;
    const url = URL.createObjectURL(processing.resultBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = processing.resultFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [processing.resultBlob, processing.resultFilename]);

  const reset = useCallback(() => {
    setInputFile(null);
    setInputPreview(null);
    if (processing.resultUrl) URL.revokeObjectURL(processing.resultUrl);
    setProcessing({
      loading: false,
      progress: 0,
      error: null,
      resultUrl: null,
      resultBlob: null,
      resultFilename: null,
      resultType: null,
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [processing.resultUrl]);

  return (
    <div className="kc-workspace pf-workspace flex-1 flex flex-col items-center px-4 py-8 sm:py-12 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="pf-workspace-header w-full flex items-start justify-between gap-3 mb-8">
        <div className="min-w-0 flex-1 text-center sm:pl-[7.5rem]">
          <h1 className="text-4xl sm:text-5xl font-bold mb-2">
            <span className="text-accent">Pixel</span>forge
          </h1>
          <p className="text-muted text-sm sm:text-base">
            Remove backgrounds &middot; Vectorize logos &middot; Self-hosted &amp; private
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2 text-xs text-muted">
          <span className="hidden sm:inline max-w-[14ch] truncate" title={email}>{email}</span>
          <button
            onClick={async () => {
              const res = await fetch("/api/auth/logout", { method: "POST" });
              const { next } = await res.json().catch(() => ({ next: "/" }));
              window.location.href = next ?? "/";
            }}
            className="rounded-lg px-3 py-1.5 hover:bg-surface transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Tool Mode Tabs */}
      <div className="pf-mode-switch flex gap-2 mb-8 bg-surface rounded-xl p-1.5" role="tablist" aria-label="Image operation">
        <button
          role="tab"
          aria-selected={mode === "removebg"}
          onClick={() => { setMode("removebg"); reset(); }}
          className={`px-5 py-2.5 rounded-lg font-medium transition-all text-sm sm:text-base ${
            mode === "removebg" ? "tab-active" : "tab-inactive"
          }`}
        >
          🖼️ Remove BG
        </button>
        <button
          role="tab"
          aria-selected={mode === "vectorize"}
          onClick={() => { setMode("vectorize"); reset(); }}
          className={`px-5 py-2.5 rounded-lg font-medium transition-all text-sm sm:text-base ${
            mode === "vectorize" ? "tab-active" : "tab-inactive"
          }`}
        >
          ✏️ Vectorize
        </button>
      </div>

      {/* Upload Area */}
      {!processing.resultUrl && (
        <div className="pf-editor w-full mb-6">
          <div
            className={`pf-dropzone relative border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all duration-200 cursor-pointer ${
              isDragging
                ? "border-accent bg-accent/10 scale-[1.02]"
                : "border-border hover:border-accent/50 hover:bg-surface-light/50"
            } ${processing.loading ? "pointer-events-none" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !processing.loading && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/bmp,image/tiff"
              className="hidden"
              onChange={handleFileSelect}
            />

            {inputPreview ? (
              <div className="space-y-4">
                <div className="inline-block max-w-xs max-h-48 overflow-hidden rounded-lg border border-border">
                  {mode === "removebg" ? (
                    // eslint-disable-next-line @next/next/no-img-element -- data:/blob:, ver la nota de arriba
                    <img src={inputPreview} alt="Preview" className="max-w-xs max-h-48 object-contain checkerboard rounded-lg" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- data:/blob:, ver la nota de arriba
                    <img src={inputPreview} alt="Preview" className="max-w-xs max-h-48 object-contain rounded-lg" />
                  )}
                </div>
                <p className="text-foreground font-medium text-sm truncate px-4">{inputFile?.name}</p>
                <p className="text-muted text-xs">
                  Click or drag to replace &middot; Ready to process
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-5xl">{mode === "removebg" ? "🖼️" : "✏️"}</div>
                <p className="text-foreground font-medium text-lg">
                  Drop an image here or click to browse
                </p>
                <p className="text-muted text-sm">
                  PNG, JPEG, WebP, BMP, TIFF &middot; Max 50MB
                </p>
              </div>
            )}
          </div>

          {/* Options Panel */}
          <div className="pf-controls mt-4 bg-surface border border-border rounded-xl p-4 space-y-4">
            {mode === "removebg" ? (
              <>
                <div className="flex items-center gap-2 text-sm flex-wrap justify-center">
                  <span className="text-muted">Model:</span>
                  <div className="flex gap-1.5 flex-wrap justify-center">
                    {BG_MODELS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setModel(m.id)}
                        title={m.tip}
                        className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                          model === m.id
                            ? "bg-accent text-white"
                            : "bg-surface-light text-muted hover:text-foreground"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm justify-center">
                  <label className="flex items-center gap-1.5 cursor-pointer" title="Better edge refinement (slower)">
                    <input
                      type="checkbox"
                      checked={alphaMatting}
                      onChange={(e) => setAlphaMatting(e.target.checked)}
                      className="accent-accent w-4 h-4"
                    />
                    <span className="text-muted">Alpha Matting</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer" title="Morphological cleanup of mask">
                    <input
                      type="checkbox"
                      checked={postProcess}
                      onChange={(e) => setPostProcess(e.target.checked)}
                      className="accent-accent w-4 h-4"
                    />
                    <span className="text-muted">Post-process</span>
                  </label>
                </div>
              </>
            ) : (
              <>
                {/* Style Presets */}
                <div className="flex items-center gap-2 text-sm flex-wrap justify-center">
                  <span className="text-muted">Style:</span>
                  <div className="flex gap-1.5 flex-wrap justify-center">
                    <button
                      onClick={() => { setHierarchical("stacked"); setCurveMode("spline"); setColorPrecision(6); setFilterSpeckle(4); setCornerThreshold(60); setSpliceThreshold(45); }}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                        hierarchical === "stacked" && curveMode === "spline"
                          ? "bg-accent text-white"
                          : "bg-surface-light text-muted hover:text-foreground"
                      }`}
                    >
                      🎨 Smooth
                    </button>
                    <button
                      onClick={() => { setHierarchical("cutout"); setCurveMode("polygon"); setColorPrecision(8); setFilterSpeckle(2); setCornerThreshold(90); setSpliceThreshold(60); }}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                        hierarchical === "cutout" && curveMode === "polygon"
                          ? "bg-accent text-white"
                          : "bg-surface-light text-muted hover:text-foreground"
                      }`}
                    >
                      ✂️ Sharp
                    </button>
                    <button
                      onClick={() => { setColormode("binary"); setHierarchical("stacked"); setCurveMode("spline"); setColorPrecision(6); setFilterSpeckle(4); setCornerThreshold(60); setSpliceThreshold(45); }}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                        colormode === "binary"
                          ? "bg-accent text-white"
                          : "bg-surface-light text-muted hover:text-foreground"
                      }`}
                    >
                      ⬛ B/W
                    </button>
                  </div>
                </div>

                {/* Advanced Settings Toggle */}
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-muted text-xs hover:text-foreground transition-all w-full text-center"
                >
                  {showAdvanced ? "▾ Hide advanced settings" : "▸ Show advanced settings"}
                </button>

                {showAdvanced && (
                  <div className="space-y-3 pt-2 border-t border-border">
                    {/* Color mode + Hierarchy */}
                    <div className="flex flex-wrap gap-4 justify-center">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted">Colors:</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setColormode("color")}
                            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${colormode === "color" ? "bg-accent text-white" : "bg-surface-light text-muted hover:text-foreground"}`}
                          >🎨 Color</button>
                          <button
                            onClick={() => setColormode("binary")}
                            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${colormode === "binary" ? "bg-accent text-white" : "bg-surface-light text-muted hover:text-foreground"}`}
                          >⬛ B/W</button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted">Layers:</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setHierarchical("stacked")}
                            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${hierarchical === "stacked" ? "bg-accent text-white" : "bg-surface-light text-muted hover:text-foreground"}`}
                          >Stacked</button>
                          <button
                            onClick={() => setHierarchical("cutout")}
                            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${hierarchical === "cutout" ? "bg-accent text-white" : "bg-surface-light text-muted hover:text-foreground"}`}
                          >Cutout</button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted">Curves:</span>
                        <div className="flex gap-1.5">
                          {(["spline", "polygon", "pixel"] as const).map((cm) => (
                            <button
                              key={cm}
                              onClick={() => setCurveMode(cm)}
                              className={`px-3 py-1.5 rounded-lg font-medium transition-all capitalize ${curveMode === cm ? "bg-accent text-white" : "bg-surface-light text-muted hover:text-foreground"}`}
                            >{cm === "spline" ? "🌀" : cm === "polygon" ? "📐" : "🟫"} {cm}</button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Sliders */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted">Color Precision</span>
                          <span className="text-foreground">{colorPrecision}</span>
                        </div>
                        <input type="range" min="1" max="12" value={colorPrecision} onChange={(e) => setColorPrecision(Number(e.target.value))} className="w-full accent-accent" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted">Filter Speckle</span>
                          <span className="text-foreground">{filterSpeckle}</span>
                        </div>
                        <input type="range" min="0" max="64" value={filterSpeckle} onChange={(e) => setFilterSpeckle(Number(e.target.value))} className="w-full accent-accent" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted">Corner Threshold</span>
                          <span className="text-foreground">{cornerThreshold}</span>
                        </div>
                        <input type="range" min="1" max="180" value={cornerThreshold} onChange={(e) => setCornerThreshold(Number(e.target.value))} className="w-full accent-accent" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted">Splice Threshold</span>
                          <span className="text-foreground">{spliceThreshold}</span>
                        </div>
                        <input type="range" min="1" max="90" value={spliceThreshold} onChange={(e) => setSpliceThreshold(Number(e.target.value))} className="w-full accent-accent" />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Process Button */}
          {inputFile && (
            <div className="pf-primary-action mt-4 flex justify-center">
              <button
                onClick={processImage}
                disabled={processing.loading}
                className="bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-8 rounded-xl transition-all active:scale-95 text-lg"
              >
                {processing.loading ? "Processing..." : mode === "removebg" ? "🖼️ Remove Background" : "✏️ Vectorize"}
              </button>
            </div>
          )}

          {/* Progress Bar */}
          {processing.loading && (
            <div className="pf-process-status mt-4 space-y-2">
              <div className="w-full bg-surface-light rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-accent h-full rounded-full transition-all duration-300"
                  style={{ width: `${processing.progress}%` }}
                />
              </div>
              <p className="text-muted text-sm text-center">
                {processing.progress < 50
                  ? "Uploading..."
                  : processing.progress < 95
                  ? "Processing on CPU... this may take a moment ⏳"
                  : "Almost done..."}
              </p>
            </div>
          )}

          {/* Error */}
          {processing.error && (
            <div className="pf-process-status mt-4 p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm text-center">
              ❌ {processing.error}
            </div>
          )}
        </div>
      )}

      {/* Result Preview */}
      {processing.resultUrl && (
        <div className="pf-result w-full space-y-4 mb-8">
          <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
            <div className="text-center">
              <p className="text-foreground font-semibold text-lg mb-1">
                ✅ {mode === "removebg" ? "Background Removed" : "Vectorized"}
              </p>
              <p className="text-muted text-sm">{processing.resultFilename}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {inputPreview && (
                <div className="flex-1 text-center">
                  <p className="text-muted text-xs mb-2 uppercase tracking-wide">Before</p>
                  <div className="inline-block rounded-lg border border-border overflow-hidden max-w-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element -- data:/blob:, ver la nota de arriba */}
                    <img src={inputPreview} alt="Original" className="max-w-full max-h-64 object-contain" />
                  </div>
                </div>
              )}

              <div className="flex-1 text-center">
                <p className="text-muted text-xs mb-2 uppercase tracking-wide">After</p>
                <div className={`inline-block rounded-lg border border-border overflow-hidden max-w-xs ${
                  processing.resultType === "png" ? "checkerboard" : "bg-white"
                }`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- data:/blob:, ver la nota de arriba */}
                  <img
                    src={processing.resultUrl}
                    alt="Result"
                    className={`max-w-full max-h-64 object-contain ${
                      processing.resultType === "png" ? "checkerboard" : "bg-white"
                    }`}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={downloadResult}
                className="bg-accent hover:bg-accent-hover text-white font-medium py-3 px-6 rounded-xl transition-all active:scale-95"
              >
                ⬇️ Download {processing.resultType?.toUpperCase()}
              </button>
              <button
                onClick={reset}
                className="bg-surface hover:bg-surface-light text-muted hover:text-foreground font-medium py-3 px-6 rounded-xl transition-all border border-border"
              >
                ↩ Process Another
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
