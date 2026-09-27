// The poster layer's drawing, on a Canvas 2D over the sea: the `lit` posters (a warm pool of light follows the
// focus; cards near it are bright, tilt toward it, and cast shadows away from it; far ones sink into the night and
// shrink to dots in their own color), the thread from the active poster to its card, and the islands' names.
import { type Rgb, mixRgb, rgbCss } from "./color"
import { dotColor, imageAt, posterImage } from "./images"
import type { MapIsland } from "./island"
import type { ExplorerTitle } from "~/domain/explorer"

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

// ---------------------------------------------------------------- names

export interface NamesFrame {
	W: number
	H: number
	phone: boolean
	pad: { t: number; r: number; b: number; l: number }
	/** Current scale, the overview's, and the smallest width a poster shows at. */
	scale: number
	fit: number
	show: number
	/** 1 out at the map, 0 in among the titles. */
	mapLevel: number
	/** The scale that frames an island's titles. */
	islandScale: (island: MapIsland) => number
	/** A line under an island's name in place of its size and taste. */
	notes: ReadonlyMap<string, string>
}

const subLineOf = (island: MapIsland, phone: boolean) => {
	const n = `${island.count.toLocaleString("en")} ${island.count === 1 ? "title" : "titles"}`
	return island.medianMatch != null && !phone
		? `${n}, ${island.medianMatch}% your taste`
		: n
}

/**
 * The islands' names: big on the islands out at the map, then small and pinned inside the view as you zoom into one,
 * fading once its titles take over. Names that would overlap make way for the ones nearer the middle.
 */
