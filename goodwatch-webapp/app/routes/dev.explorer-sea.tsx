// Development only: the Explorer sea on fixture islands, to compare the adapters (?gl=webgl2|webgl1|canvas), try
// focus and a bridge, and lose the WebGL context on purpose. Returns 404 in production.
import { json } from "@remix-run/node"
import { useEffect, useRef, useState } from "react"
import {
	loadBackdropImages,
	paintBackdropTile,
} from "~/ui/explorer/sea/backdrop"
import { createSeaRenderer } from "~/ui/explorer/sea/renderer"
import type {
	Camera,
	IslandShape,
	Rgb,
	SeaRenderer,
} from "~/ui/explorer/sea/types"

export function loader() {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return json({})
}

const FIXTURES: { name: string; color: string; backdrops: string[] }[] = [
	{
		name: "Action",
		color: "#e4572e",
		backdrops: [
			"/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg",
			"/vL5LR6WdxWPjLPFRLe133jXWsh5.jpg",
			"/uLtVbjvS1O7gXL8lUOwsFOH4man.jpg",
			"/7RyHsO4yDXtBv1zUU3mTpHeQ0d5.jpg",
		],
	},
	{
		name: "Comedy",
		color: "#f3a712",
		backdrops: [
			"/rFj9IKlL75B2pXhZA60jkNWvxeW.jpg",
			"/7Nwnmyzrtd0FkcRyPqmdzTPppQa.jpg",
			"/5bzPWQ2dFUl2aZKkp7ILJVVkRed.jpg",
			"/rmiG2uwcNoGFmBKMoa1pIcf514L.jpg",
		],
	},
	{
		name: "Drama",
		color: "#a8c686",
		backdrops: [
			"/8sNiAPPYU14PUepFNeSNGUTiHW.jpg",
			"/66Kn4XWhkuPkJxOJyPEx4U2CUfN.jpg",
			"/xXCuto8YVp5RFqBJ7yKmVmLOWpF.jpg",
			"/c3OHQncTAnKFhdOTX7D3LTW6son.jpg",
		],
	},
	{
		name: "Horror",
		color: "#b0413e",
		backdrops: [
			"/qVGpxnjrGlHaSTCqTQI6viBDSfp.jpg",
			"/9pkZesKMnblFfKxEhQx45YQ2kIe.jpg",
			"/eDLp4uFdqP1gpy9oMrutwH6Q64I.jpg",
			"/oihWVx3imvRKujnGmSDYhfG1gI5.jpg",
		],
	},
	{
		name: "Science Fiction",
		color: "#3fa7d6",
		backdrops: [
			"/cKvDv2LpwVEqbdXWoQl4XgGN6le.jpg",
			"/kIBK5SKwgqIIuRKhhWrJn3XkbPq.jpg",
		],
	},
	{
		name: "Romance",
		color: "#ee6fa3",
		backdrops: [
			"/W1ffLQGHoxfAOq0ZYdPtJlvAdb.jpg",
			"/weAYfu6FfrNxEDJ3xH1XpgQcqUv.jpg",
			"/uNLIMPxknsV4n3IAEDpS1iqF5dm.jpg",
		],
	},
	{
		name: "Thriller",
		color: "#6c63ff",
		backdrops: [
			"/9FE5eD92WfVCiivM9Pq9GVSrlWk.jpg",
			"/rlay2M5QYvi6igbGcFjq8jxeusY.jpg",
			"/dF6FjTZzRTENfB4R17HDN20jLT2.jpg",
		],
	},
	{
		name: "Animation",
		color: "#59cd90",
		backdrops: [
			"/jJKZaTBNenlFclQyjrnvzkRmvWE.jpg",
			"/eCynaAOgYYiw5yN5lBwz3IxqvaW.jpg",
			"/sDTnMOJ3H5wI38OxObmCtK7wfd5.jpg",
			"/lxwzY9vNwjDgxWKt3zZ6zcU6rEJ.jpg",
		],
	},
	{
		name: "Documentary",
		color: "#c2a878",
		backdrops: [
			"/8rft8A9nH43IReybFtYt21ezfMK.jpg",
			"/zqd39GO0GdO5TaO8HxnkmWwu2p8.jpg",
			"/cLZxnkj75cGBK1tLTMyIudOZYZk.jpg",
			"/qPlAgjG4xy7utjf5L14FZ8kaiWl.jpg",
		],
	},
	{
		name: "Fantasy",
		color: "#9d4edd",
		backdrops: [
			"/lvOLivVeX3DVVcwfVkxKf0R22D8.jpg",
			"/6G73mNyooWAEQTpckPSnFxFoNmc.jpg",
			"/htmYEfH7TQgzsXHCnNXxmoYKQtL.jpg",
			"/cClWTo3ftVXvV1sF8vlLuWfnlph.jpg",
		],
	},
	{
		name: "Crime",
		color: "#8d99ae",
		backdrops: [
			"/i5H7zusQGsysGQ8i6P361Vnr0n2.jpg",
			"/amZavErrjrdgDwhsIdpWxHNenIx.jpg",
		],
	},
	{
		name: "War",
		color: "#7f7f3f",
		backdrops: [
			"/hwNtEmmugU5Yd7hpfprNWI0DGIn.jpg",
			"/zb6fM1CX41D9rF9hdgclu0peUmy.jpg",
			"/lgBZlJ1LHQel5nneNQMoesmvc7l.jpg",
			"/95ckrV6wQgbffurAVmETQ5YKASL.jpg",
		],
	},
	{
		name: "Western",
		color: "#d68c45",
		backdrops: [
			"/2oZklIzUbvZXXzIFzv7Hi68d6xf.jpg",
			"/gddUsvfyySrM5k8B8wwJy2VRlBx.jpg",
			"/4qxZJRYe4ezA5J1sidnV7vuaYaz.jpg",
			"/sGXCYMzr1sCnGNVuRpB2TOWPWDA.jpg",
		],
	},
	{
		name: "Mystery",
		color: "#2ec4b6",
		backdrops: [
			"/rbZvGN1A1QyZuoKzhCw8QPmf2q0.jpg",
			"/8MUZz7oPXQftFTslZpRP3CVMOoq.jpg",
			"/yaExZh6qE2cfyK3o4kAMEq0mkgy.jpg",
			"/85g84VtSf9tu1A9JqqruXEHspb7.jpg",
		],
	},
]

