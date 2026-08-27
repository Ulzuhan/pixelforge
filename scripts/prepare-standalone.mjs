import { cpSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", ".next", "standalone");
// Next traza el cwd completo por las rutas configurables de Python y temporales.
// Retiramos datos de desarrollo y, sobre todo, cualquier subida que existiera.
for (const entry of [
  ".pixelforge-tmp", "src", "scripts", "deploy",
  "README.md", "DEPLOYMENT.md", "Dockerfile", "compose.yaml",
  "eslint.config.mjs", "next.config.ts", "postcss.config.mjs", "tsconfig.json",
  "tsconfig.tsbuildinfo", "package-lock.json",
]) {
  rmSync(join(root, entry), { recursive: true, force: true });
}
cpSync(join(root, "..", "static"), join(root, ".next", "static"), { recursive: true });
// El servidor necesita sólo el CLI, no locks ni bytecode Python.
for (const entry of ["requirements.txt", "requirements.lock", "__pycache__"]) {
  rmSync(join(root, "python", entry), { recursive: true, force: true });
}