export function paintNames(
	g: CanvasRenderingContext2D,
	islands: MapIsland[],
	f: NamesFrame,
) {
	const { W, H, phone: ph, pad } = f
	const placed: { x0: number; x1: number; y0: number; y1: number }[] = []
	const order = islands
		.filter((island) => island.on)
		// Lit islands, then vivid ones, then the ones nearest the middle claim their room first.
		.sort(
			(a, b) =>
				(b.look.lit > 0.5 ? 1 : 0) - (a.look.lit > 0.5 ? 1 : 0) ||
				(b.look.vivid > 0.5 ? 1 : 0) - (a.look.vivid > 0.5 ? 1 : 0) ||
				Math.hypot(a.sx - W / 2, a.sy - H / 2) -
					Math.hypot(b.sx - W / 2, b.sy - H / 2),
		)
	for (const island of order) {
		const st1 = f.islandScale(island)
		let a = 1 - smooth(Math.max(f.fit * 1.3, st1 * 0.42), st1 * 0.8, f.scale)
		const mm = island.look.mute * f.mapLevel
		a *= 1 - 0.28 * mm
		if (a <= 0.01) continue
		const z = smooth(f.fit * 1.25, f.fit * 2.2, f.scale)
		const sr = island.sr
		let size =
			clamp(sr * (ph ? 0.2 : 0.22), ph ? 12 : 15, ph ? 22 : 40) * (1 - z) +
			(ph ? 13 : 15) * z
		g.font = `800 ${size}px ${FONT}`
		const room = Math.max(sr * (ph ? 1.8 : 2.1), ph ? 72 : 120)
		let lines = [island.name]
		const words = island.name.split(" ")
		if (
			g.measureText(island.name).width > room &&
			words.length > 1 &&
			z < 0.5
		) {
			let best = 1
			let bestWidth = Number.POSITIVE_INFINITY
			for (let k = 1; k < words.length; k++) {
				const w = Math.max(
					g.measureText(words.slice(0, k).join(" ")).width,
					g.measureText(words.slice(k).join(" ")).width,
				)
				if (w < bestWidth) {
					bestWidth = w
					best = k
				}
			}
			lines = [words.slice(0, best).join(" "), words.slice(best).join(" ")]
		}
		// An island showing its posters out at the map wears its name above its shore, off the posters.
		const scale = island.look.scale
		const nat1 = island.w1 * scale * f.scale
		const floor1 =
			island.boost * island.w1 * scale * f.fit * smooth(0, 1, island.look.vivid)
		const above = z < 0.5 && floor1 > nat1 && floor1 > f.show * 1.4
		if (above) {
			const room0 = island.sy - sr * 1.1 - 8 - pad.t
			const k = lines.length * 1.02 + 0.8
			if (size * k > room0) size = Math.max(ph ? 12 : 15, room0 / k)
		}
		g.font = `800 ${size}px ${FONT}`
		const tw = Math.max(...lines.map((l) => g.measureText(l).width))
		if (tw > room) size = Math.max(ph ? 10 : 11, (size * room) / tw)
		const sub = Math.max(ph ? 9.5 : 11, size * 0.4)
		g.font = `800 ${size}px ${FONT}`
		const half = Math.max(...lines.map((l) => g.measureText(l).width)) / 2 + 12
		const lead = size * 1.02
		const note = f.notes.get(island.id)
		const subLine = note ?? subLineOf(island, ph)
		const lx =
			z > 0
				? clamp(island.sx, pad.l + half, W - Math.max(pad.r, 60) - half)
				: clamp(island.sx, half + 6, W - half - 6)
		let y =
			z > 0
				? clamp(island.sy, pad.t + 24, H - 50)
				: island.sy +
					(island.logo ? size * 0.5 : 0) -
					((lines.length - 1) * lead) / 2
		// A name pulled far from its island (the island is mostly off screen) says nothing: leave it out.
		if (Math.hypot(lx - island.sx, y - island.sy) > Math.max(sr * 0.75, 40))
			continue
		const withSub = ((sr > (ph ? 34 : 46) && mm < 0.5) || !!note) && z < 0.5
		if (above) {
			const below = (lines.length - 1) * lead + (withSub ? sub * 1.55 : 0)
			const top = island.sy - sr * 1.1 - 8 - sub * 0.4 - below
			y = Math.max(top, pad.t + size)
			if (y > top + 4) y = island.sy + sr * 1.1 + size + 4
		}
		const subFont = `${note ? 700 : 500} ${note ? sub * 1.08 : sub}px ${FONT}`
		g.font = subFont
		const bh = withSub
			? Math.max(half - 6, Math.min(g.measureText(subLine).width, sr * 1.8) / 2)
			: half - 6
		const box = {
			x0: lx - bh,
			x1: lx + bh,
			y0: y - size,
			y1:
				y + size * 0.3 + (lines.length - 1) * lead + (withSub ? sub * 1.9 : 0),
		}
		if (
			(z > 0.3 || mm > 0.3) &&
			placed.some(
				(b) => b.x0 < box.x1 && b.x1 > box.x0 && b.y0 < box.y1 && b.y1 > box.y0,
			)
		)
			continue
		placed.push(box)
		g.save()
		g.globalAlpha = a
		g.textAlign = "center"
		g.textBaseline = "alphabetic"
		if (island.logo) {
			const logo = imageAt(island.logo, "w154")
			if (logo) {
				const L = size * 1.7
				g.shadowColor = "rgba(0,0,0,.5)"
				g.shadowBlur = 16
				g.beginPath()
				g.roundRect(lx - L / 2, y - size * 1.1 - L, L, L, L * 0.24)
				g.save()
				g.clip()
				g.drawImage(logo, lx - L / 2, y - size * 1.1 - L, L, L)
				g.restore()
				g.shadowBlur = 0
			}
		}
		g.shadowColor = "rgba(3,6,14,.85)"
		g.shadowBlur = size * 0.9
		g.font = `800 ${size}px ${FONT}`
		;(g as unknown as { letterSpacing: string }).letterSpacing =
			`${-size * 0.015}px`
		g.fillStyle =
			mm > 0.01
				? `rgba(${Math.round(255 - 40 * mm)},${Math.round(255 - 34 * mm)},${Math.round(255 - 22 * mm)},1)`
				: "#fff"
		lines.forEach((l, k) => g.fillText(l, lx, y + k * lead))
		y += (lines.length - 1) * lead
		if (withSub) {
			y += sub * 1.55
			g.font = subFont
			;(g as unknown as { letterSpacing: string }).letterSpacing = "0px"
			g.fillStyle = note ? "#fff4d6" : "rgba(235,240,255,.78)"
			g.fillText(subLine, lx, y, sr * 1.8)
		}
		g.restore()
	}
}
