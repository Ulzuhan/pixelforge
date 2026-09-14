"use client";

/**
 * El resultado: descargar, copiar, abrir, y lo que se sabe de él.
 *
 * La descarga es un enlace con `download` sobre el mismo blob: que vive
 * mientras vive el resultado, así que no hay que fabricar otro y revocarlo.
 */
import { Fragment } from "react";
import { Button } from "../ui";
import { IconCheck, IconCopy, IconDownload, IconExternal, IconTrash } from "../icons";
import type { JobResult } from "./use-job";
import { formatBytes, formatDims, formatSeconds } from "./format";

export function ResultCard({ result, onCopy, onClear }: { result: JobResult; onCopy: () => void; onClear: () => void }) {
  const rows: Array<[string, string]> = [
    ["Format", result.kind === "png" ? "PNG · transparent" : "SVG"],
    ["Size", formatBytes(result.bytes)],
  ];
  if (result.width && result.height) rows.push(["Dimensions", formatDims(result.width, result.height)]);
  if (result.paths !== undefined) rows.push(["Paths", result.paths.toLocaleString()]);
  rows.push(["Took", formatSeconds(result.ms)], ["Settings", result.summary]);

  return (
    <section className="panel pop overflow-hidden border-ok/25" aria-label="Result">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ok/15 text-ok">
          <IconCheck />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{result.mode === "removebg" ? "Background removed" : "Vectorized"}</p>
          <p className="truncate font-mono text-xs text-ink-3" title={result.filename}>{result.filename}</p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <a href={result.url} download={result.filename} className="btn btn-primary btn-lg w-full">
          <IconDownload /> Download {result.kind.toUpperCase()}
        </a>
        <div className="grid grid-cols-3 gap-2">
          <Button size="sm" icon={<IconCopy />} onClick={onCopy} title={result.kind === "svg" ? "Copy the SVG markup" : "Copy the image"}>
            Copy
          </Button>
          <a href={result.url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" title="Open at full size in a new tab">
            <IconExternal /> Open
          </a>
          <Button size="sm" variant="ghost" icon={<IconTrash />} onClick={onClear} title="Discard this result">
            Clear
          </Button>
        </div>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 border-t border-line pt-3 text-xs">
          {rows.map(([k, v]) => (
            <Fragment key={k}>
              <dt className="text-ink-3">{k}</dt>
              <dd className="truncate text-right font-mono text-ink-2" title={v}>{v}</dd>
            </Fragment>
          ))}
        </dl>
      </div>
    </section>
  );
}
