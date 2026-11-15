// The show. The page scrolls to its end, the house lights go down (the page fades to the palace's dark, opacity only),
// the projector's lamp strikes up and its beam lights the screen, the curtains part, and the program runs segment by
// segment (see program.ts). The picture's light spills onto the page around the screen. Skip moves to the next
// segment; Escape, Leave, a click outside the screen, scrolling away or going to another page bring the house lights
// back up, and so does the end of the program. Reduced motion: no dust in the beam, each segment is a few still frames,
// the credits stand still.
//
// It's a modal dialog while it runs: focus moves to Leave as it opens (to Skip when the program starts), Tab stays on
// its controls, and when the house lights come back up the projector gets focus again, unless the show ended because
// the page changed.
import { Link, useLocation } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import {
	type CSSProperties,
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { createPortal } from "react-dom"
import { useFocusScope } from "~/ui/for-you/focus"
import { DISPLAY } from "~/ui/my-pages/style"
import { type CreditBlock, cinemaText } from "./numbers"
import { CINEMA_NUMBERS_KEY, fetchCinemaNumbers } from "./numbers-query"
import {
	BEAM_FX,
	FILM_GATE_FX,
	HAZE,
	HOUSE,
	PROJECTOR_FX,
	ROOM_FX,
	SCREEN,
	dockHeight,
	lensInFooter,
	scaleFor,
	screenFor,
} from "./palace"
import { FX as IDLE_FX } from "./pixelfx/idle.js"
import { FX } from "./pixelfx/show.js"
import { type Segment, programFor } from "./program"
import {
	type CinemaLayout,
	type CinemaStage,
	type Handle,
	createCinemaStage,
} from "./stage"

/** Seconds of black between segments. */
const GAP = 0.35
/** Reduced motion: how long each still holds, in seconds. */
const CALM_HOLD = 3.2
/** How far the page may scroll during the show before it counts as leaving, in CSS px. */
const SCROLL_AWAY = 140

/** The palace's curtains, t seconds after they start to open (exported by its effect). */
const curtainAt = FX[ROOM_FX].curtainAt as (t: number) => {
	open: number
	sway?: number
}

/** Timers and tweens that all stop on unmount. */
function useClock() {
	const timers = useRef<number[]>([])
	const frames = useRef<Set<number>>(new Set())
	useEffect(
		() => () => {
			for (const id of timers.current) window.clearTimeout(id)
			for (const id of frames.current) cancelAnimationFrame(id)
		},
		[],
	)
	return useRef({
		later(ms: number, fn: () => void) {
			timers.current.push(window.setTimeout(fn, ms))
		},
		clear() {
			for (const id of timers.current) window.clearTimeout(id)
			timers.current = []
		},
		/** Calls fn(u) with u from 0 to 1 over `ms` on animation frames. */
		tween(ms: number, fn: (u: number) => void) {
			const start = performance.now()
			const step = (now: number) => {
				frames.current.delete(id)
				const u = ms <= 0 ? 1 : Math.min(1, (now - start) / ms)
				fn(u)
				if (u < 1) {
					id = requestAnimationFrame(step)
					frames.current.add(id)
				}
			}
			let id = requestAnimationFrame(step)
			frames.current.add(id)
		},
	}).current
}

const easeInOut = (u: number) =>
	u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2

/** The lamp striking: hard steps, no fades. */
const STRIKE: [number, number][] = [
	[0, 0],
	[0.08, 0.7],
	[0.14, 0.12],
	[0.26, 1],
	[0.33, 0.55],
	[0.42, 1],
]
const strikeAt = (s: number) => {
	let v = 0
	for (const [t, k] of STRIKE) if (s >= t) v = k
	return v
}

function layoutNow(footer: HTMLElement): CinemaLayout {
	const vw = document.documentElement.clientWidth
	const vh = window.innerHeight
	const S = scaleFor(window.innerWidth, vh)
	const box = footer.getBoundingClientRect()
	// the grid starts on the footer's top-left corner, so the projector lands on the pixels it had in the footer
	const kx = Math.ceil(box.left / S)
	const ky = Math.ceil(box.top / S)
	const gx = box.left - kx * S
	const gy = box.top - ky * S
	const { width, top } = screenFor(window.innerWidth, vh)
	const lens = lensInFooter(
		S,
		footer.clientWidth,
		footer.clientHeight,
		dockHeight(footer),
		window.innerWidth,
	)
	return {
		S,
		gx,
		gy,
		W: Math.ceil((vw - gx) / S) + 1,
		H: Math.ceil((vh - gy) / S) + 1,
		screen: {
			x: Math.round(((vw - width) / 2 - gx) / S),
			y: Math.round((top - gy) / S),
			w: SCREEN.w,
			h: SCREEN.h,
		},
		lens: { x: lens.x + kx, y: lens.y + ky },
	}
}

/** Why the show ended: the viewer left (Escape, Leave, a click outside, scrolling away), the program ran out, or the
 * page changed under it. */
export type ShowEnd = "left" | "finished" | "navigated"

/** Where the controls sit before the stage is measured: under the screen as screenFor places it. */
function barTopBefore() {
	const vw = window.innerWidth
	const vh = window.innerHeight
	const S = scaleFor(vw, vh)
	return screenFor(vw, vh).top + SCREEN.h * S + Math.max(10, S * 4)
}

/** How far the page is from its end, in CSS px. */
const toEnd = () => {
	const root = document.scrollingElement ?? document.documentElement
	return root.scrollHeight - window.innerHeight - window.scrollY
}

export default function Show({
	footer,
	calm,
	onEnded,
}: {
	footer: RefObject<HTMLElement | null>
	calm: boolean
	onEnded: (reason: ShowEnd) => void
}) {
	const root = useRef<HTMLDivElement>(null)
	const canvas = useRef<HTMLCanvasElement>(null)
	const warm = useRef<HTMLDivElement>(null)
	const cool = useRef<HTMLDivElement>(null)
	const skip = useRef<HTMLButtonElement>(null)
	const exit = useRef<HTMLButtonElement>(null)
	const stage = useRef<CinemaStage | null>(null)
	const room = useRef<Handle | null>(null)
	const beam = useRef<Handle | null>(null)
	const projector = useRef<Handle | null>(null)
	const clock = useClock()
	const segmentClock = useClock()
	const [layout, setLayout] = useState<CinemaLayout | null>(null)
	const [segment, setSegment] = useState(-1)
	const [leaving, setLeaving] = useState(false)
	const [dark, setDark] = useState(false)
	const left = useRef(false)
	const restY = useRef<number | null>(null)
	const { pathname } = useLocation()
	const shownAt = useRef(pathname)

	const numbers = useQuery({
		queryKey: CINEMA_NUMBERS_KEY,
		queryFn: fetchCinemaNumbers,
	})
	const text = useMemo(
		() => (numbers.data ? cinemaText(numbers.data) : null),
		[numbers.data],
	)
	const program = useMemo(() => programFor(text), [text])
	// the running segment reads the program from here, so numbers that arrive late don't restart it
	const programNow = useRef(program)
	programNow.current = program

	const leave = useCallback(
		(reason: ShowEnd) => {
			if (left.current) return
			left.current = true
			setLeaving(true)
			segmentClock.clear()
			const s = stage.current
			s?.cut()
			// the shutter closes: the beam and the lamp step down
			clock.tween(calm ? 0 : 420, (u) => {
				const k = u < 0.4 ? 1 - u * 1.6 : u < 0.55 ? 0.5 : 1 - u
				beam.current?.set({ on: Math.max(0, k) })
				projector.current?.set({ on: Math.max(0, 1 - u) })
				if (s) s.blank = 0
			})
			// the curtains close
			clock.tween(calm ? 0 : 1400, (u) =>
				room.current?.set({ open: 1 - easeInOut(u), sway: 0 }),
			)
			// the house lights come back up
			clock.later(calm ? 0 : 260, () => {
				setDark(false)
				clock.tween(calm ? 0 : 1100, (u) => room.current?.set({ dim: 1 - u }))
			})
			clock.later(calm ? 400 : 1500, () => onEnded(reason))
		},
		[calm, clock, segmentClock, onEnded],
	)
	const leaveNow = useCallback(() => leave("left"), [leave])

	// Tab stays on the show's controls until it starts to leave; the projector takes focus back once it has (Projector)
	useFocusScope({
		active: !leaving,
		scope: () => [root.current],
		initial: () =>
			(skip.current && !skip.current.disabled ? skip.current : exit.current) ??
			root.current,
		returnTo: () => false,
	})

	// set the stage, once: get to the page's end, measure, build the room, the beam and the projector, then the intro
	useEffect(() => {
		const element = canvas.current
		const foot = footer.current
		if (!element || !foot) return
		const s = createCinemaStage(element)
		stage.current = s
		const repaint = () => {
			if (calm) s.render()
		}
		const intro = () => {
			// house lights down
			setDark(true)
			clock.tween(calm ? 0 : 1500, (u) => {
				room.current?.set({ dim: easeInOut(u) })
				repaint()
			})
			// the lamp strikes up and the beam lights the empty screen
			const strike = calm ? 0 : 700
			clock.later(strike, () =>
				clock.tween(calm ? 0 : 450, (u) => {
					const k = calm ? 1 : strikeAt(u * 0.45)
					beam.current?.set({ on: k })
					projector.current?.set({ on: Math.min(1, u * 2) })
					s.blank = k * 0.85
					repaint()
				}),
			)
			// the curtains part
			const curtains = 2600
			clock.later(strike + 500, () =>
				clock.tween(calm ? 0 : curtains, (u) => {
					const v = calm
						? { open: 1, sway: 0 }
						: curtainAt((u * curtains) / 1000)
					room.current?.set({ open: v.open, sway: v.sway ?? 0 })
					repaint()
				}),
			)
			// then the program
			clock.later(strike + 500 + (calm ? 0 : curtains) + 500, () => {
				clock.tween(calm ? 0 : 250, (u) => {
					s.blank = 0.85 * (1 - u)
				})
				clock.later(calm ? 0 : 300, () => setSegment(0))
			})
		}
		const start = () => {
			const l = layoutNow(foot)
			s.layout(l)
			setLayout(l)
			restY.current = window.scrollY
			room.current = s.room(FX[ROOM_FX], {
				dim: 0,
				open: 0,
				sway: 0,
				lum: 0,
			})
			beam.current = s.beam(FX[BEAM_FX], {
				on: 0,
				haze: HAZE,
				dust: calm ? 0 : 1,
			})
			projector.current = s.projector(IDLE_FX[PROJECTOR_FX], { on: 0 })
			if (calm) s.render()
			else s.run()
			intro()
		}
		// the show plays at the end of the page: get there first (smoothly), then start
		const far = toEnd()
		if (far <= 2) {
			start()
			return () => s.destroy()
		}
		window.scrollTo({
			top: window.scrollY + far,
			behavior: calm ? "auto" : "smooth",
		})
		setDark(true)
		let still = 0
		let lastY = -1
		const began = performance.now()
		const settle = () => {
			const y = window.scrollY
			still = Math.abs(y - lastY) < 0.5 ? still + 1 : 0
			lastY = y
			if (still >= 4 || performance.now() - began > 1600) start()
			else frame = requestAnimationFrame(settle)
		}
		let frame = requestAnimationFrame(settle)
		return () => {
			cancelAnimationFrame(frame)
			s.destroy()
		}
	}, [])

	// the picture's light spills onto the page around the screen (opacity only)
	useEffect(() => {
		const s = stage.current
		if (!s || !layout) return
		s.onLight = (lum, r, _g, b) => {
			const w = warm.current
			const k = cool.current
			if (!w || !k) return
			const warmth = Math.max(0, Math.min(1, (r - b) / (r + b + 1) + 0.5))
			w.style.opacity = String(Math.min(0.55, lum * (0.25 + 0.5 * warmth)))
			k.style.opacity = String(Math.min(0.45, lum * 0.5 * (1 - warmth)))
		}
		return () => {
			s.onLight = null
		}
	}, [layout])

	// measure again when the window changes size
	useEffect(() => {
		const onResize = () => {
			const foot = footer.current
			const s = stage.current
			if (!foot || !s || left.current || restY.current === null) return
			const l = layoutNow(foot)
			s.layout(l)
			setLayout(l)
			if (calm) s.render()
		}
		window.addEventListener("resize", onResize)
		return () => window.removeEventListener("resize", onResize)
	}, [footer, calm])

	// ways out: Escape, scrolling away, another page
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") leave("left")
		}
		const onScroll = () => {
			if (
				restY.current !== null &&
				Math.abs(window.scrollY - restY.current) > SCROLL_AWAY
			)
				leave("left")
		}
		window.addEventListener("keydown", onKey)
		window.addEventListener("scroll", onScroll, { passive: true })
		return () => {
			window.removeEventListener("keydown", onKey)
			window.removeEventListener("scroll", onScroll)
		}
	}, [leave])
	useEffect(() => {
		if (pathname !== shownAt.current) leave("navigated")
	}, [pathname, leave])

	// the program: each segment plays its scene (or the credits roll), then the next one starts after a beat of black
	const [creditsLength, setCreditsLength] = useState(0)
	useEffect(() => {
		const s = stage.current
		if (!s || segment < 0 || left.current) return
		const now = programNow.current
		if (segment >= now.length) {
			leave("finished")
			return
		}
		// Enter skips from the start of the program, unless the viewer has moved focus off Leave since the show opened
		if (segment === 0 && document.activeElement === exit.current)
			skip.current?.focus({ preventScroll: true })
		const g = now[segment]
		s.cut()
		if (g.kind === "credits") {
			// the roll's length decides the segment's (setCreditsLength)
			if (calm) s.render()
			return () => segmentClock.clear()
		}
		const mod = FX[g.fx]
		const opts = { w: SCREEN.w, ...g.opts }
		let length: number
		if (calm) {
			// a few stills, one after another
			g.stills.forEach((at, i) =>
				segmentClock.later(i * CALM_HOLD * 1000, () => {
					s.cut()
					s.still(mod, at, opts)
					s.render()
				}),
			)
			length = g.stills.length * CALM_HOLD
		} else {
			s.play(mod, opts)
			length = mod.meta.duration ?? 6
			if (!g.clean) s.play(FX[FILM_GATE_FX], { w: SCREEN.w })
		}
		const gap = g.flow && !calm ? 0 : GAP
		segmentClock.later((length + gap) * 1000, () => setSegment((n) => n + 1))
		return () => segmentClock.clear()
	}, [segment, calm, leave, segmentClock])

	useEffect(() => {
		if (!creditsLength || program[segment]?.kind !== "credits") return
		segmentClock.later((creditsLength + GAP) * 1000, () =>
			setSegment((n) => n + 1),
		)
	}, [creditsLength, segment, program, segmentClock])

	const next = () => {
		if (left.current) return
		segmentClock.clear()
		setCreditsLength(0)
		setSegment((n) => n + 1)
	}

	const g = segment >= 0 ? program[segment] : null
	const S = layout?.S ?? 1
	const screen = layout
		? {
				left: layout.gx + layout.screen.x * S,
				top: layout.gy + layout.screen.y * S,
				width: layout.screen.w * S,
				height: layout.screen.h * S,
			}
		: null
	// type sized to the screen: about 4.8 pixels of the picture per CSS line of text
	const fontSize = Math.max(10, Math.min(24, S * 4.8))
	const shown = { opacity: dark && !leaving ? 1 : 0 }
	const barTop = screen
		? screen.top + screen.height + Math.max(10, S * 4)
		: barTopBefore()

	return createPortal(
		<div
			ref={root}
			className="fixed inset-0 z-[1200] overflow-hidden"
			// biome-ignore lint/a11y/useSemanticElements: a full-screen layer whose house lights fade out before it goes, not a modal <dialog>
			role="dialog"
			aria-modal="true"
			aria-label="The GoodWatch cinema"
		>
			<style>{CSS}</style>
			{/* the house lights: the page fades to the palace's dark; a click out here leaves */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape and the Leave button leave from the keyboard */}
			<div
				onClick={leaveNow}
				aria-hidden
				className="cinema-fade absolute inset-0"
				style={{
					background: HOUSE.color,
					opacity: dark && !leaving ? HOUSE.opacity : 0,
				}}
			/>
			{screen && (
				<>
					<div
						ref={warm}
						aria-hidden
						className="pointer-events-none absolute"
						style={{
							...spill(screen),
							background:
								"radial-gradient(closest-side, rgba(255,214,160,.55), rgba(255,190,120,.18) 55%, transparent)",
							opacity: 0,
						}}
					/>
					<div
						ref={cool}
						aria-hidden
						className="pointer-events-none absolute"
						style={{
							...spill(screen),
							background:
								"radial-gradient(closest-side, rgba(150,190,255,.5), rgba(120,150,255,.15) 55%, transparent)",
							opacity: 0,
						}}
					/>
				</>
			)}
			<canvas
				ref={canvas}
				aria-hidden
				className="cinema-fade pointer-events-none absolute top-0 left-0 origin-top-left [image-rendering:pixelated]"
				style={shown}
			/>
			{screen && g && !leaving && (
				<div
					className="pointer-events-none absolute overflow-hidden"
					style={{ ...screen, fontSize }}
				>
					{g.kind === "credits" && text ? (
						<CreditsRoll
							key={segment}
							credits={text.credits}
							S={S}
							height={screen.height}
							calm={calm}
							onLength={setCreditsLength}
						/>
					) : g.kind === "scene" && g.numbers && text ? (
						<p className="sr-only">
							{g.numbers === "montage" ? text.montageSay : text.finaleSay}
						</p>
					) : null}
				</div>
			)}
			{/* the controls are there from the start, so focus has somewhere to go as the show opens */}
			<div
				className="cinema-fade absolute inset-x-0 flex justify-center px-4"
				style={{ top: barTop, ...shown }}
			>
				<div className="flex max-w-full items-center gap-3 rounded-full bg-black/40 py-1 pr-1 pl-4 text-xs text-gray-400 ring-1 ring-white/10">
					<span aria-live="polite" className="min-w-0 truncate">
						{g
							? g.kind === "scene" && g.say
								? g.say
								: g.label
							: "Lights down"}
					</span>
					{g?.kind === "scene" && g.numbers && (
						<span className="cinema-rise shrink-0 whitespace-nowrap">
							<StatsLink>
								{g.numbers === "montage"
									? "All the numbers"
									: "Stay for the numbers"}
							</StatsLink>
						</span>
					)}
					<ProgramDots program={program} segment={segment} />
					<button
						ref={skip}
						type="button"
						onClick={next}
						disabled={!g}
						className="shrink-0 rounded-full bg-white/[0.08] px-3 py-1 text-gray-200 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-300 disabled:opacity-40"
					>
						Skip
					</button>
					<button
						ref={exit}
						type="button"
						onClick={leaveNow}
						className="shrink-0 rounded-full px-3 py-1 whitespace-nowrap text-gray-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-300"
					>
						Leave <span className="hidden text-gray-500 sm:inline">Esc</span>
					</button>
				</div>
			</div>
		</div>,
		document.body,
	)
}

