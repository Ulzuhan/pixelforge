import Link from "next/link";

/**
 * What somebody without a session sees.
 *
 * Server-rendered, no client JavaScript: it is the first thing a stranger
 * loads and there is nothing here that needs hydrating to be useful.
 */
export function Landing() {
  return (
    <main className="flex-1">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-3xl px-4 pt-14 pb-16 text-center sm:pt-24 sm:pb-20">
        <h1 className="text-4xl font-bold sm:text-5xl">
          <span className="text-accent">Pixel</span>forge
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          Cut the background out of a photo, or turn a logo into a vector that
          scales to any size. Both run on our own machine — your images are not
          uploaded to anyone else&apos;s service, and nothing is kept afterwards.
        </p>

        <Link
          href="/api/auth/login"
          className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-accent px-7 text-base font-medium text-background transition-opacity hover:opacity-90"
        >
          Sign in to start
        </Link>
        <p className="mt-3 text-xs text-muted">
          Accounts are approved by hand. Ask and you get let in.
        </p>
      </section>

      {/* ── Las dos herramientas ─────────────────────────────────────── */}
      <section className="border-t border-white/5 bg-surface/30">
        <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:py-20">
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-xl border border-white/5 bg-surface/60 p-5">
              <p className="text-xs uppercase tracking-wider text-accent">Remove background</p>
              <h2 className="mt-2 text-lg font-semibold">Cut-outs that keep the hair</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Four models to pick from, and alpha matting for the edges that
                usually come out looking chewed. Out comes a PNG with real
                transparency.
              </p>
            </article>

            <article className="rounded-xl border border-white/5 bg-surface/60 p-5">
              <p className="text-xs uppercase tracking-wider text-accent">Vectorize</p>
              <h2 className="mt-2 text-lg font-semibold">From pixels to curves</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Turn a logo or a drawing into an SVG you can print at any size
                without it going soft. Colour or black and white, with the knobs
                exposed if you want them.
              </p>
            </article>
          </div>

          <p className="mt-8 text-center text-sm text-muted">
            Nothing is stored: the image is processed and the result handed
            straight back to your browser.
          </p>
        </div>
      </section>
    </main>
  );
}
