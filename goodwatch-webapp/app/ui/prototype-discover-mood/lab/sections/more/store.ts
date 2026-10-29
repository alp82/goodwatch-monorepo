// PROTOTYPE (Discover lab, round 16): popularity, money and show filters, all lab-only. Live Discover takes none of
// them, so the grid doesn't follow; the Watch summary, badges, status and footer chips and Clear all read them here.
// Counts are simulated: a share table per filter times the list's movie or show count (no catalog numbers exist).
import { useSyncExternalStore } from "react"

export type MoreKey = "votes" | "rank" | "budget" | "revenue" | "seasons" | "finish"
/** A range as indexes into the key's STOPS; the first and last stop are open ends. */
export type Idx = [number, number]
export type Roi = "hit" | "flop"
export type ShowStatus = "running" | "ended" | "canceled"
/** The sub-tab (or More column) a value belongs to; also its Slot. */
export type MorePart = "reach" | "money" | "shows"

export interface MoreState {
	votes: Idx | null
	rank: Idx | null
	budget: Idx | null
	revenue: Idx | null
	roi: Roi | null
	seasons: Idx | null
	status: ShowStatus | null
	finish: Idx | null
}
const EMPTY: MoreState = { votes: null, rank: null, budget: null, revenue: null, roi: null, seasons: null, status: null, finish: null }

let state = EMPTY
const subs = new Set<() => void>()
const subscribe = (f: () => void) => {
	subs.add(f)
	return () => subs.delete(f)
}
export function setMore(patch: Partial<MoreState>) {
	state = { ...state, ...patch }
	for (const f of subs) f()
}
export const moreState = () => state
export const useMore = () => useSyncExternalStore(subscribe, moreState, () => EMPTY)
export const clearMore = () => setMore(EMPTY)

const K = (n: number) => (n >= 1e9 ? `${n / 1e9}B` : n >= 1e6 ? `${n / 1e6}M` : n >= 1e3 ? `${n / 1e3}K` : String(n))
const usd = (n: number) => (n <= 0 ? "$0" : `$${K(n)}`)

export interface Scale {
	stops: number[]
	/** A stop's label on the slider; the last is "N+". */
	fmt: (i: number) => string
	/** Simulated share of titles between stop i and i+1 (one per gap), of the kind it applies to. */
	shares: number[]
	/** Share of that kind with the fact known at all (budget is sparse on TMDB). */
	known: number
	kind: "all" | "movie" | "show"
	/** The upper handle's label, when the upper stop is exclusive in words (seasons: 1 to 2 reads "1"). */
	hi?: (i: number) => string
}

const open = (stops: number[], f: (n: number) => string) => (i: number) => (i >= stops.length - 1 ? `${f(stops[i])}+` : f(stops[i]))

const VOTES = [1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5, 1e6, 2e6]
const RANK = [1, 100, 250, 500, 1e3, 2.5e3, 5e3, 1e4, 2e4, 4e4]
const BUDGET = [0, 1e6, 5e6, 1e7, 2.5e7, 5e7, 1e8, 2e8, 3e8]
const REVENUE = [0, 1e6, 1e7, 5e7, 1e8, 2.5e8, 5e8, 1e9, 2e9]
const SEASONS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 15]
const FINISH = [0, 5, 10, 20, 30, 50, 100, 200]

