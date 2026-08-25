import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { requireAccount } from "@/lib/auth";

const execFileAsync = promisify(execFile);

const TMP_DIR = join(process.cwd(), ".pixelforge-tmp");

// Python venv is stored outside the project to avoid Turbopack symlink issues
const PYTHON = join(process.env.HOME || "/home/ulzuhan", ".pixelforge-venv", "bin", "python3");
const PROCESSOR = join(process.cwd(), "python", "process.py");

// Cleanup old temp files on startup
async function cleanupOld() {
  if (!existsSync(TMP_DIR)) return;
  const now = Date.now();
  try {
    const dirs = await import("fs/promises").then((m) => m.readdir(TMP_DIR));
    for (const id of dirs) {
      const metaPath = join(TMP_DIR, id, "meta.json");
      try {
        const { readFile } = await import("fs/promises");
        const raw = await readFile(metaPath, "utf-8");
        const meta = JSON.parse(raw);
        if (now - meta.createdAt > 30 * 60 * 1000) {
          try { await unlink(join(TMP_DIR, id, "input")); } catch {}
          try { await unlink(join(TMP_DIR, id, "output")); } catch {}
          try { await unlink(metaPath); } catch {}
          try {
            const { rmdir } = await import("fs/promises");
            await rmdir(join(TMP_DIR, id));
          } catch {}
        }
      } catch {}
    }
  } catch {}
}

cleanupOld();

export async function POST(request: NextRequest) {
  // Quitar un fondo ejecuta una red neuronal varios segundos: abierto a
  // internet, esto es cómputo gratis para quien lo encuentre.
  const unauthorized = await requireAccount();
  if (unauthorized) return unauthorized;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const model = (formData.get("model") as string) || "isnet-general-use";
    const alphaMatting = formData.get("alphaMatting") === "true";
    const postProcess = formData.get("postProcess") === "true";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Max 50MB
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Max 50MB." }, { status: 413 });
    }

    // Validate file type
    const validTypes = [
      "image/png", "image/jpeg", "image/jpg", "image/webp",
      "image/bmp", "image/tiff",
    ];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(png|jpe?g|webp|bmp|tiff?)$/i)) {
      return NextResponse.json(
        { error: "Invalid file type. Supported: PNG, JPEG, WebP, BMP, TIFF" },
        { status: 400 }
      );
    }

    const id = randomBytes(6).toString("hex");
    const workDir = join(TMP_DIR, id);
    await mkdir(workDir, { recursive: true });

    // Determine input extension
    const ext = file.name.match(/\.(png|jpe?g|webp|bmp|tiff?)$/i)?.[0] || ".png";
    const inputPath = join(workDir, `input${ext}`);
    const outputPath = join(workDir, "output.png");

    // Save input file
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(inputPath, buffer);

    // Build rembg arguments
    const args = [PROCESSOR, "removebg", inputPath, outputPath, "--model", model];
    if (alphaMatting) {
      args.push("--alpha-matting");
    }
    if (postProcess) {
      args.push("--post-process");
    }

    // Run rembg via Python subprocess
    const { stderr } = await execFileAsync(PYTHON, args, {
      timeout: 180000, // 3min for CPU processing
      maxBuffer: 10 * 1024 * 1024,
    });

    if (!existsSync(outputPath)) {
      console.error("rembg stderr:", stderr);
      return NextResponse.json(
        { error: "Background removal failed. Check server logs.", details: stderr.slice(0, 500) },
        { status: 500 }
      );
    }

    // Read output
    const { readFile } = await import("fs/promises");
    const outputBuffer = await readFile(outputPath);

    // Clean up temp files
    try { await unlink(inputPath); } catch {}
    try { await unlink(outputPath); } catch {}
    try {
      const { rmdir } = await import("fs/promises");
      await rmdir(workDir);
    } catch {}

    // Return the processed image
    return new NextResponse(outputBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="${file.name.replace(/\.[^.]+$/, '')}-nobg.png"`,
      },
    });
  } catch (error: any) {
    console.error("RemoveBG error:", error);
    return NextResponse.json(
      { error: "Processing failed", details: error.message?.slice(0, 300) },
      { status: 500 }
    );
  }
}