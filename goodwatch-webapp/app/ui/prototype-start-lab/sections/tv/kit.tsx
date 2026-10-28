// PROTOTYPE (start page lab): what the tv variants share: the real intro film mounted standalone, the box it plays in,
// the flight keyframes (camera push, screen morph), Escape / "Just look around" / Close wiring, and the label by the TV.
import { type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react"
import { FILM_LEAVE_EVENT } from "~/ui/living-room/intro/events"
import { FILM } from "~/ui/living-room/intro/film"
import "~/ui/living-room/intro/intro.css"
import { FilmPhone, isPhonePicture } from "~/ui/living-room/intro/parts/film-phone"
import { Player, Stage, chapterCount } from "~/ui/living-room/intro/player"
import type { IntroData, Scene } from "~/ui/living-room/intro/scene"
import type { IntroFrom, Rect } from "../../lab/types"
import { quadTransform } from "../../scene/homography"
import "./tv.css"

export type Pt = [number, number]
export type Quad4 = [Pt, Pt, Pt, Pt]

export const EASE = "cubic-bezier(0.65, 0, 0.2, 1)"
export const CHAPTERS = chapterCount(FILM)

export const reducedMotion = () =>
	typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

export function useViewport() {
	const [vp, setVp] = useState(() =>
		typeof window === "undefined" ? { w: 1440, h: 900 } : { w: window.innerWidth, h: window.innerHeight },
	)
	useEffect(() => {
		const on = () => setVp({ w: window.innerWidth, h: window.innerHeight })
		window.addEventListener("resize", on)
		return () => window.removeEventListener("resize", on)
	}, [])
	return vp
}

/** The film's picture: as large as fits, between 16:9 and 1.85:1, centered in the given area. */
export function filmBox(area: Rect): Rect {
	const height = Math.min(area.height, (area.width * 9) / 16)
	const width = Math.min(area.width, height * 1.85)
	return {
		left: area.left + (area.width - width) / 2,
		top: area.top + (area.height - height) / 2,
		width,
		height,
	}
}

export const rectQuad = (r: Rect): Quad4 => [
	[r.left, r.top],
	[r.left + r.width, r.top],
	[r.left + r.width, r.top + r.height],
	[r.left, r.top + r.height],
]

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * A w × h element (fixed at 0,0, origin top-left) flying from quad `a` to quad `b`: its corners move straight, the
 * whole lifting by `lift` px at the middle. Many keyframes, so the browser's matrix interpolation stays on the path.
 */
export function morphFrames(a: Quad4, b: Quad4, w: number, h: number, lift = 0, n = 24): Keyframe[] {
	const frames: Keyframe[] = []
	for (let i = 0; i <= n; i++) {
		const t = i / n
		const up = lift * Math.sin(Math.PI * t)
		const q = a.map((p, j) => [lerp(p[0], b[j][0], t), lerp(p[1], b[j][1], t) - up]) as Quad4
		frames.push({ transform: quadTransform(q, w, h), offset: t })
	}
	return frames
}

/**
 * The camera pushing into the room: transforms for the room copy (fixed at `from.roomRect`, origin top-left) that
 * zoom about one fixed point until the TV's rect covers `target`. The zoom is even in log scale, so it doesn't rush.
 */
export function pushFrames(from: IntroFrom, target: Rect, n = 20, reach = 1): Keyframe[] {
	const tv = from.tvRect
	const end = Math.max(target.width / Math.max(1, tv.width), target.height / Math.max(1, tv.height)) * 1.03
	const sEnd = 1 + (end - 1) * reach
	const c0: Pt = [tv.left + tv.width / 2, tv.top + tv.height / 2]
	const tc: Pt = [target.left + target.width / 2, target.top + target.height / 2]
	const L: Pt = [from.roomRect.left, from.roomRect.top]
	const frames: Keyframe[] = []
	const near1 = Math.abs(1 - sEnd) < 0.05
	// The fixed point: where the camera pushes in.
	const P: Pt = near1 ? c0 : [(tc[0] - sEnd * c0[0]) / (1 - sEnd), (tc[1] - sEnd * c0[1]) / (1 - sEnd)]
	for (let i = 0; i <= n; i++) {
		const t = i / n
		const s = Math.exp(Math.log(sEnd) * t)
		const tx = near1 ? (tc[0] - c0[0]) * t : (1 - s) * (P[0] - L[0])
		const ty = near1 ? (tc[1] - c0[1]) * t : (1 - s) * (P[1] - L[1])
		frames.push({ transform: `translate(${tx}px, ${ty}px) scale(${s})`, offset: t })
	}
	return frames
}

export const done = (a: Animation | undefined) => a?.finished.catch(() => undefined) ?? Promise.resolve()

/** The room exactly as it was on the page: the scene image in the room's box. */
export function RoomCopy({
	from,
	innerRef,
	children,
	style,
}: {
	from: IntroFrom
	innerRef: React.Ref<HTMLDivElement>
	children?: ReactNode
	style?: CSSProperties
}) {
	const r = from.roomRect
	return (
		<div
			ref={innerRef}
			className="pointer-events-none fixed left-0 top-0 overflow-hidden"
			style={{ left: r.left, top: r.top, width: r.width, height: r.height, transformOrigin: "0 0", opacity: 0, ...style }}
		>
			{from.image.src ? (
				<img
					src={from.image.src}
					alt=""
					draggable={false}
					className="absolute max-w-none select-none"
					style={{ left: from.image.left, top: from.image.top, width: from.image.width, height: from.image.height }}
				/>
			) : null}
			{children}
		</div>
	)
}

/** /api/intro, asked for as the Theater opens, so the film is ready when the screen lands. */
export function useIntroData() {
	const [state, setState] = useState<{ data: IntroData | null; failed: boolean }>({ data: null, failed: false })
	useEffect(() => {
		let gone = false
		fetch("/api/intro")
			.then((r) => (r.ok ? (r.json() as Promise<IntroData>) : Promise.reject(new Error(`status ${r.status}`))))
			.then((data) => !gone && setState(data.pool?.length ? { data, failed: false } : { data: null, failed: true }))
			.catch(() => !gone && setState({ data: null, failed: true }))
		return () => {
			gone = true
		}
	}, [])
	return state
}

/**
 * The Theater's wiring: the film starts fresh (its tab progress cleared), Escape and the quiz's "Just look around"
 * close it, and the page under it doesn't scroll (without hiding the scrollbar, so the room stays where it was).
 */
export function useTheater(close: () => void, root: React.RefObject<HTMLElement>) {
	const closeRef = useRef(close)
	closeRef.current = close
	useLayoutEffect(() => {
		try {
			sessionStorage.removeItem("gw-intro")
			sessionStorage.removeItem("gw-intro-taps")
		} catch {}
	}, [])
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") closeRef.current()
		}
		const onLeave = () => closeRef.current()
		const el = root.current
		const stop = (e: Event) => e.preventDefault()
		window.addEventListener("keydown", onKey)
		window.addEventListener(FILM_LEAVE_EVENT, onLeave)
		el?.addEventListener("wheel", stop, { passive: false })
		el?.addEventListener("touchmove", stop, { passive: false })
		return () => {
			window.removeEventListener("keydown", onKey)
			window.removeEventListener(FILM_LEAVE_EVENT, onLeave)
			el?.removeEventListener("wheel", stop)
			el?.removeEventListener("touchmove", stop)
		}
	}, [root])
}

