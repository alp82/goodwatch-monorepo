// PROTOTYPE - throwaway. Plays a list of intro clips one after another on a stage, with a hand-over between them.
// The lab and the start page's film variant both use it.
import { type CSSProperties, useEffect, useRef, useState } from "react"
import { type Clip, type IntroData, SECTIONS } from "./clip"
import "./intro.css"

export const TRANSITIONS = {
	cut: { name: "Cut", overlap: 0 },
	fade: { name: "Crossfade", overlap: 800 },
	slide: { name: "Slide", overlap: 800 },
	zoom: { name: "Zoom through", overlap: 800 },
	wipe: { name: "Amber wipe", overlap: 900 },
	deal: { name: "Deal (sign-up flip)", overlap: 800 },
} as const
export type TransitionId = keyof typeof TRANSITIONS

/** The stage: fills its box, sizes clips by container units, scales all clip timing by `k`. */
export function Stage({ k, children, className = "" }: { k: number; children: React.ReactNode; className?: string }) {
	return (
		<div className={`lpi-stage ${className}`} style={{ "--k": k } as CSSProperties}>
			{children}
		</div>
	)
}

/**
 * Plays `clips` in order from mount. `onEnd` runs when the last clip's length has passed (it keeps its last frame).
 * Change `run` to start again.
 */
export function Sequence({
	clips,
	data,
	k,
	transition,
	loop = false,
	run = 0,
	onEnd,
	onAt,
	chapters = false,
	firstEnter,
}: {
	clips: Clip[]
	data: IntroData
	k: number
	transition: TransitionId
	loop?: boolean
	run?: number
	onEnd?: () => void
	/** Which clip is on, as it changes. */
	onAt?: (index: number) => void
	/** Show the chapter bar: one segment per clip, labelled by its section, click to jump. */
	chapters?: boolean
	/** How the first clip comes in (it has no clip before it): e.g. "deal" after the TV's own boot screen. */
	firstEnter?: TransitionId
}) {
	// Kept in a ref: a new `onEnd` each render must not restart the clip's timer.
	const endRef = useRef(onEnd)
	endRef.current = onEnd
	const [at, setAt] = useState(0)
	const [prev, setPrev] = useState<number | null>(null)
	const [lap, setLap] = useState(0)
	const trOf = (i: number): TransitionId => clips[i]?.enter ?? transition
	const overlapOf = (i: number) => TRANSITIONS[trOf(i)].overlap
	const overlap = overlapOf(at)
	// A jump from the chapter bar: start that clip at once, with no hand-over.
	const [jumps, setJumps] = useState(0)
	const jump = (i: number) => {
		setPrev(null)
		setAt(i)
		setJumps((n) => n + 1)
	}
	useEffect(() => {
		setAt(0)
		setPrev(null)
	}, [run, clips])
	useEffect(() => onAt?.(at), [at, onAt])
	useEffect(() => {
		const clip = clips[at]
		if (!clip) return
		const last = at === clips.length - 1
		const timers: ReturnType<typeof setTimeout>[] = []
		if (last && !loop) {
			timers.push(setTimeout(() => endRef.current?.(), clip.ms * k))
		} else {
			timers.push(
				setTimeout(() => {
					setPrev(at)
					if (last) setLap((n) => n + 1)
					setAt(last ? 0 : at + 1)
				}, Math.max(0, clip.ms - overlapOf(last ? 0 : at + 1)) * k),
			)
		}
		return () => timers.forEach(clearTimeout)
	}, [at, clips, k, loop, run, jumps, transition])
	useEffect(() => {
		if (prev === null) return
		const t = setTimeout(() => setPrev(null), overlap * k + 50)
		return () => clearTimeout(t)
	}, [prev, overlap, k])

	const slot = (i: number, role: "in" | "out" | "on") => {
		const clip = clips[i]
		if (!clip) return null
		const C = clip.C
		return (
			<div
				key={`${run}-${lap}-${jumps}-${i}-${clip.id}`}
				className={`lpi-slot lpi-${role} lpi-tr-${prev === null && firstEnter && i === 0 ? firstEnter : trOf(role === "out" ? at : i)}`}
				style={{ "--o": `${prev === null && firstEnter && i === 0 ? TRANSITIONS[firstEnter].overlap : overlap}ms` } as CSSProperties}
				data-clip={clip.id}
			>
				<C data={data} />
			</div>
		)
	}
	return (
		<>
			{prev !== null && slot(prev, "out")}
			{slot(at, prev !== null || (firstEnter && at === 0 && lap === 0 && jumps === 0) ? "in" : "on")}
			{prev !== null && trOf(at) === "wipe" && <div key={`w-${run}-${lap}-${at}`} className="lpi-wipe" style={{ "--o": `${overlap}ms` } as CSSProperties} />}
			{/* The film's chapters, without "Your turn": the quiz is where the film ends, not a chapter of it. */}
			{chapters && filmCount(clips) - bootCount(clips) > 1 && at >= bootCount(clips) && at < filmCount(clips) && (
				<ChapterBar
					clips={clips.slice(bootCount(clips), filmCount(clips))}
					at={at - bootCount(clips)}
					k={k}
					run={`${run}-${lap}-${jumps}`}
					onJump={(i) => jump(i + bootCount(clips))}
				/>
			)}
		</>
	)
}

/** How many clips are film: everything before the closer (the quiz). */
const filmCount = (clips: Clip[]) => {
	const i = clips.findIndex((c) => c.section === "closer")
	return i < 0 ? clips.length : i
}

/** How many clips at the start are the TV turning on: not chapters either. */
const bootCount = (clips: Clip[]) => {
	const i = clips.findIndex((c) => c.section !== "boot")
	return i < 0 ? clips.length : i
}

const chapterOf = (clip: Clip) => SECTIONS.find((s) => s.id === clip.section)?.chapter ?? clip.section

/** YouTube-style chapters: a segment per clip, as long as the clip; the one playing fills; a click jumps there. */
function ChapterBar({ clips, at, k, run, onJump }: { clips: Clip[]; at: number; k: number; run: string; onJump: (i: number) => void }) {
	return (
		<nav className="lpi-chapters" aria-label="Chapters">
			<div className="lpi-chapter-now" key={`${run}-${at}`}>
				{chapterOf(clips[at])}
			</div>
			<ol>
				{clips.map((c, i) => (
					<li key={c.id} style={{ flexGrow: c.ms }}>
						<button type="button" onClick={() => onJump(i)} aria-label={`Chapter ${i + 1}: ${chapterOf(c)}`} aria-current={i === at || undefined}>
							<span className="lpi-chapter-track">
								<span
									key={i === at ? `${run}-${at}` : undefined}
									className={`lpi-chapter-fill ${i < at ? "lpi-done" : i === at ? "lpi-now" : ""}`}
									style={i === at ? ({ "--d": `${c.ms * k}ms` } as CSSProperties) : undefined}
								/>
							</span>
							<span className="lpi-chapter-tip">{chapterOf(c)}</span>
						</button>
					</li>
				))}
			</ol>
		</nav>
	)
}

/** The clips' total length at speed `k`, with the overlaps taken out. */
export const sequenceMs = (clips: Clip[], k: number, transition: TransitionId) => {
	// The film's length: up to the closer (the quiz waits for the visitor), each hand-over overlapping its clip.
	const film = clips.slice(0, filmCount(clips))
	const overlaps = film.slice(1).reduce((s, c) => s + TRANSITIONS[c.enter ?? transition].overlap, 0)
	return Math.max(0, film.reduce((s, c) => s + c.ms, 0) - overlaps) * k
}
