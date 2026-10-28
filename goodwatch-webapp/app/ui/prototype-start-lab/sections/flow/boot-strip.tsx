// PROTOTYPE (start page lab) · Round 18: the old TV's boot screen (ui/living-room/intro/boot.tsx + boot.css, imported
// as they are, sped up) in a strip the header's size at the top of the screen, while the page assembles under it; then
// the strip hands over to the real site header, which sits underneath the whole time (fixed, in the root layout), so
// its box never moves. Hand-offs, transform and opacity only:
// - "tv": the strip powers down like an old TV, the picture squashing into a bright line, and the header opens out of
//   that line (two black halves part from the middle).
// - "logo": the boot's G and "oodWatch" travel and scale onto the header's wordmark while the black fades and the
//   header's other parts show; the real wordmark takes over where they land.
// - "sweep": an amber glow runs across the strip left to right and leaves the header behind it (a black cover moved
//   right with its content moved left by the same amount: a wipe done with two transforms, no clip-path).
// - "quiet": the boot plays small, then crossfades into the header with a slight lift, and the search field glows once.
// A tap or a key anywhere skips to the hand-off; reduced motion gets a short fade.
import { type RefObject, useCallback, useEffect, useRef, useState } from "react"
import "~/ui/living-room/intro/boot.css"
import { Boot } from "~/ui/living-room/intro/boot"
import { type Box, fieldBox, RING_CSS, sinceFirstPaint } from "./boot-overlay"

export type StripMode = "tv" | "logo" | "sweep" | "quiet"

/** The boot in the strip ends at ~1.1 s (sped up below); the hand-off starts here, counted from the first paint. */
const HOLD_MS = 1150
const HOLD_REDUCED_MS = 600
/** Each hand-off's length (the strip is removed after it). */
const OUT_MS: Record<StripMode, number> = { tv: 460, logo: 600, sweep: 500, quiet: 480 }

const HDR = "[data-site-header]"
const WORDMARK = `${HDR} a[aria-label="GoodWatch home"]`
/** The header's own parts (phone row and desktop grid), for quiet's lift. */
const HDR_PARTS = `${HDR} > div.h-16 > *,${HDR} > header > div > *`

