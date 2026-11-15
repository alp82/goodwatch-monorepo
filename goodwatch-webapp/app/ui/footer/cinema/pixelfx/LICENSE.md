# pixelfx (vendored for the footer cinema)

The footer cinema's effects, made with pixelfx (https://github.com/patch-gg/pixelfx, MIT) on top of commit
a84159688af3ca37a4be05a0d422b94451b2e24e. The `fx/cinema-show/` effects were made for the footer cinema with the
library's tools in a local checkout, `fx/stats-page/` holds the montage's flourishes from the stats page, and
`fx/lightning/_lib.js` is the library's own. `core/index.js` and `core/index.d.ts` re-export the app's shared core
(`app/ui/pixelfx/core`) and are written by hand. `idle.js` (the projector the footer draws) and `show.js` (everything
the show plays) map pixelfx ids to modules.

To vendor again, update the pixelfx checkout and run `node scripts/vendor-footer-cinema-fx.mjs [pixelfx/src]` from
`goodwatch-webapp/` (the default source is `~/.cache/pixelfx-src/pixelfx/src`). The script clears `fx/`, copies the
effects it lists and the files they import, and writes both maps. To play another effect, add its id to the script's
lists and run it again.

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
