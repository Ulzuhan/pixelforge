"use client";

/**
 * Un trabajo: subir la imagen, esperar al servidor, y quedarse con el resultado.
 *
 * XHR y no fetch porque es lo único que da el progreso de subida, y una foto de
 * 40 MB por una conexión móvil tarda lo suyo: sin barra, la gente asume que se
 * ha colgado y recarga. Cuando la subida termina, el servidor arranca un Python
 * que puede tardar de segundos a minutos; esa fase no tiene progreso real, y
 * aquí se dice así —"en marcha, N segundos"— en vez de inventar un porcentaje.
 *
 * Los errores llegan como JSON `{ error }` dentro de un Blob (porque el tipo de
 * respuesta pedido es blob), y cada código de estado significa algo distinto
 * para quien lo recibe: 401 es "vuelve a entrar", 503 es "espera 30 segundos",
 * 413 es "esa imagen no", y así se cuentan.
 */
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import type { Mode } from "./settings";
import { baseName, imageDims, svgInfo } from "./format";

export type JobStatus = "idle" | "uploading" | "processing" | "done" | "error";

export interface JobError {
  message: string;
  status?: number;
  /** Cuándo merece la pena reintentar (ms desde epoch), si el servidor lo dijo. */
  retryAt?: number;
  signIn?: boolean;
}

export interface JobResult {
  mode: Mode;
  blob: Blob;
  url: string;
  kind: "png" | "svg";
  filename: string;
  width?: number;
  height?: number;
  paths?: number;
  bytes: number;
  ms: number;
  /** Con qué ajustes se hizo, para saber si los de ahora son otros. */
  settingsKey: string;
  /** Los mismos ajustes, dichos en una línea. */
  summary: string;
}

interface JobState {
  status: JobStatus;
  /** Progreso de la subida, 0–1. */
  progress: number;
  startedAt: number | null;
  result: JobResult | null;
  error: JobError | null;
}

const IDLE: JobState = { status: "idle", progress: 0, startedAt: null, result: null, error: null };

export interface RunArgs {
  file: File;
  mode: Mode;
  fields: Record<string, string>;
  settingsKey: string;
  summary: string;
}

function describe(status: number, serverMessage: string | null, retryAfter: string | null): JobError {
  const seconds = Number(retryAfter);
  const retryAt = Number.isFinite(seconds) && seconds > 0 ? Date.now() + seconds * 1000 : undefined;
  switch (status) {
    case 401:
      return { status, signIn: true, message: "Your session has expired. Sign in again to keep going." };
    case 403:
      return { status, message: "The request was rejected as cross-origin. Reload the page and try again." };
    case 429:
      return { status, retryAt, message: "You have hit this account's hourly limit." };
    case 503:
      return { status, retryAt: retryAt ?? Date.now() + 30_000, message: "The machine is busy with other jobs right now." };
    default:
      return { status, message: serverMessage || `Processing failed (HTTP ${status}).` };
  }
}

export function useJob() {
  const [state, setState] = useState<JobState>(IDLE);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const previousUrl = state.result?.url ?? null;

  const run = useCallback(
    ({ file, mode, fields, settingsKey, summary }: RunArgs) => {
      xhrRef.current?.abort();
      if (previousUrl) URL.revokeObjectURL(previousUrl);

      const startedAt = Date.now();
      setState({ status: "uploading", progress: 0, startedAt, result: null, error: null });

      const body = new FormData();
      body.append("file", file);
      for (const [k, v] of Object.entries(fields)) body.append(k, v);

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.responseType = "blob";
      // Un poco por encima de los tres minutos que el servidor concede al
      // proceso: si algo caduca, que sea su mensaje el que llegue, no el nuestro.
      xhr.timeout = 190_000;

      const fail = (error: JobError) => setState({ status: "error", progress: 0, startedAt, result: null, error });

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setState((s) => (s.status === "uploading" ? { ...s, progress: e.loaded / e.total } : s));
      };
      xhr.upload.onload = () => setState((s) => (s.status === "uploading" ? { ...s, status: "processing", progress: 1 } : s));
      xhr.onerror = () => fail({ message: "The connection dropped before the server answered. Check the network and try again." });
      xhr.ontimeout = () => fail({ message: "This took longer than three minutes and was stopped. Try a smaller image or a lighter model." });
      xhr.onabort = () => setState(IDLE);
      xhr.onload = async () => {
        if (xhrRef.current === xhr) xhrRef.current = null;
        const blob = xhr.response as Blob;
        if (xhr.status < 200 || xhr.status >= 300) {
          let message: string | null = null;
          try {
            const parsed = JSON.parse(await blob.text());
            message = typeof parsed?.error === "string" ? parsed.error : null;
          } catch {
            message = null;
          }
          fail(describe(xhr.status, message, xhr.getResponseHeader("Retry-After")));
          return;
        }

        const kind: JobResult["kind"] = mode === "vectorize" || blob.type.includes("svg") ? "svg" : "png";
        const url = URL.createObjectURL(blob);
        const result: JobResult = {
          mode,
          blob,
          url,
          kind,
          filename: `${baseName(file.name)}${mode === "removebg" ? "-nobg.png" : ".svg"}`,
          bytes: blob.size,
          ms: Date.now() - startedAt,
          settingsKey,
          summary,
        };
        try {
          if (kind === "png") {
            Object.assign(result, await imageDims(url));
          } else {
            Object.assign(result, svgInfo(await blob.text()));
          }
        } catch {
          // Sin dimensiones se puede vivir; sin resultado, no.
        }
        setState({ status: "done", progress: 1, startedAt, result, error: null });
      };

      xhr.open("POST", mode === "removebg" ? "/api/removebg" : "/api/vectorize");
      xhr.send(body);
    },
    [previousUrl]
  );

  const cancel = useCallback(() => {
    xhrRef.current?.abort();
    xhrRef.current = null;
  }, []);

  const clear = useCallback(() => {
    xhrRef.current?.abort();
    xhrRef.current = null;
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    setState(IDLE);
  }, [previousUrl]);

  const busy = state.status === "uploading" || state.status === "processing";
  return { ...state, busy, run, cancel, clear };
}

/* ── Un reloj que sólo corre mientras alguien lo mira ──────────────────── */
const listeners = new Set<() => void>();
let ticker: ReturnType<typeof setInterval> | null = null;
let last = 0;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!ticker) {
    last = Date.now();
    ticker = setInterval(() => {
      last = Date.now();
      listeners.forEach((l) => l());
    }, 250);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  };
}
const snapshot = () => last;
const serverSnapshot = () => 0;
const noop = () => () => {};

/** La hora, a cuartos de segundo, y sólo mientras `active`; 0 si no. */
export function useNow(active: boolean): number {
  return useSyncExternalStore(active ? subscribe : noop, active ? snapshot : serverSnapshot, serverSnapshot);
}
