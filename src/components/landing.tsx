import Link from "next/link";
import {
  IconArrow,
  IconArrowsH,
  IconBezier,
  IconLock,
  IconMaximize,
  IconScissors,
  IconShield,
  IconSliders,
  IconSparkles,
  IconZap,
} from "./icons";

/**
 * Lo que ve quien no tiene sesión.
 *
 * Servida desde el servidor y sin JavaScript de cliente: es lo primero que carga
 * un desconocido y nada de esto necesita hidratarse para ser útil. El antes y
 * después de la portada es un barrido animado sólo con CSS.
 *
 * `enrollUrl` —dónde se pide cuenta— llega por parámetro y sale del entorno. Sin
 * él no hay botón de alta y entrar pasa a ser la acción principal, que es la
 * única que lleva a alguna parte.
 */
export function Landing({ enrollUrl }: { enrollUrl?: string | null }) {
  return (
    <main className="relative flex-1 overflow-x-clip">
      <div className="landing-bg" aria-hidden />
      <SubjectSymbol />

      {/* ── Portada ─────────────────────────────────────────────────────── */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-28 lg:pt-24">
        <div className="text-center lg:text-left">
          <p className="eyebrow rise inline-flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden />
            Self-hosted · nothing stored
          </p>
          <h1 className="rise rise-1 mt-5 text-balance text-[2.6rem] font-bold leading-[1.02] tracking-tight sm:text-6xl lg:text-[4.3rem]">
            Cut the background out. <span className="text-ember">Keep every hair.</span>
          </h1>
          <p className="rise rise-2 mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-ink-2 sm:text-lg lg:mx-0">
            Or turn a flat logo into a vector that scales to a billboard. Two jobs that normally cost a subscription and hand your
            images to somebody else&apos;s server. This one runs on our machine and keeps nothing.
          </p>

          <div className="rise rise-3 mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            {enrollUrl && (
              <a href={enrollUrl} className="btn btn-primary btn-lg">
                Request an account <IconArrow />
              </a>
            )}
            <Link href="/api/auth/login" prefetch={false} className={`btn btn-lg ${enrollUrl ? "btn-secondary" : "btn-primary"}`}>
              Sign in
            </Link>
          </div>
          {enrollUrl && (
            <p className="rise rise-4 mt-3 text-xs text-ink-3">Accounts are approved by hand. That same button is where you ask for one.</p>
          )}

          <ul className="rise rise-4 mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-ink-2 lg:justify-start">
            {["Full resolution", "No watermark", "Nothing kept"].map((t) => (
              <li key={t} className="inline-flex items-center gap-2">
                <span className="grid size-4 place-items-center rounded-full bg-ok/15 text-ok" aria-hidden>
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="rise rise-2">
          <DemoCard />
        </div>
      </section>

      {/* ── Las dos herramientas ────────────────────────────────────────── */}
      <section className="border-t border-line bg-bg-2/60">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
          <p className="eyebrow">Two tools</p>
          <h2 className="mt-3 max-w-2xl text-balance text-3xl font-semibold sm:text-4xl">One image in, one file out.</h2>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <article className="panel card-hover relative overflow-hidden p-6 sm:p-7">
              <div className="flex items-center gap-3">
                <span className="feature-icon"><IconScissors /></span>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">Remove background</p>
              </div>
              <h3 className="mt-5 text-2xl font-semibold">Cut-outs that keep the hair</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-2">
                Four models to choose from, and alpha matting for the edges that usually come out chewed. Out comes a PNG with
                real transparency, ready to drop onto anything.
              </p>
              <ul className="mt-5 space-y-1.5 text-sm text-ink-2">
                {["ISNet, U²-Net, Silueta or U²-Net Lite", "Alpha matting for hair, fur and glass", "Mask clean-up for holes and specks"].map((t) => (
                  <li key={t} className="flex items-center gap-2"><span className="size-1 rounded-full bg-accent" aria-hidden />{t}</li>
                ))}
              </ul>
              <CutoutArt />
            </article>

            <article className="panel card-hover relative overflow-hidden p-6 sm:p-7">
              <div className="flex items-center gap-3">
                <span className="feature-icon"><IconBezier /></span>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-accent">Vectorize</p>
              </div>
              <h3 className="mt-5 text-2xl font-semibold">From pixels to curves</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-2">
                A logo or a drawing becomes an SVG you can print at any size without it going soft. Colour or black and white,
                with every knob exposed if you want to argue with the defaults.
              </p>
              <ul className="mt-5 space-y-1.5 text-sm text-ink-2">
                {["Smooth, sharp or poster presets", "Splines, polygons or the pixel grid", "Colour precision, speckle filter and more"].map((t) => (
                  <li key={t} className="flex items-center gap-2"><span className="size-1 rounded-full bg-accent" aria-hidden />{t}</li>
                ))}
              </ul>
              <VectorArt />
            </article>
          </div>
        </div>
      </section>

      {/* ── Cómo va ─────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
        <p className="eyebrow">How it works</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="panel p-6">
              <p className="font-mono text-xs text-accent">0{i + 1}</p>
              <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Por qué aquí ────────────────────────────────────────────────── */}
      <section className="border-t border-line bg-bg-2/60">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
          <p className="eyebrow">Why not one of the free ones</p>
          <h2 className="mt-3 max-w-2xl text-balance text-3xl font-semibold sm:text-4xl">Because the free ones are not.</h2>
          <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon, title, body }) => (
              <div key={title}>
                <span className="feature-icon">{icon}</span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cierre ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-line">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_50%_100%,color-mix(in_oklab,var(--accent)_16%,transparent),transparent_70%)]" aria-hidden />
        <div className="mx-auto w-full max-w-6xl px-5 py-20 text-center sm:px-6 sm:py-28">
          <h2 className="text-balance text-3xl font-semibold sm:text-5xl">Drop an image in and see.</h2>
          <p className="mx-auto mt-4 max-w-md text-pretty text-ink-2">
            The first cut-out takes a few seconds while the model loads. After that they come back about as fast as you can pick
            the next file.
          </p>
          {enrollUrl ? (
            <a href={enrollUrl} className="btn btn-primary btn-lg mt-8">Request an account <IconArrow /></a>
          ) : (
            <Link href="/api/auth/login" prefetch={false} className="btn btn-primary btn-lg mt-8">Sign in <IconArrow /></Link>
          )}
        </div>
      </section>
    </main>
  );
}

const STEPS = [
  { title: "Drop an image", body: "Drag it in, paste it, or pick it from your files. PNG, JPEG, WebP, BMP or TIFF, up to 50 MB, at whatever resolution it has." },
  { title: "Pick a model or a style", body: "Defaults that work on the first try, and every setting within reach when a particular image needs arguing with." },
  { title: "Download the file", body: "A PNG with real transparency or an SVG that scales without going soft. Compare it against the original before you take it." },
];

const FEATURES = [
  { icon: <IconSparkles />, title: "No watermark, no upsell", body: "The free ones give you a 500-pixel preview and ask for a card to see the rest. This gives you the file." },
  { icon: <IconMaximize />, title: "Full resolution", body: "Whatever you put in comes back the same size. Nothing is downscaled to save somebody else's bandwidth." },
  { icon: <IconShield />, title: "Your images are not kept", body: "The file is processed and the result handed straight back. Nothing is filed under your name, because there is no file to keep." },
  { icon: <IconSliders />, title: "The controls are yours", body: "Model, alpha matting, colour precision, speckle filtering. Defaults that work, and knobs when they do not." },
  { icon: <IconZap />, title: "No queue behind strangers", body: "One machine, a handful of people. You are not waiting behind ten thousand accounts on a free tier." },
  { icon: <IconLock />, title: "Only people you let in", body: "Accounts are approved by hand, which is also what keeps the CPU from becoming a free service for the whole internet." },
];

/* ══════════════════════════════════════════════════════════════════════════
   El arte, en SVG en línea.

   El retrato se define una sola vez como <symbol> y se reutiliza con <use>
   en el antes, el después y la tarjeta: el mismo dibujo, tres veces, sin
   repetir las curvas.
   ══════════════════════════════════════════════════════════════════════════ */
function SubjectSymbol() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <linearGradient id="pf-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0e2440" />
          <stop offset="1" stopColor="#2a6f8e" />
        </linearGradient>
        <linearGradient id="pf-jacket" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffc247" />
          <stop offset="1" stopColor="#ff6a3d" />
        </linearGradient>
        <pattern id="pf-checker" width="20" height="20" patternUnits="userSpaceOnUse">
          <rect width="20" height="20" fill="#f3f4f6" />
          <rect width="10" height="10" fill="#d7dae0" />
          <rect x="10" y="10" width="10" height="10" fill="#d7dae0" />
        </pattern>
        <symbol id="pf-scene" viewBox="0 0 400 300">
          <rect width="400" height="300" fill="url(#pf-sky)" />
          <circle cx="302" cy="78" r="36" fill="#ffc247" />
          <ellipse cx="110" cy="72" rx="46" ry="12" fill="#fff" opacity=".12" />
          <ellipse cx="250" cy="120" rx="60" ry="10" fill="#fff" opacity=".08" />
          <path d="M0 214 90 132l70 60 70-70 90 80 80-50V300H0z" fill="#173a56" />
          <path d="M0 244 70 202l70 36 80-46 80 50 100-38V300H0z" fill="#0f2739" />
        </symbol>
        <symbol id="pf-subject" viewBox="0 0 400 300">
          <path d="M108 300c5-66 42-88 92-90 50 2 87 24 92 90z" fill="url(#pf-jacket)" />
          <path d="M172 300l8-74 20 12 20-12 8 74z" fill="#ffe0a8" />
          <path d="M183 188h34v38c0 8-34 8-34 0z" fill="#d9a074" />
          <ellipse cx="200" cy="150" rx="46" ry="54" fill="#e9b48c" />
          <path d="M152 140c-2-52 98-56 96 0-8-30-24-40-48-38-25-2-40 8-48 38z" fill="#2b1d1a" />
          <path d="M154 140c-14 26-14 60-4 86 8-26 8-56 12-76z" fill="#2b1d1a" />
          <path d="M246 140c14 26 14 60 4 86-8-26-8-56-12-76z" fill="#2b1d1a" />
          <g fill="#2b1d1a">
            <path d="M154 132c-7-3-12-9-13-17 3 5 8 9 13 11z" />
            <path d="M150 152c-8-2-13-7-15-14 4 4 9 7 15 8z" />
            <path d="M150 172c-7 0-12-4-15-9 5 3 10 4 15 4z" />
            <path d="M246 132c7-3 12-9 13-17-3 5-8 9-13 11z" />
            <path d="M250 152c8-2 13-7 15-14-4 4-9 7-15 8z" />
            <path d="M250 172c7 0 12-4 15-9-5 3-10 4-15 4z" />
            <path d="M176 104c-2-6 0-12 4-15-1 5-1 10 0 14z" />
            <path d="M224 104c2-6 0-12-4-15 1 5 1 10 0 14z" />
          </g>
          <path d="M163 150h30a8 8 0 0 1 0 16h-30a8 8 0 0 1 0-16zm44 0h30a8 8 0 0 1 0 16h-30a8 8 0 0 1 0-16z" fill="#15110f" />
          <path d="M193 157h14" stroke="#15110f" strokeWidth="2.5" />
          <path d="M186 182q14 10 28 0" fill="none" stroke="#b97a55" strokeWidth="2.5" strokeLinecap="round" />
        </symbol>
      </defs>
    </svg>
  );
}

