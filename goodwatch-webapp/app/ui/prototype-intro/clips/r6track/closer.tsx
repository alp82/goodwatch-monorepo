// PROTOTYPE - throwaway. Chapter 11, "your turn" (round 6). The owner: "three slots fly into the quiz with tap
// hint that tries different random tiles until one is selected". Round 5's closer-slots (the three slots fly up
// into the quiz's own 1-2-3) and closer-ping (the Explorer tutorial's pointer), joined: once the posters are in,
// the pointer hovers over a few posters at random, then taps one. The quiz is the real FilmTaps, playable; the hint
// stops the moment the visitor touches anything.
import { type CSSProperties, type RefObject, useEffect, useRef, useState } from "react"
import { FilmTaps } from "~/ui/prototype-landing/film-taps"
import type { ClipProps, IntroData } from "../../clip"
import { A, type Box, DEAL, Headline, SWEEP, at, stageK, useBoxes } from "./kit"

/** How long the quiz chapter holds: the sequence waits on the quiz. */
export const QUIZ_MS = 600_000

/** The quiz's twelve titles: famous pool titles after the hero. */
const quizCards = (data: IntroData) => data.pool.slice(1).filter((c) => c.poster_path).slice(0, 12)

/** The real quiz above the chapter bar, its posters dealing in from `posters`. */
function Quiz({ data, show, posters }: { data: IntroData; show: number; posters: number }) {
	const quizData = { ...data, member: false, landing: quizCards(data) } as unknown as Parameters<typeof FilmTaps>[0]["data"]
	return (
		<div className="lpc-r6track-quiz lpc-r6track-a" style={{ "--qd": `${posters}ms`, ...at(["lpc-r6track-in", show, 600]) } as CSSProperties}>
			{/* "Look around": the TV film listens for this and shows the TV home (v-film.tsx). */}
			<FilmTaps data={quizData} onLeave={() => window.dispatchEvent(new Event("lp-film-leave"))} />
		</div>
	)
}

