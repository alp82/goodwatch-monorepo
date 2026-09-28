import type { SeaAdapter, SeaFrame, Spotlight } from "./adapter"
import { createCanvas2dAdapter } from "./canvas2d"
import {
	ATLAS_TILE_LIMIT,
	type BackdropTile,
	type Camera,
	ISLAND_LIMIT,
	type IslandShape,
	type SeaKind,
	type SeaRenderer,
} from "./types"
import { type ContextEvents, createWebglAdapter } from "./webgl"

/** Fog and surf stop drifting this long after the camera and islands last changed. */
const IDLE_AFTER_MS = 10_000
/** Two context losses within this window switch to Canvas 2D for the rest of the visit. */
const LOSS_WINDOW_MS = 60_000
/** The sea's clock advances at most this much per frame, so a stalled tab doesn't jump the fog. */
const MAX_STEP_MS = 100

const ORDER: SeaKind[] = ["webgl2", "webgl1", "canvas2d"]
const FORCED: Record<string, SeaKind> = {
	webgl2: "webgl2",
	webgl1: "webgl1",
	canvas: "canvas2d",
}

/** `?gl=webgl2|webgl1|canvas` forces an adapter, outside production only. */
function forcedKind(): SeaKind | null {
	if (import.meta.env.PROD) return null
	const value = new URLSearchParams(window.location.search).get("gl")
	return (value && FORCED[value]) || null
}

/**
 * Whether WebGL runs in software (SwiftShader, llvmpipe, or another software rasterizer). The shader sea draws there
 * at only 7 to 13 frames a second at 1440 by 900, while Canvas 2D holds 60, so such browsers get Canvas 2D first.
 * Checked once on a throwaway canvas, whose context is released right away.
 */
let software: boolean | undefined
export function webglRunsInSoftware(): boolean {
	if (software !== undefined) return software
	software = false
	try {
		const probe = document.createElement("canvas")
		const gl = (probe.getContext("webgl2") ??
			probe.getContext("webgl")) as WebGLRenderingContext | null
		if (!gl) return software
		const info = gl.getExtension("WEBGL_debug_renderer_info")
		// Firefox reports the unmasked renderer through RENDERER and deprecates the extension.
		const renderer = String(
			gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "",
		)
		software =
			/swiftshader|llvmpipe|softpipe|software|basic render driver/i.test(
				renderer,
			)
		gl.getExtension("WEBGL_lose_context")?.loseContext()
	} catch {
		software = false
	}
	return software
}

const sameCamera = (a: Camera | null, b: Camera) =>
	!!a &&
	a.x === b.x &&
	a.y === b.y &&
	a.scale === b.scale &&
	a.overviewScale === b.overviewScale &&
	a.depth === b.depth &&
	a.width === b.width &&
	a.height === b.height

const sameIsland = (a: IslandShape, b: IslandShape) =>
	a.x === b.x &&
	a.y === b.y &&
	a.radius === b.radius &&
	a.seed === b.seed &&
	a.color[0] === b.color[0] &&
	a.color[1] === b.color[1] &&
	a.color[2] === b.color[2] &&
	a.backdrop === b.backdrop &&
	a.emphasis === b.emphasis &&
	a.saturation === b.saturation &&
	(a.spotlight ?? 0) === (b.spotlight ?? 0)

/**
 * The best sea the browser can draw: WebGL2, then WebGL1, then Canvas 2D (Canvas 2D alone when WebGL runs in
 * software). Creating a context, compiling, or linking failing falls through to the next adapter. The renderer owns the backdrop atlas, recovers from lost WebGL contexts
 * (two losses within a minute switch to Canvas 2D), and stops asking for frames when nothing moves.
 *
 * A canvas that ever gave out one kind of context can't give out another, so each later adapter draws on a sibling
 * canvas with the same class and style, inserted after the original, which is hidden.
 */