function DemoCard() {
  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-accent/15 blur-3xl" aria-hidden />

      <div className="panel overflow-hidden shadow-[0_40px_100px_-30px_rgba(0,0,0,.8)]">
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <span className="flex gap-1.5" aria-hidden>
            <i className="block size-2.5 rounded-full bg-[#ff5f57]" />
            <i className="block size-2.5 rounded-full bg-[#febc2e]" />
            <i className="block size-2.5 rounded-full bg-[#28c840]" />
          </span>
          <span className="ml-2 truncate font-mono text-[11px] text-ink-3">portrait.jpg → portrait-nobg.png</span>
          <span className="tag tag-ok ml-auto">done · 3.4 s</span>
        </div>

        <div className="demo-anim relative aspect-[4/3]" style={{ "--demo-pos": "50%" } as React.CSSProperties}>
          <svg viewBox="0 0 400 300" className="absolute inset-0 h-full w-full" role="img" aria-label="A portrait in front of mountains at sunset">
            <use href="#pf-scene" />
            <use href="#pf-subject" />
          </svg>
          <svg viewBox="0 0 400 300" className="demo-after absolute inset-0 h-full w-full" role="img" aria-label="The same portrait with the background removed">
            <rect width="400" height="300" fill="url(#pf-checker)" />
            <use href="#pf-subject" />
          </svg>
          <div className="demo-line absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,.35),0_0_18px_rgba(0,0,0,.5)]" aria-hidden />
          <div className="demo-line absolute top-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-black shadow-[0_6px_24px_rgba(0,0,0,.5)]" aria-hidden>
            <IconArrowsH />
          </div>
          <span className="compare-label left-3">Before</span>
          <span className="compare-label right-3">After · PNG</span>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-2.5 font-mono text-[11px] text-ink-3">
          <span>isnet-general-use · alpha matting</span>
          <span>1 in · 1 out · 0 stored</span>
        </div>
      </div>

      <div className="panel-glass pop absolute -left-4 bottom-[4.6rem] hidden items-center gap-2 rounded-xl px-3 py-2 text-xs text-ink md:flex lg:-left-8" style={{ animationDelay: "500ms" }}>
        <IconMaximize className="text-accent" /> Full resolution
      </div>
      <div className="panel-glass pop absolute -right-3 top-[5.4rem] hidden items-center gap-2 rounded-xl px-3 py-2 text-xs text-ink md:flex lg:-right-6" style={{ animationDelay: "700ms" }}>
        <IconShield className="text-ok" /> Nothing kept
      </div>
    </div>
  );
}

