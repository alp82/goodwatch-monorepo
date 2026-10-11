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

/** Two islands to show combining: the one nearest the middle of the view, and its nearest neighbor. */
const pickPair = (
	islands: MapIsland[],
	w: number,
	h: number,
): [MapIsland, MapIsland] | null => {
	const on = islands.filter(
		(i) => i.on && !i.bridge && i.sx > 0 && i.sx < w && i.sy > 0 && i.sy < h,
	)
	if (on.length < 2) return null
	const dist = (a: { sx: number; sy: number }, x: number, y: number) =>
		Math.hypot(a.sx - x, a.sy - y)
	const a = on.reduce((m, i) =>
		dist(i, w / 2, h / 2) < dist(m, w / 2, h / 2) ? i : m,
	)
	const rest = on.filter((i) => i !== a)
	const b = rest.reduce((m, i) =>
		dist(i, a.sx, a.sy) < dist(m, a.sx, a.sy) ? i : m,
	)
	return [a, b]
}

/**
 * A looping walkthrough over the map, played on the real islands: a tap (a click on desktop) on one island, then on
 * another, the bridge rising between them, and a pinch (a scroll on desktop) to zoom in. It never takes a pointer; the
 * first touch, click, scroll, or key on the map ends it and does what it does.
 */
export function Tutorial({
	engine,
	touch,
}: {
	engine: MapEngine | null
	/** A touch screen: a finger and a pinch, instead of a cursor and a wheel. */
	touch: boolean
}) {
	const el = useRef<HTMLDivElement>(null)
	const [names, setNames] = useState<[string, string] | null>(null)
	useEffect(() => {
		if (!engine) return
		let pair: [string, string] | null = null
		const update = () => {
			const root = el.current
			if (!root) return
			const { w, h } = engine.size()
			// The same two islands for as long as they're on screen, so the loop doesn't jump.
			let a = pair ? engine.island(pair[0]) : null
			let b = pair ? engine.island(pair[1]) : null
			if (!a?.on || !b?.on) {
				const picked = pickPair(engine.islands(), w, h)
				if (!picked) {
					root.style.visibility = "hidden"
					return
				}
				;[a, b] = picked
				pair = [a.id, b.id]
				setNames([a.name, b.name])
			}
			if (!a || !b) return
			const mx = (a.sx + b.sx) / 2
			const my = (a.sy + b.sy) / 2
			const set = (k: string, v: number, unit = "px") =>
				root.style.setProperty(k, `${Math.round(v * 10) / 10}${unit}`)
			set("--ax", a.sx)
			set("--ay", a.sy)
			set("--ar", Math.max(40, Math.min(a.sr, 140)))
			set("--bx", b.sx)
			set("--by", b.sy)
			set("--br", Math.max(40, Math.min(b.sr, 140)))
			set("--mx", mx)
			set("--my", my)
			// The finger comes in from below the middle of the view.
			set("--sx", w / 2)
			set("--sy", h - 40)
			set("--len", Math.hypot(b.sx - a.sx, b.sy - a.sy))
			set("--ang", Math.atan2(b.sy - a.sy, b.sx - a.sx), "rad")
			root.style.visibility = "visible"
		}
		update()
		return engine.subscribe(update)
	}, [engine])

	const tap = touch ? "Tap" : "Click"
	const pointer = touch ? <Finger /> : <Cursor />
	return (
		<div
			ref={el}
			className={`ex-tut ${touch ? "ex-tut-touch" : "ex-tut-mouse"}`}
			style={{ visibility: "hidden" }}
			aria-hidden="true"
		>
			<div className="ex-tut-lit ex-tut-lit-a" />
			<div className="ex-tut-lit ex-tut-lit-b" />
			<div className="ex-tut-ripple ex-tut-ripple-a" />
			<div className="ex-tut-ripple ex-tut-ripple-b" />
			<div className="ex-tut-beam" />
			<div className="ex-tut-burst" />
			{names && (
				<div className="ex-tut-pair">
					{names[0]} + {names[1]}
				</div>
			)}
			<div className="ex-tut-hand">{pointer}</div>
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
			<p className="ex-tut-say">
				<span className="ex-tut-say-1">{tap} an island</span>
				<span className="ex-tut-say-2">{tap} another one</span>
				<span className="ex-tut-say-3">See what they share</span>
				<span className="ex-tut-say-4">
					{touch ? "Pinch to zoom in" : "Scroll to zoom in"}
				</span>
			</p>
		</div>
	)
}

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
