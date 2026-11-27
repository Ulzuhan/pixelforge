export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  await import("./instrumentation-node");
  const dir = process.env.PIXELFORGE_DRAIN_DIR;
  if (dir) {
    const { iniciarControl } = await import("./lib/drain-socket");
    await iniciarControl(dir);
  }
}