const hexRgb = (hex: string): Rgb => [
	Number.parseInt(hex.slice(1, 3), 16) / 255,
	Number.parseInt(hex.slice(3, 5), 16) / 255,
	Number.parseInt(hex.slice(5, 7), 16) / 255,
]
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
	a[0] + (b[0] - a[0]) * t,
	a[1] + (b[1] - a[1]) * t,
	a[2] + (b[2] - a[2]) * t,
]
/** More saturation and a floor on brightness, so tints glow. */
function luminous(c: Rgb): Rgb {
	const l = (Math.max(...c) + Math.min(...c)) / 2
	const out = c.map((v) => l + (v - l) * 1.5)
	const top = Math.max(...out, 1e-3)
	const k = Math.max(0.78, top) / top
	return out.map((v) => Math.min(1, Math.max(0, v * k))) as Rgb
}

interface Fixture {
	shape: IslandShape
	base: Rgb
	backdrops: string[]
}

/** Fourteen islands on a jittered spiral, sized by a made-up count; positions are fixed so reloads compare. */
function fixtureIslands(): Fixture[] {
	return FIXTURES.map((f, i) => {
		const a = i * 2.39996
		const d = 170 * Math.sqrt(i + 0.6)
		const base = hexRgb(f.color)
		return {
			base,
			backdrops: f.backdrops,
			shape: {
				x: Math.cos(a) * d,
				y: Math.sin(a) * d * 0.72,
				radius: 70 + ((i * 37) % 55),
				seed: i * 1.7 + 0.4,
				color: luminous(base),
				backdrop: null,
				emphasis: 0.25,
				saturation: 1,
			},
		}
	})
}

