import { createConnection } from "node:net";
import { join } from "node:path";

const [action, lease] = process.argv.slice(2);
if (process.argv.length !== 4 || !/^(begin|status|resume)$/.test(action) || !/^[a-f0-9]{32}$/.test(lease)) {
  console.error("Usage: node scripts/drain-control.mjs {begin|status|resume} LEASE");
  process.exit(2);
}
const dir = process.env.PIXELFORGE_DRAIN_DIR;
if (!dir) { console.error("Private drain control is unavailable"); process.exit(2); }

let data = "";
const socket = createConnection(join(dir, "control.sock"), () => socket.write(action + " " + lease + "\n"));
function fail() { socket.destroy(); process.exitCode = 2; }
socket.setTimeout(2000, fail);
socket.on("error", fail);
socket.on("data", chunk => {
  data += chunk.toString("utf8");
  if (data.length > 256) fail();
});
socket.on("end", () => {
  try {
    const state = JSON.parse(data);
    if (state.ok !== true) return fail();
    console.log(JSON.stringify(state));
  } catch { fail(); }
});
