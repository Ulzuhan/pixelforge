#!/usr/bin/env python3
"""
Pixelforge — Image processing CLI tool.
Modes:
  removebg  — Remove background from an image (PNG transparent output)
  vectorize — Convert a PNG image to SVG vector

Usage:
  python process.py removebg <input> <output> [--model isnet-general-use] [--alpha-matting] [--post-process]
  python process.py vectorize <input> <output> [--colormode color] [--hierarchical stacked] [--mode polygon]
"""

import argparse
import os
import sys

# ── Presupuesto de píxeles ────────────────────────────────────────────────
#
# El límite de 50 MB que pone la ruta es de FICHERO, no de imagen, y esas dos
# cosas no se parecen: un PNG de color plano de 8000x8000 ocupa 197 KB en disco y
# 64 millones de píxeles en memoria. Medido contra este mismo servicio: esos 197
# KB hacían que Python llegara a 2,1 GB de residente y once segundos de CPU
# quitando el fondo, y a 1,1 GB vectorizando. Unas diez mil veces lo que pesa lo
# que se sube.
#
# `Image.open` sólo lee la cabecera, así que preguntar el tamaño no cuesta nada:
# la comprobación va antes de descodificar y antes de importar rembg, que es lo
# lento. Cuarenta megapíxeles dejan pasar cualquier foto de móvil de hoy.
MAX_PIXELS = int(os.environ.get("PIXELFORGE_MAX_PIXELS", 40_000_000))

# Marcador para que la ruta sepa distinguir esto de un fallo cualquiera y conteste
# 413 en vez de 500. Va por stderr, que es lo único que cruza.
MARCA_TAMANO = "PIXELFORGE_IMAGEN_DEMASIADO_GRANDE"
MARCA_NO_IMAGEN = "PIXELFORGE_NO_ES_UNA_IMAGEN"


def abrir_acotada(ruta):
    """La imagen, o un fallo limpio si pide más memoria de la que se le presta."""
    from PIL import Image

    try:
        img = Image.open(ruta)
        ancho, alto = img.size
    except Exception:
        # Que un fichero no se pueda abrir no es un fallo del servidor: es que lo
        # que han subido no era una imagen. La ruta lo traduce a 400.
        print(MARCA_NO_IMAGEN, file=sys.stderr)
        sys.exit(3)
    if ancho * alto > MAX_PIXELS:
        print(f"{MARCA_TAMANO} {ancho}x{alto}", file=sys.stderr)
        sys.exit(2)
    return img


def cmd_removebg(args: argparse.Namespace) -> None:
    from rembg import remove, new_session
    from PIL import Image

    input_img = abrir_acotada(args.input)

    # Convert to RGB first if needed (rembg works best with RGB input)
    if input_img.mode == "RGBA":
        bg = Image.new("RGB", input_img.size, (255, 255, 255))
        bg.paste(input_img, mask=input_img.split()[3])
        input_img = bg
    elif input_img.mode != "RGB":
        input_img = input_img.convert("RGB")

    sess = new_session(args.model)

    kwargs = {"session": sess}

    if args.alpha_matting:
        kwargs["alpha_matting"] = True
        kwargs["alpha_matting_foreground_threshold"] = args.alpha_matte_fg
        kwargs["alpha_matting_background_threshold"] = args.alpha_matte_bg
        kwargs["alpha_matting_erode_size"] = args.alpha_matte_erode

    if args.post_process:
        kwargs["post_process_mask"] = True

    output_img = remove(input_img, **kwargs)

    if not isinstance(output_img, Image.Image):
        if isinstance(output_img, bytes):
            import io
            output_img = Image.open(io.BytesIO(output_img))
        else:
            import numpy as np
            output_img = Image.fromarray(output_img)

    if output_img.mode != "RGBA":
        output_img = output_img.convert("RGBA")

    # Clean up near-transparent ghost pixels
    import numpy as np
    arr = np.array(output_img)
    alpha = arr[:, :, 3]
    alpha[alpha < 10] = 0
    arr[:, :, 3] = alpha
    output_img = Image.fromarray(arr, "RGBA")

    output_img.save(args.output, "PNG", optimize=True)
    print(f"OK: Background removed → {args.output}", flush=True)


