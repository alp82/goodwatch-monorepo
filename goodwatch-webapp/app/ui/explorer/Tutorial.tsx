import { type CSSProperties, useEffect, useRef, useState } from "react"
import type { MapEngine } from "./engine"
import type { MapIsland } from "./island"

const SEEN_KEY = "gw-explorer-tutorial"
/** Members see the tutorial on their first visits; guests on every visit. */
const MEMBER_VISITS = 3

const seenCount = () => {
	try {
		return Number(localStorage.getItem(SEEN_KEY)) || 0
	} catch {
		return 0
	}
}
const countVisit = () => {
	try {
		localStorage.setItem(SEEN_KEY, String(seenCount() + 1))
	} catch {}
}

/**
 * Whether the tutorial plays on this visit, and a way to end it. Decided once the viewer is known: always for guests,
 * the first visits for members (counted on this device). Never with reduced motion: the hint line explains instead.
 */
export function useTutorial(member: boolean, userLoading: boolean) {
	const [show, setShow] = useState(false)
	const decided = useRef(false)
	useEffect(() => {
		if (userLoading || decided.current) return
		decided.current = true
		if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
		if (member && seenCount() >= MEMBER_VISITS) return
		if (member) countVisit()
		setShow(true)
	}, [member, userLoading])
	return [show, () => setShow(false)] as const
}

/** What the tutorial asks for now: light an island, light a second one, zoom into the bridge, and separate. */
export type TutorialStep = "one" | "two" | "zoom" | "separate"

/** On screen: its middle inside the view. */
const shown = (i: MapIsland, w: number, h: number) =>
	i.on && !i.bridge && i.sx > 0 && i.sx < w && i.sy > 0 && i.sy < h
const dist = (a: MapIsland, x: number, y: number) =>
	Math.hypot(a.sx - x, a.sy - y)
const nearest = (list: MapIsland[], x: number, y: number) =>
	list.reduce<MapIsland | null>(
		(m, i) => (!m || dist(i, x, y) < dist(m, x, y) ? i : m),
		null,
	)

/**
 * The walkthrough over the map, one step at a time on the real islands; each step's gesture loops until the viewer
 * does it: a tap (a click on desktop) on an island, a tap on a second one, a pinch (a scroll on desktop) into the
 * bridge that rises between them, then Separate (lit up in the combine bar) to start over. It never takes a pointer
 * but its Skip button.
 */
