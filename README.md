# Pixelforge

**Cut the background out of a photo, or turn a logo into a vector.** Two jobs that
normally cost a subscription and hand your images to somebody else's server. This runs
on your machine and keeps nothing.

[![CI](https://github.com/Ulzuhan/pixelforge/actions/workflows/ci.yml/badge.svg)](https://github.com/Ulzuhan/pixelforge/actions/workflows/ci.yml)

- **Background removal** — [rembg](https://github.com/danielgatis/rembg), with four
  models to pick from: `isnet-general-use` (the default, most precise), `u2net` (best
  all-round), `silueta` (good edges, fast) and `u2netp` (fastest, lightest). Alpha
  matting and post-processing are on by default and can be turned off per job.
- **Vectorization** — [vtracer](https://github.com/visioncortex/vtracer) turns a raster
  image into an SVG that scales to a billboard.
- **Nothing is stored.** Uploads live in a private configurable temporary directory for as long as the job takes
  and are swept at startup and every 30 minutes. There is no database and no user table.

## Sign-in

The two expensive routes — `/api/removebg` and `/api/vectorize` — **require an account**.
That is not about privacy but about the CPU: background removal is a neural network, and
an open endpoint on the internet is a free GPU-less compute service for whoever finds it.

Accounts come from an **OIDC provider** (Authentik in the deployment this was written
for, but any provider works). There is no user table: a session is a signed cookie
carrying the identity the provider vouched for. Without the variables below, nobody can
sign in and the tools stay locked.

## Running it

It needs **Node and Python**: the interface is Next.js, the actual work is done by two
Python libraries called as a subprocess.

```bash
# Python side — the venv lives outside the project on purpose: Turbopack follows
# symlinks into it and chokes on the model files.
python3 -m venv ~/.pixelforge-venv
~/.pixelforge-venv/bin/pip install -r python/requirements.txt

# Node side
npm ci
npm run dev          # http://localhost:3000
```

The first background removal downloads the model (~180 MB) and is slow; the ones after
are not.

| Variable | Purpose |
|---|---|
| `PIXELFORGE_SESSION_SECRET` | HMAC key that signs the session cookie. Without it nobody can sign in. |
| `PIXELFORGE_OIDC_CLIENT_ID` / `_SECRET` | OIDC client credentials. |
| `PIXELFORGE_OIDC_REDIRECT_URI` | Must match one of the URIs registered in the provider. |
| `PIXELFORGE_OIDC_PUBLIC_BASE` | The provider as the browser sees it. |
| `PIXELFORGE_OIDC_INTERNAL_BASE` | The provider as this server sees it — redeeming the authorization code never leaves the internal network. |
| `PIXELFORGE_SESSION_TTL_HOURS` | Session lifetime, clamped to 1–24 h; default 12. |
| `PIXELFORGE_PYTHON` | Absolute path to the audited Python interpreter. |
| `PIXELFORGE_TMP_DIR` | Private temporary workspace; defaults to `.pixelforge-tmp`. |

`PIXELFORGE_PYTHON` selects the interpreter; without it the development fallback is `$HOME/.pixelforge-venv/bin/python3`. Production should set it explicitly.

## API

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/removebg` | account | Image in, cut-out PNG out. Takes `model`, `alphaMatting`, `postProcess`. |
| `POST /api/vectorize` | account | Image in, SVG out. Takes the vtracer quality parameters. |

## Limits

These controls exist for the same reason: this app is the only one here that
spends real CPU and real memory on a request.

| Variable | Default | What it bounds |
|---|---|---|
| `PIXELFORGE_MAX_PIXELS` | `40000000` | Pixels in the uploaded image, checked from the header before decoding |
| `PIXELFORGE_MAX_OUTPUT_BYTES` | `268435456` | Maximum generated PNG or SVG before Node reads it |
| `PIXELFORGE_MAX_JOBS` | `2` | Python processes running at once |
| `PIXELFORGE_MAX_QUEUE` | `6` | Requests waiting for a turn; beyond that, 503 with `Retry-After` |
| `PIXELFORGE_MAX_REQUESTS_PER_HOUR` | `30` | Requests admitted per signed identity and client IP each hour |
| `PIXELFORGE_PUBLIC_HOST` | Nombre público con el que se comprueba el origen de una petición. Sin poner se usa el `Host` que llega, que es lo correcto detrás de un túnel que lo conserva. Sólo hace falta si el proxy lo reescribe con un nombre interno. |

The pixel budget is not the same thing as the 50 MB upload cap, and that difference
is the whole point: a flat-colour 8000×8000 PNG is 197 KB on disk and 64 million
pixels in memory. Measured against this service before the budget existed, those
197 KB took **2.1 GB of resident memory and eleven seconds of CPU** to remove a
background. Forty megapixels lets any phone photo of today through.

The queue matters for the same reason. Six simultaneous requests used to start six
Python processes — measured, each going from 5 to 29 seconds fighting over this
machine's four cores. With large images that stops being slowness and becomes the
machine's memory, and what runs out of it is not just this service: it is the other
four and the identity provider, which live on the same box.

## Tests

No test framework. Two suites, each against a server the script starts itself:

```bash
npm run build
./scripts/run-suites.sh          # both
./scripts/run-suites.sh auth     # one
```

`test-auth` covers the door — a legitimate session gets in, twelve forged ones do
not, and `?next=` cannot be pointed off-site. `test-process` covers what gets
uploaded and what it costs: the pixel budget, the queue, files that are not images,
the vtracer settings, and the filename that comes back in `Content-Disposition`.

There is no local sign-in — Authentik owns identity — so the suites mint their
session cookie with the same secret the test server runs with. It is the only way
to exercise a route without standing up an identity provider for every run.

## Stack

Next.js 16 · React 19 · Tailwind CSS v4 · TypeScript, with `rembg` + `vtracer` + Pillow
behind them. Deployment recipes for Docker Compose and a hardened systemd user service are in [`DEPLOYMENT.md`](DEPLOYMENT.md).
