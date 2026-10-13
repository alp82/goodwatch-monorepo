// The tutorial over the map: one step at a time on the real islands. Tap a group, tap an island, tap another group,
// tap an island there, tap Combined, zoom into the combination, tap Show all, tap a third island, tap Combined,
// Separate, and a closing line on combining more. Each step's gesture loops until the viewer does it, and the
// tutorial never takes a pointer but its Skip button.
import { type CSSProperties, useEffect, useRef, useState } from "react"
import type { MapIsland } from "./island"
import type { MapEngine } from "./engine"
import { groupingOf } from "./regions"

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

/** What the tutorial asks for now. */
export type TutorialStep =
	| "group"
	| "one"
	| "group2"
	| "two"
	| "combined"
	| "all"
	| "group3"
	| "three"
	| "zoom"
	| "separate"
	| "more"

const shown = (i: MapIsland, w: number, h: number) =>
	i.on && !i.bridge && i.sx > 0 && i.sx < w && i.sy > 0 && i.sy < h

export function Tutorial({
	engine,
	touch,
	step,
	picks,
	empty,
	onSkip,
}: {
	engine: MapEngine | null
	touch: boolean
	step: TutorialStep
	/** The picked islands. */
	picks: readonly string[]
	/** Whether an island would leave the combination empty (unknown counts as no). */
	empty: (id: string) => boolean
	onSkip: () => void
}) {
	const el = useRef<HTMLDivElement>(null)
	const emptyRef = useRef(empty)
	emptyRef.current = empty
	const picksRef = useRef(picks)
	picksRef.current = picks
	const onMap =
		step !== "combined" &&
		step !== "all" &&
		step !== "separate" &&
		step !== "more"
	/** What the gesture is on, so its animation starts over for a new target. */
	const [target, setTarget] = useState<string | null>(null)
	useEffect(() => {
		const root = el.current
		if (!engine || !root || !onMap) return
		let held: string | null = null
		const update = () => {
			const { w, h } = engine.size()
			const set = (k: string, v: number) =>
				root.style.setProperty(k, `${Math.round(v)}px`)
			const hide = () => {
				root.style.visibility = "hidden"
			}
			const aim = (
				id: string,
				x: number,
				y: number,
				fx: number,
				fy: number,
			) => {
				if (held !== id) {
					held = id
					setTarget(id)
				}
				set("--tx", x)
				set("--ty", y)
				set("--fx", fx)
				set("--fy", fy)
				root.style.visibility = "visible"
			}
			if (step === "zoom") {
				const b = engine.mix()
				if (!b?.on) return hide()
				set("--tx", b.sx)
				set("--ty", b.sy)
				root.style.visibility = "visible"
				return
			}
			if (step === "group" || step === "group2" || step === "group3") {
				// The same group for as long as the step lasts: the first one, or the first the picked island isn't from.
				const from = picksRef.current.map(groupingOf)
				const regions = engine.regionsOn()
				const to =
					regions.find((r) => r.id === held) ??
					regions.find((r) => !from.includes(r.id))
				if (!to || to.x < 0 || to.x > w || to.y < 0 || to.y > h) return hide()
				// The pointer comes in from the middle once an island sits there, else from below and to the side.
				const hub = engine.hubOn()
				if (step !== "group" && hub) aim(to.id, to.x, to.y, hub.x, hub.y)
				else aim(to.id, to.x, to.y, to.x + Math.min(140, w * 0.2), to.y + 150)
				return
			}
			// An island: the same one for as long as it's on screen, so the loop doesn't jump.
			let to = held ? engine.island(held) : null
			if (!to || !shown(to, w, h)) {
				const on = engine
					.islands()
					.filter(
						(i) =>
							shown(i, w, h) &&
							i.role !== "joined" &&
							!picksRef.current.includes(i.id) &&
							!emptyRef.current(i.id),
					)
				to = on.reduce<MapIsland | null>(
					(m, i) =>
						!m ||
						Math.hypot(i.sx - w / 2, i.sy - h / 2) <
							Math.hypot(m.sx - w / 2, m.sy - h / 2)
							? i
							: m,
					null,
				)
			}
			if (!to) return hide()
			aim(to.id, to.sx, to.sy, to.sx + Math.min(140, w * 0.2), to.sy + 150)
		}
		update()
		return engine.subscribe(update)
	}, [engine, step, onMap])

	const tap = touch ? "Tap" : "Click"
	const say: Record<TutorialStep, string> = {
		group: `${tap} a group`,
		one: `${tap} an island`,
		group2: `${tap} another group`,
		two: `${tap} an island to combine them`,
		combined: `${tap} Combined to see what they share`,
		all: `${tap} Show all to go back out`,
		group3: `${tap} another group`,
		three: `${tap} a third island to narrow it down`,
		zoom: touch ? "Pinch to zoom in" : "Scroll to zoom in",
		separate: `${tap} Separate to start over`,
		more: "Combine up to 5 islands to narrow it down",
	}
	return (
		<>
			<div
				ref={el}
				className="ex-tut"
				style={{ visibility: "hidden" }}
				aria-hidden="true"
			>
				{onMap && step !== "zoom" && (
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
					{say[step]}
				</p>
				<button type="button" onClick={onSkip}>
					{step === "more" ? "Got it" : "Skip"}
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

const tip: CSSProperties = { transform: "translate(-50%, -50%)" }
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
