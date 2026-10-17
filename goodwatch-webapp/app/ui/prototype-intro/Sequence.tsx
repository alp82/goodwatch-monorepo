// PROTOTYPE - throwaway. Plays a list of intro clips one after another on a stage, with a hand-over between them.
// The lab and the start page's film variant both use it.
import { type CSSProperties, useEffect, useState } from "react"
import type { Clip, IntroData } from "./clip"
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
}) {
	const [at, setAt] = useState(0)
	const [prev, setPrev] = useState<number | null>(null)
	const [lap, setLap] = useState(0)
	const overlap = TRANSITIONS[transition].overlap
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
			timers.push(setTimeout(() => onEnd?.(), clip.ms * k))
		} else {
			timers.push(
				setTimeout(() => {
					setPrev(at)
					if (last) setLap((n) => n + 1)
					setAt(last ? 0 : at + 1)
				}, Math.max(0, clip.ms - overlap) * k),
			)
		}
		return () => timers.forEach(clearTimeout)
	}, [at, clips, k, overlap, loop, onEnd, run])
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
				key={`${run}-${lap}-${i}-${clip.id}`}
				className={`lpi-slot lpi-${role} lpi-tr-${transition}`}
				style={{ "--o": `${overlap}ms` } as CSSProperties}
				data-clip={clip.id}
			>
				<C data={data} />
			</div>
		)
	}
	return (
		<>
			{prev !== null && slot(prev, "out")}
			{slot(at, prev !== null ? "in" : "on")}
			{prev !== null && transition === "wipe" && <div key={`w-${run}-${lap}-${at}`} className="lpi-wipe" style={{ "--o": `${overlap}ms` } as CSSProperties} />}
		</>
	)
}

/** The clips' total length at speed `k`, with the overlaps taken out. */
export const sequenceMs = (clips: Clip[], k: number, transition: TransitionId) =>
	Math.max(0, clips.reduce((s, c) => s + c.ms, 0) - TRANSITIONS[transition].overlap * Math.max(0, clips.length - 1)) * k
