import { slugify } from "~/domain/browse/address"
// The Browse catalog from the loaded title snapshot: which facet values exist (the genres titles carry, the countries
// with the most titles). Place and blend counts are read from the rows themselves (rows.server.ts); this module used to
// count every single value and pair here too, in one pass that held the event loop for over half a second on a
// process's first Browse page, and nothing read those counts.
//
// A title counts toward a page when it is presentable (poster and GoodWatch score), not adult, and has at least
// MIN_VOTES ratings: the same rule Top rated uses (server/title-filter/order.server.ts), so a page that passes the
// minimum is full of titles people know, under every sort.
import { MOODS } from "~/domain/moods"
import { BRANDS } from "~/domain/new-on-services"
import { STYLES, THEMES } from "~/domain/themes-styles"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import {
	FLAG_ADULT,
	FLAG_POSTER,
	NO_COUNTRY,
	UNKNOWN_SCORE,
} from "~/server/title-snapshot/format.server"

/** The families counted here (themes and styles count too: they're blend parts). */
export type CountedFamily = "mood" | "genre" | "theme" | "style" | "decade" | "country" | "service"
type Family = CountedFamily
export type Kind = "movie" | "show" | "all"

/** Count order, which is also the order of a pair key's two halves. */
export const COUNTED_FAMILIES: readonly Family[] = [
	"mood",
	"genre",
	"theme",
	"style",
	"decade",
	"country",
	"service",
]

export interface FacetValue {
	family: Family
	slug: string
	label: string
	/** What the filter reads: mood/theme/style key, genre name, first year of a decade, country code, brand slug. */
	id: string
}

export type Catalog = Record<Family, FacetValue[]>

export interface Facet {
	family: Family
	slug: string
}

export { slugify } from "~/domain/browse/address"
export const MIN_VOTES = 1000
const DECADES = [1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020]
const regionName = new Intl.DisplayNames(["en"], { type: "region" })

export interface Counts {
	version: string
	catalog: Catalog
	minVotes: number
	ms: number
}

const cache = new Map<number, { key: string; counts: Counts }>()

/** `minVotes`: what makes a title well-known enough to count (MIN_VOTES, Top rated's rule, by default). */
export function getCounts(minVotes = MIN_VOTES): Counts | null {
	const snapshot = getTitleSnapshot()
	if (!snapshot) return null
	const key = String(snapshot.version)
	const hit = cache.get(minVotes)
	if (hit?.key === key) return hit.counts
	const counts = compute(snapshot, minVotes)
	cache.set(minVotes, { key, counts })
	return counts
}

function compute(
	snapshot: NonNullable<ReturnType<typeof getTitleSnapshot>>,
	minVotes: number,
): Counts {
	const started = performance.now()
	const c = snapshot.columns
	const facts = c.facts
	const n = snapshot.count

	// Qualifying rows.
	const rows: number[] = []
	for (let r = 0; r < n; r++) {
		if (!(c.flags[r] & FLAG_POSTER) || c.flags[r] & FLAG_ADULT) continue
		if (c.scores[r] === UNKNOWN_SCORE || c.votes[r] < minVotes) continue
		rows.push(r)
	}

	// Values. Countries: the 24 with the most qualifying titles.
	const countryHits = new Map<number, number>()
	if (facts)
		for (const r of rows)
			for (let s = 0; s < 4; s++) {
				const i = facts.countryIndexes[s * n + r]
				if (i !== NO_COUNTRY) countryHits.set(i, (countryHits.get(i) ?? 0) + 1)
			}
	const topCountries = [...countryHits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24)
	const genreHits = new Map<number, number>()
	for (const r of rows)
		for (let g = 0; g < c.genreNames.length; g++)
			if (c.genres[r] & (1 << g)) genreHits.set(g, (genreHits.get(g) ?? 0) + 1)

	const v = (family: Family, label: string, id: string, slug = slugify(label)): FacetValue => ({
		family,
		slug,
		label,
		id,
	})
	const catalog: Catalog = {
		mood: MOODS.map((m) => v("mood", m.name, m.key)),
		genre: [...genreHits.keys()]
			.sort((a, b) => c.genreNames[a].localeCompare(c.genreNames[b]))
			.map((g) => v("genre", c.genreNames[g], c.genreNames[g])),
		theme: THEMES.map((t) => v("theme", t.name, t.id)),
		style: STYLES.map((s) => v("style", s.name, s.id)),
		decade: DECADES.map((d) => v("decade", `${d}s`, String(d), `${d}s`)),
		country: topCountries.map(([i]) => {
			const code = facts?.countries[i] ?? "??"
			return v("country", regionName.of(code) ?? code, code)
		}),
		service: BRANDS.map((b) => v("service", b.name, b.slug, b.slug)),
	}

	return {
		version: snapshot.version,
		catalog,
		minVotes,
		ms: Math.round(performance.now() - started),
	}
}
