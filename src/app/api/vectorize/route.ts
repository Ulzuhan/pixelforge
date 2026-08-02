import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const TMP_DIR = join(process.cwd(), ".pixelforge-tmp");

const PYTHON = join(process.env.HOME || "/home/ulzuhan", ".pixelforge-venv", "bin", "python3");
const PROCESSOR = join(process.cwd(), "python", "process.py");

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const colormode = (formData.get("colormode") as string) || "color";
    const hierarchical = (formData.get("hierarchical") as string) || "stacked";
    const curveMode = (formData.get("curveMode") as string) || "spline";
    const filterSpeckle = formData.get("filterSpeckle") as string || "4";
    const colorPrecision = formData.get("colorPrecision") as string || "6";
    const layerDifference = formData.get("layerDifference") as string || "16";
    const cornerThreshold = formData.get("cornerThreshold") as string || "60";
    const lengthThreshold = formData.get("lengthThreshold") as string || "4";
    const spliceThreshold = formData.get("spliceThreshold") as string || "45";
    const pathPrecision = formData.get("pathPrecision") as string || "8";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Max 50MB." }, { status: 413 });
    }

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

    const ext = file.name.match(/\.(png|jpe?g|webp|bmp|tiff?)$/i)?.[0] || ".png";
    const inputPath = join(workDir, `input${ext}`);
    const outputPath = join(workDir, "output.svg");

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(inputPath, buffer);

    // Build vtracer arguments with all quality parameters
    const args = [
      PROCESSOR, "vectorize", inputPath, outputPath,
      "--colormode", colormode,
      "--hierarchical", hierarchical,
      "--curve-mode", curveMode,
      "--filter-speckle", filterSpeckle,
      "--color-precision", colorPrecision,
      "--layer-difference", layerDifference,
      "--corner-threshold", cornerThreshold,
      "--length-threshold", lengthThreshold,
      "--splice-threshold", spliceThreshold,
      "--path-precision", pathPrecision,
    ];

    const { stderr } = await execFileAsync(PYTHON, args, {
      timeout: 180000,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (!existsSync(outputPath)) {
      console.error("vtracer stderr:", stderr);
      return NextResponse.json(
        { error: "Vectorization failed. Check server logs.", details: stderr.slice(0, 500) },
        { status: 500 }
      );
    }

    const { readFile } = await import("fs/promises");
    const outputBuffer = await readFile(outputPath);

    try { await unlink(inputPath); } catch {}
    try { await unlink(outputPath); } catch {}
    try {
      const { rmdir } = await import("fs/promises");
      await rmdir(workDir);
    } catch {}

    return new NextResponse(outputBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `inline; filename="${file.name.replace(/\.[^.]+$/, '')}.svg"`,
      },
    });
  } catch (error: any) {
    console.error("Vectorize error:", error);
    return NextResponse.json(
      { error: "Processing failed", details: error.message?.slice(0, 300) },
      { status: 500 }
    );
  }
}