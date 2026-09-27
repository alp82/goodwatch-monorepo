// PROTOTYPE - throwaway. The selection for /prototype/rec-watch-next-4 (#176, round 4): an ordering plus a
// few filters, applied to the ordered Wishlist. A selection is only a view; the saved order changes only
// through "Use this order". Filters are hard (titles that don't match leave the view) or soft (titles that
// match more of them come first), depending on the variant.
import { MOOD_LABEL, type Mood, type WTitle, onMine } from "~/ui/prototype-rec-watch-next-2/model"
import type { Queue, SortKey } from "~/ui/prototype-rec-watch-next-3/model"

export type By = "mine" | SortKey
export type Kind = "all" | "movie" | "show"
export type Length = "any" | "short" | "long"
export interface Sel {
	by: By
	services: boolean
	kind: Kind
	length: Length
	mood: Mood | null
	genre: string | null
}
export const ANY: Sel = { by: "mine", services: false, kind: "all", length: "any", mood: null, genre: null }

export const ORDERS: { key: By; label: string; short: string; note: string }[] = [
	{ key: "mine", label: "My order", short: "my order", note: "The order you saved" },
	{ key: "tonight", label: "For tonight", short: "for tonight", note: "On your services first, then best taste match" },
	{ key: "short", label: "Shortest first", short: "shortest first", note: "Short films and short episodes first" },
	{ key: "leaving", label: "Leaving soon", short: "leaving soon", note: "Titles about to leave your services first" },
	{ key: "match", label: "Best match", short: "best match first", note: "Highest taste match first, wherever it streams" },
	{ key: "oldest", label: "Oldest wish first", short: "oldest wish first", note: "The titles you have wanted the longest" },
]
export const MOODS: Mood[] = ["comfort", "thoughtful", "escape", "binge", "light"]
export { MOOD_LABEL }
export const LENGTHS: { key: Length; label: string }[] = [
	{ key: "any", label: "Any length" },
	{ key: "short", label: "Short" },
	{ key: "long", label: "Long" },
]
export const KINDS: { key: Kind; label: string }[] = [
	{ key: "all", label: "Films and shows" },
	{ key: "movie", label: "Films" },
	{ key: "show", label: "Shows" },
]

// Short: a film under 1h40 or episodes of half an hour. Long: a film over 2h20, or any series.
export const isShort = (t: WTitle) => (t.type === "movie" ? (t.runtime ?? 999) <= 100 : (t.runtime ?? 99) <= 30)
export const isLong = (t: WTitle) => (t.type === "movie" ? (t.runtime ?? 0) >= 140 : true)

type Test = { key: keyof Sel; label: string; ok: (t: WTitle) => boolean }
// The active filters, each with the words used to relax it.
export function tests(sel: Sel): Test[] {
	const out: Test[] = []
	if (sel.services) out.push({ key: "services", label: "on my services", ok: onMine })
	if (sel.kind !== "all") out.push({ key: "kind", label: sel.kind === "movie" ? "films" : "shows", ok: (t) => t.type === sel.kind })
	if (sel.length !== "any") out.push({ key: "length", label: sel.length, ok: sel.length === "short" ? isShort : isLong })
	if (sel.mood) {
		const m = sel.mood
		out.push({ key: "mood", label: MOOD_LABEL[m].toLowerCase(), ok: (t) => t.moods.includes(m) })
	}
	if (sel.genre) {
		const g = sel.genre
		out.push({ key: "genre", label: g, ok: (t) => t.genres.includes(g) })
	}
	return out
}

export const relax = (sel: Sel, key: keyof Sel): Sel => ({ ...sel, [key]: ANY[key] })
export const isDefault = (sel: Sel) => sel.by === "mine" && tests(sel).length === 0
export const sig = (sel: Sel) => JSON.stringify(sel)

export interface View {
	keys: string[]
	// How many of the active filters each title meets.
	fit: Map<string, number>
	need: number
	// Titles left out by hard filters.
	hidden: number
}

// Apply a selection to the queue. `passed` titles ("Not tonight") drop to the end of the view for this visit;
// `pin` ("Play this next" from a peek) goes first.
export function apply(q: Queue, sel: Sel, mode: "hard" | "soft", passed: string[] = [], pin: string | null = null): View {
	const ts = tests(sel)
	const ordered = sel.by === "mine" ? q.order : q.sorted(sel.by)
	const fit = new Map<string, number>()
	for (const k of ordered) {
		const t = q.T(k)
		fit.set(k, t ? ts.filter((x) => x.ok(t)).length : 0)
	}
	let keys = mode === "hard" ? ordered.filter((k) => fit.get(k) === ts.length) : [...ordered].sort((a, b) => fit.get(b)! - fit.get(a)!)
	if (passed.length) keys = [...keys.filter((k) => !passed.includes(k)), ...passed.filter((k) => keys.includes(k))]
	if (pin && keys.includes(pin)) keys = [pin, ...keys.filter((k) => k !== pin)]
	return { keys, fit, need: ts.length, hidden: ordered.length - keys.length }
}

// The best suggestion outside the Wishlist that meets the hard filters, for empty views.
export function suggestFor(q: Queue, sel: Sel) {
	const ts = tests(sel)
	return q.suggest.forYou(80).find((t) => ts.every((x) => x.ok(t)))
}

// Genres that appear most on the Wishlist, for the genre filter.
export function topGenres(q: Queue, n = 6) {
	const c = new Map<string, number>()
	for (const t of q.titles) for (const g of t.genres) c.set(g, (c.get(g) ?? 0) + 1)
	const pool = c.size ? c : new Map(["Drama", "Comedy", "Thriller", "Science Fiction", "Crime", "Animation"].map((g) => [g, 1]))
	return [...pool.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, n)
		.map(([g]) => g)
}

// A plain sentence for the selection: "short films on your services, comfort watch, shortest first".
export function describe(sel: Sel) {
	const what = sel.kind === "movie" ? "films" : sel.kind === "show" ? "shows" : "titles"
	const bits = [sel.length !== "any" ? `${sel.length} ${what}` : sel.kind !== "all" ? what : null, sel.genre ? sel.genre.toLowerCase() : null, sel.mood ? MOOD_LABEL[sel.mood].toLowerCase() : null, sel.services ? "on your services" : null].filter(Boolean)
	const order = ORDERS.find((o) => o.key === sel.by)!
	if (!bits.length) return sel.by === "mine" ? "your saved order" : order.short
	return `${bits.join(", ")}${sel.by === "mine" ? "" : `, ${order.short}`}`
}

// The saved order "Use this order" writes: the view's titles in view order, then everything else as it was.
export const adopt = (q: Queue, v: View) => [...v.keys, ...q.order.filter((k) => !v.keys.includes(k))]
