"use client";

/**
 * Las piezas pequeñas de la interfaz: botón, control segmentado, interruptor,
 * deslizador, tarjeta de opción y desplegable.
 *
 * Todas con semántica ARIA de verdad —radiogroup, switch, slider— y manejo de
 * teclado, para que la herramienta se pueda usar entera sin ratón. Los estilos
 * viven en globals.css bajo el mismo nombre que la clase.
 */
import { useId, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { IconChevron } from "./icons";

/* ── Botón ─────────────────────────────────────────────────────────────── */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  loading?: boolean;
};

export function Button({ variant = "secondary", size = "md", icon, loading, className = "", children, disabled, type = "button", ...rest }: ButtonProps) {
  const sizeClass = size === "lg" ? "btn-lg" : size === "sm" ? "btn-sm" : "";
  return (
    <button type={type} className={`btn btn-${variant} ${sizeClass} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="spinner" aria-hidden /> : icon}
      {children}
    </button>
  );
}

/* ── Control segmentado ────────────────────────────────────────────────── */
export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  title?: string;
}

export function Segmented<T extends string>({ value, onChange, options, label, size = "md", className = "" }: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  label: string;
  size?: "md" | "lg";
  className?: string;
}) {
  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = options.findIndex((o) => o.value === value);
    if (index < 0) return;
    let next = index;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    else return;
    e.preventDefault();
    onChange(options[next].value);
    const target = (e.currentTarget.children[next] as HTMLElement | undefined);
    target?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={`seg ${size === "lg" ? "seg-mode" : ""} ${className}`} onKeyDown={move}>
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            title={o.title}
            onClick={() => onChange(o.value)}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Interruptor ───────────────────────────────────────────────────────── */
export function Switch({ checked, onChange, label, hint, disabled }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-ink cursor-pointer">{label}</label>
        {hint && <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{hint}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className="switch mt-0.5 disabled:opacity-50"
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}

/* ── Deslizador ────────────────────────────────────────────────────────── */
export function Slider({ label, hint, value, min, max, step = 1, onChange, format }: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  const id = useId();
  const fill = `${((value - min) / (max - min)) * 100}%`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
        <output htmlFor={id} className="font-mono text-xs tabular-nums text-accent">{format ? format(value) : value}</output>
      </div>
      {hint && <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{hint}</p>}
      <input
        id={id}
        type="range"
        className="range mt-1"
        style={{ "--fill": fill } as React.CSSProperties}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

/* ── Tarjeta de opción (radio con descripción) ─────────────────────────── */
export function Choice({ checked, onSelect, title, blurb, tag, tagTone }: {
  checked: boolean;
  onSelect: () => void;
  title: ReactNode;
  blurb?: ReactNode;
  tag?: string;
  tagTone?: "accent" | "ok";
}) {
  return (
    <button type="button" role="radio" aria-checked={checked} className="choice" onClick={onSelect}>
      <span className="choice-dot" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-ink">{title}</span>
          {tag && <span className={`tag ${tagTone === "accent" ? "tag-accent" : tagTone === "ok" ? "tag-ok" : ""}`}>{tag}</span>}
        </span>
        {blurb && <span className="mt-0.5 block text-xs leading-relaxed text-ink-3">{blurb}</span>}
      </span>
    </button>
  );
}

/* ── Desplegable ───────────────────────────────────────────────────────── */
export function Disclosure({ open, onToggle, label, summary, children }: {
  open: boolean;
  onToggle: () => void;
  label: string;
  summary?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="rounded-xl border border-line bg-bg-2/60">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm font-medium text-ink-2 transition-colors hover:text-ink"
      >
        <span className="flex items-center gap-2">{label}{summary}</span>
        <IconChevron className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div id={id} className="space-y-4 border-t border-line px-3.5 pb-4 pt-3.5">{children}</div>}
    </div>
  );
}

/* ── Atajo de teclado ─────────────────────────────────────────────────── */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}
