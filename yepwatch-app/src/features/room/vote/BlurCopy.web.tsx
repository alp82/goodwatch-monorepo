/**
 * Bleed's blurred poster backdrop on the web, drawn once into a canvas instead of as a CSS-filtered image.
 *
 * `filter: blur(48px)` on a stage-sized image was the most expensive raster of every look: 25-100 ms of raster work
 * each time a layer holding it was first drawn (the press, the match), in software on a phone browser without GPU
 * raster. The canvas runs the same filter once, when the copy is built, at half the size (a blur that wide leaves
 * nothing finer than its radius), and it is a bitmap: no raster at all when it shows.
 *
 * It draws what the CSS image drew. React Native Web's Image puts its `filter` on both its box (which clips) and the
 * background inside it, so the poster was filtered twice: blurred, brightened and contrasted, clipped to the box, then
 * all of that again with the edges softening outward. The canvas does the same two passes, with transparent
 * surroundings, and reaches 3 radii past the box. Screenshots differ from the CSS image by a few levels at most
 * (canvas and CSS blurs aren't bit-identical even at full size). Without canvas filters (older Safari) it falls back
 * to the CSS image.
 */
import { useEffect, useRef, useState } from 'react';
import type { BlurCopyProps } from './BlurCopy';
import { PosterCopy } from './shapes';

/** Canvas pixels per CSS pixel. */
const SCALE = 0.5;

const supported = (() => {
  if (typeof document === 'undefined') return false;
  const ctx = document.createElement('canvas').getContext('2d');
  return Boolean(ctx && typeof ctx.filter === 'string');
})();

export function BlurCopy({ uri, width, height, blur, rest, nativeBlur, tints }: BlurCopyProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const margin = Math.ceil(blur * 3);
  const cw = Math.ceil((width + margin * 2) * SCALE);
  const ch = Math.ceil((height + margin * 2) * SCALE);
  useEffect(() => {
    const el = canvas.current;
    if (!supported || !uri || !el) return;
    let live = true;
    const img = new Image();
    img.decoding = 'async';
    img.src = uri;
    img.decode().then(() => {
      const ctx = live ? el.getContext('2d') : null;
      const first = live ? document.createElement('canvas').getContext('2d') : null;
      if (!ctx || !first) return;
      const filter = `blur(${blur * SCALE}px) ${rest}`;
      const [bx, by, bw, bh] = [margin * SCALE, margin * SCALE, width * SCALE, height * SCALE];
      first.canvas.width = cw;
      first.canvas.height = ch;
      // Pass 1: the background, `cover` in the box (the source cropped to the box's shape first, as CSS crops it before
      // its filter runs), filtered, then clipped to the box.
      const s = Math.max(width / img.naturalWidth, height / img.naturalHeight);
      const sw = width / s;
      const sh = height / s;
      first.beginPath();
      first.rect(bx, by, bw, bh);
      first.clip();
      first.filter = filter;
      first.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, bx, by, bw, bh);
      // Pass 2: the box, filtered again, unclipped.
      ctx.clearRect(0, 0, cw, ch);
      ctx.filter = filter;
      ctx.drawImage(first.canvas, 0, 0);
    }, () => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [uri, width, height, blur, rest, margin, cw, ch]);
  if (!supported || failed) return <PosterCopy uri={uri} css={`blur(${blur}px) ${rest}`} blur={nativeBlur} tints={tints} />;
  if (!uri) return null;
  return <canvas ref={canvas} width={cw} height={ch} aria-hidden style={{ position: 'absolute', left: -margin, top: -margin, width: width + margin * 2, height: height + margin * 2, pointerEvents: 'none' }} />;
}
