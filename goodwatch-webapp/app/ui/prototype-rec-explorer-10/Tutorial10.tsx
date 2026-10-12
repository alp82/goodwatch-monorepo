// PROTOTYPE - throwaway. Round 10 of the Explorer: the real Explorer's tutorial (ui/explorer/Tutorial.tsx), with the
// steps of the world: tap a group, tap an island, tap another group, tap an island there, tap Combined, zoom into
// the combination, and Separate. As there, each step's gesture loops on the real map until the viewer does it, and
// the tutorial never takes a pointer but its Skip button. The looks are the real tutorial's (explorer.css).
import { type CSSProperties, useEffect, useRef, useState } from "react"
import type { MapIsland } from "~/ui/explorer/island"
import type { MapEngine as MapEngine10 } from "./engine10"
import { groupingOf } from "./world10"

export type TutorialStep10 =
	| "group"
	| "one"
	| "group2"
	| "two"
	| "combined"
	| "zoom"
	| "separate"

const shown = (i: MapIsland, w: number, h: number) =>
	i.on && !i.bridge && i.sx > 0 && i.sx < w && i.sy > 0 && i.sy < h

export function Tutorial10({
	engine,
	touch,
	step,
	picks,
	empty,
	onSkip,
}: {
	engine: MapEngine10 | null
	touch: boolean
	step: TutorialStep10
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
	const onMap = step !== "combined" && step !== "separate"
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
			const aim = (id: string, x: number, y: number, fx: number, fy: number) => {
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
			if (step === "group" || step === "group2") {
				// The same group for as long as the step lasts: the first one, or the first the picked island isn't from.
				const from = picksRef.current.map(groupingOf)
				const regions = engine.regionsOn()
				const to =
					regions.find((r) => r.id === held) ??
					regions.find((r) => !from.includes(r.id))
				if (!to || to.x < 0 || to.x > w || to.y < 0 || to.y > h) return hide()
				// The pointer comes in from the middle once an island sits there, else from below and to the side.
				const hub = engine.hubOn()
				if (step === "group2" && hub) aim(to.id, to.x, to.y, hub.x, hub.y)
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
	const say: Record<TutorialStep10, string> = {
		group: `${tap} a group`,
		one: `${tap} an island`,
		group2: `${tap} another group`,
		two: `${tap} an island to combine them`,
		combined: `${tap} Combined to see what they share`,
		zoom: touch ? "Pinch to zoom in" : "Scroll to zoom in",
		separate: `${tap} Separate to start over`,
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
					Skip
				</button>
			</div>
		</>
	)
}

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
