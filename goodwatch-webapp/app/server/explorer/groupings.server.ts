// Groupings split the Explorer's pool into islands. A layout is one grouping's islands over the whole pool, before
// the viewer's filters: which islands each title sits on, each island's titles best first, where the islands sit
// (similar islands close together), and what sets each one apart. Layouts that aren't personal are built once per
// snapshot version and kept for 6 hours; Your taste per taste. The islands and their rules are in islands.server.ts.
import { type Grouping, MAX_ISLANDS } from "~/domain/explorer"
import type { CoreScores } from "~/server/utils/fingerprint"
import { VALID_FINGERPRINT_KEYS } from "~/server/utils/fingerprint"
import {
	DECADES,
	FEWEST,
	FIT_WEIGHT,
	type IslandDef,
	MIN_COUNTRY,
	MIN_SCORES,
	MOODS,
	MOST,
	OCCASIONS,
	PALETTE,
	REST_COLOR,
	REST_OF_WORLD,
	type RuleIsland,
	STYLES,
	type Score,
	TASTE_BANDS,
	THEMES,
	TOO_COMMON,
} from "./islands.server"
import {
	DIMENSIONS as D,
	DESCRIPTIVE_KEYS,
	type ExplorerPool,
	OCCASION_FLAGS,
} from "./pool.server"
import { normalize, pca2 } from "./positions.server"
import { phraseOf, sentence } from "./words.server"

export interface Layout {
	grouping: Grouping
	islands: IslandDef[]
	/** Titles can sit on several islands (Mood, Theme, Style, Occasion). */
	multi: boolean
	/** Per pool title, bit j set when it sits on island j. */
	mask: Uint16Array
	/** Per island, its pool titles, best first: by fit and quality where titles sit on several islands, else quality. */
	members: Int32Array[]
	/** Per island, the unit-length mean of its titles' unit vectors, for "between" bridges and pairs. */
	centers: Float64Array[]
	x: number[]
	y: number[]
	apart: string[]
}

const MIN_ISLAND = 3
const KEEP_MS = 6 * 60 * 60 * 1000
const MAX_KEPT = 200

const MISSING = 255

// ---------------------------------------------------------------- building a layout

/**
 * A layout from island definitions and, per pool title, the bit mask of the islands it sits on (bit j is defs[j]).
 * Islands with fewer than 3 titles are dropped, then the largest MAX_ISLANDS are kept.
 */
export function buildLayout(
	pool: ExplorerPool,
	grouping: Grouping,
	defs: IslandDef[],
	maskOf: (i: number) => number,
	multi: boolean,
	/** How strongly pool title i belongs to defs[j], where the grouping has levels; a step of 1 outweighs typicality. */
	levelOf?: (i: number, j: number) => number,
): Layout {
	const n = pool.n
	const raw = new Uint32Array(n)
	const sizes = new Array<number>(defs.length).fill(0)
	for (let i = 0; i < n; i++) {
		const m = maskOf(i)
		raw[i] = m
		for (let j = 0; j < defs.length; j++) if (m & (1 << j)) sizes[j]++
	}
	const kept = defs
		.map((_, j) => j)
		.filter((j) => sizes[j] >= MIN_ISLAND)
		.sort((a, b) => sizes[b] - sizes[a] || a - b)
		.slice(0, MAX_ISLANDS)
		.sort((a, b) => a - b)
	const islands = kept.map((j) => defs[j])
	const mask = new Uint16Array(n)
	const lists: number[][] = kept.map(() => [])
	for (let i = 0; i < n; i++) {
		let m = 0
		kept.forEach((j, at) => {
			if (raw[i] & (1 << j)) {
				m |= 1 << at
				lists[at].push(i)
			}
		})
		mask[i] = m
	}
	// Island means: of the z-scores for where islands sit and what sets them apart, of the unit vectors for closeness.
	const means = lists.map((list) => {
		const v = new Float64Array(D)
		for (const i of list) for (let d = 0; d < D; d++) v[d] += pool.z[i * D + d]
		for (let d = 0; d < D; d++) v[d] /= Math.max(1, list.length)
		return v
	})
	const centers = lists.map((list) => {
		const v = new Float64Array(D)
		for (const i of list)
			for (let d = 0; d < D; d++) v[d] += pool.unit[i * D + d]
		return normalize(v)
	})
	// Where a title sits on several islands, a well-known one would lead all of them by quality alone, so each
	// island's order also counts how well a title fits that island: its rank there by level, then by how typical it is.
	const members = lists.map((list, at) => {
		const value = new Map<number, number>()
		if (multi && list.length > 1) {
			const fit = new Map<number, number>()
			for (const i of list) {
				let dot = 0
				for (let d = 0; d < D; d++) dot += pool.unit[i * D + d] * centers[at][d]
				fit.set(i, (levelOf?.(i, kept[at]) ?? 0) + dot)
			}
			const ranked = [...list].sort(
				(a, b) => (fit.get(a) ?? 0) - (fit.get(b) ?? 0),
			)
			ranked.forEach((i, rank) =>
				value.set(
					i,
					FIT_WEIGHT * (rank / (ranked.length - 1)) +
						(1 - FIT_WEIGHT) * pool.quality[i],
				),
			)
		} else for (const i of list) value.set(i, pool.quality[i])
		return Int32Array.from(
			list.sort((a, b) => (value.get(b) ?? 0) - (value.get(a) ?? 0) || a - b),
		)
	})
	const positions = pca2(means)
	return {
		grouping,
		islands,
		multi,
		mask,
		members,
		centers,
		x: positions.map((p) => round3(p[0])),
		y: positions.map((p) => round3(p[1])),
		apart: apartLines(means),
	}
}