/** "Your turn! Tap three you loved." with three slots that fly up into the quiz's own 1-2-3 as it opens. */
function Slots({ root }: { root: RefObject<HTMLDivElement | null> }) {
	const mine = useBoxes(root, ".lpc-r6track-slot-box")
	const theirs = useBoxes(root, ".lpft-slot")
	const ready = mine.length === 3 && theirs.length === 3
	return (
		<div className="lpc-r6track-turn">
			<div className={A()} style={at(["lpc-r6track-to", 2700, 700, SWEEP], undefined, undefined, { "--ty": "-10cqh" } as CSSProperties)}>
				<Headline text="Your *turn!*" delay={150} step={220} className="lpc-r6track-h-huge" />
				<p className="lpc-r6track-h lpc-r6track-h-mid lpc-r6track-a" style={{ marginTop: "2cqh", ...at(["lpc-r6track-rise", 1300, 800]) }}>
					Tap three you loved.
				</p>
			</div>
			<div className="lpc-r6track-slots">
				{[1, 2, 3].map((n, i) => {
					const fly = ready
						? ({
								"--tx": `${theirs[i].x - mine[i].x}cqw`,
								"--ty": `${theirs[i].y - mine[i].y}cqh`,
								"--ts": `${theirs[i].w / mine[i].w}`,
								"--to": "1",
							} as CSSProperties)
						: undefined
					return (
						<div
							key={n}
							className={`lpc-r6track-slot-box ${ready ? A(1) : ""}`}
							style={ready ? at(["lpc-r6track-to", 2700 + i * 90, 850, DEAL], ["lpc-r6track-out", 3700, 300], undefined, fly) : undefined}
						>
							<div className="lpc-r6track-slot lpc-r6track-a" style={at(["lpc-r6track-pop", 700 + i * 130, 650, DEAL])}>
								{n}
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}

/** A few distinct posters, each away from the one before: where the pointer hovers, then the one it taps. */
function route(count: number, hops: number) {
	const out: number[] = []
	while (out.length < hops) {
		const n = Math.floor(Math.random() * count)
		const last = out[out.length - 1]
		if (out.includes(n)) continue
		// Not the poster next to the last one: the pointer should be seen to travel.
		if (last !== undefined && Math.abs((n % 6) - (last % 6)) + Math.abs(Math.floor(n / 6) - Math.floor(last / 6)) < 2) continue
		out.push(n)
	}
	return out
}

type Roam = { at: Box | null; taps: number; on: boolean }

/**
 * The pointer's walk over the quiz's posters from `start` (ms at k = 1): it hovers over a few at random, then taps
 * one. With `select` the tap picks that poster for real; otherwise it only shows the tap, and the walk starts over.
 * Anything the visitor does inside the clip ends it.
 */
function useRoam(root: RefObject<HTMLDivElement | null>, cells: Box[], start: number, select: boolean): Roam {
	const [state, setState] = useState<Roam>({ at: null, taps: 0, on: false })
	const ready = cells.length >= 12
	useEffect(() => {
		const el = root.current
		if (!el || !ready) return
		if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
		const k = stageK(el)
		const timers: ReturnType<typeof setTimeout>[] = []
		let stopped = false
		const later = (ms: number, f: () => void) => timers.push(setTimeout(() => !stopped && f(), ms * k))
		const walk = (t0: number) => {
			const hops = route(cells.length, 4)
			let t = t0
			hops.forEach((n, i) => {
				later(t, () => setState((s) => ({ ...s, at: cells[n], on: true })))
				t += i === hops.length - 1 ? 900 : 1050
			})
			const pick = hops[hops.length - 1]
			later(t, () => setState((s) => ({ ...s, taps: s.taps + 1 })))
			if (select) {
				later(t + 140, () => (el.querySelectorAll(".lpft-poster")[pick] as HTMLElement | undefined)?.click())
				later(t + 1100, () => setState((s) => ({ ...s, on: false })))
			} else {
				later(t + 1300, () => setState((s) => ({ ...s, on: false })))
				// Again from where it is now, after a pause.
				later(t + 2600, () => walk(0))
			}
		}
		walk(start)
		const stop = () => {
			stopped = true
			timers.forEach(clearTimeout)
			setState((s) => ({ ...s, on: false }))
		}
		el.addEventListener("pointerdown", stop, { capture: true })
		el.addEventListener("keydown", stop, { capture: true })
		return () => {
			stopped = true
			timers.forEach(clearTimeout)
			el.removeEventListener("pointerdown", stop, { capture: true })
			el.removeEventListener("keydown", stop, { capture: true })
		}
		// The walk is planned once the posters are measured.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ready])
	return state
}

/** The pointer: a cursor (a finger on touch screens) that glides between posters and presses on a tap. */
function Pointer({ roam }: { roam: Roam }) {
	const [touch, setTouch] = useState(false)
	useEffect(() => setTouch(Boolean(window.matchMedia?.("(pointer: coarse)").matches)), [])
	const at = roam.at ?? { x: 82, y: 104, w: 0, h: 0 }
	// The pointer's tip sits a little below the poster's middle, where a thumb would land.
	const spot = { x: at.x, y: at.y + at.h * 0.12 }
	return (
		<>
			<div
				className={`lpc-r6track-roam ${roam.on ? "lpc-r6track-roam-on" : ""}`}
				style={{ transform: `translate(${spot.x}cqw, ${spot.y}cqh)` }}
				aria-hidden="true"
			>
				<div key={roam.taps} className={roam.taps ? "lpc-r6track-roam-press" : ""}>
					{touch ? (
						<svg viewBox="0 0 64 64" className="lpc-r6track-finger">
							<circle cx="32" cy="32" r="22" fill="rgba(255,255,255,0.28)" />
							<circle cx="32" cy="32" r="14" fill="#fff" stroke="rgba(10,14,26,0.35)" strokeWidth="2" />
						</svg>
					) : (
						<svg viewBox="0 0 32 40" className="lpc-r6track-cursor">
							<path d="M3 2l24 22-11 1.5 6.5 12-5 2.5-6.5-12.5L3 34z" fill="#fff" stroke="#0a0e1a" strokeWidth="2.2" strokeLinejoin="round" />
						</svg>
					)}
				</div>
			</div>
			{roam.taps > 0 && roam.at && <div key={`r${roam.taps}`} className="lpc-r6track-tapring" style={{ left: `${spot.x}cqw`, top: `${spot.y}cqh` }} aria-hidden="true" />}
		</>
	)
}

/** When the pointer starts: once the quiz's posters have all dealt in. */
const ROAM_AT = 5000

/** A. The slots fly into the quiz, the pointer tries a few posters, then picks one for real. */
export function CloserRoam({ data }: ClipProps) {
	const root = useRef<HTMLDivElement>(null)
	const cells = useBoxes(root, ".lpft-poster")
	const roam = useRoam(root, cells, ROAM_AT, true)
	return (
		<div ref={root} className="absolute inset-0">
			<div className="lpc-r6track-glow" />
			<Quiz data={data} show={3000} posters={3200} />
			<Slots root={root} />
			<Pointer roam={roam} />
		</div>
	)
}

/** B. The same, but the pointer only shows the tap, and keeps trying posters until the visitor takes over. */
export function CloserRoamHint({ data }: ClipProps) {
	const root = useRef<HTMLDivElement>(null)
	const cells = useBoxes(root, ".lpft-poster")
	const roam = useRoam(root, cells, ROAM_AT, false)
	return (
		<div ref={root} className="absolute inset-0">
			<div className="lpc-r6track-glow" />
			<Quiz data={data} show={3000} posters={3200} />
			<Slots root={root} />
			<Pointer roam={roam} />
		</div>
	)
}
