// The tuning model of the Browse dials, pure and shared by the loader and the browser: a page has a pool of titles with a few scores each, and two to four dials. A dial set to a position
// pulls the titles nearest to it to the front. The loader ranks with the stops in the address; the browser ranks with
// the knob while it is dragged, so both always agree on the order.
import type { PlaceRef, ShowTitle } from "~/domain/browse/types"

export interface Stop {
	/** The stop's value in the address. */
	id: string
	/** What a person calls it: "A touch", "Darker". Never a number. */
	name: string
	/** Where it sits on the track, 0-1. */
	at: number
	/** One line saying what that much of it is like. */
	blurb: string
	/** The page with the dial at this stop (other dials keep their place). */
	to: string
}

/** Where a dial leads when you push past its end: the nearest place further that way. */
export interface Exit {
	place: PlaceRef
	to: string
}

export interface DialSpec {
	/** The dial's parameter in the address. */
	id: string
	/**
	 * much: how much of a trait (a touch, plenty, all the way). axis: a direction (lighter to darker). reach: from what
	 * everyone watches to deep cuts. year: along time. love: who loves it, critics or the crowd.
	 */
	kind: "much" | "axis" | "reach" | "year" | "love"
	/** "How scary?", "Lighter or darker?" */
	question: string
	/** The dial's color: its trait's fingerprint family color, or neutral. */
	color: string
	/** The column of the pool's scores this dial reads. */
	col: number
	/** The score at the track's left and right end. */
	lo: number
	hi: number
	stops: Stop[]
	/** Where this place itself sits, 0-1 (the hollow mark); null when that says nothing. */
	home: number | null
	/** What the hollow mark stands for: "Cozy movies sit here". */
	homeLabel?: string
	/** What the dial reads at rest, in place of "Any amount" or "Anywhere": "The whole decade". */
	restName?: string
	/** The stop in the address, or null: the dial is at rest. */
	value: string | null
	/** The page with this dial at rest. */
	off: string
	low: string
	high: string
	lowExit?: Exit | null
	highExit?: Exit | null
	/** A "much" dial of a mood, theme, style or trait reaches past the place's own titles ("a touch of scary"). */
	widens?: boolean
}

export interface PoolItem {
	t: ShowTitle
	/** Scores by column (see DialSpec.col). */
	s: number[]
	/** 1: one of the place's own titles. 0: only reachable through a widening dial. */
	m: 0 | 1
}

/** Dial id to position 0-1, or null for a dial at rest. */
export type Settings = Record<string, number | null>

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

export const settingsOf = (dials: DialSpec[]): Settings =>
	Object.fromEntries(
		dials.map((d) => [d.id, d.stops.find((s) => s.id === d.value)?.at ?? null] as const),
	)

export const isTuned = (settings: Settings) => Object.values(settings).some((v) => v !== null)

export function nearestStop(d: DialSpec, at: number): Stop {
	let best = d.stops[0]
	for (const s of d.stops) if (Math.abs(s.at - at) < Math.abs(best.at - at)) best = s
	return best
}

/**
 * Round 9: a dial may rest between its named stops. Each gap between two stops is split so the whole track has 6-10
 * resting places (three stops: nine places; five stops: nine; a long dial like the years keeps just its stops). The
 * named stops stay the words; a knob between them reads as the nearest one.
 */
export function finePlaces(d: Pick<DialSpec, "stops">): number[] {
	const stops = d.stops
	const gaps = stops.length - 1
	if (gaps < 1) return stops.map((s) => s.at)
	const split = gaps >= 6 ? 1 : Math.max(1, Math.floor(9 / gaps))
	const out: number[] = []
	for (let i = 0; i < gaps; i++)
		for (let k = 0; k < split; k++)
			out.push(stops[i].at + ((stops[i + 1].at - stops[i].at) * k) / split)
	out.push(stops[gaps].at)
	return out
}

/** The resting place nearest to a position. */
export function snapFine(d: Pick<DialSpec, "stops">, at: number): number {
	let best = d.stops[0]?.at ?? at
	for (const p of finePlaces(d)) if (Math.abs(p - at) < Math.abs(best - at)) best = p
	return best
}

