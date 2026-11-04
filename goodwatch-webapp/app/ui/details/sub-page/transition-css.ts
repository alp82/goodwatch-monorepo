// The View Transition between a title page and its sub-pages (way-in.ts). html[data-sub-transition] is "in" going
// into a sub-page and "out" coming back. The site header, the title bar and the rail's You block and index hold still
// (the rail's index is the same list, one entry now selected with its parts under it); the rest of the page fades
// out and the next one rises in. The title page's pieces are named by selectors here (TitlePage.tsx keeps no names
// of its own), the sub-page frame's by its data-sub-* attributes. Injected once into <head>, so it is there for
// whichever page animates. Only transform and opacity animate.
const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)"
const IN = "280ms"
const OUT = "240ms"

/** The title page's rail (TitlePage.tsx): the You block, then find and the index. */
const PAGE_YOU = 'aside[aria-label="You and this page"] > #you'
const PAGE_INDEX = 'aside[aria-label="You and this page"] > #you + div'

const T = "html[data-sub-transition]"

export const TRANSITION_CSS = /* css */ `
${T}::view-transition { background: rgb(17 24 39); }
${T}::view-transition-old(root),
${T}::view-transition-new(root) { animation: none; mix-blend-mode: normal; }
${T}::view-transition-group(*) { animation-duration: ${IN}; animation-timing-function: ${EASE}; }
html[data-sub-transition="out"]::view-transition-group(*) { animation-duration: ${OUT}; }

/* The site header holds still. */
${T} [data-site-header] { view-transition-name: sub-site-header; }
${T}::view-transition-group(sub-site-header),
${T}::view-transition-new(sub-site-header) { animation: none; }
${T}::view-transition-old(sub-site-header) { display: none; }

/* The title bar holds still, and so do the rail's You block and index (desktop: on a phone they are far down). */
${T} [data-title-bar], ${T} [data-sub-bar] { view-transition-name: sub-bar; }
@media (min-width: 1024px) {
	${T} ${PAGE_YOU}, ${T} [data-sub-you] { view-transition-name: sub-you; }
	${T} ${PAGE_INDEX}, ${T} [data-sub-index] { view-transition-name: sub-index; }
}
${T}::view-transition-group(sub-bar) { z-index: 3; }

@keyframes sub-fade-out { to { opacity: 0; } }
@keyframes sub-fade-in { from { opacity: 0; } }
@keyframes sub-rise-in { from { opacity: 0; transform: translateY(14px); } }
@keyframes sub-sink-out { to { opacity: 0; transform: translateY(14px); } }
html[data-sub-transition="in"]::view-transition-old(root) { animation: sub-fade-out 180ms ease-out both; }
html[data-sub-transition="in"]::view-transition-new(root) { animation: sub-rise-in 260ms ${EASE} 40ms both; }
html[data-sub-transition="out"]::view-transition-old(root) { z-index: 1; animation: sub-sink-out 200ms ease-out both; }
html[data-sub-transition="out"]::view-transition-new(root) { animation: sub-fade-in 240ms ease-out 30ms both; }
`
