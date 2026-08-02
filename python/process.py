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
import sys
import os


def cmd_removebg(args: argparse.Namespace) -> None:
    from rembg import remove, new_session
    from PIL import Image

    input_img = Image.open(args.input)

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

    input_img = Image.open(args.input)

    # Pre-process: resize if the image is too large (vtracer struggles with huge images)
    max_dim = 2048
    if max(input_img.size) > max_dim:
        ratio = max_dim / max(input_img.size)
        new_size = (int(input_img.width * ratio), int(input_img.height * ratio))
        input_img = input_img.resize(new_size, Image.LANCZOS)
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