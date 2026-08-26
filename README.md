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
- **Nothing is stored.** Uploads live in `.pixelforge-tmp/` for as long as the job takes
  and are swept on startup. There is no database and no user table.

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

`HOME` decides where the Python venv is looked for (`$HOME/.pixelforge-venv`).

## API

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/removebg` | account | Image in, cut-out PNG out. Takes `model`, `alphaMatting`, `postProcess`. |
| `POST /api/vectorize` | account | Image in, SVG out. Takes the vtracer quality parameters. |

## Stack

Next.js 16 · React 19 · Tailwind CSS v4 · TypeScript, with `rembg` + `vtracer` + Pillow
behind them. In production it runs as a systemd user service on port 3458.
