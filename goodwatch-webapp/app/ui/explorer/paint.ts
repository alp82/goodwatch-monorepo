import type { ExplorerTitle } from "~/domain/explorer"
// The poster layer's drawing, on a Canvas 2D over the sea: the `lit` posters (a warm pool of light follows the
// focus; cards near it are bright, tilt toward it, and cast shadows away from it; far ones sink into the night and
// shrink to dots in their own color), the thread from the active poster to its card, and the islands' names.
import { type Rgb, mixRgb, rgbCss } from "./color"
import { dotColor, imageAt, posterImage } from "./images"
import type { MapIsland } from "./island"

export const FONT = "Gabarito, system-ui, sans-serif"

/** A title drawn this frame. */
export interface Drawn {
	island: MapIsland
	/** Index in the island's titles. */
	i: number
	title: ExplorerTitle
	generation: number
	/** Screen rect as drawn (CSS pixels), top left, and center. */
	x: number
	y: number
	w: number
	h: number
	cx: number
	cy: number
	/** Opacity, 0 to 1. */
	a: number
	/** Closeness to the focus: 1 at it, 0 far away. */
	t: number
}

/** The pool of light: where it is and its radius, in CSS pixels. */
export interface Lens {
	x: number
	y: number
	r: number
}

export const clamp = (v: number, a: number, b: number) =>
	Math.max(a, Math.min(b, v))
export const smooth = (a: number, b: number, v: number) => {
	const t = clamp((v - a) / (b - a), 0, 1)
	return t * t * (3 - 2 * t)
}

// ---------------------------------------------------------------- sprites

function canvasOf(w: number, h: number) {
	const c = document.createElement("canvas")
	c.width = w
	c.height = h
	return c.getContext("2d") as CanvasRenderingContext2D
}

let shadowSprite: HTMLCanvasElement | null = null
function shadow() {
	if (shadowSprite) return shadowSprite
	const g = canvasOf(96, 132)
	g.filter = "blur(10px)"
	g.fillStyle = "rgba(0,0,0,.9)"
	g.beginPath()
	g.roundRect(24, 24, 48, 84, 6)
	g.fill()
	shadowSprite = g.canvas
	return shadowSprite
}

let dotSprite: HTMLCanvasElement | null = null
/** A round soft dot of light, for far-away titles. */
function dotLight() {
	if (dotSprite) return dotSprite
	const g = canvasOf(64, 64)
	const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
	gr.addColorStop(0, "rgba(255,255,255,1)")
	gr.addColorStop(0.22, "rgba(255,255,255,.9)")
	gr.addColorStop(0.3, "rgba(255,255,255,.35)")
	gr.addColorStop(1, "rgba(255,255,255,0)")
	g.fillStyle = gr
	g.fillRect(0, 0, 64, 64)
	dotSprite = g.canvas
	return dotSprite
}

const glows = new Map<string, HTMLCanvasElement>()
/** A soft glow in an island's color, behind the hovered and active posters. */
function glow(c: Rgb) {
	const key = c.map((v) => Math.round(v * 40)).join(",")
	let sprite = glows.get(key)
	if (!sprite) {
		const g = canvasOf(128, 160)
		g.filter = "blur(11px)"
		g.fillStyle = rgbCss(c, 0.95)
		g.beginPath()
		g.roundRect(32, 32, 64, 96, 6)
		g.fill()
		sprite = g.canvas
		glows.set(key, sprite)
	}
	return sprite
}

// ---------------------------------------------------------------- posters

/** How far `lit` shrinks far-away posters. */
export const FAR = 0.74

/** The warm pool of light on the ground at the focus, the night deepening away from it (only once zoomed in). */
export function paintPool(
	g: CanvasRenderingContext2D,
	lens: Lens,
	zoomedIn: number,
	W: number,
	H: number,
) {
	if (zoomedIn <= 0.01) return
	g.save()
	const night = g.createRadialGradient(
		lens.x,
		lens.y,
		lens.r * 0.45,
		lens.x,
		lens.y,
		lens.r * 1.9,
	)
	night.addColorStop(0, "rgba(2,4,10,0)")
	night.addColorStop(1, `rgba(2,4,10,${0.5 * zoomedIn})`)
	g.fillStyle = night
	g.fillRect(0, 0, W, H)
	g.globalCompositeOperation = "lighter"
	const warm = g.createRadialGradient(
		lens.x,
		lens.y,
		0,
		lens.x,
		lens.y,
		lens.r * 1.05,
	)
	warm.addColorStop(0, `rgba(255,236,205,${0.11 * zoomedIn})`)
	warm.addColorStop(1, "rgba(255,236,205,0)")
	g.fillStyle = warm
	g.fillRect(
		lens.x - lens.r * 1.1,
		lens.y - lens.r * 1.1,
		lens.r * 2.2,
		lens.r * 2.2,
	)
	g.restore()
}

