import type { FocusRole, IslandLook } from "./island"
// The focus layout: where every island goes, and how big and how vivid, for what the person is interested in now.
// Normally that's where the map put it, at its own size. A lit island grows a little and the rest shrink a little. A
// bridge rises between the islands it joins and grows into the main thing on screen; the islands it joins are drawn in
// against its shore at a medium size; everything else shrinks, moves aside, greys, dims, and simplifies to its color
// and name. The places come from a small relaxation solved once per change (circles that push each other apart, kept
// inside the map, the others pulled toward home); the engine then springs the islands there.
import { clamp } from "./paint"

export interface FocusIsland {
	id: string
	/** Its place on the map and radius, in world units. */
	cx: number
	cy: number
	r: number
	/** The islands it joins, when it's a bridge. */
	joins?: readonly string[]
}

export interface FocusInput {
	/** The map's size in world units. */
	w: number
	h: number
	/** The islands shown, the bridge (rising, not sinking) among them. */
	islands: FocusIsland[]
	/** Lit islands (picked, or being combined while their bridge loads). */
	lit: readonly string[]
	/** How tall the bridge's name is above its shore, in world units. */
	bridgeHead: number
}

export interface FocusLayout {
	looks: Map<string, IslandLook>
	roles: Map<string, FocusRole>
	/** Bounds of the layout in world units, when anything is in focus (the overview frames all of it). */
	box: { x0: number; y0: number; x1: number; y1: number } | null
}

interface Body {
	id: string
	role: FocusRole
	x: number
	y: number
	hx: number
	hy: number
	r: number
	/** Heavier ones move less when two push each other. */
	w: number
	/** How strongly it's pulled back to its own place each step. */
	home: number
	phantom?: boolean
}

const FIXED = 1e9