export function Tutorial({
	engine,
	touch,
	step,
	lit,
	shares,
	onSkip,
}: {
	engine: MapEngine | null
	/** A touch screen: a finger and a pinch, instead of a cursor and a wheel. */
	touch: boolean
	step: TutorialStep
	/** The lit island, for the second tap. */
	lit: string | null
	/** Whether two islands share any titles, so the second tap raises a bridge (unknown counts as yes). */
	shares: (a: string, b: string) => boolean
	onSkip: () => void
}) {
	const el = useRef<HTMLDivElement>(null)
	const sharesRef = useRef(shares)
	sharesRef.current = shares
	/** The island the gesture is on, so its animation starts over for a new one. */
	const [target, setTarget] = useState<string | null>(null)
	useEffect(() => {
		const root = el.current
		if (!engine || !root || step === "separate") return
		let picked: string | null = null
		const update = () => {
			const { w, h } = engine.size()
			const set = (k: string, v: number) =>
				root.style.setProperty(k, `${Math.round(v)}px`)
			const hide = () => {
				root.style.visibility = "hidden"
			}
			if (step === "zoom") {
				const b = engine.bridge()
				if (!b?.on) return hide()
				set("--tx", b.sx)
				set("--ty", b.sy)
			} else {
				// The same island for as long as it's on screen, so the loop doesn't jump.
				let to = picked ? engine.island(picked) : null
				const from = lit ? engine.island(lit) : null
				if (!to || !shown(to, w, h)) {
					const on = engine.islands().filter((i) => shown(i, w, h))
					if (step === "one") to = nearest(on, w / 2, h / 2)
					else if (from) {
						const others = on.filter((i) => i !== from)
						const sharing = others.filter((i) =>
							sharesRef.current(from.id, i.id),
						)
						to = nearest(sharing.length ? sharing : others, from.sx, from.sy)
					}
					picked = to?.id ?? null
					setTarget(picked)
				}
				if (!to) return hide()
				set("--tx", to.sx)
				set("--ty", to.sy)
				// The pointer comes in from the lit island, or from below and to the side for the first tap.
				set("--fx", from ? from.sx : to.sx + Math.min(140, w * 0.2))
				set("--fy", from ? from.sy : to.sy + 150)
			}
			root.style.visibility = "visible"
		}
		update()
		return engine.subscribe(update)
	}, [engine, step, lit])

	const tap = touch ? "Tap" : "Click"
	const say =
		step === "one"
			? `${tap} an island`
			: step === "two"
				? `${tap} another island to combine them`
				: step === "zoom"
					? touch
						? "Pinch to zoom in"
						: "Scroll to zoom in"
					: `${tap} Separate to start over`
	return (
		<>
			<div
				ref={el}
				className="ex-tut"
				style={{ visibility: step === "separate" ? "visible" : "hidden" }}
				aria-hidden="true"
			>
				{(step === "one" || step === "two") && (
					<div key={`${step}|${target}`} className="ex-tut-tap">
						<div className="ex-tut-ripple" />
						<div className="ex-tut-hand">{touch ? <Finger /> : <Cursor />}</div>
					</div>
				)}
				{step === "zoom" && (
					<div className="ex-tut-zoom">
						<div className="ex-tut-rings">
							<span />
							<span />
							<span />
						</div>
						{touch ? (
							<>
								<div className="ex-tut-pinch ex-tut-pinch-1">
									<Finger />
								</div>
								<div className="ex-tut-pinch ex-tut-pinch-2">
									<Finger />
								</div>
							</>
						) : (
							<Mouse />
						)}
					</div>
				)}
			</div>
			<div className="ex-tut-say">
				<p key={step} aria-live="polite">
					{say}
				</p>
				<button type="button" onClick={onSkip}>
					Skip
				</button>
			</div>
		</>
	)
}

/** Lights up a button the tutorial points at, with a pointer pressing it. */
export const Press = ({ touch }: { touch: boolean }) => (
	<span className="ex-tut-press" aria-hidden="true">
		{touch ? <Finger /> : <Cursor />}
	</span>
)

/** A fingertip, its touch point at the element's top left. */
const Finger = () => (
	<svg
		className="ex-tut-finger"
		viewBox="0 0 64 64"
		style={tip}
		aria-hidden="true"
	>
		<circle cx="32" cy="32" r="22" fill="rgba(255,255,255,0.28)" />
		<circle
			cx="32"
			cy="32"
			r="14"
			fill="#fff"
			stroke="rgba(10,14,26,0.35)"
			strokeWidth="2"
		/>
	</svg>
)
const tip: CSSProperties = { transform: "translate(-50%, -50%)" }

/** An arrow cursor, its point at the element's top left. */
const Cursor = () => (
	<svg className="ex-tut-cursor" viewBox="0 0 32 40" aria-hidden="true">
		<path
			d="M3 2l24 22-11 1.5 6.5 12-5 2.5-6.5-12.5L3 34z"
			fill="#fff"
			stroke="#0a0e1a"
			strokeWidth="2.2"
			strokeLinejoin="round"
		/>
	</svg>
)

/** A mouse with its wheel turning. */
const Mouse = () => (
	<svg className="ex-tut-mouse-i" viewBox="0 0 48 72" aria-hidden="true">
		<rect
			x="3"
			y="3"
			width="42"
			height="66"
			rx="21"
			fill="rgba(10,14,26,0.55)"
			stroke="#fff"
			strokeWidth="4"
		/>
		<rect
			className="ex-tut-wheel"
			x="20"
			y="14"
			width="8"
			height="16"
			rx="4"
			fill="#fff"
		/>
	</svg>
)
