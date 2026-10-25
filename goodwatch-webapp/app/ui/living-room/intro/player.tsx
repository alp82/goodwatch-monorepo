// Plays the film's scenes (film.ts) one after another on the TV's picture, with a hand-over between them, the
// chapter bar under them and a Next button at the bottom right. Once the quiz shows, Next and the chapter bar go and
// nothing takes their place (the owner, 2026-10-22: no Replay at the end; the quiz's own keys lead on, and the TV's
// menu plays the film again with "What is GoodWatch?"). A quick second press of Next lands on nothing.
// Holding a press on the picture, or the space bar, plays the chapters at 2x, then 3x and 4x, until it's let go
// (speed.ts).
import {
	type CSSProperties,
	type ReactNode,
	type RefObject,
	createContext,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react"
import { CHAPTERS, type Enter, type IntroData, type Scene } from "./scene"
import {
	type FilmClock,
	STEP_MS,
	TOUCH_HOLD_MS,
	filmClock,
	holdRate,
	rampRate,
} from "./speed"

/** How long each hand-over overlaps the end of the scene before it, in ms at k = 1. */
const OVERLAP: Record<Enter, number> = {
	cut: 0,
	fade: 800,
	wipe: 900,
	deal: 800,
}

const StageElement = createContext<RefObject<HTMLDivElement> | null>(null)

/** The stage: fills the TV's picture, sizes scenes by container units, scales all their timing by `k`. */
export function Stage({ k, children }: { k: number; children: ReactNode }) {
	const ref = useRef<HTMLDivElement>(null)
	return (
		<div ref={ref} className="film-stage" style={{ "--k": k } as CSSProperties}>
			<StageElement.Provider value={ref}>{children}</StageElement.Provider>
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
	const clock = useRef<FilmClock | null>(null)
	clock.current ??= filmClock()
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
		return last
			? clock.current?.after(scene.ms * k, () => endRef.current?.())
			: clock.current?.after(
					Math.max(0, scene.ms - OVERLAP[enterOf(at + 1)]) * k,
					() => {
						setPrev(at)
						setAt(at + 1)
					},
				)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [at, scenes, k, jumps])
	useEffect(() => {
		if (prev === null) return
		return clock.current?.after(overlap * k + 50, () => setPrev(null))
	}, [prev, overlap, k])
	const chapters = chapterCount(scenes)
	const speed = useFastHold(useContext(StageElement), at < chapters, clock)
	// The overlay keeps its last number while it fades out.
	const shown = useRef(2)
	if (speed > 1) shown.current = speed

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
				<div
					className="film-fast"
					data-on={speed > 1 || undefined}
					aria-hidden="true"
				>
					<span key={shown.current} className="film-fast-n">
						{shown.current}×
					</span>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path
							d="M3 5.5l9 6.5-9 6.5zm9 0l9 6.5-9 6.5z"
							fill="currentColor"
						/>
					</svg>
				</div>
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

/** The overlay's own fade isn't part of the film: it keeps its pace. */
const isFilm = (animation: Animation) => {
	const target = (animation.effect as KeyframeEffect | null)?.target
	return !target?.closest(".film-fast")
}

/**
 * The speed the visitor holds the film at (1 when not held): 2x, then 3x and 4x every `STEP_MS` held. A hold starts
 * with a mouse press or the space bar at once, a finger after `TOUCH_HOLD_MS` without moving (a tap or a scroll doesn't). A press on the chapter bar or
 * Next is theirs. While the speed isn't 1x, every frame sets it on the clock and on each animation on
 * the stage, so a scene that comes in while held plays fast too.
 */
function useFastHold(
	stage: RefObject<HTMLDivElement> | null,
	enabled: boolean,
	clock: RefObject<FilmClock | null>,
): number {
	const [fast, setFast] = useState(false)
	const [heldFor, setHeldFor] = useState(0)
	// Each step up comes `STEP_MS` into the hold; letting go starts over at 2x.
	useEffect(() => {
		setHeldFor(0)
		if (!fast) return
		const timers = [1, 2].map((n) =>
			setTimeout(() => setHeldFor(n * STEP_MS), n * STEP_MS),
		)
		return () => timers.forEach(clearTimeout)
	}, [fast])
	const target = fast ? holdRate(heldFor) : 1

	useEffect(() => {
		const el = stage?.current
		if (!el || !enabled) {
			setFast(false)
			return
		}
		let pointer: { id: number; x: number; y: number } | null = null
		let touchTimer: ReturnType<typeof setTimeout> | undefined
		let space = false
		const release = () => {
			pointer = null
			space = false
			clearTimeout(touchTimer)
			touchTimer = undefined
			setFast(false)
		}
		const onDown = (e: PointerEvent) => {
			if (pointer || (e.pointerType === "mouse" && e.button !== 0)) return
			const target = e.target instanceof Element ? e.target : null
			if (target?.closest("button, a, input, .film-chapters")) return
			pointer = { id: e.pointerId, x: e.clientX, y: e.clientY }
			if (e.pointerType === "touch")
				touchTimer = setTimeout(() => {
					touchTimer = undefined
					setFast(true)
				}, TOUCH_HOLD_MS)
			else setFast(true)
		}
		const onMove = (e: PointerEvent) => {
			// A finger that moves before the film sped up is scrolling or pointing, not holding.
			if (!pointer || e.pointerId !== pointer.id || !touchTimer) return
			if (Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) > 10)
				release()
		}
		const onUp = (e: PointerEvent) => {
			if (pointer && e.pointerId === pointer.id) release()
		}
		// A long press would open the browser's menu over the film.
		const onMenu = (e: Event) => {
			if (pointer) e.preventDefault()
		}
		const typing = (target: EventTarget | null) =>
			target instanceof HTMLElement &&
			(target.isContentEditable ||
				/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
		// The space bar only while at least half the picture is on screen: further down the page it scrolls.
		const onScreen = () => {
			const r = el.getBoundingClientRect()
			const seen = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0)
			return seen >= r.height / 2
		}
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.code !== "Space" || e.altKey || e.ctrlKey || e.metaKey) return
			if (!space && (typing(e.target) || !onScreen())) return
			e.preventDefault()
			if (!space) {
				space = true
				setFast(true)
			}
		}
		const onKeyUp = (e: KeyboardEvent) => {
			if (e.code !== "Space" || !space) return
			e.preventDefault()
			release()
		}
		const onHidden = () => {
			if (document.hidden) release()
		}
		el.addEventListener("pointerdown", onDown)
		el.addEventListener("contextmenu", onMenu)
		window.addEventListener("pointermove", onMove)
		window.addEventListener("pointerup", onUp)
		window.addEventListener("pointercancel", onUp)
		window.addEventListener("keydown", onKeyDown, true)
		window.addEventListener("keyup", onKeyUp, true)
		window.addEventListener("blur", release)
		document.addEventListener("visibilitychange", onHidden)
		return () => {
			el.removeEventListener("pointerdown", onDown)
			el.removeEventListener("contextmenu", onMenu)
			window.removeEventListener("pointermove", onMove)
			window.removeEventListener("pointerup", onUp)
			window.removeEventListener("pointercancel", onUp)
			window.removeEventListener("keydown", onKeyDown, true)
			window.removeEventListener("keyup", onKeyUp, true)
			window.removeEventListener("blur", release)
			document.removeEventListener("visibilitychange", onHidden)
			release()
		}
	}, [stage, enabled])

	useEffect(() => {
		const el = stage?.current
		const time = clock.current
		if (!el || !time) return
		const to = target
		const from = time.rate
		if (from === to && !fast) return
		const start = performance.now()
		let frame = 0
		const step = () => {
			const rate = rampRate(from, to, performance.now() - start)
			time.setRate(rate)
			for (const animation of el.getAnimations?.({ subtree: true }) ?? []) {
				if (animation.playbackRate === rate || !isFilm(animation)) continue
				if (animation.updatePlaybackRate) animation.updatePlaybackRate(rate)
				else animation.playbackRate = rate
			}
			// Held, it keeps going: the scenes that come in meanwhile start at 1x.
			if (fast || rate !== to) frame = requestAnimationFrame(step)
		}
		step()
		return () => cancelAnimationFrame(frame)
	}, [fast, target, stage, clock])

	return target
}
