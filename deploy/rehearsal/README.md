# PixelForge ARM64 return gate (isolated)

This PR-only workflow cannot publish, merge, deploy or contact a production
service. Builds a local, unsigned review image from exact drain source
61cd3e4c9beeafb6b56e835137ee200fc7fa9fe4; prior is the verified ARM64 image
already built and signed from main at 9517188643b7a2be16e04034c0897276a6feca4e
(index b7ed4fd60de0ca09c3cb620d97d11d25cfe334186bc55193d84e0ed1e0ab20a0).
Do not use tagged v0.8.0: that release was AMD64 only.

Only on the disposable hosted native ARM64 runner, test in sequence on the
same newly created state directory, one writer at any time, with no network
other than container-local loopback. The four pinned (public) model weights
are fetched and verified in scratch first, then never mounted writable.
The signed synthetic logout service writes a first marker on prior and a
second on the candidate. After return, both sessions remain denied while a
different valid session processes successfully. A held multipart POST on
candidate crosses drain activation, gets a complete real inference response,
and another POST receives 503 during the same drain; the candidate is stopped
only after the body and a final valid empty drain result are observed.

`mode=review` proves compatible *source* and an isolated runtime, not the
exact digest of a future tagged build. The script's `exact` mode must be wired
into a separately reviewed hosted run only **after** a signed v0.8.1 exists:
pass its exact OCI index digest and release commit; the script verifies tag
attestation and Linux ARM64 revision before executing.

Proposed compatible release delta: apply only the three version fields
package.json/package-lock.json 0.8.0→0.8.1 to reviewed #14, pin verified release
main and wait for exact CI before any authorized tag. The current reviewed
publisher supports and scans native ARM64/AMD64 and attests the merged digest.
The first cut remains separately supervised: old live version has no
app drain socket, so first close public admission externally, let remaining
responses flush, and apply a conservative timed abort if there is no evidence
the old work has finished. Never treat a healthy HTTP response as empty queue.
Do not restore an earlier revocation file when returning to the prior image.