const round3 = (v: number) => Math.round(v * 1000) / 1000

/** What sets each island apart: the two attributes its mean exceeds the average island's mean by most. */
function apartLines(means: Float64Array[]): string[] {
	const average = new Float64Array(D)
	for (const v of means)
		for (let d = 0; d < D; d++) average[d] += v[d] / Math.max(1, means.length)
	return means.map((v) =>
		sentence(
			DESCRIPTIVE_KEYS.map((key, d) => ({ key, lead: v[d] - average[d] }))
				.sort((a, b) => b.lead - a.lead)
				.slice(0, 2)
				.map((r) => phraseOf(r.key)),
		),
	)
}

// ---------------------------------------------------------------- the groupings

const KEY_INDEX = Object.fromEntries(
	VALID_FINGERPRINT_KEYS.map((key, k) => [key, k]),
) as Record<keyof CoreScores, number>

function ruleLayout(
	pool: ExplorerPool,
	grouping: Grouping,
	rules: RuleIsland[],
): Layout {
	const n = pool.n
	const R = rules.length
	const levels = new Uint8Array(n * R)
	for (let i = 0; i < n; i++) {
		const fp = pool.snapshot.fingerprintAt(pool.rows[i])
		let present = 0
		for (let k = 0; k < fp.length; k++) if (fp[k] !== MISSING) present++
		if (present < MIN_SCORES) continue
		const score: Score = (key) => {
			const v = fp[KEY_INDEX[key]]
			return v === MISSING ? 0 : v
		}
		for (let j = 0; j < R; j++)
			levels[i * R + j] = Math.max(
				0,
				rules[j].level(score, pool.facts[i].genres),
			)
	}
	const from = rules.map((rule, j) => {
		const sizeAt = (t: number) => {
			let size = 0
			for (let i = 0; i < n; i++) if (levels[i * R + j] >= t) size++
			return size
		}
		let t = rule.from
		while (t < 10 && sizeAt(t) > n * MOST) t++
		if (t === rule.from && sizeAt(t) < n * FEWEST) t--
		return t
	})
	const layout = buildLayout(
		pool,
		grouping,
		rules,
		(i) => {
			let m = 0
			for (let j = 0; j < R; j++) if (levels[i * R + j] >= from[j]) m |= 1 << j
			return m
		},
		true,
		(i, j) => levels[i * R + j],
	)
	report(pool, layout, (id) => {
		const j = rules.findIndex((rule) => rule.id === id)
		return from[j] === rules[j].from ? "" : ` from ${from[j]}`
	})
	return layout
}

function occasionLayout(pool: ExplorerPool): Layout {
	const bitOf = new Map(OCCASION_FLAGS.map((flag, bit) => [flag, 1 << bit]))
	const wanted = OCCASIONS.map((o) =>
		o.flags.reduce((m, flag) => m | (bitOf.get(flag) ?? 0), 0),
	)
	const sizes = wanted.map((w) => {
		let size = 0
		for (let i = 0; i < pool.n; i++) if (pool.display[i].occasions & w) size++
		return size
	})
	const layout = buildLayout(
		pool,
		"occasion",
		OCCASIONS,
		(i) => {
			let m = 0
			for (let j = 0; j < wanted.length; j++)
				if (
					sizes[j] <= pool.n * TOO_COMMON &&
					pool.display[i].occasions & wanted[j]
				)
					m |= 1 << j
			return m
		},
		true,
	)
	report(pool, layout, () => "")
	return layout
}

