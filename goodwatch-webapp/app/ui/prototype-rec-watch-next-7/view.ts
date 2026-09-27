// PROTOTYPE - throwaway. The selection for /prototype/rec-watch-next-7 (#176, round 7): up to three moods,
// "on my services" (on by default), and a sort view. Nothing here ever writes the saved order: "My order"
// is the order the person set, and every other sort is a temporary view over it.
import { type WTitle, onMine } from "~/ui/prototype-rec-watch-next-2/model"
import type { Queue } from "~/ui/prototype-rec-watch-next-3/model"
import type { Tier } from "~/ui/prototype-rec-watch-next-4/kit4"
import type { View } from "~/ui/prototype-rec-watch-next-4/select"
import { MAX_MOODS, MOOD, type MoodKey, MOODS } from "./moods"

export type Extra = { m: MoodKey[]; rel: number | null }
export type X = Record<string, Extra>

export type SortKey7 = "mine" | "match" | "score" | "waiting" | "newest" | "popular"
export type Sel7 = { moods: MoodKey[]; everywhere: boolean; by: SortKey7 }
export const START: Sel7 = { moods: [], everywhere: false, by: "mine" }

// Every order is backed by a stored field (see the round-7 report for coverage on the owner's Wishlist).
export const SORTS: { key: SortKey7; label: string; line: string }[] = [
	{ key: "mine", label: "My order", line: "The order you set. It is the only one that is saved." },
	{ key: "match", label: "Best match", line: "Closest to your taste, from your scores and the title analysis." },
	{ key: "score", label: "Top rated", line: "Highest GoodWatch score first." },
	{ key: "waiting", label: "Waiting longest", line: "The titles you added to your Wishlist earliest." },
	{ key: "newest", label: "Newest release", line: "Latest films, and shows with the newest episodes." },
	{ key: "popular", label: "Popular now", line: "What most people are watching right now, from TMDB." },
]
export const SORT = Object.fromEntries(SORTS.map((s) => [s.key, s])) as Record<SortKey7, (typeof SORTS)[number]>

// Toggle a mood. The fourth is refused: the caller shows why.
export function toggleMood(sel: Sel7, m: MoodKey): { sel: Sel7; blocked: boolean } {
	if (sel.moods.includes(m)) return { sel: { ...sel, moods: sel.moods.filter((x) => x !== m) }, blocked: false }
	if (sel.moods.length >= MAX_MOODS) return { sel, blocked: true }
	return { sel: { ...sel, moods: [...sel.moods, m] }, blocked: false }
}

// A sorted copy of the saved order. Titles missing the field go last; ties keep the saved order.
export function sortedView(q: Queue, x: X, by: SortKey7): string[] {
	if (by === "mine") return q.order
	const val = (k: string): number | null => {
		const t = q.T(k)
		if (!t) return null
		if (by === "match") return t.match
		if (by === "score") return t.score
		if (by === "waiting") return -q.addedAt(k)
		// A release date still ahead means not out yet: it sorts with the undated titles, after everything out.
		if (by === "newest") return (x[k]?.rel ?? 0) > q.now ? null : (x[k]?.rel ?? null)
		return t.popularity || null
	}
	const idx = new Map(q.order.map((k, i) => [k, i]))
	const v = new Map(q.order.map((k) => [k, val(k)]))
	return [...q.order].sort((a, b) => {
		const va = v.get(a)
		const vb = v.get(b)
		if (va == null || vb == null) return va == null && vb == null ? idx.get(a)! - idx.get(b)! : va == null ? 1 : -1
		return vb - va || idx.get(a)! - idx.get(b)!
	})
}

export const hits = (x: X, k: string, moods: MoodKey[]) => (moods.length ? moods.filter((m) => x[k]?.m.includes(m)).length : 0)

