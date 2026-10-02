// Keyframes for the IMDb export explainer (ImdbExportHowTo.tsx).
//
// Every animated element's own style is its END state, and each keyframe only describes where it comes from.
// So with animations switched off (reduced motion, or the static step list) each scene shows its final picture.
// `--d` is the delay in seconds from the start of the scene. Being plain CSS, pausing is `animation-play-state`.
//
// The text goes into a <style> element as a React child, which escapes & < > " and ' when rendering on the server.
// Keep those five characters out of it.
export const HOWTO_CSS = `
.gwhowto-in { animation: gwhowto-in .45s ease-out var(--d, 0s) both; }
.gwhowto-rise { animation: gwhowto-rise .45s cubic-bezier(.22, 1, .36, 1) var(--d, 0s) both; }
.gwhowto-out { opacity: 0; animation: gwhowto-out .3s ease-out var(--d, 0s) both; }
.gwhowto-enable { animation: gwhowto-enable .3s ease-out var(--d, 0s) both; }
.gwhowto-cursor { animation: gwhowto-cursor 1.1s cubic-bezier(.45, 0, .2, 1) var(--d, 0s) both; }
.gwhowto-ripple { opacity: 0; animation: gwhowto-ripple .6s ease-out var(--d, 0s) both; }
.gwhowto-press { animation: gwhowto-press .3s ease-in-out var(--d, 0s) both; }
.gwhowto-pop { animation: gwhowto-pop .4s cubic-bezier(.34, 1.56, .64, 1) var(--d, 0s) both; }
.gwhowto-file { animation: gwhowto-file 2.4s linear var(--d, 0s) both; }
.gwhowto-fill { transform-origin: left center; animation: gwhowto-fill var(--dur, 4s) linear both; }
.gwhowto-spin { animation: gwhowto-spin 2.4s linear infinite; }

@keyframes gwhowto-in { from { opacity: 0; } }
@keyframes gwhowto-rise { from { opacity: 0; transform: translateY(8px); } }
@keyframes gwhowto-out { from { opacity: 1; } }
@keyframes gwhowto-enable { from { opacity: .35; } }
@keyframes gwhowto-cursor {
	0% { opacity: 0; transform: translate(var(--fx, -80px), var(--fy, 60px)); }
	15% { opacity: 1; }
}
@keyframes gwhowto-ripple {
	0% { opacity: 0; transform: scale(.3); }
	15% { opacity: .8; }
	100% { opacity: 0; transform: scale(1.9); }
}
@keyframes gwhowto-press { 50% { transform: scale(.9); } }
@keyframes gwhowto-pop { from { opacity: 0; transform: scale(.3); } }
@keyframes gwhowto-file {
	0% { opacity: 0; transform: translateY(calc(var(--lift, -120px) - 36px)); animation-timing-function: cubic-bezier(.22, 1, .36, 1); }
	22% { opacity: 1; transform: translateY(var(--lift, -120px)); }
	58% { opacity: 1; transform: translateY(var(--lift, -120px)); animation-timing-function: cubic-bezier(.65, 0, .35, 1); }
	100% { opacity: 1; transform: none; }
}
@keyframes gwhowto-fill { from { transform: scaleX(0); } }
@keyframes gwhowto-spin { to { transform: rotate(360deg); } }

.gwhowto[data-paused=true] *,
.gwhowto[data-paused=true] *::before,
.gwhowto[data-paused=true] *::after { animation-play-state: paused !important; }

.gwhowto[data-static=true] *,
.gwhowto[data-static=true] *::before,
.gwhowto[data-static=true] *::after { animation: none !important; }

@media (prefers-reduced-motion: reduce) {
	.gwhowto *,
	.gwhowto *::before,
	.gwhowto *::after { animation: none !important; }
}
`
