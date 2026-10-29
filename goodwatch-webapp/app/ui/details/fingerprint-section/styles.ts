// The fingerprint section's motion, in one style block the section renders once: opacity and transform only, and none
// of it for a viewer who asks for reduced motion.
export const SECTION_STYLE = `
@keyframes fp-grow { from { opacity: 0; transform: scale(.6); } to { opacity: 1; transform: none; } }
@keyframes fp-in { from { opacity: 0; } to { opacity: 1; } }
.fp-shape { transform-origin: 0 0; animation: fp-grow .8s cubic-bezier(.2,.75,.25,1) both .1s; }
.fp-fade { transition: opacity .22s ease; }
.fp-pop { transform-origin: 0 0; transition: transform .38s cubic-bezier(.2,.8,.2,1), opacity .22s ease; }
.fp-in { animation: fp-in .24s ease both; }
.fp-xin { animation: fp-in .2s ease both; }
.fp-xout { opacity: 0; transition: opacity .2s ease; }
.fp-late { animation: fp-in .32s ease both; }
.fp-fan { transition: transform .18s cubic-bezier(.2,.8,.2,1); }
.group\\/stack:enabled:hover .fp-fan, .group\\/stack:focus-visible .fp-fan { transform: translateX(calc(var(--i) * 1.2px)); }
.fp-taste-fan { transform: translateX(0) rotate(var(--r)); transition: transform .2s cubic-bezier(.2,.8,.2,1); }
.group\\/taste:hover .fp-taste-fan { transform: translateX(var(--x)) rotate(calc(var(--r) * 1.6)); }
@media (prefers-reduced-motion: reduce) {
	.fp-shape, .fp-in, .fp-xin, .fp-late { animation: none; }
	.fp-fade, .fp-pop, .fp-xout, .fp-fan, .fp-taste-fan { transition: none; }
}
`
