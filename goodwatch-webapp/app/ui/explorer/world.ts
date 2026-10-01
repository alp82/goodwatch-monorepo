// Where the islands sit on the map, in world units (the short side about 1000). The server places each island between
// -1 and 1 on both axes (similar islands close together) and says how many titles it holds; this sizes the islands by
// their titles, spreads them from those places until their shores (with room for their wobble) no longer touch, brings
// in any island left on its own, and fits the result into a world with the viewport's aspect ratio.

export interface WorldIsland {
	id: string
	/** Center and radius in world units, before the outline's wobble. */
	cx: number
	cy: number
	r: number
	/** Phase of the outline's wobble, so every island has its own shoreline. */
	seed: number
}

export interface World {
	w: number
	h: number
	islands: WorldIsland[]
}

/** FNV-1a of the island id, 0 to 1: the same island always gets the same shoreline. */
function hash(text: string) {
	let h = 2166136261
	for (let k = 0; k < text.length; k++)
		h = Math.imul(h ^ text.charCodeAt(k), 16777619)
	return (h >>> 0) / 4294967295
}

/** Lays islands out for a viewport of this aspect ratio (width over height). */
export function layWorld(
	islands: { id: string; count: number; x: number; y: number }[],
	aspect: number,
): World {
	const w = aspect >= 1 ? 1000 * aspect : 1000
	const h = aspect >= 1 ? 1000 : 1000 / aspect
	const raw = islands.map((island) => Math.sqrt(island.count ** 0.85))
	const k = Math.sqrt(
		(0.36 * w * h) /
			Math.PI /
			Math.max(
				1e-6,
				raw.reduce((s, v) => s + v * v, 0),
			),
	)
	const R = raw.map((v) => Math.max(v * k, 60))
	const tx = islands.map((island) => w / 2 + island.x * w * 0.34)
	const ty = islands.map((island) => h / 2 + island.y * h * 0.34)
	const X = [...tx]
	const Y = [...ty]
	const gap = 18
	for (let it = 0; it < 400; it++) {
		for (let a = 0; a < X.length; a++)
			for (let b = a + 1; b < X.length; b++) {
				const dx = X[b] - X[a]
				const dy = Y[b] - Y[a]
				const d = Math.hypot(dx, dy) || 0.01
				// Room for the wobbly shores too.
				const need = (R[a] + R[b]) * 1.12 + gap
				if (d < need) {
					const push = (need - d) / 2
					X[a] -= (dx / d) * push
					Y[a] -= (dy / d) * push
					X[b] += (dx / d) * push
					Y[b] += (dy / d) * push
				}
			}
		for (let a = 0; a < X.length; a++) {
			X[a] += (tx[a] - X[a]) * 0.02
			Y[a] += (ty[a] - Y[a]) * 0.02
		}
	}
	// An island whose place is far from the others' is left out on its own: it comes in toward its nearest neighbor
	// until it's as close as the others are. That's no further than the room it has, so it pushes no one.
	for (let pass = 0; pass < 3; pass++)
		for (let a = 0; a < X.length; a++) {
			let near = -1
			let slack = Number.POSITIVE_INFINITY
			for (let b = 0; b < X.length; b++) {
				if (b === a) continue
				const free =
					Math.hypot(X[b] - X[a], Y[b] - Y[a]) - ((R[a] + R[b]) * 1.12 + gap)
				if (free < slack) {
					slack = free
					near = b
				}
			}
			if (near < 0 || slack <= 1) continue
			const dx = X[near] - X[a]
			const dy = Y[near] - Y[a]
			const d = Math.hypot(dx, dy)
			X[a] += (dx / d) * slack
			Y[a] += (dy / d) * slack
		}
	if (!islands.length) return { w, h, islands: [] }
	const x0 = Math.min(...X.map((x, a) => x - R[a]))
	const x1 = Math.max(...X.map((x, a) => x + R[a]))
	const y0 = Math.min(...Y.map((y, a) => y - R[a]))
	const y1 = Math.max(...Y.map((y, a) => y + R[a]))
	const s = Math.min((w * 0.94) / (x1 - x0), (h * 0.94) / (y1 - y0))
	return {
		w,
		h,
		islands: islands.map((island, a) => ({
			id: island.id,
			cx: w / 2 + (X[a] - (x0 + x1) / 2) * s,
			cy: h / 2 + (Y[a] - (y0 + y1) / 2) * s,
			r: R[a] * s,
			seed: hash(island.id) * 6.28,
		})),
	}
}

/** The shoreline's radius at angle `a`: the same wobble the sea draws. */
export function shoreRadius(island: { r: number; seed: number }, a: number) {
	const s = island.seed
	return (
		island.r *
		(1 +
			0.055 * Math.sin(3 * a + s) +
			0.035 * Math.sin(5 * a + s * 2.3) +
			0.03 * Math.sin(2 * a + s * 0.7))
	)
}

/** How far (x, y) is from the island's shore in world units (negative inside). */
export const shoreDistance = (
	island: { cx: number; cy: number; r: number; seed: number },
	x: number,
	y: number,
) =>
	Math.hypot(x - island.cx, y - island.cy) -
	shoreRadius(island, Math.atan2(y - island.cy, x - island.cx))
