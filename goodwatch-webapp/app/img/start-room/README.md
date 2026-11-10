The landscape variants preserve the existing `start-room-1536.webp` painting and never upscale it.

Encoded on 2026-11-10 with ImageMagick 7 and avifenc 1.4.2 / libaom 3.15.3:

```bash
magick start-room-1536.webp source.png
for width in 800 1280 1536; do
  magick source.png -resize "${width}x" "room-${width}.png"
  avifenc -j 2 -s 4 -q 50 -y 420 "room-${width}.png" "start-room-${width}.avif"
done
for width in 800 1280; do
  magick source.png -resize "${width}x" -quality 82 "start-room-${width}.webp"
done
```

AVIF sizes: 800 pixels / 36,344 bytes; 1280 pixels / 73,994 bytes; 1536 pixels / 97,278 bytes.
The previous landscape AVIF was 157,342 bytes. The original largest WebP remains the fallback and encoding source.
The phone AVIF remains 113,573 bytes; the phone and below-fold TV painting have no encoding changes.

The full paintings and a side-by-side sofa/window crop were inspected. At quality 50, fine fabric and rug detail
softens slightly, with the colors, composition and painted texture retained. Quality 40 and 45 were also compared
by file size; 50 keeps more detail while meeting the 80–110 KB largest-image target.

`room-pictures.ts` shares responsive candidates, sizes and CORS mode between the picture and HTML head preload.
The head preloads AVIF only, with the matching orientation query. A responsive preload cannot select a candidate
in a 103 response because the viewport does not exist yet; see [responsive image preloading](https://web.dev/articles/preload-responsive-images).
