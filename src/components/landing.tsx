import Link from "next/link";

/**
 * What somebody without a session sees.
 *
 * Server-rendered, no client JavaScript: it is the first thing a stranger
 * loads and there is nothing here that needs hydrating to be useful.
 *
 * The demo is an inline SVG rather than a screenshot: this tool is about what
 * happens to an image, and the before/after says it in one glance — with the
 * checkerboard doing the work of explaining "transparent" to people who have
 * never had to think about alpha channels.
 */
/**
 * `enrollUrl` —dónde se pide cuenta— llega por parámetro y sale del entorno. Estaba
 * escrito a fuego aquí, apuntando al Authentik de quien escribió esto, en un repositorio
 * con licencia MIT: quien lo desplegara mandaba a sus visitantes a pedir cuenta en casa
 * ajena. Sin él no hay botón de alta y la portada se reordena: entrar pasa a ser la
 * acción principal, que es la única que lleva a alguna parte.
 */
export function Landing({ enrollUrl }: { enrollUrl?: string | null }) {
  return (
    <main className="kc-product-landing flex-1">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-5xl overflow-x-clip px-5 pt-12 pb-16 sm:pt-20 sm:pb-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="text-center lg:text-left">
            <span className="inline-block rounded-full border border-white/10 bg-surface px-3 py-1 text-xs text-muted">
              Runs on our machine · nothing is kept
            </span>

            <h1 className="mt-5 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              <span className="text-accent">Pixel</span>forge
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-[17px] lg:mx-0">
              Cut the background out of a photo, or turn a logo into a vector
              that scales to a billboard. Two jobs that normally cost a
              subscription and hand your images to somebody else&apos;s server.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              {enrollUrl && (
                <Link
                  href={enrollUrl}
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-accent px-7 text-base font-medium text-background transition-opacity hover:opacity-90"
                >
                  Request an account
                </Link>
              )}
              <Link
                href="/api/auth/login"
                prefetch={false}
                className={
                  enrollUrl
                    ? "inline-flex h-12 items-center justify-center rounded-xl border border-white/12 px-7 text-base font-medium transition-colors hover:bg-surface"
                    : "inline-flex h-12 items-center justify-center rounded-xl bg-accent px-7 text-base font-medium text-background transition-opacity hover:opacity-90"
                }
              >
                Sign in
              </Link>
            </div>
            {/* Sin nombrar a nuestro proveedor —esto lo lee quien despliegue PixelForge
                en su casa— y solo cuando hay un alta que ofrecer. Que las cuentas se
                aprueben a mano es política de cada instancia, no de la aplicación. */}
            {enrollUrl && (
              <p className="mt-3 text-xs text-muted">
                Already have an account? That same button is where you ask for access to
                this one.
              </p>
            )}
          </div>

          <DemoCard />
        </div>
      </section>

      {/* ── Las dos herramientas ─────────────────────────────────────── */}
      <section className="border-t border-white/5 bg-surface/30">
        <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:py-20">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted">
            Two tools
          </h2>

          <div className="kc-card-grid mt-8 grid gap-4 sm:grid-cols-2">
            <article className="rounded-xl border border-white/5 bg-surface/60 p-5">
              <p className="font-mono text-xs uppercase tracking-wider text-accent">
                remove background
              </p>
              <h3 className="mt-2 text-lg font-semibold">Cut-outs that keep the hair</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Four models to choose from, and alpha matting for the edges that
                usually come out chewed. Out comes a PNG with real transparency,
                ready to drop onto anything.
              </p>
            </article>

            <article className="rounded-xl border border-white/5 bg-surface/60 p-5">
              <p className="font-mono text-xs uppercase tracking-wider text-accent">
                vectorize
              </p>
              <h3 className="mt-2 text-lg font-semibold">From pixels to curves</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                A logo or a drawing becomes an SVG you can print at any size
                without it going soft. Colour or black and white, with the knobs
                exposed if you want to argue with the defaults.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ── Por qué aquí ─────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-5xl px-5 py-16 sm:py-20">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">
          Why not one of the free ones
        </h2>

        <div className="kc-card-grid mt-8 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon, title, body }) => (
            <div key={title}>
              <div className="flex size-9 items-center justify-center rounded-xl bg-accent/10 text-lg">
                {icon}
              </div>
              <h3 className="mt-3.5 font-medium">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Cierre ───────────────────────────────────────────────────── */}
      <section className="border-t border-white/5">
        <div className="mx-auto w-full max-w-5xl px-5 py-16 text-center sm:py-24">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Drop an image in and see
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted">
            The first cut-out takes a few seconds while the model loads. After
            that they come back almost as fast as you can pick the next file.
          </p>
          <Link
            href={enrollUrl ?? "/api/auth/login"}
            className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-accent px-7 text-base font-medium text-background transition-opacity hover:opacity-90"
          >
            {enrollUrl ? "Request an account" : "Sign in"}
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}