function CutoutArt() {
  return (
    <svg viewBox="0 0 200 150" className="pointer-events-none absolute -bottom-6 -right-6 w-44 opacity-90 sm:w-52" aria-hidden>
      <rect x="10" y="10" width="180" height="140" rx="14" fill="url(#pf-checker)" stroke="var(--line-2)" />
      <svg x="10" y="10" width="180" height="140" viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice">
        <use href="#pf-subject" />
      </svg>
    </svg>
  );
}

const FLAME = [
  "....#....",
  "....##...",
  "...###...",
  "...####..",
  "..#####..",
  "..######.",
  ".#######.",
  ".###o###.",
  ".##ooo##.",
  "..#ooo#..",
  "..#####..",
  "...###...",
];

function VectorArt() {
  const cell = 7;
  return (
    <svg viewBox="0 0 220 120" className="pointer-events-none absolute -bottom-4 -right-4 w-48 opacity-90 sm:w-56" aria-hidden>
      <defs>
        <linearGradient id="pf-flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffc247" />
          <stop offset="1" stopColor="#ff6a3d" />
        </linearGradient>
      </defs>
      <g transform="translate(18 14)">
        {FLAME.flatMap((row, y) =>
          row.split("").map((c, x) =>
            c === "." ? null : <rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell - 0.6} height={cell - 0.6} fill={c === "o" ? "#ffe0a8" : "#ff9a3c"} />
          )
        )}
      </g>
      <path d="M96 60h28m-6-6 6 6-6 6" fill="none" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <g transform="translate(140 10)">
        <path d="M32 2c8 22 26 32 26 54 0 22-14 40-26 40S6 78 6 56c0-16 12-20 16-34 2 8 6 12 10 18 4-8 2-24 0-38z" fill="url(#pf-flame)" />
        <ellipse cx="32" cy="72" rx="9" ry="12" fill="#ffe0a8" />
        <g fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="2 2" opacity=".8">
          <path d="M32 2 48 20M58 56 66 76M6 56-4 40" />
        </g>
        <g fill="#fff" stroke="#070a12" strokeWidth="1">
          <circle cx="32" cy="2" r="2.6" /><circle cx="58" cy="56" r="2.6" /><circle cx="6" cy="56" r="2.6" /><circle cx="32" cy="96" r="2.6" />
        </g>
        <g fill="#45e0f5">
          <circle cx="48" cy="20" r="1.8" /><circle cx="66" cy="76" r="1.8" /><circle cx="-4" cy="40" r="1.8" />
        </g>
      </g>
    </svg>
  );
}
