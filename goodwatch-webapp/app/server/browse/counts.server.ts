// Browse page counts from the loaded title snapshot: which facet
// values and which pairs of them have enough titles to be a page of their own.
//
// A title counts toward a page when it is presentable (poster and GoodWatch score), not adult, and has at least
// MIN_VOTES ratings: the same rule Top rated uses (server/title-filter/order.server.ts), so a page that passes the
// minimum is full of titles people know, under every sort.
import { MOODS, MOOD_KEYS } from "~/domain/moods"
import { BRANDS, brandOfService } from "~/domain/new-on-services"
import { STYLES, STYLE_KEYS, THEMES, THEME_KEYS } from "~/domain/themes-styles"
import { countryServices } from "~/server/availability-index.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"
import {
	FLAG_ADULT,
	FLAG_POSTER,
	NO_COUNTRY,
	SHOW_BASE,
	UNKNOWN_SCORE,
} from "~/server/title-snapshot/format.server"
import type { TitleKey } from "~/utils/title-key"

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
const FAMILIES = COUNTED_FAMILIES

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

/** A label as an address segment: "Action & Adventure" is "action-adventure". */
export const slugify = (s: string) =>
	s
		.toLowerCase()
		.replace(/&/g, " ")
		.replace(/\+/g, " plus ")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")

export const MIN_VOTES = 1000
const TOP_N = 12
const KINDS: Kind[] = ["movie", "show", "all"]
const DECADES = [1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020]
const STREAMING_COUNTRY = "US"
const regionName = new Intl.DisplayNames(["en"], { type: "region" })

export interface Counts {
	version: string
	qualifying: Record<Kind, number>
	catalog: Catalog
	/** `${kind}|${family}:${slug}` → titles. */
	single: Record<string, number>
	/** `${kind}|${family}:${slug}|${family}:${slug}` (FAMILIES order) → titles. */
	pair: Record<string, number>
	/** The most popular qualifying titles of a single value (up to TOP_N), for poster peeks and rails. */
	top: Record<string, TitleKey[]>
	/** Every qualifying title of a single value (movie and show only), for Top ranking inside a place. */
	members: Map<string, Set<TitleKey>>
	streamingCountry: string
	minVotes: number
	ms: number
}

export const singleKey = (kind: Kind, f: Facet) => `${kind}|${f.family}:${f.slug}`
export function pairKey(kind: Kind, a: Facet, b: Facet) {
	const [x, y] = FAMILIES.indexOf(a.family) <= FAMILIES.indexOf(b.family) ? [a, b] : [b, a]
	return `${kind}|${x.family}:${x.slug}|${y.family}:${y.slug}`
}

const cache = new Map<number, { key: string; counts: Counts }>()

/** `minVotes`: what makes a title well-known enough to count (MIN_VOTES, Top rated's rule, by default). */
export function getCounts(minVotes = MIN_VOTES): Counts | null {
	const snapshot = getTitleSnapshot()
	if (!snapshot) return null
	const services = countryServices(STREAMING_COUNTRY)
	const key = `${snapshot.version}|${services?.loadedAt ?? 0}`
	const hit = cache.get(minVotes)
	if (hit?.key === key) return hit.counts
	const counts = compute(snapshot, services, minVotes)
	cache.set(minVotes, { key, counts })
	return counts
}