const CSS = `.fl-strip{position:fixed;left:0;right:0;top:0;height:64px;z-index:1100;overflow:hidden;cursor:pointer;-webkit-tap-highlight-color:transparent}
@media (min-width:1024px){.fl-strip{height:65px}}
.fl-strip[data-s=out],.fl-strip[data-s=land]{pointer-events:none;cursor:default}
.fl-strip .boot{background:transparent;animation:none}
.fl-strip .boot-push{animation:none}
.fl-strip .boot-lockup{font-size:28px}
@media (min-width:640px){.fl-strip .boot-lockup{font-size:36px}}
.fl-strip .boot-glow{animation-duration:.8s;animation-delay:.05s;background:radial-gradient(22% 120% at 50% 50%,rgb(251 191 36/.16) 0,rgb(251 191 36/0) 70%)}
.fl-strip .boot-standby{width:5px;height:5px;margin-left:-2.5px;bottom:6px;box-shadow:0 0 10px 3px rgb(251 191 36/.5);animation:boot-breathe .8s ease-in-out both,boot-dot-out .3s ease-in .8s forwards}
.fl-strip .boot-arc{animation-duration:.85s;animation-delay:.05s}
.fl-strip .boot-g{animation-duration:.6s;animation-delay:.08s}
.fl-strip .boot-text{animation-duration:.6s;animation-delay:.48s}
.fl-bg{position:absolute;inset:0;background:#000}

.fl-half{position:absolute;left:0;right:0;height:50%;background:#000}
.fl-half-t{top:0}.fl-half-b{bottom:0}
.fl-tv{position:absolute;inset:0;transform-origin:50% 50%}
.fl-flash{position:absolute;inset:0;opacity:0;background:linear-gradient(90deg,rgb(251 191 36/.25),rgb(255 247 220/.9) 50%,rgb(251 191 36/.25))}
.fl-line{position:absolute;left:0;right:0;top:50%;height:2px;margin-top:-1px;opacity:0;background:linear-gradient(90deg,rgb(251 191 36/0),#fcd34d 18%,#fffbeb 50%,#fcd34d 82%,rgb(251 191 36/0));box-shadow:0 0 12px 2px rgb(251 191 36/.55)}
@keyframes fl-tv-off{70%{opacity:1}to{transform:scaleY(.03);opacity:0}}
@keyframes fl-flash{to{opacity:1}}
@keyframes fl-line{0%{opacity:0}35%{opacity:1;transform:none}100%{opacity:0;transform:scaleX(0)}}
@keyframes fl-part-t{to{transform:translateY(-101%)}}
@keyframes fl-part-b{to{transform:translateY(101%)}}
.fl-strip[data-mode=tv][data-s=out] .fl-tv{animation:fl-tv-off .18s cubic-bezier(.6,0,.9,.5) both}
.fl-strip[data-mode=tv][data-s=out] .fl-flash{animation:fl-flash .16s ease-in both}
.fl-strip[data-mode=tv][data-s=out] .fl-line{animation:fl-line .44s cubic-bezier(.4,0,.2,1) .06s both}
.fl-strip[data-mode=tv][data-s=out] .fl-half-t{animation:fl-part-t .27s cubic-bezier(.2,.8,.2,1) .16s both}
.fl-strip[data-mode=tv][data-s=out] .fl-half-b{animation:fl-part-b .27s cubic-bezier(.2,.8,.2,1) .16s both}

.fl-strip[data-mode=logo] .boot-lockup{transform-origin:0 0}
.fl-strip[data-mode=logo][data-s=out] .boot-lockup{transition:transform .48s cubic-bezier(.55,0,.2,1)}
.fl-strip[data-mode=logo]:not([data-s=boot]) :is(.boot-g,.boot-text,.boot-arc,.boot-standby,.boot-glow){animation:none}
.fl-strip[data-mode=logo]:not([data-s=boot]) :is(.boot-arc,.boot-glow,.boot-standby){opacity:0;transition:opacity .15s}
.fl-strip[data-mode=logo][data-s=out] .fl-bg{opacity:0;transition:opacity .36s ease-out .1s}
.fl-strip[data-mode=logo][data-s=land] .fl-bg{opacity:0}
.fl-strip[data-mode=logo][data-s=land] .boot{opacity:0;transition:opacity .12s linear}
body:has(.fl-strip[data-mode=logo]:not([data-s=land])) ${WORDMARK}{opacity:0}

.fl-cover,.fl-cover-in{position:absolute;inset:0}
.fl-cover{background:#000}
.fl-band{position:absolute;top:0;bottom:0;left:0;width:260px;margin-left:-200px;opacity:0;background:linear-gradient(90deg,rgb(251 191 36/0),rgb(251 191 36/.18) 45%,rgb(253 230 138/.75) 74%,#fffbeb 77%,rgb(251 191 36/.5) 80%,rgb(0 0 0/0) 100%)}
@keyframes fl-cover{to{transform:translateX(100%)}}
@keyframes fl-cover-in{to{transform:translateX(-100%)}}
@keyframes fl-band{0%{opacity:0}12%{opacity:1}85%{opacity:1}100%{opacity:0}}
.fl-strip[data-mode=sweep][data-s=out] .fl-cover{animation:fl-cover .48s cubic-bezier(.55,.05,.35,1) both}
.fl-strip[data-mode=sweep][data-s=out] .fl-cover-in{animation:fl-cover-in .48s cubic-bezier(.55,.05,.35,1) both}
.fl-strip[data-mode=sweep][data-s=out] .fl-band{animation:fl-band .48s linear both}

.fl-strip[data-mode=quiet] .boot-lockup{font-size:21px}
@media (min-width:640px){.fl-strip[data-mode=quiet] .boot-lockup{font-size:26px}}
.fl-strip[data-mode=quiet] .boot-standby{display:none}
.fl-strip[data-mode=quiet]:is([data-s=out],[data-s=land]){opacity:0;transform:translateY(-6px);transition:opacity .34s ease-out,transform .42s cubic-bezier(.2,.8,.2,1)}
body:has(.fl-strip[data-mode=quiet]) :is(${HDR_PARTS}){transition:opacity .36s ease-out .06s,translate .46s cubic-bezier(.2,.8,.2,1) .06s}
body:has(.fl-strip[data-mode=quiet][data-s=boot]) :is(${HDR_PARTS}){opacity:0;translate:0 8px}
${RING_CSS}
.fl-ring{z-index:1050}

@media (prefers-reduced-motion:reduce){.fl-strip .boot,.fl-strip .boot *{animation:none!important}.fl-strip .boot-arc,.fl-strip .boot-standby{display:none}
.fl-strip[data-s=out]{opacity:0!important;transform:none!important;transition:opacity .3s linear!important}
.fl-strip[data-s=out] *{animation:none!important;transition:none!important}}`