type Focus = "none" | "bridge"

/** The combining look: Horror and Thriller joined by a bridge between them, the rest grey, small, and dim. */
function withFocus(list: Fixture[], focus: Focus): IslandShape[] {
	const shapes = list.map((f) => ({ ...f.shape }))
	if (focus === "none") return shapes
	const a = shapes[3]
	const b = shapes[6]
	for (const [i, s] of shapes.entries()) {
		if (i === 3 || i === 6) {
			s.emphasis = 0.6
			s.saturation = 1.1
			continue
		}
		const grey = (s.color[0] + s.color[1] + s.color[2]) / 3
		s.color = mix(s.color, [grey, grey, grey], 0.7).map((v) => v * 0.6) as Rgb
		s.emphasis = -0.8
		s.saturation = 0.1
		s.radius *= 0.7
	}
	shapes.push({
		x: (a.x + b.x) / 2,
		y: (a.y + b.y) / 2,
		radius: Math.max(a.radius, b.radius) * 1.3,
		seed: 2.9,
		color: luminous(mix(a.color, b.color, 0.5)),
		backdrop: a.backdrop,
		emphasis: 1.4,
		saturation: 1.15,
		spotlight: 0.5,
	})
	return shapes
}

declare global {
	interface Window {
		explorerSea?: {
			kind: () => string
			stats: () => Stats
			loseContext: () => boolean
			restoreContext: () => boolean
			pan: (dx: number, dy: number) => void
			zoom: (factor: number) => void
			setFocus: (focus: Focus) => void
			tilesReady: () => number
		}
	}
}

interface Stats {
	running: boolean
	frames: number
	drawMs: number[]
	intervals: number[]
}