function compute(
	snapshot: NonNullable<ReturnType<typeof getTitleSnapshot>>,
	services: ReturnType<typeof countryServices>,
	minVotes: number,
): Counts {
	const started = performance.now()
	const c = snapshot.columns
	const facts = c.facts
	const n = snapshot.count

	// Qualifying rows, most popular first.
	const rows: number[] = []
	for (let r = 0; r < n; r++) {
		if (!(c.flags[r] & FLAG_POSTER) || c.flags[r] & FLAG_ADULT) continue
		if (c.scores[r] === UNKNOWN_SCORE || c.votes[r] < minVotes) continue
		rows.push(r)
	}
	rows.sort((a, b) => c.popularity[b] - c.popularity[a])

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

	// Value indexes for the counting arrays.
	const all = FAMILIES.flatMap((f) => catalog[f])
	const NV = all.length
	const index = new Map(all.map((val, i) => [`${val.family}:${val.slug}`, i]))
	const at = (family: Family, slug: string) => index.get(`${family}:${slug}`) as number
	const moodIdx = MOOD_KEYS.map((k) => at("mood", catalog.mood.find((m) => m.id === k)?.slug ?? ""))
	const themeIdx = THEME_KEYS.map((k) =>
		at("theme", catalog.theme.find((m) => m.id === k)?.slug ?? ""),
	)
	const styleIdx = STYLE_KEYS.map((k) =>
		at("style", catalog.style.find((m) => m.id === k)?.slug ?? ""),
	)
	const genreIdx = c.genreNames.map((name) => index.get(`genre:${slugify(name)}`) ?? -1)
	const countryIdx = new Map(
		topCountries.map(([i], j) => [i, at("country", catalog.country[j].slug)]),
	)
	const decadeIdx = new Map(DECADES.map((d) => [d, at("decade", `${d}s`)]))
	const brandIdx = new Map(BRANDS.map((b) => [b.slug, at("service", b.slug)]))

	const single = new Uint32Array(3 * NV)
	const pair = new Uint32Array(3 * NV * NV)
	const top: Record<string, TitleKey[]> = {}
	const memberSets = new Map<string, Set<TitleKey>>()
	const qualifying = { movie: 0, show: 0, all: 0 }
	const members: number[] = []
	for (const r of rows) {
		const key = c.pointIds[r]
		const kind = key >= SHOW_BASE ? 1 : 0
		qualifying[kind ? "show" : "movie"]++
		qualifying.all++
		members.length = 0
		const m = c.moods[r]
		for (let i = 0; i < moodIdx.length; i++) if (m & (1 << i)) members.push(moodIdx[i])
		const g = c.genres[r]
		for (let i = 0; i < genreIdx.length; i++)
			if (g & (1 << i) && genreIdx[i] >= 0) members.push(genreIdx[i])
		for (let i = 0; i < themeIdx.length; i++) if (c.themes[r] & (1 << i)) members.push(themeIdx[i])
		for (let i = 0; i < styleIdx.length; i++) if (c.styles[r] & (1 << i)) members.push(styleIdx[i])
		if (facts) {
			const year = facts.releaseYears[r]
			const d = decadeIdx.get(Math.floor(year / 10) * 10)
			if (year && d !== undefined) members.push(d)
			for (let s = 0; s < 4; s++) {
				const ci = countryIdx.get(facts.countryIndexes[s * n + r])
				if (ci !== undefined && !members.includes(ci)) members.push(ci)
			}
		}
		if (services) {
			const sr = services.rowOf(key)
			if (sr >= 0)
				for (let i = services.offsets[sr]; i < services.offsets[sr + 1]; i++) {
					const brand = brandOfService(services.services[services.entries[i]])
					const bi = brand && brandIdx.get(brand.slug)
					if (bi !== undefined && bi !== null && !members.includes(bi)) members.push(bi)
				}
		}
		for (const kOff of [kind, 2]) {
			const base = kOff * NV
			for (let i = 0; i < members.length; i++) {
				const a = members[i]
				single[base + a]++
				const tk = `${KINDS[kOff]}|${all[a].family}:${all[a].slug}`
				if (single[base + a] <= TOP_N) (top[tk] ??= []).push(key)
				if (kOff !== 2) {
					let set = memberSets.get(tk)
					if (!set) memberSets.set(tk, (set = new Set()))
					set.add(key)
				}
				for (let j = 0; j < members.length; j++) {
					const b = members[j]
					if (all[a].family === all[b].family) continue
					if (FAMILIES.indexOf(all[a].family) > FAMILIES.indexOf(all[b].family)) continue
					pair[kOff * NV * NV + a * NV + b]++
				}
			}
		}
	}

	const singleOut: Record<string, number> = {}
	const pairOut: Record<string, number> = {}
	for (let k = 0; k < 3; k++)
		for (let a = 0; a < NV; a++) {
			singleOut[`${KINDS[k]}|${all[a].family}:${all[a].slug}`] = single[k * NV + a]
			for (let b = 0; b < NV; b++) {
				const x = pair[k * NV * NV + a * NV + b]
				if (x)
					pairOut[`${KINDS[k]}|${all[a].family}:${all[a].slug}|${all[b].family}:${all[b].slug}`] = x
			}
		}
	return {
		version: snapshot.version,
		qualifying,
		catalog,
		single: singleOut,
		pair: pairOut,
		top,
		members: memberSets,
		streamingCountry: services ? STREAMING_COUNTRY : "",
		minVotes,
		ms: Math.round(performance.now() - started),
	}
}
