"use client";

/**
 * Los ajustes de las dos herramientas: qué son, sus valores por defecto, los
 * presets, y los paneles que los editan.
 *
 * Los rangos son exactamente los que valida cada ruta (`/api/vectorize` rechaza
 * con 400 lo que se salga), y los textos explican qué hace cada mando en vez de
 * repetir su nombre: "corner threshold" no le dice nada a nadie; "el ángulo a
 * partir del cual una curva pasa a ser una esquina", sí.
 */
import { useState } from "react";
import { Button, Choice, Disclosure, Segmented, Slider, Switch } from "../ui";
import { IconRefresh } from "../icons";

export type Mode = "removebg" | "vectorize";

/* ── Quitar fondo ──────────────────────────────────────────────────────── */
export const MODELS = [
  { id: "isnet-general-use", name: "ISNet", blurb: "The sharpest masks on most subjects. Start here.", tag: "Precise", tone: "accent" },
  { id: "u2net", name: "U²-Net", blurb: "The classic all-rounder. Strong on people and products.", tag: "Balanced", tone: undefined },
  { id: "silueta", name: "Silueta", blurb: "A slimmer U²-Net: good edges, noticeably quicker.", tag: "Fast", tone: undefined },
  { id: "u2netp", name: "U²-Net Lite", blurb: "The lightest model. Quickest, softer edges.", tag: "Fastest", tone: "ok" },
] as const;
export type ModelId = (typeof MODELS)[number]["id"];

export interface RemoveBgSettings {
  model: ModelId;
  alphaMatting: boolean;
  postProcess: boolean;
}

export const DEFAULT_REMOVEBG: RemoveBgSettings = { model: "isnet-general-use", alphaMatting: true, postProcess: true };

/* ── Vectorizar ────────────────────────────────────────────────────────── */
export interface VectorizeSettings {
  colormode: "color" | "binary";
  hierarchical: "stacked" | "cutout";
  curveMode: "spline" | "polygon" | "pixel";
  filterSpeckle: number;
  colorPrecision: number;
  layerDifference: number;
  cornerThreshold: number;
  lengthThreshold: number;
  spliceThreshold: number;
  pathPrecision: number;
}

export const DEFAULT_VECTORIZE: VectorizeSettings = {
  colormode: "color",
  hierarchical: "stacked",
  curveMode: "spline",
  filterSpeckle: 4,
  colorPrecision: 6,
  layerDifference: 16,
  cornerThreshold: 60,
  lengthThreshold: 4,
  spliceThreshold: 45,
  pathPrecision: 8,
};

type PresetValues = Pick<VectorizeSettings, "hierarchical" | "curveMode" | "colorPrecision" | "filterSpeckle" | "cornerThreshold" | "spliceThreshold">;

export const VEC_PRESETS: Array<{ id: string; name: string; blurb: string; values: PresetValues }> = [
  {
    id: "smooth",
    name: "Smooth",
    blurb: "Flowing curves, stacked layers. Logos and drawings.",
    values: { hierarchical: "stacked", curveMode: "spline", colorPrecision: 6, filterSpeckle: 4, cornerThreshold: 60, spliceThreshold: 45 },
  },
  {
    id: "sharp",
    name: "Sharp",
    blurb: "Crisp corners, cut-out layers. Icons, type, pixel art.",
    values: { hierarchical: "cutout", curveMode: "polygon", colorPrecision: 8, filterSpeckle: 2, cornerThreshold: 90, spliceThreshold: 60 },
  },
  {
    id: "poster",
    name: "Poster",
    blurb: "Fewer colours, bolder shapes. Photos into flat prints.",
    values: { hierarchical: "stacked", curveMode: "spline", colorPrecision: 4, filterSpeckle: 10, cornerThreshold: 60, spliceThreshold: 45 },
  },
];

/** El preset que coincide con estos ajustes, o `null` si son a medida. */
export function presetOf(s: VectorizeSettings): string | null {
  const match = VEC_PRESETS.find((p) => (Object.keys(p.values) as Array<keyof PresetValues>).every((k) => p.values[k] === s[k]));
  return match?.id ?? null;
}

const VEC_SLIDERS: Array<{ key: keyof VectorizeSettings; label: string; min: number; max: number; hint: string; unit?: string }> = [
  { key: "colorPrecision", label: "Colour precision", min: 1, max: 12, hint: "How many colours survive. Higher keeps subtle shades, lower flattens them." },
  { key: "filterSpeckle", label: "Filter speckle", min: 0, max: 64, hint: "Ignore specks smaller than this many pixels. Higher cleans up noise.", unit: " px" },
  { key: "cornerThreshold", label: "Corner threshold", min: 1, max: 180, hint: "The angle at which a bend becomes a corner. Lower is smoother.", unit: "°" },
  { key: "spliceThreshold", label: "Splice threshold", min: 1, max: 90, hint: "The angle under which two curves are joined into one.", unit: "°" },
  { key: "layerDifference", label: "Layer difference", min: 1, max: 64, hint: "Colour distance between stacked layers. Lower makes more layers." },
  { key: "lengthThreshold", label: "Length threshold", min: 1, max: 64, hint: "Paths shorter than this are dropped.", unit: " px" },
  { key: "pathPrecision", label: "Path precision", min: 1, max: 12, hint: "Decimals kept in the SVG coordinates. Lower means a smaller file." },
];

