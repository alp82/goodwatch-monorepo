// PROTOTYPE - throwaway. Round 10 of the Explorer: the islands' names, forked from ~/ui/explorer/paint.ts for a
// per-island fade (names of islands too small to read stay out) and the line under a combination of three.
import { imageAt } from "~/ui/explorer/images"
import type { MapIsland } from "~/ui/explorer/island"
import { FONT, clamp, smooth } from "~/ui/explorer/paint"

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
	/** 0 to 1 per island: names of islands drawn too small to read stay out. */
	fade: (island: MapIsland) => number
}

const subLineOf = (island: MapIsland, phone: boolean) => {
	const n = `${island.count.toLocaleString("en")} ${island.count === 1 ? "title" : "titles"}`
	const taste =
		island.medianMatch != null && !phone
			? `, ${island.medianMatch}% your taste`
			: ""
	if (island.bridge?.pending && !island.count) return "Finding titles…"
	if (island.bridge) {
		const kind = island.bridge.kind as string
		return kind === "all"
			? `${n} on all three${taste}`
			: kind === "both"
				? `${n} in both${taste}`
				: `${n} between the two${taste}`
	}
	return `${n}${taste}`
}

/** How far a bridge has risen, for its name and posters: 0 until it's well up, and fading as it sinks. */
export const risen = (island: MapIsland, from: number) =>
	island.bridge
		? smooth(from, 1, island.bridge.grow) *
			(island.bridge.to ? 1 : island.bridge.grow)
		: 1

/**
 * The islands' names: big on the islands out at the map, then small and pinned inside the view as you zoom into one,
 * fading once its titles take over. Names that would overlap make way for the ones nearer the middle.
 */
export function paintNames10(
	g: CanvasRenderingContext2D,
	islands: MapIsland[],
	f: NamesFrame,
) {
	const { W, H, phone: ph, pad } = f
	const placed: { x0: number; x1: number; y0: number; y1: number }[] = []
	const order = islands
		.filter((island) => island.on)
		// The bridge, then lit islands, then vivid ones, then the ones nearest the middle claim their room first.
		.sort(
			(a, b) =>
				(b.bridge ? 1 : 0) - (a.bridge ? 1 : 0) ||
				(b.look.lit > 0.5 ? 1 : 0) - (a.look.lit > 0.5 ? 1 : 0) ||
				(b.look.vivid > 0.5 ? 1 : 0) - (a.look.vivid > 0.5 ? 1 : 0) ||
				Math.hypot(a.sx - W / 2, a.sy - H / 2) -
					Math.hypot(b.sx - W / 2, b.sy - H / 2),
		)
	for (const island of order) {
		const st1 = f.islandScale(island)
		let a = 1 - smooth(Math.max(f.fit * 1.3, st1 * 0.42), st1 * 0.8, f.scale)
		const mm = island.look.mute * f.mapLevel
		a *= (1 - 0.28 * mm) * risen(island, 0.55) * f.fade(island)
		if (a <= 0.01) continue
		const z = smooth(f.fit * 1.25, f.fit * 2.2, f.scale)
		const sr = island.sr
		const bridge = !!island.bridge
		let size =
			clamp(sr * (ph ? 0.2 : 0.22), ph ? 12 : 15, ph ? 22 : 40) * (1 - z) +
			(ph ? 13 : 15) * z
		if (bridge) size = Math.max(size, ph ? 14 : 17)
		g.font = `800 ${size}px ${FONT}`
		const room = Math.max(sr * (ph ? 1.8 : 2.1), bridge ? 180 : ph ? 72 : 120)
		/** The widest the line under the name may be. */
		const subRoom = Math.max(sr * 1.8, bridge ? 240 : 0)
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
		const note = bridge ? undefined : f.notes.get(island.id)
		const subLine = note ?? subLineOf(island, ph)
		const subFont = `${note ? 700 : 500} ${note ? sub * 1.08 : sub}px ${FONT}`
		// A bridge's line is wide; keep all of it on screen.
		g.font = subFont
		const subHalf =
			bridge && z < 0.5
				? Math.min(g.measureText(subLine).width, subRoom) / 2
				: 0
		g.font = `800 ${size}px ${FONT}`
		const lx =
			z > 0
				? clamp(island.sx, pad.l + half, W - Math.max(pad.r, 60) - half)
				: clamp(
						island.sx,
						Math.max(half, subHalf) + 6,
						W - Math.max(half, subHalf) - 6,
					)
		let y =
			z > 0
				? clamp(island.sy, pad.t + 24, H - 50)
				: island.sy +
					(island.logo ? size * 0.5 : 0) -
					((lines.length - 1) * lead) / 2
		// A name pulled far from its island (the island is mostly off screen) says nothing: leave it out.
		if (
			!bridge &&
			Math.hypot(lx - island.sx, y - island.sy) > Math.max(sr * 0.75, 40)
		)
			continue
		const withSub =
			(((sr > (ph ? 34 : 46) || bridge) && mm < 0.5) || !!note) && z < 0.5
		if (above) {
			const below = (lines.length - 1) * lead + (withSub ? sub * 1.55 : 0)
			const top = island.sy - sr * 1.1 - 8 - sub * 0.4 - below
			y = Math.max(top, pad.t + size)
			if (y > top + 4) y = island.sy + sr * 1.1 + size + 4
		}
		g.font = subFont
		const bh = withSub
			? Math.max(half - 6, Math.min(g.measureText(subLine).width, subRoom) / 2)
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
			g.fillText(subLine, lx, y, subRoom)
		}
		g.restore()
	}
}