// A title fits a mood selection when it is in at least one picked mood. Within what fits, the order is the
// saved order or the sort view, so a view means the same with or without moods.
// "On my services" is one more thing to fit. Soft, as in rounds 4 to 6: misses stay, further down.
export function apply7(q: Queue, x: X, sel: Sel7, passed: string[] = [], pin: string | null = null): View & { hit: Map<string, number> } {
	const base = sortedView(q, x, sel.by)
	const need = (sel.moods.length ? 1 : 0) + (sel.everywhere ? 0 : 1)
	const fit = new Map<string, number>()
	const hit = new Map<string, number>()
	for (const k of base) {
		const t = q.T(k)
		const h = hits(x, k, sel.moods)
		hit.set(k, h)
		fit.set(k, (sel.moods.length && h > 0 ? 1 : 0) + (!sel.everywhere && t && onMine(t) ? 1 : 0))
	}
	const idx = new Map(base.map((k, i) => [k, i]))
	let keys = [...base].sort((a, b) => fit.get(b)! - fit.get(a)! || idx.get(a)! - idx.get(b)!)
	if (passed.length) keys = [...keys.filter((k) => !passed.includes(k)), ...passed.filter((k) => keys.includes(k))]
	if (pin && keys.includes(pin)) keys = [pin, ...keys.filter((k) => k !== pin)]
	return { keys, fit, need, hidden: 0, hit }
}

export const fitCount = (v: View) => (v.need ? v.keys.filter((k) => v.fit.get(k) === v.need).length : v.keys.length)

// Per mood, with the services setting and sort as they are: how many Wishlist titles are in it, and a
// title for its picture (the first of them, or a popular title in that mood when the Wishlist has none).
export type Per = Record<MoodKey, { n: number; art?: WTitle }>
export function perMood(q: Queue, x: X, sel: Sel7, pool: string[]): Per {
	const base = sortedView(q, x, sel.by)
	const out = {} as Per
	// Each mood gets a picture no other mood already uses, so the options don't look alike.
	const used = new Set<string>()
	for (const m of MOODS) {
		const ks = base.filter((k) => x[k]?.m.includes(m.key) && (sel.everywhere || onMine(q.T(k)!)))
		const cands = [...ks, ...pool.filter((k) => x[k]?.m.includes(m.key))].map(q.T).filter((t) => t?.backdrop)
		const art = cands.find((t) => !used.has(t!.key)) ?? cands[0]
		if (art) used.add(art.key)
		out[m.key] = { n: ks.length, art }
	}
	return out
}

export const moodWords = (ms: MoodKey[]) => {
	const names = ms.map((m) => MOOD[m].name)
	return names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`
}

// The stepped grid under the hero, labelled for what is picked. The hero takes the first title.
export function tiers7(v: View & { hit: Map<string, number> }, sel: Sel7): Tier[] {
	const rest = v.keys.slice(1)
	if (!v.need)
		return [
			{ key: "up", label: "Up next", size: "xl", keys: rest.slice(0, 4) },
			{ key: "soon", label: "Soon", size: "lg", keys: rest.slice(4, 12) },
			{ key: "later", label: "Later", size: "md", keys: rest.slice(12, 32) },
			{ key: "someday", label: "Someday", size: "sm", keys: rest.slice(32) },
		]
	const all = rest.filter((k) => v.fit.get(k) === v.need)
	const miss = rest.filter((k) => v.fit.get(k) !== v.need)
	const mood = sel.moods.length > 0
	const svc = !sel.everywhere
	const close = rest.filter((k) => v.fit.get(k) === v.need - 1)
	const other = miss.filter((k) => !close.includes(k))
	const closeNote = mood && svc ? "In one of these but not on your services, or on them but in another mood." : mood ? "In another mood." : "Not on your services."
	return [
		{ key: "fits", label: "Up next", size: "xl", keys: all.slice(0, 4) },
		{ key: "fits2", label: "Soon", size: "lg", keys: all.slice(4, 16) },
		{ key: "fits3", label: "Later", size: "md", keys: all.slice(16) },
		{ key: "close", label: mood && svc ? "Close" : mood ? "Other moods" : "Elsewhere", note: closeNote, size: "md", keys: close },
		{ key: "rest", label: "Not tonight", note: "Another mood and not on your services.", size: "sm", keys: other },
	]
}
