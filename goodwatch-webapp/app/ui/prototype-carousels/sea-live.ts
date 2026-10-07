// PROTOTYPE for "Prototype native-scroll carousels on title pages", sixth round. Throwaway code: not for production.
//
// The live part of the sea forms. It loads when the section comes near the viewport or is first touched
// (SeaSection.tsx), never while the page hydrates. Until then the section is the server's static picture, and taps
// work through the inline script.
//
// What it adds:
// - the Explorer's own sea renderer (ui/explorer/sea: WebGL2, WebGL1, or Canvas 2D) on a canvas under the posters,
//   fed with the islands of the static picture and the camera of the world's transform, so the shores, the glow, the
//   fog, and the surf are the Explorer's, and they follow every pan and zoom.
// - dragging the sea with momentum (sea1, sea4, and sea3 once inside an island), with the vertical swipe left to
//   the page.
// - the minimap as a handle (sea1), pinch and ctrl+wheel as zoom (sea3), the compass and the sea itself as a dial
//   (sea5), and the minimap again, in both directions (sea6).
// - the card naming the title nearest the middle of the map after a pan, as the Explorer's proximity card does.
import { createSeaRenderer } from "~/ui/explorer/sea/renderer"
import type { IslandShape, Rgb, SeaRenderer } from "~/ui/explorer/sea/types"

interface SeaState {
	busy: boolean
	spot: string
	cam: { x: number; y: number; k: number }
	trail: { px: number; py: number }[]
}
interface SeaApi {
	st: (s: Element) => SeaState
	cam: (s: Element, x: number, y: number, k: number, fast?: boolean) => void
	go: (s: Element, id: string, fast?: boolean) => void
	peek: (s: Element, poster: Element | null) => void
	head: (s: Element, tick: Element | null) => void
	turn: (s: Element, deg: number, fast?: boolean) => void
	marks: (s: Element, id: string) => void
	live: ((s: Element, fast?: boolean, swapped?: boolean) => void) | null
}
type SeaSectionElement = HTMLElement & { __drag?: number; __hold?: number }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

