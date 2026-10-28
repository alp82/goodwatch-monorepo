// PROTOTYPE (start page lab) · Round 17: the previous start page's TV boot screen (ui/living-room/intro/boot.tsx and
// boot.css, imported as they are) full screen over the start page, and its hand-off into the page: "fade" (the
// wordmark goes, then the black fades), "glow" (the screen's amber glow swells while the black fades, and the room's
// own warm layer takes it over, FlowBg), or "collapse" (the black screen shrinks into the search field, like an old
// TV powering down onto a line, then the field glows once). In the server's HTML, over the page (the stage stays in
// the HTML underneath). A tap skips to the hand-off. Transform and opacity only.
import { type RefObject, useCallback, useEffect, useRef, useState } from "react"
import "~/ui/living-room/intro/boot.css"
import { Boot } from "~/ui/living-room/intro/boot"

export type Handoff = "fade" | "glow" | "collapse"

/** How long the boot screen holds before the hand-off: the wordmark has slid out and settled (the old TV faded at 2.4 s). */
const HOLD_MS = 2300
const HOLD_REDUCED_MS = 700

/** The first paint's age: the boot plays from the server's HTML, so the first run's wait counts from the paint. */
export const sinceFirstPaint = () => {
	const paint = typeof performance !== "undefined" ? performance.getEntriesByName?.("first-contentful-paint")[0] : undefined
	return paint ? Math.max(0, performance.now() - paint.startTime) : 0
}

/** e's single glow around the search field (Round 18: i reuses it). */
export const RING_CSS = `@keyframes fl-ring{0%{opacity:0;transform:scale(1.04)}30%{opacity:1;transform:none}100%{opacity:0}}
.fl-ring{position:fixed;pointer-events:none;box-shadow:0 0 0 2px rgb(251 191 36/.85),0 0 0 7px rgb(251 191 36/.14),0 0 70px 10px rgb(251 191 36/.3);animation:fl-ring 1.1s ease-out both}`

const CSS = `.fl-boot{position:fixed;inset:0;z-index:2147483100;cursor:pointer;-webkit-tap-highlight-color:transparent}
.fl-boot .boot{animation:none;pointer-events:none;transition:opacity .9s ease-out}
.fl-boot .boot-lockup{transition:opacity .35s ease-in}
.fl-boot[data-s=out] .boot-lockup,.fl-boot[data-s=collapse] .boot-lockup,.fl-boot[data-s=land] .boot-lockup{opacity:0}
.fl-boot[data-mode=fade][data-s=out]{opacity:0;transition:opacity .7s ease-out .35s}
.fl-boot[data-mode=glow][data-s=out] .boot{opacity:0;transition-delay:.25s}
.fl-glow{position:absolute;inset:-10%;opacity:0;pointer-events:none;background:radial-gradient(40% 42% at 50% 50%,rgb(251 191 36/.42) 0,rgb(251 191 36/.16) 45%,rgb(251 191 36/0) 72%)}
@keyframes fl-glow{0%{opacity:0;transform:scale(1)}28%{opacity:1}100%{opacity:0;transform:scale(2.6)}}
.fl-boot[data-s=out] .fl-glow{animation:fl-glow 1.6s cubic-bezier(.2,.7,.2,1) both}
.fl-boot[data-s=collapse] .boot,.fl-boot[data-s=land] .boot{opacity:0;transition:none}
.fl-boot[data-s=collapse],.fl-boot[data-s=land]{pointer-events:none}
.fl-screen{position:fixed;background:#000;transform-origin:50% 50%;will-change:transform}
.fl-screen[data-go]{transition:transform .8s cubic-bezier(.7,0,.25,1)}
.fl-boot[data-s=land] .fl-screen{opacity:0;transition:opacity .35s ease-out}
${RING_CSS}
@media (prefers-reduced-motion:reduce){.fl-boot[data-s=out]{opacity:0!important;transition:opacity .3s linear!important}.fl-glow{display:none}}`

type Stage = "boot" | "out" | "collapse" | "land"
export type Box = { left: number; top: number; width: number; height: number; radius: string; scale: number }

