# Living room rendering budget on low-end devices

Research for [#190](https://github.com/alp82/goodwatch-monorepo/issues/190), a child of the recommendation redesign map [#172](https://github.com/alp82/goodwatch-monorepo/issues/172). Written 2026-09-27.

## Question

What does the living room start page cost to render on low-end laptops and phones, which effects can it afford, and what budget should it hold to?

The prototype under review is round 4: `goodwatch-webapp/app/routes/prototype.start-living-room-4.tsx`, with its UI in `app/ui/prototype-start-living-room/` (`r3.tsx`, `r4.tsx`, `tv.tsx`, `channels.tsx`). Framer Motion is 11.18.2.

## Short answer

The page can keep almost every effect it has, if each effect follows three rules:

1. **Only `transform` and `opacity` may move on a loop or follow the pointer.** Everything else (blur, blend modes, box-shadow, clip-path, SVG geometry) may change only in short, one-shot transitions that end.
2. **When nothing is happening, nothing animates.** No infinite animation runs on screen unless it is a single small transform or opacity animation, and even that stops when the tab is hidden or the user asks for reduced motion.
3. **No blend modes or live blur over the room photo.** The photo is a full-viewport layer. Anything that blends or blurs against it repaints the whole viewport each frame.

The budget:

| Metric | Budget | Where it comes from |
| --- | --- | --- |
| Idle CPU, TV on, no input | 5% of one core or less on a GPU laptop; 10% or less under software rendering | Measured: 86% with blend light and dust, about 9% without |
| Frame work during interaction | 10 ms or less per frame on the main thread; no task over 50 ms | RAIL model |
| Input response | INP 200 ms or less at p75 | Core Web Vitals |
| LCP (room photo) | 2.5 s or less at p75; 2.0 s or less in a Lighthouse mobile lab run | Core Web Vitals, Lighthouse mobile throttling |
| Room photo | 120 KB or less on phones, 250 KB or less on desktop | This document |
| Image bytes above the fold | 400 KB or less on phones, 700 KB or less on desktop | This document, against HTTP Archive medians |
| Decoded image memory | 32 MB or less for the room, hand and TV content | 4 bytes per pixel |

## What the platform guarantees

### Compositor-only properties

- Browsers can animate `transform` and `opacity` cheaply. Changing them "only requires compositing changes," and opacity is handled by the GPU during compositing ([web.dev: animations overview](https://web.dev/articles/animations-overview), [web.dev: stick to compositor-only properties](https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count)).
- Animations of `transform`, `opacity` and `filter` "can be run entirely on the compositor thread and skip the main thread" in Chromium ([Chrome: RenderingNG architecture](https://developer.chrome.com/docs/chromium/renderingng-architecture)).
- Current Chromium lists composited `clip-path` and `background-color` animations as stable. Composited `box-shadow` animation is not stable, so box-shadow animations still repaint every frame ([Chromium `runtime_enabled_features.json5`](https://raw.githubusercontent.com/chromium/chromium/refs/heads/main/third_party/blink/renderer/platform/runtime_enabled_features.json5)). The Chrome team announced the clip-path and background-color work in 2021 ([Chrome: hardware-accelerated animations](https://developer.chrome.com/blog/hardware-accelerated-animations)). Safari historically had the faster clip-path path ([Chromium paint-dev, 2017](https://groups.google.com/a/chromium.org/g/paint-dev/c/3bXUo0X3C5I)).
- Paint "is often the longest-running of all tasks." On mobile, the roughly 10 ms frame budget is usually too small for paint during an animation ([web.dev: animations overview](https://web.dev/articles/animations-overview), [web.dev: simplify paint complexity](https://web.dev/articles/simplify-paint-complexity-and-reduce-paint-areas)).
- Anything that involves a blur takes longer to paint than a plain box ([web.dev: simplify paint complexity](https://web.dev/articles/simplify-paint-complexity-and-reduce-paint-areas)).
- Lighthouse flags any animation that runs style, layout or paint as a non-composited animation ([Lighthouse: non-composited animations](https://developer.chrome.com/docs/lighthouse/performance/non-composited-animations)).

### Software rendering

- Without GPU acceleration, Chrome uses a software compositor. 3D transforms and composited filters still work there, but raster and compositing run on the CPU ([Chromium: GPU accelerated compositing](https://www.chromium.org/developers/design-documents/gpu-accelerated-compositing-in-chrome/), [Chrome: RenderingNG architecture](https://developer.chrome.com/docs/chromium/renderingng-architecture)).
- This is why the measured 86% matters. Low-end laptops with blocklisted GPU drivers, virtual machines and remote desktops take this path. Under software compositing, even a "compositor-only" animation costs CPU in proportion to the pixels that change. A blend mode forces every pixel under it to be recombined each frame.
- No primary source publishes a number for `mix-blend-mode` or large `filter: blur()` layers under software raster. The 86% versus 9% measurement is the best figure available for this page.

### Layers and memory

- A 3D or perspective transform, an accelerated filter, and an opacity or transform animation each promote an element to its own compositing layer. The compositor splits layers into tiles and rasterizes each tile ([Chromium: GPU accelerated compositing](https://www.chromium.org/developers/design-documents/gpu-accelerated-compositing-in-chrome/)).
- "Every layer you create requires memory and management." Layer textures must be uploaded to the GPU, and on devices with little memory the cost can outweigh the benefit ([web.dev: manage layer count](https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count)).
- MDN calls `will-change` "a last resort." Overuse causes excessive memory use; set it from script just before a change and remove it after ([MDN: will-change](https://developer.mozilla.org/en-US/docs/Web/CSS/will-change)).
- A decoded bitmap takes 4 bytes per pixel, whatever the file format ([MDN: ImageData](https://developer.mozilla.org/en-US/docs/Web/API/ImageData/ImageData)). A layer texture costs about the same per pixel.

### JavaScript-driven animation

- CSS transitions sample styles on the main thread much like a `requestAnimationFrame` callback. The gain comes only when the property skips layout and paint, because then sampling can move off the main thread ([MDN: CSS and JavaScript animation performance](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/CSS_JavaScript_animation_performance)).
- The Web Animations API is "one of the most performant ways to animate on the Web" and underlies CSS animations and transitions ([MDN: using the Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API/Using_the_Web_Animations_API)).
- `requestAnimationFrame` pauses in background tabs and hidden iframes, and fires at the display rate, so a 120 Hz screen runs a spring loop twice as often ([MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)).
- Framer Motion 11.18.2 hands an animation to the Web Animations API only for the values `opacity`, `clipPath`, `filter` and `transform`, and only without `onUpdate`, `transformTemplate`, `repeatDelay` or mirror repeats (`node_modules/framer-motion/dist/es/animation/animators/utils/accelerated-values.mjs` and `AcceleratedAnimation.mjs`). Individual transform shorthands (`x`, `y`, `scale`, `rotate`, `rotateX`) and `boxShadow` run in Framer Motion's main-thread frame loop. Springs on accelerated values are pregenerated into keyframes.

### SVG

- Since Chromium 89, SVG animations are hardware-accelerated by default ([Chrome: hardware-accelerated animations](https://developer.chrome.com/blog/hardware-accelerated-animations)). The post does not say which properties qualify.
- No primary source covers per-frame updates of SVG geometry attributes such as a line's `x1` and `y2`. Changing geometry cannot be done by the compositor, so each update repaints the line's bounds. Keep the SVG small or the update rare.

### Reduced motion, idle work and battery

- `prefers-reduced-motion: reduce` reports that the user asked the OS to minimize motion. web.dev recommends adding decorative motion only under `no-preference` ([web.dev: prefers-reduced-motion](https://web.dev/articles/prefers-reduced-motion)).
- WebKit: "Minimize continually animating content." Painting on macOS and iOS uses the GPU, so repaints raise power use. Declarative CSS animations let the engine skip work when the content is not visible ([WebKit: how web content can affect power usage](https://webkit.org/blog/8970/how-web-content-can-affect-power-usage/)).
- The Page Visibility API is the documented way to pause carousels and polling in hidden tabs ([MDN: Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)). Chrome throttles timers in hidden tabs to once per second, and to once per minute after 5 minutes ([Chrome: timer throttling in Chrome 88](https://developer.chrome.com/blog/timer-throttling-in-chrome-88)).
- `content-visibility: auto` skips rendering of offscreen content and is Baseline ([web.dev: content-visibility](https://web.dev/articles/content-visibility)).

### Frame and load budgets

- RAIL: produce each frame in 10 ms of work or less out of a 16 ms frame at 60 fps. Run idle work in chunks of 50 ms or less and finish a response within 100 ms ([web.dev: RAIL](https://web.dev/articles/rail)). A task over 50 ms is a long task ([web.dev: optimize long tasks](https://web.dev/articles/optimize-long-tasks)).
- INP is good at 200 ms or less at p75 ([web.dev: INP](https://web.dev/articles/inp)). LCP is good at 2.5 s or less for 75% of visits ([web.dev: optimize LCP](https://web.dev/articles/optimize-lcp)).
- Lighthouse mobile throttles to 150 ms latency, 1.6 Mbps down, and a 4x CPU slowdown ([Lighthouse throttling docs](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md)).

### Images

- Give the LCP image `fetchpriority="high"`, make it discoverable in the HTML or through a preload, and never lazy-load it ([web.dev: optimize LCP](https://web.dev/articles/optimize-lcp)).
- Serve 3 to 5 sizes with `srcset` and `sizes`. Desktop-sized images on phones use 2 to 4 times more data than needed ([web.dev: serve responsive images](https://web.dev/articles/serve-responsive-images)).
- AVIF saves more than 50% over JPEG in real-world tests ([web.dev: AVIF](https://web.dev/articles/compress-images-avif)).
- `decoding="async"` can let other content render first. `img.decode()` decodes an image before it is swapped in ([web.dev: image performance](https://web.dev/learn/performance/image-performance), [MDN: HTMLImageElement.decoding](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decoding)).
- A first budget from web.dev allows about 345 KB in total for Slow 4G on a mid-range phone ([web.dev: your first performance budget](https://web.dev/articles/your-first-performance-budget)). The median mobile page ships 900 KB of images ([HTTP Archive Web Almanac 2024](https://almanac.httparchive.org/en/2024/page-weight)). A photo-led start page cannot meet the web.dev figure, but it should stay well under the median.

## The effects on this page

Each row names the effect, how the prototype builds it, what it costs, and the rule it should follow.

| Effect | How it is built now | Cost | Verdict |
| --- | --- | --- | --- |
| TV light on the room | Blend-mode light layer plus blurred drifting motes (earlier rounds); now a plain translucent radial gradient with an opacity change (`r3.tsx`, around line 1004) | Blend version: 86% of a core idle under software rendering. Gradient version: a one-shot opacity change | Keep the gradient. Never bring back `mix-blend-mode` or animated blur over the photo |
| Remote aiming | `useSpring` yaw and pitch drive `rotate`, `rotateX`, `rotateY` with `transformPerspective` on a `will-change-transform` wrapper that holds the remote and the hand photo (`r3.tsx`, around line 1052) | Main-thread spring each frame while the pointer moves, but transform only, so no layout or paint. One 3D layer about the size of the hand image, kept alive by `will-change` | Affordable. Run it only while pointing (already true on desktop and mouse only). Drop `will-change` when idle, or accept one permanent layer. Skip aiming under reduced motion |
| Pointer beam | An SVG line and gradient spanning the whole root, with `x1`, `y1`, `x2`, `y2` rewritten on every spring tick (`r3.tsx`, `drawBeam`) | Repaints the line's bounding box each frame; cheap for a 3 px line, but the SVG is viewport-sized | Affordable while pointing. Consider a `div` rotated and scaled with `transform` instead, which the compositor can move without repainting |
| TV cursor | `translate` written straight to `style.transform` on a `will-change: transform` element (`tv.tsx`, around line 207) | Compositor only | Keep |
| Hover on pickable posters | `transform: scale`, `filter: brightness`, and `box-shadow` transitions (`tv.tsx`, `.lr-pointing [data-pick]:hover`) | Box-shadow repaints for 160 ms per hover | Acceptable as a short transition. Prefer an outline ring or a pre-drawn shadow faded with opacity |
| CRT power on and off | Framer Motion keyframes on `clipPath` and `opacity`, plus a white flash and a glowing dot (`tv.tsx`, around line 244) | Runs as a Web Animations API animation, composited in current Chromium. One-shot, under 1 s | Keep. Under reduced motion, cross-fade instead |
| Channel change | Framer Motion `y`, `scaleY` and `filter: brightness() blur()` (`tv.tsx`, around line 256); static noise with `mix-blend-mode: screen` stepping `background-position` every 140 ms, plus a blurred roll bar animating `top` (`tv.tsx`, `.lr-static`, `.lr-roll`) | `y` and `scaleY` run on the main thread. Blur over the whole TV content repaints for 340 ms. The static uses a blend mode and animates `background-position` and `top`, both paint or layout | Allowed only because each lasts under half a second and follows input. Move the roll bar to `transform: translateY`. Drop the blend mode on the static if a plain opacity overlay looks close enough |
| Screen flicker and scanlines | `.lr-flicker` opacity loop and `.lr-scan` static gradient (`tv.tsx`) | Scanlines are static. Flicker is an infinite opacity animation | Scanlines are free. Flicker breaks the idle rule; remove it or limit it to a few seconds after power-on |
| Preview strip progress | `.lr-progress` CSS `transform: scaleX` animation on a 3 px bar (`channels.tsx`, `Strip`), plus a `setInterval` that cycles items | Compositor only; the cycle re-renders React every few seconds | Keep. Pause the cycle when the tab is hidden or the TV is off screen |
| Ken Burns backdrop | `.lr-kenburns` 18 s infinite `transform` loop on a 1280 px backdrop inside the TV (`channels.tsx`, `tv.tsx`) | Compositor only on a GPU. Under software compositing it redraws the whole TV area every frame, which is likely most of the remaining 9% | Run it once, not infinitely, or hold still after the first pass. Already off under reduced motion |
| Infinite pulses and spinners | Framer Motion `repeat: Infinity` on a logo pulse and a placeholder shimmer (`channels.tsx`), a spinner in `r3.tsx` | Small, but each keeps a frame loop alive | Allow only while something is loading. Stop them once the content arrives |
| Blurred images | `blur-md`, `blur-sm` and `blur-2xl` on backdrop images at low opacity (`r4.tsx`, `channels.tsx`), `blur-2xl` on the room photo on phones (`r3.tsx`, around line 995), `backdrop-blur-md` panels (`r3.tsx`) | Static blur is painted once, but a large blur radius is costly to raster and repaints whenever anything under or inside it changes | Bake the blur into a small pre-blurred image (for example 64 px wide, scaled up) instead of CSS `filter: blur()`. Avoid `backdrop-filter` over anything that animates |
| Glow shadows | TV frame `boxShadow` animated by Framer Motion when the set turns on (`r3.tsx`, around line 1013); red and blue remote LED shadows animated on each press | Box-shadow animation repaints every frame on the main thread | Short and rare, so acceptable. Cheaper: fade a pre-drawn glow with opacity |

## Images on this page

Measured from `goodwatch-webapp/app/img/prototype-living-room/`:

| Image | Size | Format | Decoded |
| --- | --- | --- | --- |
| `room-teal-a.webp` (the LCP element) | 1672 x 941, 292 KB | Lossy WebP | 6.3 MB |
| `room-teal-b.webp`, `room-teal-c.webp` | 1672 x 941, 296 KB to 313 KB | Lossy WebP | 6.3 MB each |
| `hand2-back.webp` | 1024 x 1536, 349 KB | Lossless WebP | 6.3 MB |

The route also loads TMDB backdrops at `w780` and `w1280` and posters at `w92` to `w342` inside the TV.

Recommendations:

- Serve the room photo as AVIF with a WebP fallback at three widths (for example 960, 1280 and 1672). The room shows as only a fraction of the screen on phones, so 960 is enough there. Aim for 120 KB or less on phones and 250 KB or less on desktop.
- Encode the hand as lossy WebP or AVIF with alpha. Lossless is the wrong format for a photo; this one image weighs more than the room. Aim for 80 KB or less. It is desktop only, so do not load it on phones.
- Mark the room photo `fetchpriority="high"` and render it in the server HTML (it is currently rendered after a client-side measurement, which delays LCP). Keep the first load free of a fade from opacity 0 (the prototype's `AnimatePresence initial={false}` already does this); LCP counts only once it is painted.
- Load TMDB backdrops inside the TV after the room is painted, at `w780`, with `decoding="async"`. Decode the next channel's backdrop with `img.decode()` before a switch.
- Keep decoded image memory for the room, hand and visible TV content under about 32 MB. At 4 bytes per pixel the room and hand already take 12.6 MB.

## Budget, with rationale

- **Idle CPU: 5% of one core or less on a GPU laptop, 10% or less under software rendering.** Measure with Chrome's task manager or `top` on the renderer process, with the TV on, the pointer outside the window, and 30 s of settling. The current build measures about 9% under software rendering; the Ken Burns loop and the flicker are the likely remainder. Ten percent is the ceiling, not the target.
- **Frame work: 10 ms or less of main-thread work per frame while aiming, zapping or navigating, and no long task over 50 ms.** Check in a Performance panel trace with 4x CPU throttling. The spring and the beam update are small; React re-renders on each key press are the risk.
- **INP: 200 ms or less at p75.** Every remote press must paint its first feedback within one frame.
- **LCP: 2.5 s or less at p75 in the field, 2.0 s or less in a Lighthouse mobile run.** The room photo is the LCP element on desktop. On phones the TV block or the blurred room copy may be.
- **Image weight: 400 KB or less above the fold on phones, 700 KB or less on desktop,** counting the room, the hand and the first TV screen.

## Checks before shipping

- Run once with `chrome --disable-gpu` (software compositing) and confirm idle CPU at 10% or less.
- Emulate `prefers-reduced-motion: reduce` and confirm no infinite animation runs and aiming is off.
- Run Lighthouse mobile and confirm LCP and the "Avoid non-composited animations" audit. The only flagged animations should be the one-shot channel change and glow.
- Hide the tab for a minute and confirm the preview cycle and any `setInterval` stop.

## Gaps

- No primary source quantifies `mix-blend-mode` or large blur cost under software raster. The 86% versus 9% measurement on this page is the evidence.
- No primary source documents the cost of per-frame SVG attribute updates.
- Low-end phones were not measured for this page. The budgets rely on Lighthouse's 4x CPU throttling as a stand-in.
