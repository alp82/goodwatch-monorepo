// The world map as something you move
// through: the real outlines of the atlas's map (Natural Earth, Equal Earth), a camera that flies to a region, zoom and
// pan, and countries that wear their flag or light up by how well they fit.
//
// What each element means:
// - at rest, a country with a page wears its flag; land without a page is a dark mass;
// - with `fit`, the countries that fit the dials take a warm scale (violet through rose to amber) by how well they fit,
//   and the rest keep their flag, dimmed, so the map never goes blank;
// - the amber outline is the country in the dock (`docked`); a name appears for the country under the pointer or focus
//   and for the ones a page pins (`named`); with `ranks`, the best fits carry their place;
// - zoomed in, the larger countries in view carry their names.
//
// Zoom: the + and − buttons, a double click, Ctrl (or ⌘) with the wheel or a trackpad pinch, and two fingers on touch.
// `wheel="free"` lets the plain wheel zoom too (a map that fills the screen). Zoomed in, a drag pans, with a little coast.
// Every camera move eases; colors glide; names fade in place with a small scale, they never fly.
import { useNavigate } from "@remix-run/react"
import {
	type CSSProperties,
	type MouseEvent as ReactMouseEvent,
	type PointerEvent as ReactPointerEvent,
	memo,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { countryFlagUrl } from "~/utils/country-flag"
import { flagBox, flagCover } from "~/ui/browse/world-map/flagBox"
import { type Box, SHAPE_BY_CODE, isSmall, isTiny } from "~/ui/browse/world-map/geometry"
import { WORLD_SHAPES, type WorldShape } from "~/ui/browse/world-map/shapes"

export interface AtlasCountry {
	/** ISO 3166-1 alpha-2. */
	code: string
	name: string
	href: string
	/** How much there is to see, 0-1. */
	weight?: number
}

/** The whole world as the map draws it at rest: the atlas's world without the far north of Greenland. */
export const WORLD: Box = [38, 20, 968, 436]

/** The sea, also the border line between countries (borders are gaps of sea). */
const SEA = "#0a101c"
const BORDER = "#0d1422"
/** Land without a page. */
const LAND = "#1a2232"
const EASE_FILL = "cubic-bezier(0.22, 1, 0.36, 1)"

type RGB = readonly [number, number, number]
const hex = (h: string): RGB => [
	Number.parseInt(h.slice(1, 3), 16),
	Number.parseInt(h.slice(3, 5), 16),
	Number.parseInt(h.slice(5, 7), 16),
]
/** A color along stops, t from 0 to 1. */
function ramp(stops: readonly RGB[], t: number): string {
	const x = clamp(t, 0, 1) * (stops.length - 1)
	const i = Math.min(stops.length - 2, Math.floor(x))
	const f = x - i
	const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f))
	return `rgb(${c[0]},${c[1]},${c[2]})`
}
/** How much there is to see: slate to a pale blue (used without flags). */
const WEIGHT_RAMP = ["#2a3549", "#3d4f6c", "#5b7397", "#8ea8c8"].map(hex)
/** How well it fits: violet, rose, coral, amber. */
const FIT_STOPS = ["#3b2d63", "#7a3576", "#cf4f62", "#f08a4b", "#fbbf24"]
const FIT_RAMP = FIT_STOPS.map(hex)
export const FIT_GRADIENT = `linear-gradient(90deg, ${FIT_STOPS.join(",")})`
export const WEIGHT_GRADIENT = `linear-gradient(90deg, ${["#2a3549", "#3d4f6c", "#5b7397", "#8ea8c8"].join(",")})`

const width = (b: Box) => b[2] - b[0]
const height = (b: Box) => b[3] - b[1]
const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x)
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOut = (t: number) => 1 - (1 - t) ** 3

/** What a frame `aspect` times as wide as tall shows at rest: the world, with sea added on the short side. */
function frameOf(aspect: number): Box {
	const cx = (WORLD[0] + WORLD[2]) / 2
	const cy = (WORLD[1] + WORLD[3]) / 2
	const w = Math.max(width(WORLD), height(WORLD) * aspect)
	const h = w / aspect
	return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2]
}

interface Cam {
	/** The middle of what is shown, and how wide it is, in the map's own units. */
	cx: number
	cy: number
	w: number
}

/** The camera that shows `box` whole in a frame. */
function camOf(frame: Box, box: Box): Cam {
	const aspect = width(frame) / height(frame)
	return {
		cx: (box[0] + box[2]) / 2,
		cy: (box[1] + box[3]) / 2,
		w: Math.min(width(frame), Math.max(width(box), height(box) * aspect)),
	}
}

/** The closest the camera comes: about a twentieth of the world across. */
const MIN_W = 44