/** The search field's box on screen (the first element in the field wrapper with rounded corners), or null when it isn't in view. */
export function fieldBox(root: HTMLElement | null): Box | null {
	const wrap = root?.querySelector<HTMLElement>(".jk-field-gap")
	if (!wrap) return null
	const all = [wrap, ...Array.from(wrap.querySelectorAll<HTMLElement>("*"))]
	const el = all.find((n) => getComputedStyle(n).borderTopLeftRadius !== "0px" && n.getBoundingClientRect().width > 120) ?? wrap
	const r = el.getBoundingClientRect()
	const vw = window.innerWidth
	const vh = window.innerHeight
	if (r.width < 40 || r.height < 20 || r.top < 0 || r.bottom > vh) return null
	const cx = r.left + r.width / 2
	const cy = r.top + r.height / 2
	// Scaled about its own center, the box must cover the whole viewport (and hide its rounded corners past the edges).
	const scale = 1.08 * Math.max((2 * Math.max(cx, vw - cx)) / r.width, (2 * Math.max(cy, vh - cy)) / r.height)
	return { left: r.left, top: r.top, width: r.width, height: r.height, radius: getComputedStyle(el).borderTopLeftRadius, scale }
}

export function BootOverlay({
	mode,
	first,
	root,
	onHandoff,
	onDone,
}: {
	mode: Handoff
	/** The page's first run (the boot started at the first paint); a Replay starts it now. */
	first: boolean
	root: RefObject<HTMLElement | null>
	/** The page starts its own reveal (the room's light, the camera) as the boot screen begins to go. */
	onHandoff: () => void
	onDone: () => void
}) {
	const [s, setS] = useState<Stage>("boot")
	const [eff, setEff] = useState<Handoff>(mode)
	const [box, setBox] = useState<Box | null>(null)
	const [go, setGo] = useState(false)
	const timers = useRef<ReturnType<typeof setTimeout>[]>([])
	const started = useRef(false)
	const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms))

	const handoff = useCallback(() => {
		if (started.current) return
		started.current = true
		for (const t of timers.current) clearTimeout(t)
		timers.current = []
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		const m: Handoff = reduce ? "fade" : mode
		setEff(m)
		setS("out")
		onHandoff()
		if (m === "fade") return later(reduce ? 400 : 1150, onDone)
		if (m === "glow") return later(1700, onDone)
		// collapse: the wordmark goes, then the black screen (now the field's box, scaled to cover) shrinks onto the field.
		later(320, () => {
			const b = fieldBox(root.current)
			if (!b) {
				setEff("fade")
				setS("out")
				return later(800, onDone)
			}
			setBox(b)
			setS("collapse")
			// Two frames at full size, then the shrink.
			requestAnimationFrame(() => requestAnimationFrame(() => setGo(true)))
			later(880, () => setS("land"))
			later(880 + 1100, onDone)
		})
	}, [mode, onDone, onHandoff, root])

	useEffect(() => {
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		const hold = reduce ? HOLD_REDUCED_MS : HOLD_MS
		const wait = Math.max(250, hold - (first ? sinceFirstPaint() : 0))
		const t = setTimeout(handoff, wait)
		return () => {
			clearTimeout(t)
			for (const x of timers.current) clearTimeout(x)
		}
	}, [first, handoff])

	return (
		<div
			className="fl-boot"
			data-mode={eff}
			data-s={s}
			aria-hidden="true"
			onClick={s === "boot" ? handoff : undefined}
			title={s === "boot" ? "Tap to skip" : undefined}
		>
			{/* As HTML: React would escape the selectors' quotes and > in the server's text. */}
			<style dangerouslySetInnerHTML={{ __html: CSS }} />
			<Boot />
			{eff === "glow" ? <div className="fl-glow" /> : null}
			{box && (s === "collapse" || s === "land") ? (
				<div
					className="fl-screen"
					{...(go ? { "data-go": "" } : {})}
					style={{
						left: box.left,
						top: box.top,
						width: box.width,
						height: box.height,
						borderRadius: box.radius,
						transform: go ? "none" : `scale(${box.scale})`,
					}}
				/>
			) : null}
			{box && s === "land" ? (
				<div className="fl-ring" style={{ left: box.left, top: box.top, width: box.width, height: box.height, borderRadius: box.radius }} />
			) : null}
		</div>
	)
}
