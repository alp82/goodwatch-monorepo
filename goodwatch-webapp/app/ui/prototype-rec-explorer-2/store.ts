// PROTOTYPE - throwaway. The titles loaded so far, as flat typed arrays the renderer walks without allocating.
// Grows as the server streams more in; nothing is ever the whole catalog.
import type { W } from "./wire"

const TMDB = "https://image.tmdb.org/t/p"
export const SIZES = ["w92", "w154", "w342"] as const

export type Img = { el: HTMLImageElement; ok: boolean; failed: boolean }
export type Item = W & { urls: string[]; im: (Img | null)[] }

export const GRID = 96 // world units per spatial-index cell

export class Store {
	n = 0
	cap = 0
	items: Item[] = []
	index = new Map<string, number>()
	x = new Float32Array(0)
	y = new Float32Array(0)
	level = new Uint8Array(0)
	born = new Float32Array(0)
	/** 1 = passes the filters, 2 = hidden by an action on this page */
	flags = new Uint8Array(0)
	order = new Int32Array(0) // draw order: finer levels first, best match last (on top)
	grid = new Map<number, number[]>()
	version = 0
	private orderDirty = false
	private gridDirty = false

	private grow(min: number) {
		if (min <= this.cap) return
		const cap = Math.max(256, min, this.cap * 2)
		const f = (a: Float32Array) => {
			const b = new Float32Array(cap)
			b.set(a)
			return b
		}
		const u = (a: Uint8Array) => {
			const b = new Uint8Array(cap)
			b.set(a)
			return b
		}
		this.x = f(this.x)
		this.y = f(this.y)
		this.born = f(this.born)
		this.level = u(this.level)
		this.flags = u(this.flags)
		this.cap = cap
	}

	/** Adds or updates titles; returns the indices. Position comes from the wire unless given. */
	add(
		ws: W[],
		now: number,
		place?: (w: W, j: number) => { x: number; y: number },
	) {
		this.grow(this.n + ws.length)
		const out: number[] = []
		ws.forEach((w, j) => {
			let i = this.index.get(w.k)
			const p = place ? place(w, j) : { x: w.x ?? 0, y: w.y ?? 0 }
			if (i == null) {
				i = this.n++
				const urls = w.p ? SIZES.map((s) => `${TMDB}/${s}${w.p}`) : []
				this.items[i] = { ...w, urls, im: [null, null, null] }
				this.index.set(w.k, i)
				this.born[i] = now
				this.x[i] = p.x
				this.y[i] = p.y
			} else {
				// Refreshed from the server (e.g. filters changed): keep the images, take the new level.
				const it = this.items[i]
				Object.assign(it, w, { urls: it.urls, im: it.im })
				if (place == null && w.x != null) {
					this.x[i] = w.x
					this.y[i] = w.y ?? 0
				}
			}
			this.level[i] = w.l ?? 0
			this.flags[i] = (this.flags[i] & 2) | 1
			out.push(i)
		})
		this.orderDirty = true
		this.gridDirty = true
		this.version++
		return out
	}

	move(i: number, x: number, y: number) {
		this.x[i] = x
		this.y[i] = y
		this.gridDirty = true
		this.version++
	}

	clear() {
		this.n = 0
		this.items = []
		this.index.clear()
		this.grid.clear()
		this.order = new Int32Array(0)
		this.version++
	}

	/** Recompute which titles pass "On my services" and "Not seen yet". */
	filter(pass: (it: Item) => boolean) {
		for (let i = 0; i < this.n; i++)
			this.flags[i] = (this.flags[i] & 2) | (pass(this.items[i]) ? 1 : 0)
		this.version++
	}
	hide(i: number, on = true) {
		this.flags[i] = on ? this.flags[i] | 2 : this.flags[i] & ~2
		this.version++
	}
	shown = (i: number) => this.flags[i] === 1

	prepare() {
		if (this.orderDirty) {
			const o = new Int32Array(this.n)
			for (let i = 0; i < this.n; i++) o[i] = i
			o.sort(
				(a, b) =>
					this.level[b] - this.level[a] || this.items[a].m - this.items[b].m,
			)
			this.order = o
			this.orderDirty = false
		}
		if (this.gridDirty) {
			this.grid.clear()
			for (let i = 0; i < this.n; i++) {
				const key =
					Math.floor(this.x[i] / GRID) * 65536 + Math.floor(this.y[i] / GRID)
				const l = this.grid.get(key)
				if (l) l.push(i)
				else this.grid.set(key, [i])
			}
			this.gridDirty = false
		}
	}

	/** Titles within r world units of a point. */
	near(x: number, y: number, r: number) {
		this.prepare()
		const out: number[] = []
		for (
			let gx = Math.floor((x - r) / GRID);
			gx <= Math.floor((x + r) / GRID);
			gx++
		)
			for (
				let gy = Math.floor((y - r) / GRID);
				gy <= Math.floor((y + r) / GRID);
				gy++
			)
				for (const i of this.grid.get(gx * 65536 + gy) ?? [])
					if (Math.hypot(this.x[i] - x, this.y[i] - y) <= r) out.push(i)
		return out
	}
}
