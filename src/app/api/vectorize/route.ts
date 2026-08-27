import { NextRequest, NextResponse } from "next/server";
import { pareceImagen } from "@/lib/imagen";
import { ColaLlena, conTurno } from "@/lib/turnos";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { requireAccount } from "@/lib/auth";

const execFileAsync = promisify(execFile);

const TMP_DIR = join(process.cwd(), ".pixelforge-tmp");

const PYTHON = join(process.env.HOME || "/home/ulzuhan", ".pixelforge-venv", "bin", "python3");
const PROCESSOR = join(process.cwd(), "python", "process.py");

/**
 * Cabecera `Content-Disposition` completa, con el nombre que puso quien subió
 * el fichero.
 *
 * Tres formas de romperla desde fuera, las tres vistas en pruebas:
 *
 *   comillas   `filename="foto"rara.png"` sale partida y el navegador lee
 *              solo `foto`.
 *   control    un salto de línea hace que el runtime rechace la cabecera y la
 *              petición muera con un 500. (No es inyección: Node valida.)
 *   no ASCII   una cabecera HTTP solo admite bytes 0–255. `diseño.png` colaba
 *              porque la eñe cabe en Latin-1, pero `日本語.png` o un emoji
 *              **devolvían 500**. Nombres así son de lo más normal.
 *
 * La solución es la del estándar (RFC 6266): `filename=` con un respaldo en
 * ASCII puro, y `filename*=UTF-8''…` con el nombre real percent-encoded, que
 * es lo que usan todos los navegadores actuales. Así el usuario recibe su
 * fichero con su nombre y la cabecera nunca es inválida.
 */
function cabeceraNombre(nombre: string, sufijo: string): string {
  const base =
    nombre
      .replace(/\.[^.]+$/, "")
      .replace(/[\u0000-\u001F\u007F"\\/]/g, "_")
      .trim()
      .slice(0, 80) || "image";

  // Respaldo: solo ASCII imprimible, que es lo único seguro en `filename=`.
  const ascii = base.replace(/[^\u0020-\u007E]/g, "_") + sufijo;

  // Nombre real. `encodeURIComponent` deja pasar !'()* , que no son attr-char
  // válidos en RFC 5987, así que se codifican también.
  const utf8 = encodeURIComponent(base + sufijo).replace(
    /['()!*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );

  return `inline; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

/**
 * Barrido de huérfanas al arrancar. Esta ruta no lo tenía y comparte
 * `.pixelforge-tmp` con la de quitar fondos, así que sus restos dependían de que
 * arrancara la otra. Misma lógica: la antigüedad sale de la fecha de la carpeta
 * y se borra recursivamente.
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
    workDir = join(TMP_DIR, id);
    await mkdir(workDir, { recursive: true });

    const ext = file.name.match(/\.(png|jpe?g|webp|bmp|tiff?)$/i)?.[0] || ".png";
    const inputPath = join(workDir, `input${ext}`);
    const outputPath = join(workDir, "output.svg");

    const buffer = Buffer.from(await file.arrayBuffer());
    // El tipo declarado y el nombre los escribe quien sube; los primeros bytes,
    // no. Descartar aquí lo que no es una imagen ahorra arrancar un Python
    // entero para acabar en un error —1,3 segundos por fichero basura—.
    if (!pareceImagen(buffer)) {
      return NextResponse.json(
        { error: "That file is not an image." },
        { status: 400 }
      );
    }
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

    // Por turnos: cada uno de estos arranca un Python que puede tardar minutos y
    // comerse más de un giga, y esta máquina tiene cuatro núcleos y otros cuatro
    // servicios encima. Sin cola, seis peticiones eran seis procesos a la vez.
    const { stderr } = await conTurno(() =>
      execFileAsync(PYTHON, args, {
        timeout: 180000,
        maxBuffer: 10 * 1024 * 1024,
      })
    );

    if (!existsSync(outputPath)) {
      console.error("vtracer stderr:", stderr);
      return NextResponse.json(
        // Sin `details`: el stderr de Python lleva rutas absolutas del servidor
        // —usuario, venv, árbol del proyecto, nombre del temporal— y eso no
        // tiene por qué salir de la máquina. Al log entero, al cliente lo justo.
        { error: "Vectorization failed. Check server logs." },
        { status: 500 }
      );
    }

    const { readFile } = await import("fs/promises");
    const outputBuffer = await readFile(outputPath);


    return new NextResponse(outputBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": cabeceraNombre(file.name, ".svg"),
      },
    });
  } catch (error) {
    // La cola llena no es un fallo del servidor: es que ahora mismo no hay sitio.
    // Se dice cuándo volver, en vez de un 500 que no explica nada.
    if (error instanceof ColaLlena) {
      return NextResponse.json(
        { error: "The machine is busy right now. Try again in a moment." },
        { status: 503, headers: { "Retry-After": "30" } }
      );
    }
    // Una imagen que pide más memoria de la que se le presta tampoco es un fallo
    // del servidor: es una petición que no se acepta, y merece decirlo claro. El
    // límite de 50 MB de arriba es de fichero, y un PNG de color plano de
    // 8000x8000 pesa 197 KB y son 64 millones de píxeles.
    const salida = String((error as { stderr?: string })?.stderr ?? "");
    if (salida.includes("PIXELFORGE_NO_ES_UNA_IMAGEN")) {
      return NextResponse.json(
        { error: "That file is not an image." },
        { status: 400 }
      );
    }
    if (salida.includes("PIXELFORGE_IMAGEN_DEMASIADO_GRANDE")) {
      return NextResponse.json(
        { error: "Image has too many pixels. Max 40 megapixels." },
        { status: 413 }
      );
    }
    console.error("Vectorize error:", error);
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