/** The poster image (or its title on a dark card while it loads), clipped to a rounded rect. */
function face(
	g: CanvasRenderingContext2D,
	d: Drawn,
	dpr: number,
	x: number,
	y: number,
	w: number,
	h: number,
	rr: number,
) {
	const image = d.title.poster ? posterImage(d.title.poster, w * dpr) : null
	g.save()
	g.beginPath()
	g.roundRect(x, y, w, h, rr)
	g.clip()
	if (image) g.drawImage(image, x, y, w, h)
	else {
		g.fillStyle = rgbCss(mixRgb(d.island.tint, [0.05, 0.06, 0.1], 0.7))
		g.fillRect(x, y, w, h)
		if (w > 60) {
			const name = d.title.title
			g.fillStyle = "rgba(255,255,255,.8)"
			g.font = `600 ${Math.min(15, w * 0.11)}px ${FONT}`
			g.textAlign = "center"
			g.textBaseline = "middle"
			g.fillText(
				name.length > 22 ? `${name.slice(0, 20)}…` : name,
				x + w / 2,
				y + h / 2,
				w * 0.86,
			)
		}
	}
	g.restore()
}

/**
 * One title the `lit` way. lift: 0 normal, 1 hovered, 2 active. Far and small, it's a dot in the poster's own color;
 * bigger, a card that turns toward the light, with a shadow falling away from it and the night on its far side.
 */
export function paintPoster(
	g: CanvasRenderingContext2D,
	d: Drawn,
	lift: number,
	alpha: number,
	lens: Lens,
	dpr: number,
	budget: { left: number },
) {
	const t = d.t
	const dotW = 1 - smooth(13, 24, d.w)
	if (dotW > 0.01) {
		const c =
			(d.title.poster && dotColor(d.title.poster, budget)) ||
			rgbCss(d.island.tint)
		g.globalAlpha = alpha * dotW * 0.9
		const r = clamp(d.w * 0.34, 2.2, 6)
		g.drawImage(dotLight(), d.cx - r * 2.2, d.cy - r * 2.2, r * 4.4, r * 4.4)
		g.globalAlpha = alpha * dotW
		g.fillStyle = c
		g.beginPath()
		g.arc(d.cx, d.cy, r * 0.62, 0, Math.PI * 2)
		g.fill()
		g.globalAlpha = 1
		if (dotW > 0.99) return
	}
	const pa = alpha * (1 - dotW)
	let vx = (d.cx - lens.x) / lens.r
	let vy = (d.cy - lens.y) / lens.r
	const vl = Math.hypot(vx, vy)
	if (vl > 1) {
		vx /= vl
		vy /= vl
	}
	const k = lift === 2 ? 1.05 : lift === 1 ? 1.03 : 1
	const w = d.w * k
	const h = d.h * k
	const x = -w / 2
	const y = -h / 2
	const rr = Math.max(2, w * 0.045)
	// The shadow falls away from the light, longer for the cards closest to it.
	const off = w * (0.05 + 0.12 * t)
	g.globalAlpha = pa * (0.3 + 0.45 * t)
	g.drawImage(
		shadow(),
		d.cx - w * 0.35 + vx * off,
		d.cy - h / 2 - h * 0.2 + w * 0.06 + vy * off,
		w * 1.7,
		h * 1.36,
	)
	g.globalAlpha = pa
	if (lift) {
		g.globalAlpha = pa * (lift === 2 ? 1 : 0.65)
		g.drawImage(
			glow(d.island.tint),
			d.cx - w / 2 - w * 0.5,
			d.cy - h / 2 - h * 0.34,
			w * 2,
			h * 1.68,
		)
		g.globalAlpha = pa
	}
	// A tilt toward the light: none right under it, most at the edge of the pool.
	const tilt = t * smooth(0.04, 0.5, vl) * 0.085
	g.save()
	g.translate(d.cx, d.cy)
	g.transform(
		1 - Math.abs(vx) * tilt * 0.9,
		-vx * vy * tilt * 0.6,
		-vx * tilt * 0.55,
		1 - Math.abs(vy) * tilt * 0.5,
		0,
		0,
	)
	face(g, d, dpr, x, y, w, h, rr)
	if (w > 30) {
		// A sheen on the side facing the light.
		const gr = g.createLinearGradient(
			-vx * w * 0.6,
			-vy * h * 0.6,
			vx * w * 0.6,
			vy * h * 0.6,
		)
		gr.addColorStop(0, `rgba(255,255,255,${0.2 * t + 0.04})`)
		gr.addColorStop(0.5, "rgba(255,255,255,0)")
		g.fillStyle = gr
		g.fillRect(x, y, w, h)
	}
	const dark = (1 - t) * 0.5
	if (dark > 0.01 && lift < 2) {
		g.fillStyle = `rgba(3,5,12,${dark})`
		g.fillRect(x, y, w, h)
	}
	g.lineWidth = lift === 2 ? 2 : 1
	g.strokeStyle =
		lift === 2 ? "rgba(255,255,255,.9)" : `rgba(255,255,255,${0.06 + 0.22 * t})`
	g.beginPath()
	g.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, rr)
	g.stroke()
	g.restore()
	g.globalAlpha = 1
}