export function layOutFocus(input: FocusInput): FocusLayout {
	const { w: WW, h: HH } = input
	const S = Math.min(WW, HH)
	const m = S * 0.02
	const gap = S * 0.022
	const bridge = input.islands.find((i) => i.joins)
	const joined = new Set(bridge?.joins ?? [])
	const lit = new Set(input.lit.filter((id) => id !== bridge?.id))
	const looks = new Map<string, IslandLook>()
	const roles = new Map<string, FocusRole>()
	const rB = bridge ? S * 0.33 : 0
	const bodies: Body[] = []
	let B: Body | null = null
	for (const island of input.islands) {
		let role: FocusRole = "none"
		if (island === bridge) role = "bridge"
		else if (joined.has(island.id)) role = "joined"
		else if (lit.has(island.id)) role = "lit"
		else if (bridge || lit.size) role = "other"
		roles.set(island.id, role)
		const r0 = island.r
		let scale = 1
		let mute = 0
		let vivid = 0
		let glow = 0
		if (role === "bridge") {
			scale = rB / r0
			vivid = 1
		} else if (role === "joined") {
			// Medium: big islands come down, small ones come up, next to a bridge that stays the biggest.
			scale = clamp(r0, rB * 0.42, rB * 0.62) / r0
			vivid = 1
			glow = 0.45
		} else if (role === "lit") {
			scale = bridge ? Math.min(0.95, (rB * 0.6) / r0) : 1.14
			vivid = bridge ? 0.8 : 1
			glow = 1
		} else if (role === "other") {
			scale = bridge ? 0.5 : 0.93
			mute = bridge ? 1 : 0.2
		}
		looks.set(island.id, { dx: 0, dy: 0, scale, mute, vivid, lit: glow })
		const b: Body = {
			id: island.id,
			role,
			x: island.cx,
			y: island.cy,
			hx: island.cx,
			hy: island.cy,
			r: r0 * scale * 1.08,
			w:
				role === "bridge" ? FIXED : role === "joined" || role === "lit" ? 4 : 1,
			home: role === "other" ? 0.05 : role === "lit" && bridge ? 0.03 : 0,
		}
		if (role === "bridge") {
			// Between the islands it joins, a little toward the middle of the map (they're drawn in after it), so it's
			// the main thing on screen wherever they are; kept whole inside the map, with room above it for its name.
			const at = {
				x: island.cx + (WW / 2 - island.cx) * 0.35,
				y: island.cy + (HH / 2 - island.cy) * 0.35,
			}
			b.x = clamp(at.x, b.r + m, WW - b.r - m)
			b.y = clamp(
				at.y,
				b.r + m + Math.min(input.bridgeHead, S * 0.14),
				HH - b.r - m,
			)
			if (WW < 2 * (b.r + m)) b.x = WW / 2
			if (HH < 2 * (b.r + m)) b.y = HH / 2
			B = b
		}
		// A lit island (no bridge) stays where it is, unless its name would have no room above it.
		if (role === "lit" && !bridge) {
			b.w = 1e6
			b.y = Math.max(b.y, Math.min(HH / 2, b.r + m + S * 0.075))
		}
		bodies.push(b)
	}
	const anyFocus = bodies.some((b) => b.role !== "none")
	const Bb = B as Body | null
	const hugDistance = (b: Body) => (Bb ? Bb.r + b.r + gap * 1.6 : 0)
	if (Bb) {
		// Start: the islands the bridge joins against its shore, facing where they were; the rest out of its way.
		for (const b of bodies) {
			if (b === Bb) continue
			let vx = b.x - Bb.x
			let vy = b.y - Bb.y
			let d = Math.hypot(vx, vy)
			if (d < 1e-3) {
				vx = 1
				vy = 0
				d = 1
			}
			if (b.role === "joined") {
				b.x = Bb.x + (vx / d) * hugDistance(b)
				b.y = Bb.y + (vy / d) * hugDistance(b)
			} else if (d < Bb.r + b.r + gap) {
				b.x = Bb.x + (vx / d) * (Bb.r + b.r + gap)
				b.y = Bb.y + (vy / d) * (Bb.r + b.r + gap)
			}
		}
		// Its name is kept clear: fixed circles along the top of its shore, where the name goes.
		for (const f of [-0.6, -0.2, 0.2, 0.6]) {
			const r = input.bridgeHead * 0.55
			bodies.push({
				id: Bb.id,
				role: "bridge",
				x: Bb.x + f * Bb.r,
				y: Bb.y - Bb.r - r,
				hx: 0,
				hy: 0,
				r,
				w: FIXED,
				home: 0,
				phantom: true,
			})
		}
	}
	const separate = () => {
		for (let i = 0; i < bodies.length; i++)
			for (let j = i + 1; j < bodies.length; j++) {
				const a = bodies[i]
				const c = bodies[j]
				// Two fixed ones (the bridge and the room for its name) never move.
				if (a.w >= FIXED && c.w >= FIXED) continue
				const want = a.r + c.r + gap
				let vx = c.x - a.x
				let vy = c.y - a.y
				let d = Math.hypot(vx, vy)
				if (d >= want) continue
				if (d < 1e-3) {
					vx = Math.cos(i * 2.4 + j)
					vy = Math.sin(i * 2.4 + j)
					d = 1
				}
				const o = want - d
				if ((a.phantom || c.phantom) && Bb) {
					// The room for the bridge's name pushes out from the bridge's middle, as the bridge does, so nothing
					// gets caught between the two; an island the bridge joins slides around its shore instead.
					const q = a.phantom ? c : a
					const p = a.phantom ? a : c
					const ux = q.x - Bb.x
					const uy = q.y - Bb.y
					const ul = Math.hypot(ux, uy) || 1
					if (q.role === "joined") {
						let tx = -uy / ul
						let ty = ux / ul
						if ((q.x - p.x) * tx + (q.y - p.y) * ty < 0) {
							tx = -tx
							ty = -ty
						}
						q.x += tx * o
						q.y += ty * o
					} else {
						q.x += (ux / ul) * o
						q.y += (uy / ul) * o
					}
					continue
				}
				const wa = c.w / (a.w + c.w)
				const wc = a.w / (a.w + c.w)
				a.x -= (vx / d) * o * wa
				a.y -= (vy / d) * o * wa
				c.x += (vx / d) * o * wc
				c.y += (vy / d) * o * wc
			}
	}
	const hug = () => {
		if (!Bb) return
		for (const b of bodies) {
			if (b.role !== "joined") continue
			const vx = b.x - Bb.x
			const vy = b.y - Bb.y
			const d = Math.hypot(vx, vy) || 1
			b.x = Bb.x + (vx / d) * hugDistance(b)
			b.y = Bb.y + (vy / d) * hugDistance(b)
		}
	}
	if (anyFocus) {
		for (let it = 0; it < 260; it++) {
			for (const b of bodies)
				if (b.home) {
					b.x += (b.hx - b.x) * b.home
					b.y += (b.hy - b.y) * b.home
				}
			hug()
			separate()
			for (const b of bodies) {
				if (b.w >= FIXED) continue
				// Islands in focus wear their names above them: room for that at the top.
				const head = b.role === "joined" || b.role === "lit" ? S * 0.075 : 0
				b.x = WW > 2 * (b.r + m) ? clamp(b.x, b.r + m, WW - b.r - m) : WW / 2
				b.y =
					HH > 2 * (b.r + m) + head
						? clamp(b.y, b.r + m + head, HH - b.r - m)
						: HH / 2
			}
		}
		// Whatever the map's edges couldn't hold: no overlaps, even if a little spills over (the camera frames it).
		for (let it = 0; it < 80; it++) {
			hug()
			separate()
		}
	}
	let box = { x0: 0, y0: 0, x1: WW, y1: HH }
	const home = new Map(input.islands.map((i) => [i.id, i]))
	for (const b of bodies) {
		if (b.phantom) continue
		const look = looks.get(b.id) as IslandLook
		const island = home.get(b.id) as FocusIsland
		look.dx = b.x - island.cx
		look.dy = b.y - island.cy
		const rr = b.r * 1.04
		box = {
			x0: Math.min(box.x0, b.x - rr),
			y0: Math.min(box.y0, b.y - rr),
			x1: Math.max(box.x1, b.x + rr),
			y1: Math.max(box.y1, b.y + rr),
		}
	}
	return { looks, roles, box: anyFocus ? box : null }
}
