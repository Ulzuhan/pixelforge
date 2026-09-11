# Security policy

Pixelforge is the only tool here that spends real CPU and real memory on a
request: it runs a neural network over an image somebody uploaded. Its security
story is therefore mostly about bounds — who may ask, how much they may ask for,
and what the parser is allowed to do.

## Reporting a vulnerability

Open a [private security advisory](https://github.com/Ulzuhan/pixelforge/security/advisories/new)
on this repository. That channel stays private until we publish it together.

Please do not open a public issue for anything exploitable.

**What to expect:** an acknowledgement within 72 hours, an assessment within
7 days, and a fix or a written explanation of why there is not going to be one.
You will be credited in the advisory unless you would rather not be. There is no
bounty.

## What it is, in security terms

- **The expensive routes require an account.** `/api/removebg` and
  `/api/vectorize` are not open: an unauthenticated endpoint that runs a model
  is a free compute service for whoever finds it.
- **There is no user table.** A session is a signed cookie carrying the identity
  the OIDC provider vouched for; rotating the session secret invalidates them all.
- **Nothing is kept.** Images live in a temporary directory for the length of the
  job and are not stored afterwards.
- **The work happens in a Python subprocess** (rembg and ONNX for background
  removal, the vectorizer for the other route). That subprocess is the real
  attack surface, and the limits below exist to keep it bounded.
- **The bounds are explicit**, and the pixel budget is checked from the image
  header *before* decoding: a flat 8000×8000 PNG is 197 KB on disk and 64
  million pixels in memory. Measured here before the budget existed, those
  197 KB cost 2.1 GB of resident memory and eleven seconds of CPU.

| Bound | Default |
|---|---|
| Pixels in the uploaded image | 40,000,000 |
| Generated PNG or SVG | 256 MiB |
| Python processes at once | 2 |
| Requests waiting for a turn | 6, then 503 with `Retry-After` |
| Requests per identity and IP each hour | 30 |

## In scope

- Running either expensive route without an account, or past the documented bounds.
- Getting around the pixel budget — a decode bomb, a header that lies, a format
  that inflates after the check.
- Anything that makes the subprocess run attacker-controlled code, read files it
  should not, or write outside the temporary directory.
- Reading another person's image or output, or a temporary file that outlives its job.
- Session forgery or replay.

## Out of scope

- Scanner output with no working exploit, or missing headers with no shown impact.
- Volumetric denial of service. A way *around* a documented limit is in scope;
  sending more traffic than a host can take is not.
- Misconfiguration of your own deployment, unless an unsafe default here causes it.
- The quality of a model's output. Getting a bad cut-out is not a vulnerability.

## What it does not claim

Image parsers are a large attack surface and the models are third-party code.
The bounds above are what stands between a hostile file and the host; they are
not a sandbox, and a report that gets past them is exactly what we want to hear
about. If you run this yourself, keep the process unprivileged and give it a
memory ceiling — the deployment notes say how.

## Supply chain

Dependencies are pinned by `package-lock.json` and the Python requirements;
Renovate opens grouped updates weekly and security updates immediately. Every
GitHub Action is pinned by commit SHA. The image is built with BuildKit
provenance and an SBOM — metadata, not a signature — and every published digest
is scanned with Trivy for fixable critical and high CVEs. A red run is not
deployed.
