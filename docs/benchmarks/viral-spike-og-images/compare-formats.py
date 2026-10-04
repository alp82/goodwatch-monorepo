"""compare-formats.py <png-dir> <out-dir>: encodes every PNG card in several formats and prints, per variant, the
size distribution and the structural similarity (SSIM, from ImageMagick's `compare`) to the original PNG.

Variants: JPEG from libjpeg-turbo (Pillow) with and without chroma subsampling, the jpeg-js files that
encode-jpegjs.mjs wrote into <out-dir>, a 256-color PNG with and without dithering, and WebP. Needs Pillow and
ImageMagick 7.
"""
import io, os, re, statistics, subprocess, sys
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
names = sorted(f[:-4] for f in os.listdir(src) if f.endswith(".png"))

def save(name, variant, ext, data):
    path = os.path.join(out, f"{name}.{variant}.{ext}")
    with open(path, "wb") as f:
        f.write(data)
    return path

def encode(image, fmt, **options):
    buffer = io.BytesIO()
    image.save(buffer, fmt, **options)
    return buffer.getvalue()

def variants(name):
    rgb = Image.open(os.path.join(src, name + ".png")).convert("RGB")
    yield "png-original", os.path.join(src, name + ".png")
    for q in (80, 85, 90):
        yield f"jpeg444-q{q}", save(name, f"jpeg444-q{q}", "jpg", encode(rgb, "JPEG", quality=q, subsampling=0, optimize=True))
    yield "jpeg420-q85", save(name, "jpeg420-q85", "jpg", encode(rgb, "JPEG", quality=85, subsampling=2, optimize=True))
    yield "jpeg444-q85-progressive", save(name, "jpeg444-q85p", "jpg", encode(rgb, "JPEG", quality=85, subsampling=0, optimize=True, progressive=True))
    for q in (80, 85, 90, 92):
        path = os.path.join(out, f"{name}.jpegjs-q{q}.jpg")
        if os.path.exists(path):
            yield f"jpegjs-q{q}", path
    yield "png-256-dither", save(name, "png256d", "png", encode(rgb.quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG), "PNG", optimize=True))
    yield "png-256-flat", save(name, "png256", "png", encode(rgb.quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE), "PNG", optimize=True))
    yield "png-rgb-optimized", save(name, "pngrgb", "png", encode(rgb, "PNG", optimize=True))
    yield "webp-q80", save(name, "webp-q80", "webp", encode(rgb, "WEBP", quality=80, method=6))

def ssim(a, b):
    result = subprocess.run(["magick", "compare", "-metric", "SSIM", a, b, "null:"], capture_output=True, text=True)
    match = re.search(r"\(([\d.]+)\)", result.stderr) or re.search(r"([\d.]+)", result.stderr)
    return float(match.group(1)) if match else float("nan")

sizes, scores = {}, {}
for name in names:
    original = os.path.join(src, name + ".png")
    for variant, path in variants(name):
        sizes.setdefault(variant, []).append(os.path.getsize(path))
        scores.setdefault(variant, []).append(1.0 if path == original else ssim(original, path))

def q(values, p):
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(p * len(ordered)))]

print(f"{len(names)} cards")
print("variant | min KB | p50 KB | p95 KB | max KB | over 150 KB | SSIM min | SSIM mean")
for variant, values in sizes.items():
    s = scores[variant]
    print(f"{variant} | {min(values)/1000:.0f} | {q(values, .5)/1000:.0f} | {q(values, .95)/1000:.0f} | {max(values)/1000:.0f} | {sum(v > 150000 for v in values)} | {min(s):.4f} | {statistics.mean(s):.4f}")
