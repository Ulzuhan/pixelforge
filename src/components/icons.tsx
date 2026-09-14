/**
 * Iconos de línea, dibujados aquí.
 *
 * Sin librería a propósito: la CSP de esta aplicación no admite scripts de
 * terceros y un paquete de iconos entero para veinte trazos es más superficie
 * que código. Todos heredan `currentColor` y se miden en `em`, así que siguen
 * al texto que acompañan.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };

function Icon({ size = "1em", children, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconUpload = (p: IconProps) => (
  <Icon {...p}><path d="M12 16V4m0 0 4 4m-4-4-4 4" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></Icon>
);
export const IconImage = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-8 9" /></Icon>
);
export const IconScissors = (p: IconProps) => (
  <Icon {...p}><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" /></Icon>
);
export const IconBezier = (p: IconProps) => (
  <Icon {...p}><path d="M4 18c6 0 4-12 10-12" /><circle cx="4" cy="18" r="2" /><circle cx="14" cy="6" r="2" /><path d="M14 6h6M4 18H2" strokeDasharray="2 2" /></Icon>
);
export const IconDownload = (p: IconProps) => (
  <Icon {...p}><path d="M12 4v12m0 0 4-4m-4 4-4-4" /><path d="M4 17v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" /></Icon>
);
export const IconCopy = (p: IconProps) => (
  <Icon {...p}><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" /></Icon>
);
export const IconCheck = (p: IconProps) => (
  <Icon {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>
);
export const IconX = (p: IconProps) => (
  <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>
);
export const IconSliders = (p: IconProps) => (
  <Icon {...p}><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></Icon>
);
export const IconSparkles = (p: IconProps) => (
  <Icon {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></Icon>
);
export const IconAlert = (p: IconProps) => (
  <Icon {...p}><path d="M12 4 2.5 20h19z" /><path d="M12 10v4M12 17.5v.5" /></Icon>
);
export const IconRefresh = (p: IconProps) => (
  <Icon {...p}><path d="M20 12a8 8 0 0 1-14.2 5M4 12a8 8 0 0 1 14.2-5" /><path d="M18 3v4h-4M6 21v-4h4" /></Icon>
);
export const IconExternal = (p: IconProps) => (
  <Icon {...p}><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></Icon>
);
export const IconChevron = (p: IconProps) => (
  <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>
);
export const IconArrowsH = (p: IconProps) => (
  <Icon {...p}><path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" /></Icon>
);
export const IconLock = (p: IconProps) => (
  <Icon {...p}><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></Icon>
);
export const IconZap = (p: IconProps) => (
  <Icon {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></Icon>
);
export const IconMaximize = (p: IconProps) => (
  <Icon {...p}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></Icon>
);
export const IconShield = (p: IconProps) => (
  <Icon {...p}><path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6z" /><path d="m9.5 12 2 2 3.5-4" /></Icon>
);
export const IconArrow = (p: IconProps) => (
  <Icon {...p}><path d="M4 12h16m-6-6 6 6-6 6" /></Icon>
);
export const IconTrash = (p: IconProps) => (
  <Icon {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></Icon>
);