/** Logs a layout's island sizes and how much of the pool sits on an island, once per build, for tuning the rules. */
function report(
	pool: ExplorerPool,
	layout: Layout,
	note: (id: string) => string,
): void {
	let placed = 0
	for (let i = 0; i < pool.n; i++) if (layout.mask[i]) placed++
	console.info(
		`Explorer ${layout.grouping} islands: ${layout.islands
			.map(
				(island, j) =>
					`${island.id} ${layout.members[j].length}${note(island.id)}`,
			)
			.join(
				", ",
			)}; ${Math.round((100 * placed) / Math.max(1, pool.n))}% of ${pool.n} titles on an island`,
	)
}

function decadeLayout(pool: ExplorerPool): Layout {
	return buildLayout(
		pool,
		"decade",
		DECADES,
		(i) => {
			const year = pool.years[i]
			if (!year) return 0
			const j = DECADES.findIndex((d) => year >= d.from && year <= d.to)
			return j < 0 ? 0 : 1 << j
		},
		false,
	)
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" })
const isCountryCode = (origin: string | null): origin is string =>
	!!origin && /^[A-Z]{2}$/.test(origin)

function countryLayout(pool: ExplorerPool): Layout {
	// Origins are the first production country, else the original language; only countries get islands.
	const counts = new Map<string, number>()
	for (const facts of pool.facts)
		if (isCountryCode(facts.origin))
			counts.set(facts.origin, (counts.get(facts.origin) ?? 0) + 1)
	const countries = [...counts.entries()]
		.filter(([, count]) => count >= MIN_COUNTRY)
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, MAX_ISLANDS - 1)
		.map(([code]) => code)
	const defs: IslandDef[] = [
		...countries.map((code, j) => ({
			id: code.toLowerCase(),
			name: regionNames.of(code) ?? code,
			color: PALETTE[j % PALETTE.length],
		})),
		{ id: REST_OF_WORLD, name: "Rest of world", color: REST_COLOR },
	]
	const at = new Map(countries.map((code, j) => [code, j]))
	return buildLayout(
		pool,
		"country",
		defs,
		(i) => 1 << (at.get(pool.facts[i].origin ?? "") ?? countries.length),
		false,
	)
}

/** Your taste: the viewer's match bands; `match[i]` is 0 for a title without a match. */
export function tasteLayout(pool: ExplorerPool, match: Uint8Array): Layout {
	return buildLayout(
		pool,
		"taste",
		TASTE_BANDS,
		(i) => {
			if (!match[i]) return 0
			return 1 << TASTE_BANDS.findIndex((band) => match[i] >= band.min)
		},
		false,
	)
}

// ---------------------------------------------------------------- the shared layouts

const kept = new Map<string, { at: number; layout: Layout }>()

/** A layout that's the same for everyone (every grouping but Your taste), kept for 6 hours per snapshot version. */
export function sharedLayout(
	pool: ExplorerPool,
	grouping: Exclude<Grouping, "taste">,
): Layout {
	return keep(`${pool.version}|${grouping}`, () => {
		if (grouping === "mood") return ruleLayout(pool, "mood", MOODS)
		if (grouping === "theme") return ruleLayout(pool, "theme", THEMES)
		if (grouping === "style") return ruleLayout(pool, "style", STYLES)
		if (grouping === "occasion") return occasionLayout(pool)
		if (grouping === "decade") return decadeLayout(pool)
		return countryLayout(pool)
	})
}

/** Keeps a layout for 6 hours under a key; the oldest go beyond MAX_KEPT. */
export function keep(key: string, build: () => Layout): Layout {
	const now = Date.now()
	const hit = kept.get(key)
	if (hit && now - hit.at < KEEP_MS) return hit.layout
	const layout = build()
	kept.delete(key)
	kept.set(key, { at: now, layout })
	for (const [k, entry] of kept) {
		if (kept.size <= MAX_KEPT && now - entry.at < KEEP_MS) break
		kept.delete(k)
	}
	return layout
}