/** Keeps the camera over the world: never wider than the frame, never past its edge. */
function hold(frame: Box, cam: Cam): Cam {
	const w = clamp(cam.w, MIN_W, width(frame))
	const h = (w * height(frame)) / width(frame)
	return {
		w,
		cx: clamp(cam.cx, frame[0] + w / 2, frame[2] - w / 2),
		cy: clamp(cam.cy, frame[1] + h / 2, frame[3] - h / 2),
	}
}

/** Every country without a page, as one quiet shape. It never changes, so it renders once. */
const Land = memo(function Land({ skip }: { skip: string }) {
	const d = useMemo(() => {
		const listed = new Set(skip.split(","))
		return WORLD_SHAPES.filter((shape) => shape.d && !listed.has(shape.code))
			.map((shape) => shape.d)
			.join("")
	}, [skip])
	return (
		<path
			d={d}
			fill={LAND}
			stroke={BORDER}
			strokeWidth={0.8}
			vectorEffect="non-scaling-stroke"
			strokeLinejoin="round"
		/>
	)
})

/** How loud a flag is: hinted at rest, almost full under the pointer, full when picked. */
type FlagLook = "rest" | "hover" | "on"
const FLAG_LOOK: Record<FlagLook, CSSProperties> = {
	rest: { opacity: 0.38, filter: "saturate(0.22)" },
	hover: { opacity: 0.92, filter: "saturate(0.9)" },
	on: { opacity: 1, filter: "none" },
}

/** A country's flag inside its outline, covering its largest part. It re-renders only when its look changes. */
const Flag = memo(function Flag({ shape, look }: { shape: WorldShape; look: FlagLook }) {
	const b = flagBox(shape)
	const cover = flagCover(b[0], b[1], b[2] - b[0], b[3] - b[1])
	return (
		<>
			<clipPath id={`atlas-c-${shape.code}`}>
				<path d={shape.d} />
			</clipPath>
			<g clipPath={`url(#atlas-c-${shape.code})`}>
				<path d={shape.d} fill="#2d3748" />
				<image
					href={countryFlagUrl(shape.code)}
					{...cover}
					preserveAspectRatio="none"
					style={{ ...FLAG_LOOK[look], transition: FLAG_EASE }}
				/>
			</g>
		</>
	)
})

const FLAG_EASE =
	"opacity 320ms cubic-bezier(0.22, 1, 0.36, 1), filter 320ms cubic-bezier(0.22, 1, 0.36, 1)"

type Placed = AtlasCountry & { shape: WorldShape }
type Label = {
	code: string
	x: number
	y: number
	below: boolean
	rank: number
	kind: "name" | "rank" | "quiet"
}

