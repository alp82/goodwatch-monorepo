// Plays the film's scenes (film.ts) one after another on the TV's picture, with a hand-over between them, the
// chapter bar under them and a Next button at the bottom right. Once the quiz shows, Next and the chapter bar go and
// nothing takes their place (the owner, 2026-10-22: no Replay at the end; the quiz's own keys lead on, and the TV's
// menu plays the film again with "What is GoodWatch?"). A quick second press of Next lands on nothing.
import {
	type CSSProperties,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react"
import { CHAPTERS, type Enter, type IntroData, type Scene } from "./scene"

/** How long each hand-over overlaps the end of the scene before it, in ms at k = 1. */
const OVERLAP: Record<Enter, number> = {
	cut: 0,
	fade: 800,
	wipe: 900,
	deal: 800,
}

/** The stage: fills the TV's picture, sizes scenes by container units, scales all their timing by `k`. */
export function Stage({ k, children }: { k: number; children: ReactNode }) {
	return (
		<div className="film-stage" style={{ "--k": k } as CSSProperties}>
			{children}
		</div>
	)
}

/** How many scenes are chapters: everything before the quiz. */
export const chapterCount = (scenes: readonly Scene[]) => {
	const i = scenes.findIndex((c) => c.section === "closer")
	return i < 0 ? scenes.length : i
}

const chapterOf = (scene: Scene) =>
	CHAPTERS.find((c) => c.id === scene.section)?.name ?? scene.section

/**
 * Plays `scenes` from `startAt`. `onAt` hears which scene shows, `onEnd` runs when the last scene's length has passed
 * (it keeps its last frame).
 */
export function Player({
	scenes,
	data,
	k = 1,
	firstEnter,
	startAt = 0,
	onAt,
	onEnd,
}: {
	scenes: readonly Scene[]
	data: IntroData
	k?: number
	/** How the first scene comes in: "deal" after the boot screen, "fade" when the film resumes. */
	firstEnter?: Enter
	startAt?: number
	onAt?: (index: number) => void
	onEnd?: () => void
}) {
	// In refs: a new callback each render must not restart a scene's timer.
	const endRef = useRef(onEnd)
	endRef.current = onEnd
	const atRef = useRef(onAt)
	atRef.current = onAt
	const [at, setAt] = useState(startAt)
	const [prev, setPrev] = useState<number | null>(null)
	// A jump (the chapter bar, Next) starts that scene at once, with no hand-over.
	const [jumps, setJumps] = useState(0)
	const jump = (i: number) => {
		setPrev(null)
		setAt(i)
		setJumps((n) => n + 1)
	}
	const enterOf = (i: number): Enter => scenes[i]?.enter ?? "fade"
	const overlap = OVERLAP[enterOf(at)]

	useEffect(() => atRef.current?.(at), [at])
	useEffect(() => {
		const scene = scenes[at]
		if (!scene) return
		const last = at === scenes.length - 1
		const timer = last
			? setTimeout(() => endRef.current?.(), scene.ms * k)
			: setTimeout(
					() => {
						setPrev(at)
						setAt(at + 1)
					},
					Math.max(0, scene.ms - OVERLAP[enterOf(at + 1)]) * k,
				)
		return () => clearTimeout(timer)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [at, scenes, k, jumps])
	useEffect(() => {
		if (prev === null) return
		const timer = setTimeout(() => setPrev(null), overlap * k + 50)
		return () => clearTimeout(timer)
	}, [prev, overlap, k])

	// The first scene shown comes in with `firstEnter`; every later one with its own hand-over.
	const first = prev === null && jumps === 0 && at === startAt && firstEnter
	const slot = (i: number, role: "in" | "out" | "on") => {
		const scene = scenes[i]
		if (!scene) return null
		const enter =
			first && i === at ? firstEnter : enterOf(role === "out" ? at : i)
		const C = scene.C
		return (
			<div
				key={`${jumps}-${i}-${scene.id}`}
				className={`film-slot film-${role} film-tr-${enter}`}
				style={{ "--o": `${OVERLAP[enter]}ms` } as CSSProperties}
				data-scene={scene.id}
			>
				<C data={data} />
			</div>
		)
	}
	const chapters = chapterCount(scenes)
	return (
		<>
			{prev !== null && slot(prev, "out")}
			{slot(at, prev !== null || first ? "in" : "on")}
			{prev !== null && enterOf(at) === "wipe" && (
				<div
					key={`wipe-${at}`}
					className="film-wipe"
					style={{ "--o": `${overlap}ms` } as CSSProperties}
				/>
			)}
			{at < chapters && (
				<ChapterBar
					scenes={scenes.slice(0, chapters)}
					at={at}
					k={k}
					run={jumps}
					onJump={jump}
				/>
			)}
			{at < chapters && (
				<button
					type="button"
					className="film-skip"
					onClick={() => jump(at + 1)}
					aria-label="Next chapter"
				>
					Next
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M6 5l8 7-8 7V5zm10 0h2.5v14H16z" fill="currentColor" />
					</svg>
				</button>
			)}
		</>
	)
}

/** YouTube-style chapters: a segment per scene, as long as the scene; the one playing fills; a click jumps there. */
function ChapterBar({
	scenes,
	at,
	k,
	run,
	onJump,
}: {
	scenes: readonly Scene[]
	at: number
	k: number
	run: number
	onJump: (i: number) => void
}) {
	return (
		<nav className="film-chapters" aria-label="Chapters">
			<div className="film-chapter-now" key={`${run}-${at}`}>
				{chapterOf(scenes[at])}
			</div>
			<ol>
				{scenes.map((c, i) => (
					<li key={c.id} style={{ flexGrow: c.ms }}>
						<button
							type="button"
							onClick={() => onJump(i)}
							aria-label={`Chapter ${i + 1}: ${chapterOf(c)}`}
							aria-current={i === at || undefined}
						>
							<span className="film-chapter-track">
								<span
									key={i === at ? `${run}-${at}` : undefined}
									className={`film-chapter-fill ${i < at ? "film-done" : i === at ? "film-now" : ""}`}
									style={
										i === at
											? ({ "--d": `${c.ms * k}ms` } as CSSProperties)
											: undefined
									}
								/>
							</span>
							<span className="film-chapter-tip">{chapterOf(c)}</span>
						</button>
					</li>
				))}
			</ol>
		</nav>
	)
}
