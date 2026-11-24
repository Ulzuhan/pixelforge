"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0b0d14",
          color: "#edf0f7",
          fontFamily: "system-ui, sans-serif",
          padding: "2rem",
        }}
      >
        <main style={{ maxWidth: "24rem", textAlign: "center" }}>
          <p style={{ fontSize: "0.8rem", letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.65 }}>
            500
          </p>
          <h1 style={{ fontSize: "1.45rem", fontWeight: 600, margin: "0.5rem 0 0.6rem" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "0.95rem", opacity: 0.78, margin: "0 0 1.5rem" }}>
            An unexpected error occurred while loading Pixelforge.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                padding: "0.6rem 1.1rem",
                borderRadius: "0.65rem",
                border: "none",
                background: "#45e0f5",
                color: "#04121a",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                padding: "0.6rem 1.1rem",
                borderRadius: "0.65rem",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#edf0f7",
                textDecoration: "none",
              }}
            >
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