export function AtlasMap({
	countries,
	target = WORLD,
	docked,
	hot,
	onHot,
	onDock,
	fit,
	named,
	ranks,
	legend,
	flags = false,
	zoom = false,
	wheel = "ctrl",
	quiet,
	onView,
	className = "aspect-[16/10] sm:aspect-[2.5/1]",
	label = "Map of the world",
}: {
	countries: readonly AtlasCountry[]
	/** The part of the world to show; when it changes the view flies there. */
	target?: Box
	/** The country in the dock, outlined in amber. */
	docked?: string | null
	/** The country under the pointer or focus (the page owns it, so a list can light the map too). */
	hot: string | null
	onHot: (code: string | null) => void
	/** A tap on a country that is not in the dock yet puts it there instead of opening it. Leave out to open at once. */
	onDock?: (code: string) => void
	/** How well each country fits, 0-1, by code. When given, the fitting ones take the warm scale and the rest step back. */
	fit?: Record<string, number> | null
	/** Countries that carry their name on the map without being pointed at (keep it to one or two). */
	named?: readonly string[]
	/** The best fits in order, by code: each carries its place on the map (keep it to six). */
	ranks?: readonly string[]
	/** A small key in the corner: what the scale means at each end. Shown with `fit` only when flags are on. */
	legend?: { low: string; high: string } | null
	/** Countries with a page wear their flag. */
	flags?: boolean
	/** Zoom buttons and gestures. */
	zoom?: boolean
	/** "ctrl": the wheel zooms only with Ctrl or ⌘ (the page keeps scrolling); "free": the plain wheel zooms. */
	wheel?: "ctrl" | "free"
	/** Countries that step back (a search that doesn't match them), by code. */
	quiet?: ReadonlySet<string> | null
	/** Called when the camera comes to rest, with the part of the world in view. */
	onView?: (box: Box) => void
	/** The frame's shape. */
	className?: string
	label?: string
}) {
	const navigate = useNavigate()
	const host = useRef<HTMLDivElement>(null)
	const group = useRef<SVGGElement>(null)
	const frame = useRef<Box>(WORLD)
	const cam = useRef<Cam>(camOf(WORLD, WORLD))
	const flight = useRef(0)
	const touch = useRef(false)
	const touched = useRef(0)
	const drag = useRef<{
		id: number
		x: number
		y: number
		vx: number
		vy: number
		t: number
		moved: boolean
	} | null>(null)
	const fingers = useRef(new Map<number, { x: number; y: number }>())
	const pinch = useRef<{ d: number; cam: Cam; ux: number; uy: number } | null>(null)
	const swallow = useRef(false)
	const onViewRef = useRef(onView)
	onViewRef.current = onView
	const [moving, setMoving] = useState(false)
	const [grabbing, setGrabbing] = useState(false)
	const [close, setClose] = useState(false)
	const [atMost, setAtMost] = useState(false)
	const [focused, setFocused] = useState<string | null>(null)
	const [tick, setTick] = useState(0)
	const [hint, setHint] = useState(false)
	const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

	// Largest first, so a small country is drawn (and hit) over a large neighbor's wide hit area.
	const placed = useMemo(() => {
		const out: Placed[] = []
		for (const country of countries) {
			const shape = SHAPE_BY_CODE.get(country.code.toUpperCase())
			if (shape) out.push({ ...country, code: shape.code, shape })
		}
		const size = (p: Placed) => width(p.shape.box) * height(p.shape.box)
		return out.sort((a, b) => size(b) - size(a))
	}, [countries])
	const codes = useMemo(() => placed.map((p) => p.code).join(","), [placed])
	const maxWeight = useMemo(() => Math.max(0, ...placed.map((p) => p.weight ?? 0)), [placed])
	const dockedCode = docked?.toUpperCase() ?? null

	/** Writes the camera to the map: one transform on one group. */
	const paint = useCallback(() => {
		const g = group.current
		if (!g) return
		const f = frame.current
		const c = cam.current
		const s = width(f) / c.w
		// The SVG's view box is WORLD and it is fitted with `meet`, so its middle is the frame's middle.
		const x = (f[0] + f[2]) / 2 - s * c.cx
		const y = (f[1] + f[3]) / 2 - s * c.cy
		g.style.transform = `translate(${x}px, ${y}px) scale(${s})`
	}, [])

	const settle = useCallback(() => {
		const f = frame.current
		const c = cam.current
		setMoving(false)
		setClose(c.w < width(f) * 0.97)
		setAtMost(c.w <= MIN_W * 1.02)
		setTick((n) => n + 1)
		const h = (c.w * height(f)) / width(f)
		onViewRef.current?.([c.cx - c.w / 2, c.cy - h / 2, c.cx + c.w / 2, c.cy + h / 2])
	}, [])

	/** Eases the camera to `to` over `ms` (a zoom or a reset: short and calm). */
	const glide = useCallback(
		(to: Cam, ms = 320) => {
			cancelAnimationFrame(flight.current)
			const f = frame.current
			const from = cam.current
			const end = hold(f, to)
			if (
				typeof window !== "undefined" &&
				window.matchMedia("(prefers-reduced-motion: reduce)").matches
			) {
				cam.current = end
				paint()
				settle()
				return
			}
			const start = performance.now()
			setMoving(true)
			const step = (now: number) => {
				const t = clamp((now - start) / ms, 0, 1)
				const e = easeOut(t)
				cam.current = hold(f, {
					cx: from.cx + (end.cx - from.cx) * e,
					cy: from.cy + (end.cy - from.cy) * e,
					w: Math.exp(Math.log(from.w) + (Math.log(end.w) - Math.log(from.w)) * e),
				})
				paint()
				if (t < 1) flight.current = requestAnimationFrame(step)
				else settle()
			}
			flight.current = requestAnimationFrame(step)
		},
		[paint, settle],
	)

	/** Flies to a box: out a little, across, and in, so you see where you are going. */
	const fly = useCallback(
		(box: Box, instant = false) => {
			cancelAnimationFrame(flight.current)
			const f = frame.current
			const from = cam.current
			const to = hold(f, camOf(f, box))
			const still =
				instant ||
				(typeof window !== "undefined" &&
					window.matchMedia("(prefers-reduced-motion: reduce)").matches)
			const far = Math.hypot(to.cx - from.cx, to.cy - from.cy)
			if (still || (far < 0.5 && Math.abs(to.w - from.w) < 0.5)) {
				cam.current = to
				paint()
				settle()
				return
			}
			// How far the view pulls back on the way: more for a long trip between two close views.
			const pull = clamp((far / (from.w + to.w)) * 0.9, 0, 0.45)
			const ms = 680 + 420 * pull
			const start = performance.now()
			setMoving(true)
			const step = (now: number) => {
				const t = clamp((now - start) / ms, 0, 1)
				const e = easeInOut(t)
				const w = Math.exp(Math.log(from.w) + (Math.log(to.w) - Math.log(from.w)) * e)
				cam.current = hold(f, {
					cx: from.cx + (to.cx - from.cx) * e,
					cy: from.cy + (to.cy - from.cy) * e,
					w: w * (1 + pull * Math.sin(Math.PI * e)),
				})
				paint()
				if (t < 1) flight.current = requestAnimationFrame(step)
				else settle()
			}
			flight.current = requestAnimationFrame(step)
		},
		[paint, settle],
	)

	// The frame follows the element's shape; the target is shown again in the new frame.
	const targetKey = target.join(",")
	const latest = useRef(target)
	latest.current = target
	useLayoutEffect(() => {
		const el = host.current
		if (!el) return
		let shape = 0
		const measure = () => {
			const r = el.getBoundingClientRect()
			if (r.width <= 0 || r.height <= 0) return false
			const next = Math.round((r.width / r.height) * 1000)
			if (next === shape) return false
			shape = next
			frame.current = frameOf(r.width / r.height)
			return true
		}
		measure()
		fly(latest.current, true)
		const ro = new ResizeObserver(() => {
			if (measure()) fly(latest.current, true)
		})
		ro.observe(el)
		return () => {
			ro.disconnect()
			cancelAnimationFrame(flight.current)
		}
	}, [fly])
	const first = useRef(true)
	// biome-ignore lint/correctness/useExhaustiveDependencies: the target is compared by content
	useEffect(() => {
		if (first.current) {
			first.current = false
			return
		}
		fly(latest.current)
	}, [targetKey, fly])

	// --- Zoom ----------------------------------------------------------------------------------------------------

	const rect = () => host.current?.getBoundingClientRect()
	/** The map point under a spot in the element (px from its top left), for a camera. */
	const unitAt = (c: Cam, px: number, py: number) => {
		const r = rect()
		if (!r?.width) return { ux: c.cx, uy: c.cy }
		return {
			ux: c.cx + (px / r.width - 0.5) * c.w,
			uy: c.cy + (py / r.height - 0.5) * ((c.w * r.height) / r.width),
		}
	}
	/** The camera `k` times as wide, with the map point under (px, py) staying put. */
	const zoomed = (c: Cam, k: number, px: number, py: number): Cam => {
		const r = rect()
		if (!r?.width) return c
		const { ux, uy } = unitAt(c, px, py)
		const w = clamp(c.w * k, MIN_W, width(frame.current))
		return {
			w,
			cx: ux - (px / r.width - 0.5) * w,
			cy: uy - (py / r.height - 0.5) * ((w * r.height) / r.width),
		}
	}
	const zoomBy = (k: number) => {
		const r = rect()
		if (!r) return
		glide(zoomed(cam.current, k, r.width / 2, r.height / 2))
	}
	const reset = () => glide(camOf(frame.current, WORLD), 420)

	// The wheel: with Ctrl or ⌘ (a trackpad pinch sends Ctrl too), or always with `wheel="free"`. Otherwise the page
	// scrolls and a short hint says how to zoom.
	useEffect(() => {
		const el = host.current
		if (!el || !zoom) return
		const onWheel = (e: WheelEvent) => {
			if (wheel !== "free" && !e.ctrlKey && !e.metaKey) {
				setHint(true)
				if (hintTimer.current) clearTimeout(hintTimer.current)
				hintTimer.current = setTimeout(() => setHint(false), 1400)
				return
			}
			e.preventDefault()
			setHint(false)
			const r = el.getBoundingClientRect()
			const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
			const k = Math.exp(clamp(dy, -120, 120) * (e.ctrlKey ? 0.01 : 0.0025))
			glide(zoomed(cam.current, k, e.clientX - r.left, e.clientY - r.top), 180)
		}
		el.addEventListener("wheel", onWheel, { passive: false })
		return () => el.removeEventListener("wheel", onWheel)
		// oxlint-disable-next-line react-hooks/exhaustive-deps -- `zoomed` reads refs only
	}, [zoom, wheel, glide])
	useEffect(
		() => () => {
			if (hintTimer.current) clearTimeout(hintTimer.current)
		},
		[],
	)

	// --- Drag to pan (once the view is closer than the whole world) and two fingers to zoom ------------------------

	const unitsPerPx = () => {
		const r = rect()
		return r?.width ? cam.current.w / r.width : 1
	}
	const down = (e: ReactPointerEvent<HTMLDivElement>) => {
		touch.current = e.pointerType !== "mouse"
		if (touch.current) touched.current = performance.now()
		swallow.current = false
		if (zoom && e.pointerType === "touch") {
			fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
			if (fingers.current.size === 2) {
				const [a, b] = [...fingers.current.values()]
				const r = rect()
				if (r) {
					cancelAnimationFrame(flight.current)
					drag.current = null
					const mid = unitAt(cam.current, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top)
					pinch.current = {
						d: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)),
						cam: cam.current,
						...mid,
					}
					swallow.current = true
					setMoving(true)
				}
				return
			}
		}
		if (e.button !== 0 || !close) return
		cancelAnimationFrame(flight.current)
		drag.current = {
			id: e.pointerId,
			x: e.clientX,
			y: e.clientY,
			vx: 0,
			vy: 0,
			t: performance.now(),
			moved: false,
		}
	}
	const move = (e: ReactPointerEvent<HTMLDivElement>) => {
		if (fingers.current.has(e.pointerId))
			fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
		const p = pinch.current
		if (p && fingers.current.size >= 2) {
			const [a, b] = [...fingers.current.values()]
			const r = rect()
			if (!r) return
			const d = Math.max(20, Math.hypot(a.x - b.x, a.y - b.y))
			const w = clamp((p.cam.w * p.d) / d, MIN_W, width(frame.current))
			const px = (a.x + b.x) / 2 - r.left
			const py = (a.y + b.y) / 2 - r.top
			cam.current = hold(frame.current, {
				w,
				cx: p.ux - (px / r.width - 0.5) * w,
				cy: p.uy - (py / r.height - 0.5) * ((w * r.height) / r.width),
			})
			paint()
			return
		}
		const d = drag.current
		if (!d || d.id !== e.pointerId) return
		const dx = e.clientX - d.x
		const dy = e.clientY - d.y
		if (!d.moved) {
			if (Math.hypot(dx, dy) < 5) return
			d.moved = true
			swallow.current = true
			setGrabbing(true)
			setMoving(true)
			onHot(null)
			e.currentTarget.setPointerCapture(e.pointerId)
		}
		const now = performance.now()
		const dt = Math.max(1, now - d.t)
		const k = unitsPerPx()
		d.vx = 0.7 * d.vx + 0.3 * ((dx * k) / dt)
		d.vy = 0.7 * d.vy + 0.3 * ((dy * k) / dt)
		d.x = e.clientX
		d.y = e.clientY
		d.t = now
		cam.current = hold(frame.current, {
			...cam.current,
			cx: cam.current.cx - dx * k,
			cy: cam.current.cy - dy * k,
		})
		paint()
	}
	const up = (e: ReactPointerEvent<HTMLDivElement>) => {
		fingers.current.delete(e.pointerId)
		if (pinch.current) {
			if (fingers.current.size < 2) {
				pinch.current = null
				settle()
			}
			return
		}
		const d = drag.current
		if (!d || d.id !== e.pointerId) return
		drag.current = null
		if (!d.moved) return
		setGrabbing(false)
		// Let go and it coasts a little.
		let { vx, vy } = d
		if (performance.now() - d.t > 80) vx = vy = 0
		let last = performance.now()
		const coast = (now: number) => {
			const dt = now - last
			last = now
			const decay = 0.994 ** dt
			vx *= decay
			vy *= decay
			const before = cam.current
			cam.current = hold(frame.current, {
				...before,
				cx: before.cx - vx * dt,
				cy: before.cy - vy * dt,
			})
			paint()
			if (Math.hypot(vx, vy) * unitsPerPx() ** -1 > 0.02)
				flight.current = requestAnimationFrame(coast)
			else settle()
		}
		flight.current = requestAnimationFrame(coast)
	}

	const open = (event: ReactMouseEvent, p: Placed) => {
		if (swallow.current) {
			event.preventDefault()
			return
		}
		if (
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		)
			return
		event.preventDefault()
		// A finger has no hover: the first tap puts the country in the dock, the second opens it.
		if (touch.current && onDock && dockedCode !== p.code) {
			onDock(p.code)
			return
		}
		navigate(p.href)
	}

	// --- Names: over the country's label point, wherever the view puts it -------------------------------------------

	const [labels, setLabels] = useState<Label[]>([])
	const namedKey = (named ?? []).join(",")
	const ranksKey = (ranks ?? []).join(",")
	// biome-ignore lint/correctness/useExhaustiveDependencies: `tick` says the view came to rest
	useLayoutEffect(() => {
		const el = host.current
		if (!el || moving) {
			setLabels((now) => now.filter((l) => l.kind !== "quiet"))
			return
		}
		const r = el.getBoundingClientRect()
		const f = frame.current
		const c = cam.current
		const h = (c.w * height(f)) / width(f)
		const toScreen = (at: readonly [number, number]) => ({
			x: ((at[0] - (c.cx - c.w / 2)) / c.w) * r.width,
			y: ((at[1] - (c.cy - h / 2)) / h) * r.height,
		})
		// From the keys, so a new array with the same codes is no change.
		const rankList = ranksKey ? ranksKey.toUpperCase().split(",") : []
		const naming = new Set(
			[...(namedKey ? namedKey.split(",") : []), ...(hot ? [hot] : [])].map((x) => x.toUpperCase()),
		)
		const out: Label[] = []
		for (const code of [...new Set([...rankList, ...naming])]) {
			const shape = SHAPE_BY_CODE.get(code)
			if (!shape) continue
			const { x, y } = toScreen(shape.at)
			if (x < 0 || x > r.width || y < 0 || y > r.height) continue
			const name = naming.has(code)
			out.push({
				code,
				x: name ? clamp(x, 64, r.width - 64) : clamp(x, 14, r.width - 14),
				y: clamp(y, 14, r.height - 14),
				below: y < 44,
				rank: rankList.indexOf(code) + 1,
				kind: name ? "name" : "rank",
			})
		}
		// Zoomed in: the larger countries in view carry their names, quietly.
		if (c.w < width(f) * 0.6) {
			const taken = new Set(out.map((l) => l.code))
			const room = placed
				.filter((p) => !taken.has(p.code) && !isTiny(p.shape))
				.map((p) => ({ p, px: (width(p.shape.box) / c.w) * r.width, at: toScreen(p.shape.at) }))
				.filter(
					(x) =>
						x.px > 46 &&
						x.at.x > 30 &&
						x.at.x < r.width - 30 &&
						x.at.y > 16 &&
						x.at.y < r.height - 16,
				)
				.sort((a, b) => (b.p.weight ?? 0) - (a.p.weight ?? 0))
				.slice(0, 18)
			for (const { p, at } of room)
				out.push({ code: p.code, x: at.x, y: at.y, below: false, rank: 0, kind: "quiet" })
		}
		// The named ones last, so their pill sits over a neighbor's badge.
		const order = { quiet: 0, rank: 1, name: 2 }
		setLabels(out.sort((a, b) => order[a.kind] - order[b.kind]))
	}, [hot, namedKey, ranksKey, moving, tick, placed])

	const focusShape = focused ? SHAPE_BY_CODE.get(focused) : undefined
	const hotShape = hot && hot !== dockedCode ? SHAPE_BY_CODE.get(hot) : undefined
	const dockShape = dockedCode ? SHAPE_BY_CODE.get(dockedCode) : undefined
	const nameOf = (code: string) => placed.find((p) => p.code === code)?.name ?? ""
	const glideFill = `fill 320ms ${EASE_FILL}, fill-opacity 320ms ${EASE_FILL}, stroke 320ms ${EASE_FILL}, opacity 320ms ${EASE_FILL}`
	const pinchable = zoom && close

	return (
		// oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/prefer-tag-over-role -- the map's own drag, pinch and double-click zoom; every country inside is a link, and the zoom buttons are buttons
		<div
			ref={host}
			// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- an interactive map region, not a form group
			role="group"
			aria-label={label}
			onPointerDown={down}
			onPointerMove={move}
			onPointerUp={up}
			onPointerCancel={up}
			onDoubleClick={(e) => {
				if (!zoom) return
				const r = rect()
				if (!r) return
				glide(zoomed(cam.current, e.shiftKey ? 2 : 0.5, e.clientX - r.left, e.clientY - r.top))
			}}
			className={`relative overflow-hidden select-none ${pinchable ? "touch-none" : "touch-pan-y"} ${className} ${
				grabbing ? "cursor-grabbing" : close ? "cursor-grab" : ""
			}`}
			style={{
				backgroundColor: SEA,
				backgroundImage:
					"radial-gradient(ellipse 70% 80% at 50% 45%, rgba(56,78,120,0.22), transparent 70%), radial-gradient(rgba(148,163,184,0.09) 1px, transparent 1.2px)",
				backgroundSize: "100% 100%, 14px 14px",
			}}
		>
			<svg
				viewBox={`${WORLD[0]} ${WORLD[1]} ${width(WORLD)} ${height(WORLD)}`}
				preserveAspectRatio="xMidYMid meet"
				className="absolute inset-0 h-full w-full overflow-visible"
			>
				<g ref={group} style={{ transformOrigin: "0 0", willChange: "transform" } as CSSProperties}>
					<Land skip={codes} />
					{placed.map((p) => {
						const on = p.code === dockedCode
						const lit = p.code === hot
						const tiny = isTiny(p.shape)
						const t = fit?.[p.code] ?? 0
						const fits = Boolean(fit) && t > 0
						const away = Boolean(quiet?.has(p.code))
						// Without flags: the weight scale at rest. With flags: a veil over the flag, clear at rest, the fit
						// color for a country that fits, a dark veil for one that doesn't (or a search left out).
						const weightT =
							maxWeight && p.weight ? 0.12 + 0.88 * Math.min(1, p.weight / maxWeight) ** 0.42 : 0.12
						let veil: string
						let veilOpacity: number
						if (fits) {
							veil = ramp(FIT_RAMP, t)
							veilOpacity = lit ? 0.35 : 0.94
						} else if (fit || away) {
							veil = SEA
							veilOpacity = lit ? 0.1 : flags ? 0.72 : 0.6
						} else if (flags) {
							// The flag itself carries rest, pointer and pick (its look); the veil stays clear.
							veil = SEA
							veilOpacity = 0
						} else {
							veil = lit ? "#e2e8f0" : ramp(WEIGHT_RAMP, weightT)
							veilOpacity = 1
						}
						if (!flags && fit && !fits) veil = "#222b3b"
						return (
							<a
								key={p.code}
								href={p.href}
								aria-label={p.name}
								data-code={p.code}
								onClick={(event) => open(event, p)}
								onPointerEnter={(event) => event.pointerType === "mouse" && onHot(p.code)}
								onPointerLeave={(event) => event.pointerType === "mouse" && onHot(null)}
								onFocus={(event) => {
									// A tap focuses too; only the keyboard's focus points at a country.
									if (performance.now() - touched.current < 800) return
									onHot(p.code)
									if (event.currentTarget.matches(":focus-visible")) setFocused(p.code)
								}}
								onBlur={() => {
									onHot(null)
									setFocused(null)
								}}
								draggable={false}
								className="cursor-pointer outline-none"
							>
								{/* A wider area to hit, for the countries a pointer would miss. */}
								{isSmall(p.shape) && !tiny && (
									<path
										d={p.shape.d}
										fill="none"
										stroke="transparent"
										strokeWidth={12}
										vectorEffect="non-scaling-stroke"
										pointerEvents="stroke"
									/>
								)}
								{flags && p.shape.d && !tiny && (
									<Flag shape={p.shape} look={on ? "on" : lit ? "hover" : "rest"} />
								)}
								{p.shape.d && !tiny && (
									<path
										d={p.shape.d}
										stroke={BORDER}
										style={{
											fill: veil,
											fillOpacity: veilOpacity,
											transition: glideFill,
										}}
										strokeWidth={0.8}
										vectorEffect="non-scaling-stroke"
										strokeLinejoin="round"
									/>
								)}
								{tiny && (
									<>
										{/* A dot that keeps its size on screen: a point with a round, non-scaling stroke. */}
										<path
											d={`M${p.shape.at[0]},${p.shape.at[1]}h0`}
											stroke="transparent"
											strokeWidth={26}
											strokeLinecap="round"
											vectorEffect="non-scaling-stroke"
										/>
										<path
											d={`M${p.shape.at[0]},${p.shape.at[1]}h0`}
											style={{
												stroke: lit ? "#e2e8f0" : fits ? veil : fit || away ? "#334155" : "#94a3b8",
												transition: glideFill,
											}}
											strokeWidth={8}
											strokeLinecap="round"
											vectorEffect="non-scaling-stroke"
										/>
									</>
								)}
							</a>
						)
					})}
					{/* The country under the pointer and the dock's country: a clean outline over every neighbor's border. */}
					{[hotShape, dockShape].map((shape, i) =>
						shape?.d && !isTiny(shape) ? (
							<path
								key={i === 0 ? "hot" : "dock"}
								d={shape.d}
								fill="none"
								stroke={i === 0 ? "rgba(255,255,255,0.9)" : "#fcd34d"}
								strokeWidth={i === 0 ? 1.4 : 1.8}
								vectorEffect="non-scaling-stroke"
								strokeLinejoin="round"
								pointerEvents="none"
							/>
						) : null,
					)}
					{/* The keyboard's place: an outline over every neighbor's border. */}
					{focusShape &&
						(focusShape.d && !isTiny(focusShape) ? (
							<path
								d={focusShape.d}
								fill="none"
								className="stroke-amber-400"
								strokeWidth={2}
								vectorEffect="non-scaling-stroke"
								strokeLinejoin="round"
								pointerEvents="none"
							/>
						) : (
							<path
								d={`M${focusShape.at[0]},${focusShape.at[1]}h0`}
								fill="none"
								className="stroke-amber-400/50"
								strokeWidth={18}
								strokeLinecap="round"
								vectorEffect="non-scaling-stroke"
								pointerEvents="none"
							/>
						))}
				</g>
			</svg>
			{labels.map((l) => (
				<div
					key={`${l.kind}-${l.code}`}
					aria-hidden
					className={`pointer-events-none absolute top-0 left-0 ${l.kind === "name" ? "z-20" : "z-10"}`}
					style={{ transform: `translate3d(${l.x}px, ${l.y}px, 0)` }}
				>
					{l.kind === "name" ? (
						// The pill fades in with a small scale from where it points; it never flies across the map.
						<div
							data-atlas-pill=""
							className={`absolute left-0 flex -translate-x-1/2 items-center gap-1.5 rounded-full py-1 pr-3 text-[13px] font-semibold whitespace-nowrap shadow-lg shadow-black/50 ring-1 ${
								l.rank === 1
									? "bg-amber-300 pl-1 text-gray-950 ring-amber-200"
									: l.rank
										? "bg-gray-950/95 pl-1 text-white ring-white/20"
										: "bg-gray-950/95 pl-3 text-white ring-white/15"
							} ${l.below ? "top-3 origin-top" : "bottom-3 origin-bottom"}`}
						>
							{l.rank > 0 && (
								<span
									className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold tabular-nums ${
										l.rank === 1 ? "bg-gray-950 text-amber-300" : "bg-white/15 text-white"
									}`}
								>
									{l.rank}
								</span>
							)}
							{nameOf(l.code)}
						</div>
					) : l.kind === "rank" ? (
						<span className="atlas-in absolute grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gray-950/90 text-[11px] font-bold text-white tabular-nums shadow-md ring-1 shadow-black/40 ring-white/25">
							{l.rank}
						</span>
					) : (
						<span className="atlas-in absolute -translate-x-1/2 -translate-y-1/2 text-[11px] font-semibold tracking-wide whitespace-nowrap text-white/85 [text-shadow:0_1px_3px_rgba(0,0,0,0.9),0_0_8px_rgba(0,0,0,0.6)]">
							{nameOf(l.code)}
						</span>
					)}
				</div>
			))}
			{zoom && (
				<div className="absolute top-3 right-3 z-30 flex flex-col overflow-hidden rounded-xl bg-gray-950/80 shadow-lg ring-1 shadow-black/40 ring-white/10 backdrop-blur-sm">
					<MapButton label="Zoom in" onClick={() => zoomBy(0.55)} disabled={atMost}>
						<path d="M8 3v10M3 8h10" />
					</MapButton>
					<MapButton label="Zoom out" onClick={() => zoomBy(1.8)} disabled={!close}>
						<path d="M3 8h10" />
					</MapButton>
					<MapButton label="Show the whole world" onClick={reset} disabled={!close}>
						<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
					</MapButton>
				</div>
			)}
			{zoom && (
				<div
					aria-hidden={!hint}
					className={`pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
						hint ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
					}`}
				>
					<span className="rounded-full bg-gray-950/90 px-3 py-1.5 text-xs font-semibold text-gray-200 shadow-lg ring-1 ring-white/10">
						Hold Ctrl and scroll to zoom
					</span>
				</div>
			)}
			{legend && fit && (
				<div
					aria-hidden
					className="atlas-in pointer-events-none absolute bottom-3 left-3 hidden rounded-lg bg-gray-950/75 px-2.5 py-2 text-[11px] font-medium text-gray-300 ring-1 ring-white/10 backdrop-blur-sm sm:block"
				>
					<div className="h-1.5 w-32 rounded-full" style={{ background: FIT_GRADIENT }} />
					<div className="mt-1 flex w-32 justify-between gap-2">
						<span>{legend.low}</span>
						<span>{legend.high}</span>
					</div>
				</div>
			)}
			{legend && !fit && !flags && (
				<div
					aria-hidden
					className="pointer-events-none absolute bottom-3 left-3 hidden rounded-lg bg-gray-950/70 px-2.5 py-2 text-[11px] font-medium text-gray-300 ring-1 ring-white/10 backdrop-blur-sm sm:block"
				>
					<div className="h-1.5 w-32 rounded-full" style={{ background: WEIGHT_GRADIENT }} />
					<div className="mt-1 flex w-32 justify-between gap-2">
						<span>{legend.low}</span>
						<span>{legend.high}</span>
					</div>
				</div>
			)}
			<style>{`
.atlas-in{animation:atlas-in 160ms cubic-bezier(0.22,1,0.36,1) both}
[data-atlas-pill]{animation:atlas-in 160ms cubic-bezier(0.22,1,0.36,1) both}
@keyframes atlas-in{from{opacity:0;scale:.92}to{opacity:1;scale:1}}
@media (prefers-reduced-motion: reduce){.atlas-in,[data-atlas-pill]{animation:none}}
`}</style>
		</div>
	)
}

function MapButton({
	label,
	onClick,
	disabled,
	children,
}: {
	label: string
	onClick: () => void
	disabled?: boolean
	children: React.ReactNode
}) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			onClick={onClick}
			onPointerDown={(e) => e.stopPropagation()}
			onDoubleClick={(e) => e.stopPropagation()}
			disabled={disabled}
			className="grid h-9 w-9 place-items-center border-b border-white/[0.07] text-gray-200 transition-[background-color,color] duration-150 ease-out last:border-b-0 hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:outline-none disabled:text-gray-600 disabled:hover:bg-transparent"
		>
			<svg
				viewBox="0 0 16 16"
				width={15}
				height={15}
				fill="none"
				stroke="currentColor"
				strokeWidth={1.8}
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden
			>
				{children}
			</svg>
		</button>
	)
}