export function attach(s: SeaSectionElement): () => void {
	const api = (window as unknown as { __gwSea?: SeaApi }).__gwSea
	const map = s.querySelector<HTMLElement>("[data-sea-map]")
	const world = s.querySelector<HTMLElement>("[data-sea-world]")
	const bg = s.querySelector<HTMLElement>("[data-sea-bg]")
	const unitEl = s.querySelector<HTMLElement>("[data-sea-unit]")
	if (!api || !map || !world || !bg || !unitEl) return () => {}
	const form = s.dataset.sea
	const flat = form !== "sea5"
	const wide = window.matchMedia("(min-width:1024px)")
	const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
	const unit = () => unitEl.getBoundingClientRect().width / 100 || 4
	const here = () => s.querySelector<HTMLElement>("[data-sea-here]")
	/** A placed element's middle and width in world pixels, from the layout that shows. */
	const placeOf = (el: HTMLElement | SVGElement, u: number) => {
		const names = wide.matches ? ["--X", "--Y", "--W"] : ["--x", "--y", "--w"]
		const [x, y, w] = names.map((name) =>
			Number.parseFloat(el.style.getPropertyValue(name)),
		)
		return { x: x * u, y: y * u, w: w * u }
	}

	// ------------------------------------------------------------------ the sea
	const canvas = document.createElement("canvas")
	canvas.className = flat ? "sea-cv" : "sea-cv sea-cv-w"
	canvas.setAttribute("aria-hidden", "true")
	let plane = 0
	const sizePlane = () => {
		// sea5: the canvas lies on the tilted sea and turns with it, so it is a square larger than the stage.
		plane = Math.round(Math.max(map.clientWidth, 600) * 1.5)
		canvas.style.cssText = `left:${-plane / 2}px;top:${-plane / 2}px;width:${plane}px;height:${plane}px`
	}
	if (flat) bg.appendChild(canvas)
	else {
		sizePlane()
		world.insertBefore(canvas, world.firstChild)
	}
	let renderer: SeaRenderer | null = null
	try {
		renderer = createSeaRenderer(canvas, { reducedMotion: still })
	} catch {
		// No canvas at all: the static picture stays.
		canvas.remove()
	}
	let bounds = { x0: 0, x1: 0, y0: 0, y1: 0 }
	const readIslands = () => {
		const u = unit()
		const h = here()
		const hx = h?.offsetLeft ?? 0
		const hy = h?.offsetTop ?? 0
		const list: IslandShape[] = []
		bounds = { x0: hx, x1: hx, y0: hy, y1: hy }
		for (const el of s.querySelectorAll<SVGElement>("[data-isl]")) {
			const p = placeOf(el, u)
			if (!Number.isFinite(p.x + p.y + p.w)) continue
			const x = hx + p.x
			const y = hy + p.y
			bounds = {
				x0: Math.min(bounds.x0, x),
				x1: Math.max(bounds.x1, x),
				y0: Math.min(bounds.y0, y),
				y1: Math.max(bounds.y1, y),
			}
			list.push({
				x,
				y,
				radius: p.w / 2.5,
				seed: Number(el.dataset.isl),
				color: (el.dataset.rgb ?? "160,180,230")
					.split(",")
					.map((v) => Number(v) / 255) as Rgb,
				backdrop: null,
				emphasis: Number(el.dataset.em ?? 0),
				saturation: 1,
			})
		}
		// The voyage's earlier stops are small islands of their own, as far back as the renderer has room for.
		const trail = api.st(s).trail
		for (let i = trail.length - 2; i >= 0 && list.length < 24; i--) {
			const p = trail[i]
			if (form !== "sea4") break
			bounds = {
				x0: Math.min(bounds.x0, p.px),
				x1: Math.max(bounds.x1, p.px),
				y0: Math.min(bounds.y0, p.py),
				y1: Math.max(bounds.y1, p.py),
			}
			if (i === trail.length - 2) continue
			list.push({
				x: p.px,
				y: p.py,
				radius: 7.5 * u,
				seed: 1.3 + i,
				color: [0.62, 0.7, 0.9],
				backdrop: null,
				emphasis: -0.4,
				saturation: 1,
			})
		}
		renderer?.setIslands(list.slice(0, 24))
	}
	const readCamera = () => {
		if (!renderer) return
		if (!flat) {
			renderer.setCamera({
				x: 0,
				y: 0,
				scale: 1,
				overviewScale: 1,
				depth: 0,
				width: plane,
				height: plane,
			})
			return
		}
		const t = getComputedStyle(world).transform
		let k = 1
		let tx = 0
		let ty = 0
		if (t && t !== "none" && !t.includes("3d")) {
			const p = t.slice(t.indexOf("(") + 1, -1).split(",")
			k = Number(p[0]) || 1
			tx = Number(p[4])
			ty = Number(p[5])
		}
		const w = map.clientWidth
		const h = map.clientHeight
		renderer.setCamera({
			x: (w / 2 - world.offsetLeft - tx) / k,
			y: (h / 2 - world.offsetTop - ty) / k,
			scale: k,
			overviewScale: 1,
			depth: clamp((k - 1) / 1.6, 0, 1) * 0.5,
			width: w,
			height: h,
		})
	}
	let raf = 0
	let until = 0
	let visible = true
	let live = false
	const frame = (time: number) => {
		raf = 0
		if (!renderer) return
		readCamera()
		const moving = renderer.draw(time)
		if (!live) {
			live = true
			map.setAttribute("data-sea-live", "")
		}
		if (visible && (moving || performance.now() < until))
			raf = requestAnimationFrame(frame)
	}
	const kick = (ms = 700) => {
		until = performance.now() + ms
		if (!raf && visible && renderer) raf = requestAnimationFrame(frame)
	}

	// ------------------------------------------------------------------ what is near the middle
	const proximity = () => {
		if (form !== "sea1" && form !== "sea4" && form !== "sea6") return
		const state = api.st(s)
		const h = here()
		const u = unit()
		if (!h || state.busy) return
		const atHome =
			Math.hypot(state.cam.x - h.offsetLeft, state.cam.y - h.offsetTop) <
			(6 * u) / state.cam.k
		let best: Element | null = null
		let gap = 17 * u * state.cam.k
		if (!atHome) {
			const m = map.getBoundingClientRect()
			const cx = m.left + world.offsetLeft
			const cy = m.top + world.offsetTop
			for (const el of s.querySelectorAll(".sea-p")) {
				const r = el.getBoundingClientRect()
				const d = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy)
				if (d < gap) {
					gap = d
					best = el
				}
			}
		}
		s.__hold = best ? 1 : 0
		api.peek(s, best)
	}
	const onSettled = (event: TransitionEvent) => {
		if (event.target === world && event.propertyName === "transform")
			proximity()
	}
	world.addEventListener("transitionend", onSettled)

	api.live = (section, _fast, swapped) => {
		if (section !== s) return
		if (swapped) readIslands()
		kick()
	}

	// ------------------------------------------------------------------ pointers
	interface Drag {
		kind: "pan" | "mini" | "rose" | "turn"
		id: number
		sx: number
		sy: number
		lx: number
		ly: number
		lt: number
		vx: number
		vy: number
		moved: boolean
		touch: boolean
		cam: { x: number; y: number; k: number }
		turn: number
		angle: number
	}
	let drag: Drag | null = null
	let glide = 0
	const pointers = new Map<number, { x: number; y: number }>()
	let pinch: { d: number; done: boolean } | null = null

	const panTo = (x: number, y: number, k: number) =>
		api.cam(
			s,
			clamp(x, bounds.x0, bounds.x1),
			clamp(y, bounds.y0, bounds.y1),
			k,
			true,
		)
	const miniTo = (event: PointerEvent) => {
		const mini = [...s.querySelectorAll<HTMLElement>("[data-sea-mini]")].find(
			(el) => el.offsetParent,
		)
		if (!mini) return
		const r = mini.getBoundingClientRect()
		const b = (mini.dataset.seaMini ?? "").split(",").map(Number)
		const u = unit()
		const k = api.st(s).cam.k
		// The pressed spot of the small map comes to the middle of what the stage shows (sea1: sideways only).
		const fx = clamp((event.clientX - r.left) / r.width, 0, 1)
		const fy = clamp((event.clientY - r.top) / r.height, 0, 1)
		const mid = {
			x: (map.clientWidth / 2 - world.offsetLeft) / k,
			y: (map.clientHeight * 0.44 - world.offsetTop) / k,
		}
		panTo(
			(b[0] + fx * (b[2] - b[0])) * u - mid.x,
			form === "sea6" ? (b[1] + fy * (b[3] - b[1])) * u - mid.y : 0,
			k,
		)
	}
	const turnNow = () =>
		Number(s.querySelector(".sea-turn")?.getAttribute("data-sea-turn") ?? 0)
	/** The compass mark that a turn of the sea puts nearest to ahead. */
	const tickNear = (deg: number) => {
		let best: Element | null = null
		let gap = 361
		for (const tick of s.querySelectorAll(".sea-tick")) {
			const to = Number(tick.getAttribute("data-sea-turn"))
			const d = Math.abs(((((to - deg) % 360) + 540) % 360) - 180)
			if (d < gap) {
				gap = d
				best = tick
			}
		}
		return best
	}
	const angleAt = (event: PointerEvent) => {
		const rose = s.querySelector("[data-sea-rose]")?.getBoundingClientRect()
		return rose
			? (Math.atan2(
					event.clientY - rose.top - rose.height / 2,
					event.clientX - rose.left - rose.width / 2,
				) *
					180) /
					Math.PI
			: 0
	}

	const onDown = (event: PointerEvent) => {
		if (event.button) return
		s.__drag = 0
		cancelAnimationFrame(glide)
		const target = event.target as Element
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
		if (pointers.size === 2 && form === "sea3") {
			const [a, b] = [...pointers.values()]
			pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), done: false }
			drag = null
			return
		}
		const state = api.st(s)
		if (state.busy) return
		let kind: Drag["kind"] | null = null
		if (target.closest("[data-sea-mini]")) kind = "mini"
		else if (target.closest("[data-sea-rose]")) kind = "rose"
		else if (target.closest(".sea-card, .sea-top, .sea-ui")) kind = null
		else if (form === "sea5") kind = "turn"
		else if (
			form === "sea1" ||
			form === "sea4" ||
			form === "sea6" ||
			(form === "sea3" && state.spot)
		)
			kind = "pan"
		if (!kind) return
		drag = {
			kind,
			id: event.pointerId,
			sx: event.clientX,
			sy: event.clientY,
			lx: event.clientX,
			ly: event.clientY,
			lt: performance.now(),
			vx: 0,
			vy: 0,
			moved: false,
			touch: event.pointerType !== "mouse",
			cam: { ...state.cam },
			turn: turnNow(),
			angle: angleAt(event),
		}
		if (kind === "mini") miniTo(event)
	}
	const onMove = (event: PointerEvent) => {
		if (pointers.has(event.pointerId))
			pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
		if (pinch && pointers.size === 2) {
			const [a, b] = [...pointers.values()]
			const ratio = Math.hypot(a.x - b.x, a.y - b.y) / pinch.d
			if (!pinch.done && (ratio > 1.25 || ratio < 0.8)) {
				pinch.done = true
				s.__drag = 1
				if (ratio > 1) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2)
				else api.go(s, "")
			}
			return
		}
		if (!drag || drag.id !== event.pointerId) return
		const dx = event.clientX - drag.sx
		const dy = event.clientY - drag.sy
		if (!drag.moved && Math.hypot(dx, dy) < 6 && drag.kind !== "mini") return
		drag.moved = true
		s.__drag = 1
		const now = performance.now()
		const dt = Math.max(1, now - drag.lt)
		drag.vx = 0.7 * ((event.clientX - drag.lx) / dt) + 0.3 * drag.vx
		drag.vy = 0.7 * ((event.clientY - drag.ly) / dt) + 0.3 * drag.vy
		drag.lx = event.clientX
		drag.ly = event.clientY
		drag.lt = now
		if (drag.kind === "pan") {
			const k = drag.cam.k
			// A finger pans sideways: up and down belong to the page.
			panTo(drag.cam.x - dx / k, drag.touch ? drag.cam.y : drag.cam.y - dy / k, k)
			proximity()
		} else if (drag.kind === "mini") miniTo(event)
		else if (drag.kind === "rose" || drag.kind === "turn") {
			const deg =
				drag.kind === "rose"
					? drag.turn + (((angleAt(event) - drag.angle + 540) % 360) - 180)
					: drag.turn + dx * 0.4
			api.turn(s, deg, true)
			const tick = tickNear(deg)
			if (tick) api.marks(s, tick.getAttribute("data-sea-head") ?? "")
		}
	}
	const onUp = (event: PointerEvent) => {
		pointers.delete(event.pointerId)
		if (pointers.size < 2) pinch = null
		const d = drag
		if (!d || d.id !== event.pointerId) return
		drag = null
		if (d.kind === "rose" || d.kind === "turn") {
			if (!d.moved) return
			const dx = event.clientX - d.sx
			const deg =
				d.kind === "rose"
					? d.turn + (((angleAt(event) - d.angle + 540) % 360) - 180)
					: d.turn + dx * 0.4
			s.querySelector(".sea-turn")?.setAttribute("data-sea-turn", String(deg))
			api.head(s, tickNear(deg))
			return
		}
		if (d.kind === "mini") {
			proximity()
			return
		}
		if (!d.moved) return
		const state = api.st(s)
		if (form !== "sea3") {
			state.spot = ""
			map.setAttribute("data-sea-at", "")
		}
		void state
		if (still || event.type === "pointercancel") {
			proximity()
			return
		}
		// Momentum: the sea glides on and slows.
		let vx = d.vx
		let vy = d.touch ? 0 : d.vy
		let last = performance.now()
		const step = (now: number) => {
			const dt = Math.min(40, now - last)
			last = now
			const c = api.st(s).cam
			panTo(c.x - (vx * dt) / c.k, c.y - (vy * dt) / c.k, c.k)
			vx *= 0.94 ** (dt / 16)
			vy *= 0.94 ** (dt / 16)
			if (Math.hypot(vx, vy) > 0.03) glide = requestAnimationFrame(step)
			else proximity()
		}
		if (Math.hypot(vx, vy) > 0.05) glide = requestAnimationFrame(step)
		else proximity()
	}
	/** Goes into the island nearest a screen point. */
	const zoomAt = (clientX: number, clientY: number) => {
		let best: Element | null = null
		let gap = Number.POSITIVE_INFINITY
		for (const el of s.querySelectorAll("[data-sea-spot]")) {
			const r = el.getBoundingClientRect()
			const d = Math.hypot(
				r.left + r.width / 2 - clientX,
				r.top + r.height / 2 - clientY,
			)
			if (d < gap) {
				gap = d
				best = el
			}
		}
		const id = best?.getAttribute("data-sea-spot")
		if (id && id !== api.st(s).spot) api.go(s, id)
	}
	let wheeled = 0
	const onWheel = (event: WheelEvent) => {
		// Only a pinch on a trackpad (which arrives as ctrl+wheel) zooms: a plain wheel scrolls the page.
		if (form !== "sea3" || !event.ctrlKey) return
		event.preventDefault()
		const now = performance.now()
		if (now - wheeled < 450 || Math.abs(event.deltaY) < 2) return
		wheeled = now
		if (event.deltaY < 0) zoomAt(event.clientX, event.clientY)
		else api.go(s, "")
	}
	map.addEventListener("pointerdown", onDown)
	window.addEventListener("pointermove", onMove)
	window.addEventListener("pointerup", onUp)
	window.addEventListener("pointercancel", onUp)
	map.addEventListener("wheel", onWheel, { passive: false })

	const seen = new IntersectionObserver((entries) => {
		visible = entries.some((entry) => entry.isIntersecting)
		if (visible) kick()
	})
	seen.observe(map)
	const resized = new ResizeObserver(() => {
		if (!flat) sizePlane()
		readIslands()
		kick()
	})
	resized.observe(map)
	readIslands()
	kick()

	return () => {
		cancelAnimationFrame(raf)
		cancelAnimationFrame(glide)
		seen.disconnect()
		resized.disconnect()
		world.removeEventListener("transitionend", onSettled)
		map.removeEventListener("pointerdown", onDown)
		window.removeEventListener("pointermove", onMove)
		window.removeEventListener("pointerup", onUp)
		window.removeEventListener("pointercancel", onUp)
		map.removeEventListener("wheel", onWheel)
		if (api.live) api.live = null
		renderer?.dispose()
		canvas.remove()
		map.removeAttribute("data-sea-live")
	}
}
