"use client";

import { useEffect, useState, type ReactNode } from "react";
import { IconArrow } from "./icons";

type SessionState =
  | { kind: "continue"; name: string }
  | { kind: "pending" | "requestable" | "invite_only"; name: string; accountUrl: string };

const SIGNED_OUT_KEY = "kc_signed_out";
const ATTEMPTED_KEY = "kc_sso_attempted";
const COOLDOWN_MS = 60_000;

function readStorage(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {}
}

function clearStorage(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {}
}

export function LandingSession({
  sessionUrl,
  loginHref = "/api/auth/login",
  children,
}: {
  sessionUrl?: string | null;
  loginHref?: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<SessionState | null>(null);

  useEffect(() => {
    if (!sessionUrl) return;
    let cancelled = false;

    const url = new URL(window.location.href);
    if (url.searchParams.get("signed_out") === "1") {
      writeStorage(SIGNED_OUT_KEY, "1");
      url.searchParams.delete("signed_out");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }

    const signinError = url.searchParams.has("error");
    const attemptedAt = Number(readStorage(ATTEMPTED_KEY) || "0");
    const suppressed =
      signinError ||
      readStorage(SIGNED_OUT_KEY) === "1" ||
      (Number.isFinite(attemptedAt) && attemptedAt > 0 && Date.now() - attemptedAt < COOLDOWN_MS);

    const signal =
      typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(4000)
        : undefined;

    fetch(sessionUrl, { credentials: "include", cache: "no-store", signal })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          s: {
            signed_in?: boolean;
            name?: string;
            tool_access?: string;
            account_url?: string;
          } | null
        ) => {
          if (cancelled || !s?.signed_in) return;
          const name = String(s.name || "account").slice(0, 40);
          const accountUrl =
            typeof s.account_url === "string" && s.account_url
              ? s.account_url
              : new URL("/", sessionUrl).toString();

          if (s.tool_access === "granted") {
            if (!suppressed) {
              writeStorage(ATTEMPTED_KEY, String(Date.now()));
              window.location.replace(loginHref);
              return;
            }
            setState({ kind: "continue", name });
            return;
          }

          if (
            s.tool_access === "pending" ||
            s.tool_access === "requestable" ||
            s.tool_access === "invite_only"
          ) {
            setState({ kind: s.tool_access, name, accountUrl });
          }
        }
      )
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [sessionUrl, loginHref]);

  if (!state) return <>{children}</>;

  const clearSuppression = () => {
    clearStorage(SIGNED_OUT_KEY);
    clearStorage(ATTEMPTED_KEY);
  };

  if (state.kind === "continue") {
    return (
      <>
        <div className="rise rise-3 mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
          <a href={loginHref} onClick={clearSuppression} className="btn btn-primary btn-lg">
            Continue as {state.name} <IconArrow />
          </a>
        </div>
        <p className="rise rise-4 mt-3 text-xs text-ink-3">Signed in to your KaiCorp Labs account.</p>
      </>
    );
  }

  const label =
    state.kind === "requestable"
      ? "Ask for access"
      : state.kind === "pending"
        ? "View request"
        : "Your account";
  const note =
    state.kind === "pending"
      ? "Waiting for approval"
      : state.kind === "invite_only"
        ? "By invitation only"
        : "";

  return (
    <>
      <div className="rise rise-3 mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
        <a
          href={state.accountUrl}
          className={`btn btn-lg ${state.kind === "requestable" ? "btn-primary" : "btn-secondary"}`}
        >
          {label} <IconArrow />
        </a>
      </div>
      <p className="rise rise-4 mt-3 text-xs text-ink-3">
        Signed in as {state.name}
        {note ? ` · ${note}` : ""}
      </p>
    </>
  );
}
