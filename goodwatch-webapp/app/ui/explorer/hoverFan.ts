// The hover fan: at island level, the island under the mouse swells a little and fans its top six posters up in an arc
// above it (below it near the top of the view), with its name and size in a pill beyond them.
import type { ExplorerTitle } from "~/domain/explorer"
import { type Rgb, mixRgb, rgbCss } from "./color"
import { fanTitles } from "./fanTitles"
import { posterImage } from "./images"
import type { MapIsland } from "./island"
import { FONT, clamp } from "./paint"
import { easeOut } from "./zoomGlide"

export interface Fan {
	island: MapIsland
	k: number
	want: number
}

type Swelling = MapIsland & { hoverSwell?: number }
/** How much bigger an island is drawn while it's hovered (1 when it isn't). */
export const swellOf = (island: MapIsland) =>
	(island as Swelling).hoverSwell ?? 1

/** Eases each fan toward open (the hovered island) or closed; true while any moves. */
export function stepFans(
	fans: Fan[],
	hovered: MapIsland | null,
	dt: number,
	reduce: boolean,
): boolean {
	let moving = false
	if (hovered && !fans.some((f) => f.island === hovered))
		fans.push({ island: hovered, k: 0, want: 1 })
	for (let n = fans.length - 1; n >= 0; n--) {
		const f = fans[n]
		f.want = f.island === hovered ? 1 : 0
		if (f.k !== f.want) {
			const rate = f.want ? 6.5 : 9
			const next = reduce
				? f.want
				: f.k + (f.want - f.k) * (1 - Math.exp(-dt * rate))
			f.k = Math.abs(f.want - next) < 0.004 ? f.want : next
			moving = true
		}
		;(f.island as Swelling).hoverSwell = 1 + 0.07 * easeOut(f.k)
		if (f.k === 0 && f.want === 0) {
			;(f.island as Swelling).hoverSwell = 1
			fans.splice(n, 1)
		}
	}
	return moving
}

function roundRect(
	g: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number,
) {
	g.beginPath()
	g.moveTo(x + r, y)
	g.arcTo(x + w, y, x + w, y + h, r)
	g.arcTo(x + w, y + h, x, y + h, r)
	g.arcTo(x, y + h, x, y, r)
	g.arcTo(x, y, x + w, y, r)
	g.closePath()
}

/** Paints each open fan: the island's top posters in an arc above it (below it near the top), its name and size. */
export function paintFans(
	g: CanvasRenderingContext2D,
	fans: readonly Fan[],
	view: {
		W: number
		H: number
		top: number
		dpr: number
		visible: (title: ExplorerTitle) => boolean
	},
) {
	for (const f of fans) {
		if (f.k < 0.01) continue
		const island = f.island
		if (!island.on) continue
		const list = fanTitles(island, view.visible)
		const n = list.length
		const pw = clamp(island.sr * 0.36, 44, 64)
		const ph = pw * 1.5
		const R = Math.max(island.sr * 0.95, 96) + ph * 0.6
		// Up, unless that leaves the top of the view; then down.
		const up = island.sy - R - ph * 0.7 - 44 > view.top
		const dir = up ? -1 : 1
		const ox = island.sx
		const oy = island.sy + dir * -R * 0.25
		// About a poster's width apart along the arc, never wider than a wide fan.
		const span = Math.min(1.7, ((pw * 1.08) / R) * Math.max(1, n - 1))
		const tint = island.tint as Rgb
		g.save()
		for (let i = 0; i < n; i++) {
			const t = list[i]
			// Each poster follows the one before a little: they rise out of the island one by one.
			const ki = easeOut(clamp((f.k - i * 0.06) / 0.7, 0, 1))
			if (ki <= 0.002) continue
			const a =
				(n > 1 ? -span / 2 + (span * i) / (n - 1) : 0) +
				(dir < 0 ? -Math.PI / 2 : Math.PI / 2)
			const tx = ox + Math.cos(a) * R
			const ty = oy + Math.sin(a) * R
			const x = island.sx + (tx - island.sx) * ki
			const y = island.sy + (ty - island.sy) * ki
			const rot = (a - (dir < 0 ? -Math.PI / 2 : Math.PI / 2)) * 0.55 * ki
			const s = 0.55 + 0.45 * ki
			const w = pw * s
			const h = ph * s
			g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0)
			g.translate(x, y)
			g.rotate(rot)
			g.globalAlpha = ki
			// A soft drop shadow and a rim in the island's color.
			g.fillStyle = "rgba(2,4,10,.55)"
			roundRect(g, -w / 2 + 2, -h / 2 + 5, w, h, 5)
			g.fill()
			roundRect(g, -w / 2, -h / 2, w, h, 5)
			g.fillStyle = rgbCss(mixRgb(tint, [0.04, 0.06, 0.12], 0.6))
			g.fill()
			const img = t.poster ? posterImage(t.poster, w * view.dpr) : null
			if (img) {
				g.save()
				g.clip()
				g.drawImage(img, -w / 2, -h / 2, w, h)
				g.restore()
			}
			roundRect(g, -w / 2, -h / 2, w, h, 5)
			g.lineWidth = 1
			g.strokeStyle = rgbCss(mixRgb(tint, [1, 1, 1], 0.45), 0.7)
			g.stroke()
		}
		// The name and size, beyond the arc.
		g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0)
		const la = easeOut(clamp((f.k - 0.15) / 0.6, 0, 1))
		if (la > 0.01) {
			const ly = oy + dir * (R + ph * 0.5 + 22)
			const name = island.name
			const count = `${island.count.toLocaleString("en")} titles`
			g.font = `800 15px ${FONT}`
			const nw = g.measureText(name).width
			g.font = `600 12px ${FONT}`
			const cw = g.measureText(count).width
			const bw = nw + cw + 34
			const bx = clamp(ox - bw / 2, 8, view.W - bw - 8)
			const by = ly - 15 + (1 - la) * 6 * -dir
			g.globalAlpha = la
			roundRect(g, bx, by, bw, 30, 15)
			g.fillStyle = "rgba(3,7,18,.86)"
			g.fill()
			g.lineWidth = 1
			g.strokeStyle = rgbCss(tint, 0.55)
			g.stroke()
			g.textBaseline = "middle"
			g.textAlign = "left"
			g.fillStyle = rgbCss(mixRgb(tint, [1, 1, 1], 0.2))
			g.beginPath()
			g.arc(bx + 14, by + 15, 3.5, 0, Math.PI * 2)
			g.fill()
			g.font = `800 15px ${FONT}`
			g.fillStyle = "#fff"
			g.fillText(name, bx + 24, by + 15.5)
			g.font = `600 12px ${FONT}`
			g.fillStyle = "rgba(251,191,36,.9)"
			g.fillText(count, bx + 24 + nw + 8, by + 16)
		}
		g.restore()
	}
	g.globalAlpha = 1
	g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0)
}
