# Bakes the prototype's softening into new room photo files.
# Desktop: the prototype drew the photo 3478 CSS px wide on a 1920 x 1080 window under blur(1.8px).
# Phone: 640 CSS px wide at 390 x 844 under blur(1.2px).
import sys, os
from PIL import Image, ImageFilter
src_dir, out_dir = sys.argv[1], sys.argv[2]
def soften(src, size, sigma_at_out, name, qualities):
    im = Image.open(os.path.join(src_dir, src)).convert("RGB")
    # Blur at the source's size, then scale down: the source's own compression blocks go with the blur.
    sigma_src = sigma_at_out * im.width / size[0]
    out = im.filter(ImageFilter.GaussianBlur(sigma_src)).resize(size, Image.LANCZOS)
    for fmt, q in qualities:
        p = os.path.join(out_dir, f"{name}-q{q}.{fmt}")
        if fmt == "avif": out.save(p, quality=q, speed=0)
        else: out.save(p, quality=q, method=6)
        print(p, os.path.getsize(p))
    out.save(os.path.join(out_dir, f"{name}.png"))
soften("room-2560.webp", (1920, 1081), 1.8 * 1920 / 3478, "room-soft-1920", [("avif", q) for q in (45, 55, 62, 70)] + [("webp", q) for q in (60, 70, 78)])
soften("room-phone.webp", (1068, 1602), 1.2 * 1068 / 640, "room-phone-soft", [("avif", q) for q in (45, 55, 62, 70)] + [("webp", q) for q in (60, 70, 78)])
