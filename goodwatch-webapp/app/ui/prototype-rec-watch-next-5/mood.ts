// PROTOTYPE - throwaway. Mood as a continuous choice for /prototype/rec-watch-next-5 (#176, round 5).
// Every title gets a point on two axes, light to dark and calm to intense, from its mood flags plus a
// nudge from its genres. A control picks any point in that space (a slider walks a path through the five
// named moods; the pad picks freely). A title "fits the mood" when it sits near the point. Filters are
// soft, as in round 4's dial: titles that meet more of them come first; the saved order breaks ties.
import type { Mood, WTitle } from "~/ui/prototype-rec-watch-next-2/model"
import type { Queue } from "~/ui/prototype-rec-watch-next-3/model"
import { ORDERS, type Sel, type View, tests } from "~/ui/prototype-rec-watch-next-4/select"

export type P = { x: number; y: number }

// x: -1 light .. +1 dark. y: -1 calm .. +1 intense.
export const ANCHOR: Record<Mood, P> = {
	comfort: { x: -0.75, y: -0.55 },
	light: { x: -0.55, y: 0.15 },
	escape: { x: -0.05, y: 0.7 },
	binge: { x: 0.5, y: 0.55 },
	thoughtful: { x: 0.72, y: -0.45 },
}
// The path a one-dimensional control walks, from cosy to heavy.
export const PATH: Mood[] = ["comfort", "light", "escape", "binge", "thoughtful"]
export const NAME: Record<Mood, string> = { comfort: "Comfort", light: "Easygoing", escape: "Escape", binge: "Bingeable", thoughtful: "Thought-provoking" }
export const LONG: Record<Mood, string> = { comfort: "Comfort watch", light: "Easy to drop into", escape: "Pure escape", binge: "Bingeable", thoughtful: "Thought-provoking" }
// One colour per mood, used for tracks, swatches, and the pad.
export const HUE: Record<Mood, string> = { comfort: "#f5a524", light: "#f472b6", escape: "#22d3ee", binge: "#8b5cf6", thoughtful: "#3b5bdb" }
export const TRACK = `linear-gradient(90deg, ${PATH.map((m, i) => `${HUE[m]} ${i * 25}%`).join(", ")})`

const DARK = ["Horror", "Thriller", "Crime", "War", "Mystery", "War & Politics"]
const LIGHT = ["Comedy", "Family", "Animation", "Romance", "Music", "Kids"]
const INTENSE = ["Action", "Adventure", "Horror", "Thriller", "Science Fiction", "Action & Adventure", "Sci-Fi & Fantasy"]
const CALM = ["Documentary", "Romance", "Drama", "History"]
const clamp = (n: number) => Math.max(-1, Math.min(1, n))
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 11)

const cache = new Map<string, P>()
export function coord(t: WTitle): P {
	const hit = cache.get(t.key)
	if (hit) return hit
	let x = 0
	let y = 0
	if (t.moods.length) {
		for (const m of t.moods) {
			x += ANCHOR[m].x
			y += ANCHOR[m].y
		}
		x /= t.moods.length
		y /= t.moods.length
	}
	const g = t.genres
	if (g.some((n) => DARK.includes(n))) x += 0.25
	if (g.some((n) => LIGHT.includes(n))) x -= 0.25
	if (g.some((n) => INTENSE.includes(n))) y += 0.2
	if (g.some((n) => CALM.includes(n))) y -= 0.15
	// A small stable jitter so titles with the same flags don't stack on one spot.
	const h = hash(t.key)
	const p = { x: clamp(x + ((h % 17) - 8) / 60), y: clamp(y + (((h >> 5) % 17) - 8) / 60) }
	cache.set(t.key, p)
	return p
}

export const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y)
export const RADIUS = 0.5

// 0..1 along the path to a point in the space.
export function along(s: number): P {
	const f = Math.max(0, Math.min(1, s)) * (PATH.length - 1)
	const i = Math.min(PATH.length - 2, Math.floor(f))
	const a = ANCHOR[PATH[i]]
	const b = ANCHOR[PATH[i + 1]]
	const k = f - i
	return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
}