/** One dot per segment: the one playing, the ones played, the ones to come. */
function ProgramDots({
	program,
	segment,
}: { program: Segment[]; segment: number }) {
	return (
		<span className="hidden gap-1 sm:flex" aria-hidden>
			{program.map((g, i) => (
				<span
					key={`${i}-${g.label}`}
					className={`h-1 w-1 rounded-full ${i === segment ? "bg-amber-300" : i < segment ? "bg-white/40" : "bg-white/15"}`}
				/>
			))}
		</span>
	)
}

/** The page lit around the screen: a box about twice the screen's size, centered on it. */
const spill = (screen: {
	left: number
	top: number
	width: number
	height: number
}) => {
	const w = screen.width * 1.9
	const h = screen.height * 2.6
	return {
		left: screen.left + screen.width / 2 - w / 2,
		top: screen.top + screen.height / 2 - h / 2,
		width: w,
		height: h,
	}
}

const CSS = `
.cinema-fade { transition: opacity 1.4s cubic-bezier(.4,0,.2,1) }
@keyframes cinema-crawl { from { transform: translate3d(0, var(--from), 0) } to { transform: translate3d(0, var(--to), 0) } }
@keyframes cinema-rise { from { opacity: 0; transform: translate3d(0, 6px, 0) } to { opacity: 1; transform: none } }
@keyframes cinema-appear { from { opacity: 0 } to { opacity: 1 } }
.cinema-rise { animation: cinema-rise .6s cubic-bezier(.22,1,.36,1) both }
@media (prefers-reduced-motion: reduce) { .cinema-rise { animation: cinema-appear .4s ease-out both } }
`

