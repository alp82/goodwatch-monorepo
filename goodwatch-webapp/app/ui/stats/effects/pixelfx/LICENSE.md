# pixelfx (vendored for the stats page)

Copied from https://github.com/patch-gg/pixelfx by `scripts/vendor-stats-fx.mjs`. `core/index.js` re-exports the app's
shared core (`app/ui/pixelfx/core`, see its LICENSE.md). `fx/cinema/`, `fx/pickups/` and `fx/explosions/` are the
library's effects; `fx/stats/`, `fx/stats-page/` and `fx/quiz/` were written for this page with the library's tools.

## Re-vendoring

1. Change or add the effect in a pixelfx checkout (by default `~/.cache/pixelfx-src/pixelfx`).
2. Name it in `EFFECTS` in `scripts/vendor-stats-fx.mjs` if it is new, and play it from `../spots.ts`, `../hero-roll.ts`
   or `../../quiz.tsx`.
3. Run `node scripts/vendor-stats-fx.mjs` from `goodwatch-webapp/`. It replaces `fx/`, writes `registry.js` and
   `registry.d.ts`, and draws the roll button's die into `../../die-faces.ts`.

## License

MIT License

Copyright (c) 2026 Patch
Copyright (c) 2026 Hugo Duprez

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Notice

**Hugo Duprez.** `src/core/sim.js` and the effects that say so at the top of their file adapt Sprite Fusion's
open-source pixel art VFX (https://www.spritefusion.com/pixel-art-vfx), Copyright (c) 2026 Hugo Duprez, MIT License.

**Hollow Crown.** `src/core/act.js` adapts how Hollow Crown plays its skills (poses on 12 fps steps, hit-stops, the springy
straw target), from
https://github.com/rehan-remade/hollow-crown, Copyright (c) 2026 rehan-remade, MIT License.

**Patch Pixel.** The font in `gallery/fonts` is Patch's own and is not covered by this repository's MIT license. See
`gallery/fonts/NOTICE.md`.