// The colour at 0..1 along the path, for thumbs and knobs.
export function hueAt(s: number) {
	const f = Math.max(0, Math.min(1, s)) * (PATH.length - 1)
	const i = Math.min(PATH.length - 2, Math.floor(f))
	const mix = (a: string, b: string, k: number) => {
		const pa = [1, 3, 5].map((j) => Number.parseInt(a.slice(j, j + 2), 16))
		const pb = [1, 3, 5].map((j) => Number.parseInt(b.slice(j, j + 2), 16))
		return `rgb(${pa.map((v, j) => Math.round(v + (pb[j] - v) * k)).join(",")})`
	}
	return mix(HUE[PATH[i]], HUE[PATH[i + 1]], f - i)
}

// The colour for a free point: the two nearest moods, blended by distance.
export function hueFor(p: P) {
	const [a, b] = ranked(p)
	const k = a.d / (a.d + b.d || 1)
	const s = (PATH.indexOf(a.m) + (PATH.indexOf(b.m) - PATH.indexOf(a.m)) * k) / (PATH.length - 1)
	return hueAt(s)
}

const ranked = (p: P) =>
	(Object.keys(ANCHOR) as Mood[])
		.map((m) => ({ m, d: dist(p, ANCHOR[m]) }))
		.sort((a, b) => a.d - b.d)

export const nearest = (p: P): Mood => ranked(p)[0].m

// "Comfort watch" near an anchor, "Comfort, leaning escape" between two.
export function label(p: P | null) {
	if (!p) return "Any mood"
	const [a, b] = ranked(p)
	if (a.d < 0.16 || b.d - a.d > 0.3) return LONG[a.m]
	return `${NAME[a.m]}, leaning ${NAME[b.m].toLowerCase()}`
}

// The same, split for two-line labels: "Comfort" over "leaning escape".
export function labelParts(p: P | null): { main: string; lean: string | null } {
	if (!p) return { main: "Any mood", lean: null }
	const [a, b] = ranked(p)
	if (a.d < 0.16 || b.d - a.d > 0.3) return { main: LONG[a.m], lean: null }
	return { main: NAME[a.m], lean: `leaning ${NAME[b.m].toLowerCase()}` }
}

// Mood "tests" for the fit tiers: round 4's filters, with the named mood replaced by closeness to the point.
export function tests5(sel: Sel, p: P | null) {
	const out = tests(sel).filter((x) => x.key !== "mood")
	if (p) out.push({ key: "mood", label: label(p).toLowerCase(), ok: (t: WTitle) => dist(coord(t), p) <= RADIUS })
	return out
}

export function apply5(q: Queue, sel: Sel, p: P | null, passed: string[] = [], pin: string | null = null): View {
	const ts = tests5(sel, p)
	const ordered = sel.by === "mine" ? q.order : q.sorted(sel.by)
	const fit = new Map<string, number>()
	for (const k of ordered) {
		const t = q.T(k)
		fit.set(k, t ? ts.filter((x) => x.ok(t)).length : 0)
	}
	let keys = [...ordered].sort((a, b) => fit.get(b)! - fit.get(a)!)
	if (passed.length) keys = [...keys.filter((k) => !passed.includes(k)), ...passed.filter((k) => keys.includes(k))]
	if (pin && keys.includes(pin)) keys = [pin, ...keys.filter((k) => k !== pin)]
	return { keys, fit, need: ts.length, hidden: 0 }
}

// How many Wishlist titles fit everything, for live counts next to a control.
export const fitting = (v: View) => (v.need ? v.keys.filter((k) => v.fit.get(k) === v.need).length : v.keys.length)

// The best suggestion outside the Wishlist for an empty queue.
export function suggest5(q: Queue, sel: Sel, p: P | null) {
	const ts = tests5(sel, p)
	return q.suggest.forYou(80).find((t) => ts.every((x) => x.ok(t))) ?? q.suggest.forYou(1)[0]
}

// A plain phrase for the selection: "comfort, leaning escape, short, on your services, shortest first".
export function describe5(sel: Sel, p: P | null, name?: string) {
	const bits = [p ? (name ?? label(p)).toLowerCase() : null, sel.length !== "any" ? sel.length : null, sel.kind !== "all" ? (sel.kind === "movie" ? "films" : "shows") : null, sel.services ? "on your services" : null].filter(Boolean)
	const order = ORDERS.find((o) => o.key === sel.by)!
	if (!bits.length) return sel.by === "mine" ? "your saved order" : order.short
	return `${bits.join(", ")}${sel.by === "mine" ? "" : `, ${order.short}`}`
}

export const isPlain = (sel: Sel, p: P | null) => !p && sel.by === "mine" && !sel.services && sel.length === "any" && sel.kind === "all" && !sel.genre