const FEATURES = [
  {
    icon: "🚫",
    title: "No watermark, no upsell",
    body: "The free ones give you a 500-pixel preview and ask for a card to see the rest. This gives you the file.",
  },
  {
    icon: "🖼",
    title: "Full resolution",
    body: "Whatever you put in comes back the same size. Nothing is downscaled to save somebody else's bandwidth.",
  },
  {
    icon: "🗑",
    title: "Your images are not kept",
    body: "The file is processed and the result handed straight back. Nothing is filed under your name, because there is no file to keep.",
  },
  {
    icon: "🎛",
    title: "The controls are yours",
    body: "Model, alpha matting, colour precision, speckle filtering. Defaults that work, and knobs when they do not.",
  },
  {
    icon: "⚡",
    title: "No queue",
    body: "One machine, a handful of people. You are not waiting behind ten thousand strangers on a free tier.",
  },
  {
    icon: "🔒",
    title: "Only people you let in",
    body: "Accounts are approved by hand, which is also what keeps the CPU from becoming a free service for the internet.",
  },
];

/**
 * Antes y después, en un SVG en línea.
 *
 * El damero es el que dibuja la idea de "transparente" para quien nunca ha
 * tenido que pensar en canales alfa; sin él, el después parece simplemente un
 * fondo blanco.
 */
function DemoCard() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 -z-10 rounded-[3rem] opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 40%, color-mix(in oklch, var(--accent) 22%, transparent), transparent 70%)",
        }}
      />

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <p className="text-sm font-medium">Remove background</p>
          <span className="font-mono text-[10px] uppercase tracking-wider text-accent">
            isnet · 3.4s
          </span>
        </div>

        <div className="grid grid-cols-2">
          <figure className="border-r border-white/10 p-4">
            <svg viewBox="0 0 120 120" className="w-full rounded-lg" role="img" aria-label="Photo with its background">
              <rect width="120" height="120" fill="#3b5b7a" />
              <circle cx="96" cy="26" r="13" fill="#f2c85b" />
              <path d="M0 96 L34 60 L64 96 Z" fill="#2c4459" />
              <path d="M52 100 L86 56 L120 100 Z" fill="#24384a" />
              <ellipse cx="60" cy="112" rx="26" ry="6" fill="#1b2b3a" />
              <circle cx="60" cy="52" r="16" fill="#e8b48c" />
              <path d="M40 116 q20 -34 40 0 Z" fill="#c9553d" />
            </svg>
            <figcaption className="mt-2 text-center text-[11px] text-muted">before</figcaption>
          </figure>

          <figure className="p-4">
            <svg viewBox="0 0 120 120" className="w-full rounded-lg" role="img" aria-label="The same subject, background removed">
              <defs>
                <pattern id="checker" width="12" height="12" patternUnits="userSpaceOnUse">
                  <rect width="12" height="12" fill="#f4f4f5" />
                  <rect width="6" height="6" fill="#d9d9de" />
                  <rect x="6" y="6" width="6" height="6" fill="#d9d9de" />
                </pattern>
              </defs>
              <rect width="120" height="120" fill="url(#checker)" />
              <circle cx="60" cy="52" r="16" fill="#e8b48c" />
              <path d="M40 116 q20 -34 40 0 Z" fill="#c9553d" />
            </svg>
            <figcaption className="mt-2 text-center text-[11px] text-muted">after · PNG</figcaption>
          </figure>
        </div>

        <div className="border-t border-white/10 bg-background/40 px-5 py-3 text-center">
          <p className="font-mono text-[11px] text-muted">
            1 image in · 1 image out · 0 stored
          </p>
        </div>
      </div>
    </div>
  );
}