/** A thread of light from the active poster to its card, unless the card covers the poster. */
export function paintThread(
	g: CanvasRenderingContext2D,
	d: Drawn,
	card: { x: number; y: number; w: number; h: number },
) {
	const toRight = card.x > d.cx
	const px = toRight ? d.cx + d.w * 0.53 : d.cx - d.w * 0.53
	const py = d.cy
	const inside =
		d.cx > card.x - 4 &&
		d.cx < card.x + card.w + 4 &&
		d.cy > card.y - 4 &&
		d.cy < card.y + card.h + 4
	if (inside) return
	const cx = clamp(px, card.x, card.x + card.w)
	const cy = clamp(py, card.y + 24, card.y + card.h - 24)
	const onSide = cx === card.x || cx === card.x + card.w
	const ex = onSide ? cx : px
	const ey = onSide ? cy : cy < py ? card.y + card.h : card.y
	if (Math.hypot(ex - px, ey - py) < 6) return
	const mx = (px + ex) / 2
	g.save()
	const gr = g.createLinearGradient(px, py, ex, ey)
	gr.addColorStop(0, rgbCss(d.island.tint, 0.95))
	gr.addColorStop(1, "rgba(255,255,255,.35)")
	g.beginPath()
	g.moveTo(px, py)
	g.bezierCurveTo(mx, py, mx, ey, ex, ey)
	g.strokeStyle = rgbCss(d.island.tint, 0.22)
	g.lineWidth = 6
	g.stroke()
	g.strokeStyle = gr
	g.lineWidth = 1.5
	g.stroke()
	g.fillStyle = "#fff"
	g.beginPath()
	g.arc(px, py, 3, 0, Math.PI * 2)
	g.fill()
	g.restore()
}

// ---------------------------------------------------------------- combining

type Point = { x: number; y: number }

/** A band of light between two screen points: a wide soft glow, a core, and a dotted line of light drifting along. */
export function paintBand(
	g: CanvasRenderingContext2D,
	a: Point,
	b: Point,
	c0: Rgb,
	c1: Rgb,
	wide: number,
	alpha: number,
	drift: number,
) {
	const gr = g.createLinearGradient(a.x, a.y, b.x, b.y)
	gr.addColorStop(0, rgbCss(c0, 0.5))
	gr.addColorStop(1, rgbCss(c1, 0.5))
	g.save()
	g.lineCap = "round"
	g.strokeStyle = gr
	g.globalAlpha = alpha * 0.28
	g.lineWidth = wide * 2.2
	g.beginPath()
	g.moveTo(a.x, a.y)
	g.lineTo(b.x, b.y)
	g.stroke()
	g.globalAlpha = alpha * 0.75
	g.lineWidth = wide * 0.5
	g.stroke()
	g.globalAlpha = alpha
	g.setLineDash([1, Math.max(6, wide * 0.9)])
	g.lineDashOffset = drift
	g.lineWidth = Math.max(1.6, wide * 0.18)
	g.strokeStyle = "rgba(255,255,255,.85)"
	g.stroke()
	g.restore()
}

/** Where a bridge would rise: a seed of light, pulsing gently (still with reduced motion). */
export function paintSeed(
	g: CanvasRenderingContext2D,
	at: Point,
	color: Rgb,
	radius: number,
	alpha: number,
) {
	g.save()
	g.globalCompositeOperation = "lighter"
	g.globalAlpha = alpha
	const gr = g.createRadialGradient(at.x, at.y, 0, at.x, at.y, radius)
	gr.addColorStop(0, rgbCss(mixRgb(color, [1, 1, 1], 0.6), 0.9))
	gr.addColorStop(0.35, rgbCss(color, 0.45))
	gr.addColorStop(1, rgbCss(color, 0))
	g.fillStyle = gr
	g.fillRect(at.x - radius, at.y - radius, 2 * radius, 2 * radius)
	g.restore()
}

/** A lit island: a bright shoreline just off its shore, and a halo in its own light. `shore` is in screen pixels. */
export function paintRing(
	g: CanvasRenderingContext2D,
	shore: Point[],
	color: Rgb,
	alpha: number,
) {
	if (shore.length < 3) return
	g.save()
	g.beginPath()
	shore.forEach((p, n) => (n ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)))
	g.closePath()
	g.globalAlpha = alpha
	g.shadowColor = rgbCss(mixRgb(color, [1, 1, 1], 0.2), 1)
	g.shadowBlur = 22
	g.lineWidth = 3
	g.strokeStyle = rgbCss(mixRgb(color, [1, 1, 1], 0.55), 1)
	g.stroke()
	g.shadowBlur = 0
	g.lineWidth = 1.4
	g.strokeStyle = "rgba(255,255,255,.95)"
	g.stroke()
	g.restore()
}

/** How far a bridge has risen, for its name and posters: 0 until it's well up, and fading as it sinks. */
export const risen = (island: MapIsland, from: number) =>
	island.bridge
		? smooth(from, 1, island.bridge.grow) *
			(island.bridge.to ? 1 : island.bridge.grow)
		: 1
