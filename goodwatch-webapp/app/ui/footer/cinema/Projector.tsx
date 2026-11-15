// The idle cinema: a 35mm projector peeks out of the footer's bottom-right corner, sunk toward the corner with a reel's
// rim and the lens barrel showing. It is drawn once as a still frame on the pixel grid the show uses, so nothing runs
// while it waits. Pointing at it, focusing it or a first tap on a touch screen brings it up: it rises into place in
// whole pixels with a small overshoot, a short tween that stops when it lands, and the show and its numbers start
// loading. Pressing it (a click, a second tap, Enter or Space) starts the show, which hands focus back here when it ends,
// unless it ended because the page changed (focus then stays where the new page has it).
import { useQueryClient } from "@tanstack/react-query"
import {
	type RefObject,
	Suspense,
	lazy,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { usePrefersReducedMotion } from "../motion"
import type { ShowEnd } from "./Show"
import { CINEMA_NUMBERS_KEY, fetchCinemaNumbers } from "./numbers-query"
import { PROJECTOR_FX, dockHeight, lensInFooter, scaleFor } from "./palace"
import { composite, createFrame, createFx } from "./pixelfx/core/index.js"
import { FX } from "./pixelfx/idle.js"

const loadShow = reloadOnStaleChunk(() => import("./Show"))
const Show = lazy(loadShow)

/** How far the drawing reaches from the lens, in pixels (the projector runs off the corner from there). */
const REACH = { side: 120, up: 56 }
/** How far the resting projector sits sunk toward the corner, in pixels. */
const PEEK = { dx: 24, dy: 23 }
const UP_MS = 520
const DOWN_MS = 300

interface Geometry {
	/** CSS px per pixel. */
	S: number
	/** The lens in footer pixels. */
	lens: { x: number; y: number }
	/** The footer's size in pixels, and how many of its bottom pixels the phone dock covers. */
	W: number
	H: number
	dock: number
}

const sameGeometry = (a: Geometry | null, b: Geometry) =>
	!!a &&
	a.S === b.S &&
	a.lens.x === b.lens.x &&
	a.lens.y === b.lens.y &&
	a.W === b.W &&
	a.H === b.H &&
	a.dock === b.dock

function measure(footer: HTMLElement): Geometry {
	const S = scaleFor(window.innerWidth, window.innerHeight)
	const dock = dockHeight(footer)
	return {
		S,
		lens: lensInFooter(
			S,
			footer.clientWidth,
			footer.clientHeight,
			dock,
			window.innerWidth,
		),
		W: Math.floor(footer.clientWidth / S),
		H: Math.floor(footer.clientHeight / S),
		dock: Math.ceil(dock / S),
	}
}

/** The part of the footer the drawing covers, in footer pixels. On phones it stops at the dock's top edge. */
const boxFor = (g: Geometry) => ({
	x0: Math.max(0, g.lens.x - REACH.side),
	x1: g.W,
	y0: Math.max(0, g.lens.y - REACH.up),
	y1: g.H - g.dock,
})

/** Rises fast, overshoots a touch, settles. */
const outBack = (u: number) => {
	const s = 1.9
	return u >= 1 ? 1 : 1 + (s + 1) * (u - 1) ** 3 + s * (u - 1) ** 2
}

export default function Projector({
	footer,
}: { footer: RefObject<HTMLElement | null> }) {
	const calm = usePrefersReducedMotion()
	const queryClient = useQueryClient()
	const canvas = useRef<HTMLCanvasElement>(null)
	const button = useRef<HTMLButtonElement>(null)
	const [geometry, setGeometry] = useState<Geometry | null>(null)
	const [up, setUp] = useState(false)
	const [showing, setShowing] = useState(false)
	/** Where the rise is: 0 peeking, 1 up. */
	const rise = useRef(0)
	const raf = useRef(0)
	/** The last pointer's kind, and whether the projector was already up when this tap began. */
	const pointer = useRef("")
	const wasUp = useRef(false)

	useEffect(() => {
		const element = footer.current
		if (!element) return
		// a resize that leaves the pixels where they were (a phone's URL bar coming and going) draws nothing again
		const update = () => {
			const next = measure(element)
			setGeometry((now) => (sameGeometry(now, next) ? now : next))
		}
		update()
		const observer = new ResizeObserver(update)
		observer.observe(element)
		window.addEventListener("resize", update)
		return () => {
			observer.disconnect()
			window.removeEventListener("resize", update)
		}
	}, [footer])

	/** Draws the projector at the current rise and fits the button to the pixels that show. */
	const draw = useCallback(() => {
		const element = canvas.current
		if (!element || !geometry) return
		const box = boxFor(geometry)
		const w = box.x1 - box.x0
		const h = box.y1 - box.y0
		if (w < 1 || h < 1) return
		if (element.width !== w) element.width = w
		if (element.height !== h) element.height = h
		const ctx = element.getContext("2d")
		if (!ctx) return
		const k = 1 - rise.current
		const frame = createFrame(w, h)
		createFx(FX[PROJECTOR_FX], {
			on: 0,
			hover: rise.current > 0.55 ? 1 : 0,
			x: geometry.lens.x - box.x0 + Math.round(PEEK.dx * k),
			y: geometry.lens.y - box.y0 + Math.round(PEEK.dy * k),
		}).draw(frame)
		const image = ctx.createImageData(w, h)
		composite(frame, image.data, null)
		ctx.putImageData(image, 0, 0)
		// the button covers the drawn pixels' box, so pointing at any visible part of the projector counts
		const target = button.current
		if (!target) return
		let left = w
		let top = h
		let right = 0
		const data = image.data
		for (let y = 0; y < h; y++)
			for (let x = 0; x < w; x++)
				if (data[(y * w + x) * 4 + 3] > 0) {
					if (x < left) left = x
					if (x > right) right = x
					if (y < top) top = y
				}
		const S = geometry.S
		const pad = 3
		const x0 = Math.max(0, left - pad)
		const y0 = Math.max(0, top - pad)
		target.style.left = `${(box.x0 + x0) * S}px`
		target.style.top = `${(box.y0 + y0) * S}px`
		target.style.width = `${(Math.min(w, right + pad) - x0) * S}px`
		target.style.height = `${(h - y0) * S}px`
	}, [geometry])

	// a still whenever the layout changes
	useEffect(() => draw(), [draw])

	// up or down: a short tween in whole pixels, then nothing runs
	useEffect(() => {
		cancelAnimationFrame(raf.current)
		const to = up ? 1 : 0
		const from = rise.current
		if (from === to) return
		if (calm) {
			rise.current = to
			draw()
			return
		}
		const ms = up ? UP_MS : DOWN_MS
		const start = performance.now()
		const step = (now: number) => {
			const u = Math.min(1, (now - start) / ms)
			rise.current = up ? from + (to - from) * outBack(u) : from * (1 - u * u)
			draw()
			raf.current = u < 1 ? requestAnimationFrame(step) : 0
		}
		raf.current = requestAnimationFrame(step)
		return () => cancelAnimationFrame(raf.current)
	}, [up, calm, draw])

	// a projector brought up by touch goes back down on a tap anywhere else
	useEffect(() => {
		if (!up || showing) return
		const away = (event: PointerEvent) => {
			if (event.pointerType === "mouse") return
			if (button.current?.contains(event.target as Node)) return
			setUp(false)
		}
		document.addEventListener("pointerdown", away)
		return () => document.removeEventListener("pointerdown", away)
	}, [up, showing])

	/** Brings the projector up and starts loading the show and its numbers. */
	const reach = () => {
		setUp(true)
		void loadShow()
		void queryClient.prefetchQuery({
			queryKey: CINEMA_NUMBERS_KEY,
			queryFn: fetchCinemaNumbers,
		})
	}

	const ended = useCallback((reason: ShowEnd) => {
		setShowing(false)
		if (reason !== "navigated") button.current?.focus({ preventScroll: true })
	}, [])

	if (!geometry) return null
	const box = boxFor(geometry)
	const { S } = geometry
	return (
		<>
			<canvas
				ref={canvas}
				aria-hidden
				className="pointer-events-none absolute z-[9] [image-rendering:pixelated]"
				style={{
					left: box.x0 * S,
					top: box.y0 * S,
					width: (box.x1 - box.x0) * S,
					height: (box.y1 - box.y0) * S,
				}}
			/>
			{/* under the footer's bottom-row links (z-[8]), so they stay clickable where the risen projector reaches */}
			<button
				ref={button}
				type="button"
				aria-label="Start the cinema show"
				title="Start the show"
				className="absolute z-[7] cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
				onPointerDown={(event) => {
					pointer.current = event.pointerType
					wasUp.current = up
				}}
				onClick={() => {
					// on a touch screen the first tap only brings it up; the next one starts the show
					const touch = pointer.current === "touch" || pointer.current === "pen"
					pointer.current = ""
					reach()
					if (touch && !wasUp.current) return
					setShowing(true)
				}}
				onPointerEnter={(event) => {
					if (event.pointerType === "mouse") reach()
				}}
				onPointerLeave={(event) => {
					if (
						event.pointerType === "mouse" &&
						document.activeElement !== button.current
					)
						setUp(false)
				}}
				onFocus={reach}
				onBlur={() => {
					if (!button.current?.matches(":hover")) setUp(false)
				}}
			/>
			{showing && (
				<Suspense fallback={null}>
					<Show footer={footer} calm={calm} onEnded={ended} />
				</Suspense>
			)}
		</>
	)
}
