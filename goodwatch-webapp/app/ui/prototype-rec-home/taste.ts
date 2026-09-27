// PROTOTYPE - throwaway. The taste math for /prototype/rec-home (#178), shared by the loader and the page.
// A stand-in for the stored per-member taste vector from #174: z-scored fingerprints, a vector from the
// person's signals (scores, Want to See, this-or-that choices, Not interested), cosine per title, and the
// match shown as 50 + 0.49 x percentile. Guests run it in the browser after every choice; the loader runs it
// for the `new` demo member and for the "why" lines. No imports from server code.
import { phrase } from "~/ui/prototype-rec-taste/engine"
import { CRAFT_KEYS } from "~/ui/prototype-rec-taste/model"

// Fingerprints travel as one character per attribute: "0".."10" as char codes 48..58.
export const encodeFp = (fp: Record<string, number> | null | undefined, keys: readonly string[]) => (fp ? keys.map((k) => String.fromCharCode(48 + Math.max(0, Math.min(10, Math.round(fp[k] ?? 0))))).join("") : "")
const decode = (s: string) => Array.from(s, (c) => c.charCodeAt(0) - 48)

export type Space = { keys: readonly string[]; z: Map<string, number[]>; all: string[] }

// The space is built over the titles given; z-scores make rare attributes count as much as common ones.
export function makeSpace(fps: Record<string, string>, keys: readonly string[]): Space {
	const entries = Object.entries(fps).filter(([, s]) => s.length === keys.length)
	const n = keys.length
	const mean = new Array(n).fill(0)
	const sd = new Array(n).fill(0)
	const raw = entries.map(([k, s]) => [k, decode(s)] as const)
	for (const [, v] of raw) for (let i = 0; i < n; i++) mean[i] += v[i] / raw.length
	for (const [, v] of raw) for (let i = 0; i < n; i++) sd[i] += (v[i] - mean[i]) ** 2 / raw.length
	for (let i = 0; i < n; i++) sd[i] = Math.sqrt(sd[i]) || 1
	const z = new Map(raw.map(([k, v]) => [k, v.map((x, i) => (x - mean[i]) / sd[i])]))
	return { keys, z, all: raw.map(([k]) => k) }
}

// Signal weights: a score of 10 is +1, a 1 is -1; Want to See pulls a little; Not interested pushes a little.
export const W = { want: 0.35, no: -0.35, picked: 1, passed: -0.3 }
export const scoreWeight = (s: number) => (s - 5.5) / 4.5

export function vector(space: Space, sig: Record<string, number>) {
	const v = new Array(space.keys.length).fill(0)
	let total = 0
	for (const [k, w] of Object.entries(sig)) {
		const z = space.z.get(k)
		if (!z || !w) continue
		total += Math.abs(w)
		for (let i = 0; i < v.length; i++) v[i] += w * z[i]
	}
	return total ? v.map((x) => x / total) : null
}

const cos = (a: number[], b: number[]) => {
	let d = 0
	let na = 0
	let nb = 0
	for (let i = 0; i < a.length; i++) {
		d += a[i] * b[i]
		na += a[i] * a[i]
		nb += b[i] * b[i]
	}
	return na && nb ? d / Math.sqrt(na * nb) : 0
}

// Match for every title in the space: its percentile among all of them, shown as 50..99.
export function matches(space: Space, v: number[] | null): Map<string, number> {
	if (!v) return new Map()
	const sims = space.all.map((k) => ({ k, s: cos(space.z.get(k)!, v) })).sort((a, b) => a.s - b.s)
	const n = Math.max(1, sims.length - 1)
	return new Map(sims.map((x, i) => [x.k, Math.round(50 + (49 * i) / n)]))
}

// The attributes that pull a title toward the person, as readable phrases; craft attributes say little.
export function why(space: Space, v: number[] | null, key: string, n = 2): string[] {
	const z = space.z.get(key)
	if (!v || !z) return []
	return space.keys
		.map((k, i) => ({ k, pull: z[i] * v[i], zi: z[i] }))
		.filter((r) => r.zi > 0.5 && r.pull > 0 && !CRAFT_KEYS.has(r.k))
		.sort((a, b) => b.pull - a.pull)
		.slice(0, n)
		.map((r) => phrase(r.k))
}

// What the person goes for, strongest first.
export function leanings(space: Space, v: number[] | null, n = 3): string[] {
	if (!v) return []
	return space.keys
		.map((k, i) => ({ k, w: v[i] }))
		.filter((r) => !CRAFT_KEYS.has(r.k) && r.w > 0)
		.sort((a, b) => b.w - a.w)
		.slice(0, n)
		.map((r) => phrase(r.k))
}

export const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : (xs[0] ?? ""))
