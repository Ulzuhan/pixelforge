# Pixelforge

**Image tools for creators.** Remove backgrounds, vectorize logos — self-hosted and private.

[![CI](https://github.com/Ulzuhan/pixelforge/actions/workflows/ci.yml/badge.svg)](https://github.com/Ulzuhan/pixelforge/actions/workflows/ci.yml)

## Features
- 🖼️ **Background Removal** — Powered by U2-Net, quality comparable to remove.bg
- ✏️ **Vectorization** — Convert raster images to clean SVGs using vtracer
- 🔒 **Self-hosted** — Your images never leave your machine
- ⚡ **On-demand** — Spin up when you need it, shut down when you don't

## Tech Stack
- Next.js 16 + Tailwind CSS v4
- Python backend: rembg + vtracer
- Deployed via Cloudflare tunnel