/** True when a position is one of the named stops (not a place between them). */
export const onStop = (d: Pick<DialSpec, "stops">, at: number) =>
	d.stops.some((s) => Math.abs(s.at - at) < 0.004)

/**
 * The address keeps every dial's nearest named stop in its own parameter (loaders and links read those), and the exact
 * place of a knob resting between stops in one more parameter: `fine=heart:62,tone:41` (percent of the track).
 */
export const FINE_PARAM = "fine"

export function readFine(search: string): Record<string, number> {
	const raw = new URLSearchParams(search).get(FINE_PARAM)
	const out: Record<string, number> = {}
	for (const pair of (raw ?? "").split(",")) {
		const [id, n] = pair.split(":")
		const v = Number(n)
		if (id && Number.isFinite(v)) out[id] = clamp01(v / 100)
	}
	return out
}

/**
 * The dials' settings from the address: the named stops, refined by `fine` where it agrees with them. A place halfway
 * between two stops is as near to one as to the other, so it agrees with either (round 11: a knob released on such a
 * place used to fall back to the stop, because the rounded percent leaned to the other side).
 */
export function settingsWithFine(dials: DialSpec[], search: string): Settings {
	const base = settingsOf(dials)
	const fine = readFine(search)
	for (const d of dials) {
		const f = fine[d.id]
		if (f === undefined || d.value == null) continue
		const own = d.stops.find((s) => s.id === d.value)
		if (!own) continue
		const near = nearestStop(d, f)
		if (near.id === d.value || Math.abs(own.at - f) - Math.abs(near.at - f) < 0.006)
			base[d.id] = snapFine(d, f)
	}
	return base
}

/** Writes the settings into an address: each dial's nearest stop, and `fine` for knobs resting between stops. */
export function writeSettings(params: URLSearchParams, dials: DialSpec[], settings: Settings) {
	const fine: string[] = []
	for (const d of dials) {
		const v = settings[d.id]
		if (v == null) {
			params.delete(d.id)
			continue
		}
		params.set(d.id, nearestStop(d, v).id)
		// Tenths of a percent, so the place reads back exactly (a whole percent could tip it to the other stop).
		if (!onStop(d, v)) fine.push(`${d.id}:${Math.round(v * 1000) / 10}`)
	}
	if (fine.length) params.set(FINE_PARAM, fine.join(","))
	else params.delete(FINE_PARAM)
}

const norm = (d: DialSpec, x: number) => (d.hi > d.lo ? clamp01((x - d.lo) / (d.hi - d.lo)) : 0.5)

/**
 * The pool's titles the dials ask for: the `n` nearest to every dial that is set, shown the better-known first. Keeping
 * the pool's own order (not nearest-first) means a title that stays keeps its place among the others, so a moving
 * knob shifts the grid by a few cells and never shuffles it. With no dial set it is the place's own list.
 */
export function rank(
	pool: PoolItem[],
	dials: DialSpec[],
	settings: Settings,
	n: number,
): PoolItem[] {
	const active = dials.filter((d) => settings[d.id] != null)
	if (!active.length) return pool.filter((i) => i.m).slice(0, n)
	const wide = active.some((d) => d.widens)
	const scored: { i: PoolItem; index: number; cost: number }[] = []
	pool.forEach((i, index) => {
		if (!wide && !i.m) return
		let cost = (index / pool.length) * 0.06
		for (const d of active) cost += Math.abs(norm(d, i.s[d.col]) - (settings[d.id] as number))
		scored.push({ i, index, cost })
	})
	scored.sort((a, b) => a.cost - b.cost)
	return scored
		.slice(0, n)
		.sort((a, b) => a.index - b.index)
		.map((x) => x.i)
}

/** Percentile of a list of numbers (0-1). */
export function percentile(values: number[], p: number): number {
	if (!values.length) return 0
	const sorted = [...values].sort((a, b) => a - b)
	return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))]
}

export function spread(values: number[]): number {
	if (values.length < 2) return 0
	const mean = values.reduce((s, x) => s + x, 0) / values.length
	return Math.sqrt(values.reduce((s, x) => s + (x - mean) ** 2, 0) / values.length)
}