def cmd_vectorize(args: argparse.Namespace) -> None:
    from PIL import Image

    input_img = abrir_acotada(args.input)

    # Pre-process: resize if the image is too large (vtracer struggles with huge images)
    max_dim = 2048
    if max(input_img.size) > max_dim:
        ratio = max_dim / max(input_img.size)
        new_size = (int(input_img.width * ratio), int(input_img.height * ratio))
        input_img = input_img.resize(new_size, Image.LANCZOS)
        # PNG no admite CMYK: un JPEG o un TIFF de imprenta reventaba aquí con
        # "OSError: cannot write mode CMYK as PNG", y el usuario solo veía un
        # fallo genérico. Se convierte antes de guardar, conservando el canal
        # alfa cuando lo hay. (El modo P sí guarda como PNG; no hace falta
        # tocarlo, y convertirlo perdería su paleta.)
        if input_img.mode not in ("RGB", "RGBA", "L", "LA", "P"):
            input_img = input_img.convert("RGBA" if "A" in input_img.mode else "RGB")
        # Save resized version for vtracer
        resized_path = args.input + ".resized.png"
        input_img.save(resized_path, "PNG")
        input_path = resized_path
    else:
        input_path = args.input

    # Build vtracer kwargs with quality-optimized defaults
    import vtracer

    vtracer.convert_image_to_svg_py(
        image_path=input_path,
        out_path=args.output,
        colormode=args.colormode,
        hierarchical=args.hierarchical,
        mode=args.curve_mode,
        filter_speckle=args.filter_speckle,
        color_precision=args.color_precision,
        layer_difference=args.layer_difference,
        corner_threshold=args.corner_threshold,
        length_threshold=args.length_threshold,
        max_iterations=args.max_iterations,
        splice_threshold=args.splice_threshold,
        path_precision=args.path_precision,
    )

    # Clean up resized temp file if it was created
    if input_path != args.input:
        try:
            os.unlink(input_path)
        except:
            pass

    print(f"OK: Vectorized → {args.output}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Pixelforge image processor")
    subparsers = parser.add_subparsers(dest="mode", required=True)

    # --- removebg ---
    rb = subparsers.add_parser("removebg", help="Remove background from image")
    rb.add_argument("input", help="Input image path")
    rb.add_argument("output", help="Output PNG path")
    rb.add_argument(
        "--model", default="isnet-general-use",
        help="rembg model: isnet-general-use (default), u2net, u2netp, silueta"
    )
    rb.add_argument(
        "--alpha-matting", action="store_true",
        help="Enable alpha matting for better edge quality (slower)"
    )
    rb.add_argument(
        "--alpha-matte-fg", type=int, default=240,
        help="Alpha matte foreground threshold (default: 240)"
    )
    rb.add_argument(
        "--alpha-matte-bg", type=int, default=10,
        help="Alpha matte background threshold (default: 10)"
    )
    rb.add_argument(
        "--alpha-matte-erode", type=int, default=10,
        help="Alpha matte erode size (default: 10)"
    )
    rb.add_argument(
        "--post-process", action="store_true",
        help="Apply post-processing mask cleanup (morphological ops)"
    )

    # --- vectorize ---
    vz = subparsers.add_parser("vectorize", help="Vectorize image to SVG")
    vz.add_argument("input", help="Input image path")
    vz.add_argument("output", help="Output SVG path")
    vz.add_argument(
        "--colormode", default="color", choices=["color", "binary"],
        help="Color mode: color (default) or binary (B/W)"
    )
    vz.add_argument(
        "--hierarchical", default="stacked", choices=["stacked", "cutout"],
        help="Hierarchical mode: stacked (smooth, default) or cutout (sharp layers)"
    )
    vz.add_argument(
        "--curve-mode", default="spline", choices=["spline", "polygon", "pixel"],
        help="Curve fitting: spline (smooth curves, default), polygon, or pixel"
    )
    vz.add_argument(
        "--filter-speckle", type=int, default=4,
        help="Denoise: suppress speckles of up to this size in pixels (0-64, default 4)"
    )
    vz.add_argument(
        "--color-precision", type=int, default=6,
        help="Color quantization precision: lower=fewer colors/simpler, higher=more colors (1-12, default 6)"
    )
    vz.add_argument(
        "--layer-difference", type=int, default=16,
        help="Layer scan difference threshold (1-64, default 16)"
    )
    vz.add_argument(
        "--corner-threshold", type=int, default=60,
        help="Corner detection threshold: lower=smooth curves, higher=sharp corners (1-180, default 60)"
    )
    vz.add_argument(
        "--length-threshold", type=int, default=4,
        help="Curve length threshold: shorter paths are discarded (1-64, default 4)"
    )
    vz.add_argument(
        "--max-iterations", type=int, default=10,
        help="Max iterations for curve optimization (1-30, default 10)"
    )
    vz.add_argument(
        "--splice-threshold", type=int, default=45,
        help="Splice threshold for curve joining (1-90, default 45)"
    )
    vz.add_argument(
        "--path-precision", type=int, default=8,
        help="Decimal precision for path coordinates (1-12, default 8)"
    )

    args = parser.parse_args()

    if args.mode == "removebg":
        cmd_removebg(args)
    elif args.mode == "vectorize":
        cmd_vectorize(args)


if __name__ == "__main__":
    main()