function StatsLink({ children }: { children: string }) {
	return (
		<Link
			to="/stats"
			prefetch="intent"
			className="pointer-events-auto inline-flex items-center gap-1 text-amber-300 underline decoration-amber-300/40 underline-offset-4 transition-colors hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
		>
			{children}
			<span aria-hidden>→</span>
		</Link>
	)
}

/** The end credits: they roll up the screen until the last line has left it, or stand still under reduced motion. */
function CreditsRoll({
	credits,
	S,
	height,
	calm,
	onLength,
}: {
	credits: CreditBlock[]
	S: number
	height: number
	calm: boolean
	onLength: (seconds: number) => void
}) {
	const roll = useRef<HTMLDivElement>(null)
	const [crawl, setCrawl] = useState<{
		from: number
		to: number
		seconds: number
	} | null>(null)
	useLayoutEffect(() => {
		if (calm) {
			onLength(9)
			return
		}
		const from = height
		const to = -(roll.current?.offsetHeight ?? 0)
		const seconds = (from - to) / (height / 6.5)
		setCrawl({ from, to, seconds })
		onLength(seconds)
	}, [height, calm, onLength])
	const shown = calm ? credits.slice(0, 6) : credits
	return (
		<div
			ref={roll}
			className="absolute inset-x-0 top-0 flex flex-col items-center px-[1em] text-center"
			style={
				calm
					? { paddingTop: 8 * S }
					: crawl
						? ({
								"--from": `${crawl.from}px`,
								"--to": `${crawl.to}px`,
								animation: `cinema-crawl ${crawl.seconds}s linear both`,
							} as CSSProperties)
						: { transform: `translate3d(0, ${height}px, 0)` }
			}
		>
			<p
				className="tracking-[0.3em] text-gray-400 uppercase"
				style={{ fontSize: ".7em" }}
			>
				GoodWatch presents
			</p>
			<p
				className={`${DISPLAY} mt-[0.3em] text-amber-300`}
				style={{ fontSize: "2em" }}
			>
				GoodWatch in numbers
			</p>
			<div
				className={
					calm
						? "mt-[0.8em] grid grid-cols-2 gap-x-[1.5em] gap-y-[0.6em]"
						: "mt-[1.6em] flex flex-col gap-[1.2em]"
				}
			>
				{shown.map((block) => (
					<div key={block.role}>
						<p
							className="tracking-[0.25em] text-gray-400 uppercase"
							style={{ fontSize: ".62em" }}
						>
							{block.role}
						</p>
						{block.names.map((name) => (
							<p
								key={name}
								className="text-white tabular-nums"
								style={{ fontSize: calm ? ".8em" : "1.1em" }}
							>
								{name}
							</p>
						))}
					</div>
				))}
			</div>
			{calm && (
				<p className="mt-[0.8em]" style={{ fontSize: ".75em" }}>
					<StatsLink>See every number</StatsLink>
				</p>
			)}
		</div>
	)
}