export const SCALES: Record<MoreKey, Scale> = {
	// Discover's floor is 1K ratings, so the first stop is Any.
	votes: { stops: VOTES, fmt: (i) => (i === 0 ? "Any" : open(VOTES, K)(i)), shares: [22, 18, 12, 10, 12, 8, 6, 6, 3, 1.5], known: 1, kind: "all" },
	rank: { stops: RANK, fmt: (i) => (i === 0 ? "#1" : i >= RANK.length - 1 ? `#${K(RANK[i])}+` : `#${K(RANK[i])}`), shares: [0.25, 0.4, 0.6, 1.2, 3.6, 6, 12, 24, 52], known: 1, kind: "all" },
	budget: { stops: BUDGET, fmt: (i) => (i === 0 ? "Any" : open(BUDGET, usd)(i)), shares: [10, 16, 12, 18, 16, 15, 9, 4], known: 0.42, kind: "movie" },
	revenue: { stops: REVENUE, fmt: (i) => (i === 0 ? "Any" : open(REVENUE, usd)(i)), shares: [14, 20, 22, 12, 13, 9, 7, 3], known: 0.38, kind: "movie" },
	seasons: {
		stops: SEASONS,
		fmt: (i) => open(SEASONS, String)(i),
		hi: (i) => (i >= SEASONS.length - 1 ? `${SEASONS[i]}+` : String(SEASONS[i] - 1)),
		shares: [46, 15, 9, 7, 5, 4, 3, 5, 6],
		known: 1,
		kind: "show",
	},
	finish: { stops: FINISH, fmt: (i) => (i === 0 ? "Any" : open(FINISH, (h) => `${h} h`)(i)), shares: [20, 18, 17, 12, 11, 11, 6], known: 0.96, kind: "show" },
}

export const last = (k: MoreKey) => SCALES[k].stops.length - 1
export const isAny = (k: MoreKey, r: Idx | null) => !r || (r[0] <= 0 && r[1] >= last(k))
export const sameIdx = (a: Idx | null, b: Idx | null) => !!a && !!b && a[0] === b[0] && a[1] === b[1]

/** Share of the kind's titles inside a range (0-1), simulated. */
export function shareOf(k: MoreKey, r: Idx | null) {
	if (isAny(k, r) || !r) return 1
	const s = SCALES[k]
	const all = s.shares.reduce((a, b) => a + b, 0)
	const part = s.shares.slice(r[0], r[1]).reduce((a, b) => a + b, 0)
	return (part / all) * s.known
}

export const ROI_SHARE: Record<Roi, number> = { hit: 0.11, flop: 0.09 }
export const STATUS_SHARE: Record<ShowStatus, number> = { running: 0.31, ended: 0.53, canceled: 0.16 }

export interface Preset {
	label: string
	sub: string
	range: Idx
}
const idx = (k: MoreKey, lo: number, hi: number | null): Idx => {
	const s = SCALES[k].stops
	return [s.indexOf(lo), hi === null ? s.length - 1 : s.indexOf(hi)]
}

export const PRESETS: Record<MoreKey, Preset[]> = {
	votes: [
		{ label: "Hidden gems", sub: "Under 10K ratings", range: idx("votes", 1e3, 1e4) },
		{ label: "Known to fans", sub: "10K to 100K", range: idx("votes", 1e4, 1e5) },
		{ label: "Well known", sub: "100K+ ratings", range: idx("votes", 1e5, null) },
		{ label: "Everyone's seen it", sub: "1M+ ratings", range: idx("votes", 1e6, null) },
	],
	rank: [
		{ label: "Popular now", sub: "Top 1,000", range: idx("rank", 1, 1e3) },
		{ label: "Under the radar", sub: "#1K to #10K", range: idx("rank", 1e3, 1e4) },
		{ label: "Deep cuts", sub: "Past #10K", range: idx("rank", 1e4, null) },
	],
	budget: [
		{ label: "Indie", sub: "Under $5M", range: idx("budget", 0, 5e6) },
		{ label: "Mid budget", sub: "$5M to $50M", range: idx("budget", 5e6, 5e7) },
		{ label: "Big", sub: "$50M to $100M", range: idx("budget", 5e7, 1e8) },
		{ label: "Blockbuster", sub: "$100M+", range: idx("budget", 1e8, null) },
	],
	revenue: [
		{ label: "$100M+", sub: "Box office", range: idx("revenue", 1e8, null) },
		{ label: "$500M+", sub: "Box office", range: idx("revenue", 5e8, null) },
		{ label: "$1B+", sub: "Box office", range: idx("revenue", 1e9, null) },
	],
	seasons: [
		{ label: "One season", sub: "Done in one", range: idx("seasons", 1, 2) },
		{ label: "2 to 3", sub: "A short run", range: idx("seasons", 2, 4) },
		{ label: "4 to 7", sub: "A long run", range: idx("seasons", 4, 8) },
		{ label: "8+", sub: "Years on air", range: idx("seasons", 8, null) },
	],
	finish: [
		{ label: "A weekend", sub: "Under 10 h", range: idx("finish", 0, 10) },
		{ label: "A few weeks", sub: "10 to 30 h", range: idx("finish", 10, 30) },
		{ label: "A long haul", sub: "30 to 100 h", range: idx("finish", 30, 100) },
		{ label: "Years of it", sub: "100 h+", range: idx("finish", 100, null) },
	],
}

