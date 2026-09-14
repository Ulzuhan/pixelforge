"use client";

/**
 * Lo primero que se ve: dónde dejar la imagen.
 *
 * Es un botón grande de verdad —teclado incluido— y no sólo un rectángulo que
 * escucha `drop`. El arrastre se captura en toda la ventana desde `tool.tsx`;
 * esto sólo lo dibuja.
 */
import { Kbd } from "../ui";
import { IconShield } from "../icons";

const FORMATS = ["PNG", "JPEG", "WebP", "BMP", "TIFF"];

export function Dropzone({ onOpen, active }: { onOpen: () => void; active: boolean }) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Add an image"
      data-active={active}
      className="dropzone grid min-h-[clamp(400px,calc(100vh-11.5rem),816px)] place-items-center p-8 sm:p-12"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="max-w-md text-center">
        <Illustration />
        <h2 className="mt-8 text-2xl font-semibold sm:text-3xl">Drop an image here</h2>
        <p className="mt-2 text-ink-2">
          or <span className="text-accent underline decoration-accent/40 underline-offset-4">browse your files</span>, or paste one with <Kbd>⌘ V</Kbd>
        </p>
        <ul className="mt-6 flex flex-wrap justify-center gap-1.5" aria-label="Accepted formats">
          {FORMATS.map((f) => (
            <li key={f} className="tag">{f}</li>
          ))}
          <li className="tag tag-accent">up to 50 MB</li>
        </ul>
        <p className="mt-8 inline-flex items-center gap-1.5 text-xs text-ink-3">
          <IconShield className="text-ok" /> Processed on this machine. Nothing is kept afterwards.
        </p>
      </div>
    </div>
  );
}

function Illustration() {
  return (
    <svg viewBox="0 0 180 130" className="float mx-auto w-44" aria-hidden>
      <defs>
        <pattern id="dz-checker" width="14" height="14" patternUnits="userSpaceOnUse">
          <rect width="14" height="14" fill="#f3f4f6" />
          <rect width="7" height="7" fill="#d9dce3" />
          <rect x="7" y="7" width="7" height="7" fill="#d9dce3" />
        </pattern>
        <linearGradient id="dz-ember" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffc247" />
          <stop offset="1" stopColor="#ff6a3d" />
        </linearGradient>
        <clipPath id="dz-frame">
          <rect x="30" y="16" width="120" height="90" rx="12" />
        </clipPath>
      </defs>
      <rect x="22" y="26" width="120" height="90" rx="12" fill="var(--surface-3)" opacity=".6" transform="rotate(-4 82 71)" />
      <rect x="30" y="16" width="120" height="90" rx="12" fill="url(#dz-checker)" stroke="var(--line-2)" />
      <g clipPath="url(#dz-frame)">
        <circle cx="90" cy="54" r="17" fill="url(#dz-ember)" />
        <path d="M52 106c4-24 20-32 38-32s34 8 38 32z" fill="url(#dz-ember)" />
      </g>
      <circle cx="146" cy="100" r="18" fill="var(--accent)" />
      <path d="M146 109V92m0 0-6 6m6-6 6 6" stroke="#1a0c02" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