export default function ExplorerSeaHarness() {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const [status, setStatus] = useState("starting")

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return
		const reducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches
		const sea: SeaRenderer = createSeaRenderer(canvas, { reducedMotion })
		const fixtures = fixtureIslands()
		let focus: Focus = "none"
		let tilesReady = 0
		const stats: Stats = {
			running: false,
			frames: 0,
			drawMs: [],
			intervals: [],
		}
		let raf = 0
		let lastFrame = 0
		let shown = ""

		const bounds = fixtures.reduce(
			(b, f) => ({
				minX: Math.min(b.minX, f.shape.x - f.shape.radius),
				maxX: Math.max(b.maxX, f.shape.x + f.shape.radius),
				minY: Math.min(b.minY, f.shape.y - f.shape.radius),
				maxY: Math.max(b.maxY, f.shape.y + f.shape.radius),
			}),
			{ minX: 0, maxX: 0, minY: 0, maxY: 0 },
		)
		const view = { x: 0, y: 0, scale: 1, overview: 1 }
		const fit = () => {
			const w = window.innerWidth
			const h = window.innerHeight
			view.overview = Math.min(
				w / (bounds.maxX - bounds.minX + 120),
				h / (bounds.maxY - bounds.minY + 120),
			)
		}
		fit()
		view.scale = view.overview
		view.x = (bounds.minX + bounds.maxX) / 2
		view.y = (bounds.minY + bounds.maxY) / 2

		const camera = (): Camera => {
			const zoom = view.scale / view.overview
			return {
				x: view.x,
				y: view.y,
				scale: view.scale,
				overviewScale: view.overview,
				depth: Math.max(0, Math.min(1, (zoom - 3) / 3.6)),
				width: window.innerWidth,
				height: window.innerHeight,
			}
		}

		const frame = (time: number) => {
			raf = 0
			// Frame intervals count only back-to-back frames, not the gaps while idle.
			if (time - lastFrame < 200) stats.intervals.push(time - lastFrame)
			lastFrame = time
			const started = performance.now()
			sea.setCamera(camera())
			const moving = sea.draw(time)
			stats.drawMs.push(performance.now() - started)
			if (stats.drawMs.length > 600) stats.drawMs.shift()
			if (stats.intervals.length > 600) stats.intervals.shift()
			stats.frames++
			stats.running = moving
			const next = `${sea.kind}${moving ? "" : " (idle)"}`
			if (next !== shown) {
				shown = next
				setStatus(next)
			}
			if (moving) raf = requestAnimationFrame(frame)
		}
		const wake = () => {
			if (!raf) raf = requestAnimationFrame(frame)
		}
		const setIslands = () => {
			sea.setIslands(withFocus(fixtures, focus))
			wake()
		}
		setIslands()

		let cancelled = false
		fixtures.forEach(async (f) => {
			const images = await loadBackdropImages(f.backdrops)
			if (cancelled) return
			const tile = paintBackdropTile(images, f.base)
			if (!tile) return
			f.shape.backdrop = tile
			f.shape.color = luminous(mix(tile.average, f.base, 0.45))
			tilesReady++
			setIslands()
		})

		let drag: { x: number; y: number } | null = null
		const onDown = (e: PointerEvent) => {
			drag = { x: e.clientX, y: e.clientY }
		}
		const onMove = (e: PointerEvent) => {
			if (!drag) return
			view.x -= (e.clientX - drag.x) / view.scale
			view.y -= (e.clientY - drag.y) / view.scale
			drag = { x: e.clientX, y: e.clientY }
			wake()
		}
		const onUp = () => {
			drag = null
		}
		const onWheel = (e: WheelEvent) => {
			e.preventDefault()
			view.scale = Math.max(
				view.overview * 0.5,
				Math.min(view.overview * 12, view.scale * Math.exp(-e.deltaY * 0.0015)),
			)
			wake()
		}
		const onResize = () => {
			fit()
			wake()
		}
		window.addEventListener("pointerdown", onDown)
		window.addEventListener("pointermove", onMove)
		window.addEventListener("pointerup", onUp)
		window.addEventListener("wheel", onWheel, { passive: false })
		window.addEventListener("resize", onResize)

		const visibleCanvas = () =>
			[
				...document.querySelectorAll<HTMLCanvasElement>(
					"[data-sea-host] canvas",
				),
			].find((c) => c.style.display !== "none")
		const loseExtension = () => {
			const c = visibleCanvas()
			if (!c || sea.kind === "canvas2d") return null
			const gl = c.getContext(
				sea.kind === "webgl2" ? "webgl2" : "webgl",
			) as WebGLRenderingContext | null
			return gl?.getExtension("WEBGL_lose_context") ?? null
		}
		let lostExtension: WEBGL_lose_context | null = null
		window.explorerSea = {
			kind: () => sea.kind,
			stats: () => stats,
			loseContext: () => {
				lostExtension = loseExtension()
				lostExtension?.loseContext()
				return !!lostExtension
			},
			restoreContext: () => {
				lostExtension?.restoreContext()
				return !!lostExtension
			},
			pan: (dx, dy) => {
				view.x += dx / view.scale
				view.y += dy / view.scale
				wake()
			},
			zoom: (factor) => {
				view.scale *= factor
				wake()
			},
			setFocus: (next) => {
				focus = next
				setIslands()
			},
			tilesReady: () => tilesReady,
		}

		return () => {
			cancelled = true
			if (raf) cancelAnimationFrame(raf)
			window.removeEventListener("pointerdown", onDown)
			window.removeEventListener("pointermove", onMove)
			window.removeEventListener("pointerup", onUp)
			window.removeEventListener("wheel", onWheel)
			window.removeEventListener("resize", onResize)
			window.explorerSea = undefined
			sea.dispose()
		}
	}, [])

	return (
		<div
			data-sea-host=""
			className="fixed inset-0 z-[9999] overflow-hidden bg-black"
		>
			<canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
			<output className="pointer-events-none absolute left-3 top-3 rounded bg-black/60 px-2 py-1 font-mono text-xs text-white">
				{status}
			</output>
		</div>
	)
}
