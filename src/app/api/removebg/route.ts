import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
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

/**
 * Nombre seguro para `Content-Disposition`.
 *
 * El nombre lo pone quien sube el fichero. Con comillas dentro, la cabecera
 * salía partida —`filename="foto"rara.png"`, que el navegador lee como `foto`—
 * y con un salto de línea el runtime rechazaba la cabecera entera y la petición
 * moría con un 500. No llega a ser inyección (Node valida el valor), pero son
 * dos formas de romperlo desde fuera.
 *
 * Se queda solo con el nombre base, sin rutas ni caracteres de control.
 */
function nombreSeguro(nombre: string, sufijo: string): string {
  const base = nombre
    .replace(/\.[^.]+$/, "")
    .replace(/[\u0000-\u001F\u007F"\\/]/g, "_")
    .trim()
    .slice(0, 80);
  return `${base || "image"}${sufijo}`;
}

/**
 * Barrido de carpetas temporales huérfanas al arrancar.
 *
 * La versión anterior no borraba nada nunca. Leía un `meta.json` para saber la
 * antigüedad, pero **ese fichero no lo escribía nadie**: la lectura fallaba
 * siempre, el `catch` se lo tragaba y se saltaba la carpeta entera. Encima
 * intentaba borrar `input` y `output` sin extensión, cuando los reales son
 * `input.png`, `output.svg`… Se encontraron carpetas de tres meses con imágenes
 * de usuarios dentro.
 *
 * Ahora la antigüedad sale de la fecha de la propia carpeta —que el sistema de
 * ficheros ya lleva— y se borra recursivamente, sin depender de acertar nombres.
 */
async function cleanupOld() {
  if (!existsSync(TMP_DIR)) return;
  const now = Date.now();
  try {
    const { readdir, stat, rm } = await import("fs/promises");
    for (const id of await readdir(TMP_DIR)) {
      const dir = join(TMP_DIR, id);
      try {
        const info = await stat(dir);
        if (now - info.mtimeMs > 30 * 60 * 1000) {
          await rm(dir, { recursive: true, force: true });
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

  // `workDir` se declara aquí y no dentro del try para que el `finally` pueda
  // verlo: antes, si el proceso de Python fallaba o agotaba los 3 minutos, la
  // ejecución saltaba al catch y la carpeta —con la imagen del usuario, hasta
  // 50 MB— se quedaba en disco para siempre.
  let workDir: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    // Lista blanca: `model` viaja hasta `new_session()` de rembg, que con un
    // nombre desconocido intenta resolverlo y descargarlo. No hay inyección de
    // comandos —los argumentos van en array, sin shell— pero un valor cualquiera
    // convertía la petición en un 500 y en trabajo inútil del servidor.
    const MODELOS = ["isnet-general-use", "u2net", "u2netp", "silueta"] as const;
    const modelPedido = (formData.get("model") as string) || "isnet-general-use";
    if (!MODELOS.includes(modelPedido as (typeof MODELOS)[number])) {
      return NextResponse.json(
        { error: `Unknown model. Supported: ${MODELOS.join(", ")}` },
        { status: 400 }
      );
    }
    const model = modelPedido;
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
    workDir = join(TMP_DIR, id);
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
        // Sin `details`: el stderr de Python lleva rutas absolutas del servidor
        // —usuario, venv, árbol del proyecto, nombre del temporal— y eso no
        // tiene por qué salir de la máquina. Al log entero, al cliente lo justo.
        { error: "Background removal failed. Check server logs." },
        { status: 500 }
      );
    }

    // Read output
    const { readFile } = await import("fs/promises");
    const outputBuffer = await readFile(outputPath);


    // Return the processed image
    return new NextResponse(outputBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="${nombreSeguro(file.name, "-nobg.png")}"`,
      },
    });
  } catch (error) {
    console.error("RemoveBG error:", error);
    return NextResponse.json(
      { error: "Processing failed" },
      { status: 500 }
    );
  } finally {
    // Pase lo que pase —éxito, error controlado, timeout de Python o excepción
    // inesperada— la carpeta temporal se va. Es la única garantía de que no se
    // acumulen imágenes de usuarios en disco.
    if (workDir) {
      try {
        const { rm } = await import("fs/promises");
        await rm(workDir, { recursive: true, force: true });
      } catch {}
    }
  }
}