/** A close that runs once: the variant's way out, then onClose. */
export function useOnce<A extends unknown[]>(fn: (...args: A) => void) {
	const ran = useRef(false)
	return (...args: A) => {
		if (ran.current) return
		ran.current = true
		fn(...args)
	}
}

export type FilmControl = {
	at: number
	paused: boolean
	togglePause: () => void
	next: () => void
	prev: () => void
}

/** Holding the scene timers: the Player's own `k` stretched far out (setTimeout's limit is 2^31 ms). */
const PAUSED_K = 1000

/**
 * The real intro film in a size container that fills its parent. `paused` (the remote) freezes the stage's
 * animations and stretches the Player's timers; the chapter bar's fill keeps its place.
 */
export function Film({
	data,
	scenes = FILM,
	paused = false,
	startAt = 0,
	run = 0,
	onAt,
	boxRef,
}: {
	data: IntroData
	/** The film's scenes; tv a ends on its own "Your turn" card instead of the quiz. */
	scenes?: readonly Scene[]
	paused?: boolean
	startAt?: number
	/** A new run remounts the Player at startAt. */
	run?: number
	onAt?: (i: number) => void
	boxRef?: React.MutableRefObject<HTMLDivElement | null>
}) {
	const box = useRef<HTMLDivElement | null>(null)
	const [phone, setPhone] = useState(false)
	useLayoutEffect(() => {
		const el = box.current
		if (!el) return
		const measure = () => setPhone(isPhonePicture(el.clientWidth, el.clientHeight))
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [])
	// The chapter fill's progress, read before its duration changes with k.
	const fill = useRef<number | null>(null)
	const last = useRef(paused)
	if (last.current !== paused) {
		last.current = paused
		const a = box.current?.querySelector(".film-chapter-fill.film-now")?.getAnimations()[0]
		const d = Number(a?.effect?.getComputedTiming().duration) || 0
		fill.current = a && d ? Number(a.currentTime ?? 0) / d : null
	}
	useLayoutEffect(() => {
		const el = box.current
		if (!el) return
		getComputedStyle(el).opacity // flush the new --d
		for (const a of el.getAnimations({ subtree: true })) {
			const target = (a.effect as KeyframeEffect | null)?.target
			if (fill.current !== null && target?.matches(".film-chapter-fill.film-now")) {
				const d = Number(a.effect?.getComputedTiming().duration) || 0
				a.currentTime = fill.current * d
			}
			if (paused) a.pause()
			else if (a.playState === "paused") a.play()
		}
		fill.current = null
	}, [paused])
	return (
		<div
			ref={(el) => {
				box.current = el
				if (boxRef) boxRef.current = el
			}}
			className="absolute inset-0 overflow-hidden"
			style={{ containerType: "size", background: "#05060a" }}
		>
			<FilmPhone.Provider value={phone}>
				<Stage k={1}>
					<Player
						key={run}
						scenes={scenes}
						data={data}
						firstEnter={run ? "fade" : "deal"}
						startAt={startAt}
						k={paused ? PAUSED_K : 1}
						onAt={onAt}
					/>
				</Stage>
			</FilmPhone.Provider>
		</div>
	)
}

/** The film's controls for a remote: Next is the film's own button; Previous replays the chapter before. */
export function useFilmControl(box: React.MutableRefObject<HTMLDivElement | null>) {
	const [at, setAt] = useState(0)
	const [paused, setPaused] = useState(false)
	const [start, setStart] = useState({ at: 0, run: 0 })
	const control: FilmControl = {
		at,
		paused,
		togglePause: () => setPaused((p) => !p),
		next: () => {
			if (at >= CHAPTERS) return
			setPaused(false)
			box.current?.querySelector<HTMLButtonElement>(".film-skip")?.click()
		},
		prev: () => {
			setPaused(false)
			setStart((s) => ({ at: Math.max(0, Math.min(at, CHAPTERS) - 1), run: s.run + 1 }))
		},
	}
	return { control, startAt: start.at, run: start.run, onAt: setAt }
}

export function CloseButton({ onClick, style }: { onClick: () => void; style?: CSSProperties }) {
	return (
		<button
			type="button"
			onClick={onClick}
			style={style}
			className="fixed right-3 top-3 z-[40] flex h-10 items-center gap-1.5 rounded-full bg-black/60 pl-3 pr-4 text-sm font-semibold text-white ring-1 ring-white/15 transition-colors hover:bg-black/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
			aria-label="Close the intro"
		>
			<svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
				<path d="M6 6l12 12M18 6L6 18" />
			</svg>
			Close
		</button>
	)
}

/** A portrait phone's 16:9 picture is small: say how to make it bigger. */
export function TurnHint({ box, vp }: { box: Rect; vp: { w: number; h: number } }) {
	if (vp.w >= vp.h || vp.w >= 768) return null
	return (
		<p
			className="pointer-events-none fixed inset-x-0 z-[35] px-4 text-center text-xs text-white/55"
			style={{ top: box.top + box.height + 16 }}
		>
			Turn your phone sideways for a bigger picture.
		</p>
	)
}

/** The film fails to load: a plain line on the black. */
export function FilmFailed() {
	return (
		<div className="absolute inset-0 flex items-center justify-center bg-[#05060a] p-6 text-center text-sm text-white/60">
			The intro isn't available right now.
		</div>
	)
}

export function PlayGlyph({ className = "", style }: { className?: string; style?: CSSProperties }) {
	return (
		<svg viewBox="0 0 24 24" className={className} style={style} aria-hidden="true">
			<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
		</svg>
	)
}

/**
 * "Watch the intro" by the TV: below its screen when there's room, above it otherwise, kept inside the room's box.
 * `gap` is how far from the screen's edge (a TV's bezel and stand sit below its picture).
 */
export function NearLabel({
	tvRect,
	onPlay,
	children,
	prefer = "below",
	gap = 10,
	className = "",
}: {
	tvRect: Rect
	onPlay: () => void
	children: ReactNode
	prefer?: "below" | "above"
	gap?: number
	className?: string
}) {
	const ref = useRef<HTMLButtonElement>(null)
	const [at, setAt] = useState<{ left: number; top: number } | null>(null)
	useLayoutEffect(() => {
		const el = ref.current
		const parent = el?.offsetParent as HTMLElement | null
		if (!el || !parent) return
		const W = parent.clientWidth
		const H = parent.clientHeight
		const w = el.offsetWidth
		const h = el.offsetHeight
		const below = tvRect.top + tvRect.height + gap
		const above = tvRect.top - gap - h
		const fitsBelow = below + h <= H - 8
		const fitsAbove = above >= 8
		let top = prefer === "below" ? (fitsBelow || !fitsAbove ? below : above) : fitsAbove || !fitsBelow ? above : below
		// Neither fits: on the screen's lower edge.
		if (!fitsBelow && !fitsAbove) top = Math.max(8, tvRect.top + tvRect.height - h - 8)
		const left = Math.min(Math.max(8, tvRect.left + tvRect.width / 2 - w / 2), Math.max(8, W - 8 - w))
		setAt({ left, top })
	}, [tvRect.left, tvRect.top, tvRect.width, tvRect.height, prefer, gap])
	return (
		<button
			ref={ref}
			type="button"
			onClick={onPlay}
			className={`labtv-label ${className}`}
			style={at ? { left: at.left, top: at.top } : { left: 0, top: 0, visibility: "hidden" }}
		>
			{children}
		</button>
	)
}