export const ROI_LABEL: Record<Roi, { label: string; sub: string }> = {
	hit: { label: "Hit", sub: "Made 3x its budget" },
	flop: { label: "Flop", sub: "Made less than it cost" },
}
export const STATUS_LABEL: Record<ShowStatus, string> = { running: "Still running", ended: "Ended", canceled: "Canceled" }

const NOUN: Record<MoreKey, (span: string) => string> = {
	votes: (s) => `${s} ratings`,
	rank: (s) => `Popularity ${s}`,
	budget: (s) => `Budget ${s}`,
	revenue: (s) => `Box office ${s}`,
	seasons: (s) => `${s} seasons`,
	finish: (s) => `${s} to finish`,
}

/** "Under 10K", "100K+", "10K–100K" from a range's stops. */
export function spanLabel(k: MoreKey, r: Idx) {
	const s = SCALES[k]
	if (k === "rank") return r[1] >= last(k) ? `past ${s.fmt(r[0])}` : r[0] <= 0 ? `top ${K(RANK[r[1]])}` : `${s.fmt(r[0])}–${s.fmt(r[1])}`
	// Seasons: the upper stop is exclusive, so 1-2 reads "1".
	if (k === "seasons") {
		const hi = r[1] >= last(k) ? null : SEASONS[r[1]] - 1
		const lo = SEASONS[r[0]]
		return hi === null ? `${lo}+` : hi === lo ? String(lo) : `${lo}–${hi}`
	}
	if (r[0] <= 0) return `under ${s.fmt(r[1])}`
	if (r[1] >= last(k)) return `${s.fmt(r[0]).replace(/\+$/, "")}+`
	return `${s.fmt(r[0])}–${s.fmt(r[1])}`
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/** The chip label: a preset's name when the range is one, else the span. */
export function rangeLabel(k: MoreKey, r: Idx): string {
	const p = PRESETS[k].find((x) => sameIdx(x.range, r))
	if (p && k !== "revenue" && k !== "seasons") return p.label
	if (k === "seasons" && sameIdx(r, PRESETS.seasons[0].range)) return "One season"
	return cap(NOUN[k](spanLabel(k, r)))
}

export const PART_OF: Record<MoreKey | "roi" | "status", MorePart> = {
	votes: "reach",
	rank: "reach",
	budget: "money",
	revenue: "money",
	roi: "money",
	seasons: "shows",
	status: "shows",
	finish: "shows",
}

export interface MoreChip {
	key: string
	label: string
	part: MorePart
	remove: () => void
}

export function moreChips(x: MoreState = state): MoreChip[] {
	const out: MoreChip[] = []
	for (const k of ["votes", "rank", "budget", "revenue", "seasons", "finish"] as MoreKey[]) {
		const r = x[k]
		if (r && !isAny(k, r)) out.push({ key: `more-${k}`, label: rangeLabel(k, r), part: PART_OF[k], remove: () => setMore({ [k]: null }) })
	}
	if (x.roi) out.push({ key: "more-roi", label: x.roi === "hit" ? "Box office hit" : "Box office flop", part: "money", remove: () => setMore({ roi: null }) })
	if (x.status) out.push({ key: "more-status", label: STATUS_LABEL[x.status], part: "shows", remove: () => setMore({ status: null }) })
	// Keep the order of the panel: reach, money, shows.
	const order: MorePart[] = ["reach", "money", "shows"]
	return out.sort((a, b) => order.indexOf(a.part) - order.indexOf(b.part))
}

export const partCount = (parts: MorePart[], x: MoreState = state) => moreChips(x).filter((c) => parts.includes(c.part)).length