export function createSeaRenderer(
	canvas: HTMLCanvasElement,
	prefs: { reducedMotion: boolean },
): SeaRenderer {
	const originalDisplay = canvas.style.display
	const siblings: HTMLCanvasElement[] = []
	let surface = canvas
	let surfaceUsed = false
	const freshSurface = () => {
		if (!surfaceUsed) {
			surfaceUsed = true
			return surface
		}
		const next = document.createElement("canvas")
		next.className = canvas.className
		next.style.cssText = canvas.style.cssText
		next.style.display = originalDisplay
		next.setAttribute("aria-hidden", "true")
		surface.style.display = "none"
		surface.after(next)
		siblings.push(next)
		surface = next
		return next
	}

	let disposed = false
	let contextLost = false
	let losses: number[] = []
	let camera: Camera | null = null
	let islands: IslandShape[] = []
	let slots: number[] = []
	/** The tile in each atlas slot, and when the slot was last used, for reuse. */
	const slotTiles: (BackdropTile | null)[] = Array(ATLAS_TILE_LIMIT).fill(null)
	const slotUsed: number[] = Array(ATLAS_TILE_LIMIT).fill(0)
	let generation = 0
	let dirty = true
	let lastChange = Number.NEGATIVE_INFINITY
	let seaTime = 0
	let lastTick: number | null = null
	let redraw = 0

	const events: ContextEvents = {
		onLost() {
			contextLost = true
			const now = performance.now()
			losses = [...losses.filter((t) => now - t < LOSS_WINDOW_MS), now]
			if (losses.length >= 2) fallBackToCanvas("lost the WebGL context twice")
		},
		onRestored() {
			contextLost = false
			uploadAllTiles()
			requestRedraw()
		},
		onRestoreFailed() {
			fallBackToCanvas("could not rebuild after a context loss")
		},
	}

	const build = (kind: SeaKind) =>
		kind === "canvas2d"
			? createCanvas2dAdapter(freshSurface())
			: createWebglAdapter(freshSurface(), kind === "webgl2" ? 2 : 1, events)

	const createAdapter = (kinds: SeaKind[]): SeaAdapter => {
		for (const kind of kinds) {
			try {
				return build(kind)
			} catch (error) {
				if (kind === "canvas2d") throw error
				console.warn(
					`Explorer sea: ${kind} unavailable, trying the next.`,
					error,
				)
			}
		}
		throw new Error("Explorer sea: no adapter available")
	}

	const forced = forcedKind()
	let adapter = createAdapter(
		forced
			? [...new Set<SeaKind>([forced, "canvas2d"])]
			: webglRunsInSoftware()
				? ["canvas2d"]
				: ORDER,
	)

	function uploadAllTiles() {
		slotTiles.forEach((tile, slot) => {
			if (tile) adapter.uploadTile(slot, tile.canvas)
		})
		dirty = true
	}

	function requestRedraw() {
		dirty = true
		if (redraw || disposed) return
		redraw = requestAnimationFrame((time) => {
			redraw = 0
			draw(time)
		})
	}

	function fallBackToCanvas(reason: string) {
		if (adapter.kind === "canvas2d" || disposed) return
		console.warn(`Explorer sea: switching to Canvas 2D (${reason}).`)
		adapter.dispose()
		adapter = createAdapter(["canvas2d"])
		contextLost = false
		uploadAllTiles()
		requestRedraw()
	}

	/** Gives every backdrop in use an atlas slot, reusing the least recently used slots. */
	function assignSlots(next: IslandShape[]) {
		generation++
		const inUse = new Set<BackdropTile>()
		for (const island of next) if (island.backdrop) inUse.add(island.backdrop)
		if (inUse.size > ATLAS_TILE_LIMIT)
			throw new Error(
				`Explorer sea: the atlas holds ${ATLAS_TILE_LIMIT} backdrops, got ${inUse.size}`,
			)
		for (const tile of inUse) {
			let slot = slotTiles.indexOf(tile)
			if (slot < 0) {
				slot = 0
				for (let s = 1; s < ATLAS_TILE_LIMIT; s++) {
					const candidate = slotTiles[s]
					if (candidate && inUse.has(candidate)) continue
					const best = slotTiles[slot]
					if ((best && inUse.has(best)) || slotUsed[s] < slotUsed[slot])
						slot = s
				}
				slotTiles[slot] = tile
				adapter.uploadTile(slot, tile.canvas)
			}
			slotUsed[slot] = generation
		}
		return next.map((island) =>
			island.backdrop ? slotTiles.indexOf(island.backdrop) : -1,
		)
	}

	function spotlightOf(list: IslandShape[]): Spotlight | null {
		let best: IslandShape | null = null
		for (const island of list)
			if ((island.spotlight ?? 0) > (best?.spotlight ?? 0)) best = island
		return best
			? {
					x: best.x,
					y: best.y,
					radius: best.radius,
					strength: Math.min(1, best.spotlight ?? 0),
				}
			: null
	}

	function draw(timeMs: number): boolean {
		if (disposed || contextLost || !camera) return false
		const moving =
			adapter.animated &&
			!prefs.reducedMotion &&
			timeMs - lastChange < IDLE_AFTER_MS
		if (moving) {
			if (lastTick !== null)
				seaTime += Math.min(MAX_STEP_MS, Math.max(0, timeMs - lastTick))
			lastTick = timeMs
		} else lastTick = null
		if (!moving && !dirty) return false
		const frame: SeaFrame = {
			camera,
			islands,
			slots,
			time: seaTime / 1000,
			spotlight: spotlightOf(islands),
		}
		adapter.render(frame)
		dirty = false
		return moving
	}

	return {
		get kind() {
			return adapter.kind
		},
		setIslands(next) {
			if (next.length > ISLAND_LIMIT)
				throw new Error(
					`Explorer sea: at most ${ISLAND_LIMIT} islands, got ${next.length}`,
				)
			if (
				next.length === islands.length &&
				next.every((island, i) => sameIsland(island, islands[i]))
			)
				return
			if (next.length > adapter.islandCapacity)
				fallBackToCanvas(
					`${next.length} islands, the device's WebGL holds ${adapter.islandCapacity}`,
				)
			slots = assignSlots(next)
			// Copies, so a caller that mutates its islands in place still registers as a change next time.
			islands = next.map((island) => ({ ...island, color: [...island.color] }))
			dirty = true
			lastChange = performance.now()
		},
		setCamera(next) {
			if (sameCamera(camera, next)) return
			camera = { ...next }
			dirty = true
			lastChange = performance.now()
		},
		draw,
		dispose() {
			if (disposed) return
			disposed = true
			if (redraw) cancelAnimationFrame(redraw)
			adapter.dispose()
			for (const sibling of siblings) sibling.remove()
			canvas.style.display = originalDisplay
		},
	}
}