/** Los campos tal como los espera cada ruta. */
export function toFormFields(mode: Mode, bg: RemoveBgSettings, vec: VectorizeSettings): Record<string, string> {
  if (mode === "removebg") {
    return { model: bg.model, alphaMatting: String(bg.alphaMatting), postProcess: String(bg.postProcess) };
  }
  return Object.fromEntries(Object.entries(vec).map(([k, v]) => [k, String(v)]));
}

/* ── Paneles ───────────────────────────────────────────────────────────── */
export function RemoveBgPanel({ value, onChange }: { value: RemoveBgSettings; onChange: (v: RemoveBgSettings) => void }) {
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-3">Model</legend>
        <div role="radiogroup" aria-label="Model" className="space-y-2">
          {MODELS.map((m) => (
            <Choice
              key={m.id}
              checked={value.model === m.id}
              onSelect={() => onChange({ ...value, model: m.id })}
              title={m.name}
              blurb={m.blurb}
              tag={m.tag}
              tagTone={m.tone}
            />
          ))}
        </div>
      </fieldset>

      <div className="space-y-1 border-t border-line pt-4">
        <Switch
          label="Alpha matting"
          hint="Refines the edge around hair, fur and glass. Slower, and worth it for portraits."
          checked={value.alphaMatting}
          onChange={(alphaMatting) => onChange({ ...value, alphaMatting })}
        />
        <Switch
          label="Clean up the mask"
          hint="Fills small holes and removes stray specks after the cut."
          checked={value.postProcess}
          onChange={(postProcess) => onChange({ ...value, postProcess })}
        />
      </div>
    </div>
  );
}

export function VectorizePanel({ value, onChange }: { value: VectorizeSettings; onChange: (v: VectorizeSettings) => void }) {
  const [tuning, setTuning] = useState(false);
  const preset = presetOf(value);
  const isDefault = JSON.stringify(value) === JSON.stringify(DEFAULT_VECTORIZE);

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-3">Colours</p>
        <Segmented
          label="Colour mode"
          className="w-full"
          value={value.colormode}
          onChange={(colormode) => onChange({ ...value, colormode })}
          options={[
            { value: "color", label: "Full colour" },
            { value: "binary", label: "Black & white" },
          ]}
        />
      </div>

      <fieldset>
        <legend className="mb-2 flex w-full items-center justify-between text-xs font-medium uppercase tracking-wider text-ink-3">
          <span>Style</span>
          {!preset && <span className="tag tag-accent normal-case tracking-normal">Custom</span>}
        </legend>
        <div role="radiogroup" aria-label="Style" className="space-y-2">
          {VEC_PRESETS.map((p) => (
            <Choice key={p.id} checked={preset === p.id} onSelect={() => onChange({ ...value, ...p.values })} title={p.name} blurb={p.blurb} />
          ))}
        </div>
      </fieldset>

      <Disclosure open={tuning} onToggle={() => setTuning((v) => !v)} label="Fine-tune">
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Layers</p>
            <Segmented
              label="Layers"
              className="w-full"
              value={value.hierarchical}
              onChange={(hierarchical) => onChange({ ...value, hierarchical })}
              options={[
                { value: "stacked", label: "Stacked", title: "Shapes overlap, smooth transitions" },
                { value: "cutout", label: "Cutout", title: "Shapes sit side by side, no overlaps" },
              ]}
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Curves</p>
            <Segmented
              label="Curve fitting"
              className="w-full"
              value={value.curveMode}
              onChange={(curveMode) => onChange({ ...value, curveMode })}
              options={[
                { value: "spline", label: "Spline", title: "Smooth Bézier curves" },
                { value: "polygon", label: "Polygon", title: "Straight segments" },
                { value: "pixel", label: "Pixel", title: "Keeps the pixel grid" },
              ]}
            />
          </div>
          {VEC_SLIDERS.map((s) => (
            <Slider
              key={s.key}
              label={s.label}
              hint={s.hint}
              min={s.min}
              max={s.max}
              value={value[s.key] as number}
              format={(v) => `${v}${s.unit ?? ""}`}
              onChange={(v) => onChange({ ...value, [s.key]: v })}
            />
          ))}
          <Button size="sm" variant="ghost" icon={<IconRefresh />} disabled={isDefault} onClick={() => onChange(DEFAULT_VECTORIZE)}>
            Reset to defaults
          </Button>
        </div>
      </Disclosure>
    </div>
  );
}