type S = "boot" | "out" | "land"

/** The visible header wordmark's G (phone row or desktop grid). */
function headerG(): DOMRect | null {
	for (const a of Array.from(document.querySelectorAll<HTMLElement>(WORDMARK))) {
		const svg = a.querySelector("svg")
		const r = svg?.getBoundingClientRect()
		if (r && r.width > 0) return r
	}
	return null
}

export function BootStrip({
	mode,
	first,
	root,
	onHandoff,
	onDone,
}: {
	mode: StripMode
	/** The page's first run (the boot started at the first paint); a Replay starts it now. */
	first: boolean
	root: RefObject<HTMLElement | null>
	onHandoff: () => void
	onDone: () => void
}) {
	const [s, setS] = useState<S>("boot")
	const [ring, setRing] = useState<Box | null>(null)
	const strip = useRef<HTMLDivElement>(null)
	const timers = useRef<ReturnType<typeof setTimeout>[]>([])
	const started = useRef(false)
	const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms))

	const handoff = useCallback(() => {
		if (started.current) return
		started.current = true
		for (const t of timers.current) clearTimeout(t)
		timers.current = []
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		setS("out")
		onHandoff()
		if (reduce) return later(320, onDone)
		if (mode === "logo") {
			later(500, () => setS("land"))
			return later(OUT_MS.logo, onDone)
		}
		if (mode === "quiet") {
			later(OUT_MS.quiet, () => {
				const b = fieldBox(root.current)
				if (!b) return onDone()
				setS("land")
				setRing(b)
				later(1150, onDone)
			})
			return
		}
		later(OUT_MS[mode], onDone)
	}, [mode, onDone, onHandoff, root])

	// logo: FLIP the boot's G onto the header's G (the same lockup: the G is 28/36 of the type, 2/36 before "ood"). After
	// the commit, so data-s=out has stopped the parts' own animations (resting boxes) and set the transition.
	useEffect(() => {
		if (mode !== "logo" || s !== "out" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
		const lock = strip.current?.querySelector<HTMLElement>(".boot-lockup")
		const g = strip.current?.querySelector<HTMLElement>(".boot-g svg")
		const T = headerG()
		if (!lock || !g || !T) return
		const L = lock.getBoundingClientRect()
		const B = g.getBoundingClientRect()
		const k = T.height / B.height
		const dx = T.left - L.left - k * (B.left - L.left)
		const dy = T.top - L.top - k * (B.top - L.top)
		lock.style.transform = `translate(${dx}px,${dy}px) scale(${k})`
	}, [mode, s])

	useEffect(() => {
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		const hold = reduce ? HOLD_REDUCED_MS : HOLD_MS
		const t = setTimeout(handoff, Math.max(120, hold - (first ? sinceFirstPaint() : 0)))
		// A tap or a key anywhere skips the boot (the page under it already works; the tap goes through).
		const skip = () => handoff()
		window.addEventListener("pointerdown", skip, true)
		window.addEventListener("keydown", skip, true)
		return () => {
			clearTimeout(t)
			window.removeEventListener("pointerdown", skip, true)
			window.removeEventListener("keydown", skip, true)
			for (const x of timers.current) clearTimeout(x)
		}
	}, [first, handoff])

	const boot = <Boot />
	return (
		<>
			<div ref={strip} className="fl-strip" data-mode={mode} data-s={s} aria-hidden="true" title={s === "boot" ? "Tap to skip" : undefined}>
				{/* As HTML: React would escape the selectors' quotes and > in the server's text. */}
				<style dangerouslySetInnerHTML={{ __html: CSS }} />
				{mode === "tv" ? (
					<>
						<div className="fl-half fl-half-t" />
						<div className="fl-half fl-half-b" />
						<div className="fl-tv">
							{boot}
							<div className="fl-flash" />
						</div>
						<div className="fl-line" />
					</>
				) : mode === "sweep" ? (
					<div className="fl-cover">
						<div className="fl-cover-in">{boot}</div>
						<div className="fl-band" />
					</div>
				) : (
					<>
						<div className="fl-bg" />
						{boot}
					</>
				)}
			</div>
			{ring ? (
				<div aria-hidden className="fl-ring" style={{ left: ring.left, top: ring.top, width: ring.width, height: ring.height, borderRadius: ring.radius }} />
			) : null}
		</>
	)
}
