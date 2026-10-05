// PROTOTYPE - throwaway. The selection for /prototype/rec-watch-next-8 (#176, round 8, the decided model):
// up to three moods, "On my services" (on by default), and one sort. There is no manual order: the Wishlist
// is a set of Want to See titles, and "Watch next" is simply its top under the chosen sort and moods.
// Every sort reads a stored, populated field (coverage from round 7's audit over the owner's 349 titles).
import { type WTitle, ageLabel, onMine } from "~/ui/prototype-rec-watch-next-2/model"
import type { Queue } from "~/ui/prototype-rec-watch-next-3/model"
import type { View } from "~/ui/prototype-rec-watch-next-4/select"
import { MOODS, type MoodKey } from "~/ui/prototype-rec-watch-next-7/moods"
import { type Per, type X, hits, moodWords } from "~/ui/prototype-rec-watch-next-7/view"

export type SortKey8 = "match" | "waiting" | "added" | "newest" | "score" | "popular"
export type Sel8 = { moods: MoodKey[]; everywhere: boolean; by: SortKey8 }
// Best match is the default.
export const START8: Sel8 = { moods: [], everywhere: false, by: "match" }

export const SORTS8: { key: SortKey8; label: string; line: string; short: string }[] = [
	{ key: "match", label: "Best match", short: "Best match", line: "Closest to your taste, from your scores and the title analysis." },
	{ key: "waiting", label: "Waiting longest", short: "Waiting longest", line: "The titles that have been on your Wishlist the longest." },
	{ key: "added", label: "Last added", short: "Last added", line: "The titles you added most recently." },
	{ key: "newest", label: "Newest release", short: "Newest", line: "Latest films, and shows with the newest episodes." },
	{ key: "score", label: "Top rated", short: "Top rated", line: "Highest GoodWatch score first." },
	{ key: "popular", label: "Popular now", short: "Popular", line: "What most people are watching right now, from TMDB." },
]
export const SORT8 = Object.fromEntries(SORTS8.map((s) => [s.key, s])) as Record<SortKey8, (typeof SORTS8)[number]>

// The Wishlist sorted by one field. Titles missing it go last; ties fall back to the most recently added.
export function sorted8(q: Queue, x: X, by: SortKey8): string[] {
	const val = (k: string): number | null => {
		const t = q.T(k)
		if (!t) return null
		if (by === "match") return t.match
		if (by === "score") return t.score
		if (by === "waiting") return -q.addedAt(k)
		if (by === "added") return q.addedAt(k)
		// A release date still ahead means not out yet: it sorts with the undated titles, after everything out.
		if (by === "newest") return (x[k]?.rel ?? 0) > q.now ? null : (x[k]?.rel ?? null)
		return t.popularity || null
	}
	const v = new Map(q.order.map((k) => [k, val(k)]))
	const tie = (a: string, b: string) => q.addedAt(b) - q.addedAt(a) || (a < b ? -1 : 1)
	return [...q.order].sort((a, b) => {
		const va = v.get(a)
		const vb = v.get(b)
		if (va == null || vb == null) return va == null && vb == null ? tie(a, b) : va == null ? 1 : -1
		return vb - va || tie(a, b)
	})
}

// Titles in at least one picked mood, and on your services, come first; misses follow, further down.
export function apply8(q: Queue, x: X, sel: Sel8, passed: string[] = []): View & { hit: Map<string, number> } {
	const base = sorted8(q, x, sel.by)
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
	return { keys, fit, need, hidden: 0, hit }
}

// Per mood: how many Wishlist titles are in it (with the services setting), and a picture for it.
export function perMood8(q: Queue, x: X, sel: Sel8, pool: string[]): Per {
	const base = sorted8(q, x, "match")
	const out = {} as Per
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

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })

// The hero's line: what the pick is under this sort and these moods.
export function heroLabel(sel: Sel8, fitsAll: boolean) {
	if (!fitsAll) return sel.moods.length ? "Closest to your moods" : "Nothing on your services; closest"
	const m = sel.moods.length ? moodWords(sel.moods) : ""
	switch (sel.by) {
		case "match":
			return m ? `Best match for ${m} tonight` : "Best match for you tonight"
		case "waiting":
			return m ? `Waiting longest in ${m}` : "Waiting longest on your Wishlist"
		case "added":
			return m ? `Last added in ${m}` : "Last added to your Wishlist"
		case "newest":
			return m ? `Newest release in ${m}` : "Newest release on your Wishlist"
		case "score":
			return m ? `Top rated in ${m}` : "Top rated on your Wishlist"
		default:
			return m ? `Most popular in ${m} right now` : "Most popular on your Wishlist right now"
	}
}

// The value the sort read for one title, in words. Null when it would say nothing useful.
export function sortFact(q: Queue, x: X, by: SortKey8, t: WTitle): string | null {
	if (by === "match") return t.match ? `${t.match}% taste match` : null
	if (by === "waiting" || by === "added") return `Added ${ageLabel(q.addedAt(t.key), q.now)}`
	if (by === "newest") {
		const r = x[t.key]?.rel
		if (!r) return null
		return t.type === "show" ? `Latest episode ${fmtDate(r)}` : `Released ${fmtDate(r)}`
	}
	if (by === "score") return t.score ? `GoodWatch score ${t.score}` : null
	return null
}
