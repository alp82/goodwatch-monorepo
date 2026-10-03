// PROTOTYPE (throwaway): the data side of the age-filter variants. Reads each loaded title's certifications and
// content advisories from /api/prototype/age-ratings and turns them into a rating in the viewer's country.
//
// The rules here are guesses to make the variants testable, not decisions:
// - A title with several ratings in one country takes the strictest.
// - A title without a rating in the country gets an estimate: the median age across the countries that rated it.
// - Rating codes become ages by a small hand-made table (US, GB, AU) or the number in the code (FSK 12 → 12).
import { useQueries } from "@tanstack/react-query"
import type { TitleKey } from "~/utils/title-key"

export interface LadderRow {
	code: string
	media_type: "movie" | "show"
	meaning: string
	order_default: number
}

export interface TitleRating {
	/** Every country's ratings, as "DE_12". */
	certs: string[]
	advisories: string[]
	kids: boolean | null
	teens: boolean | null
	family: boolean | null
}

export interface AgeRatingsResponse {
	country: string
	ladder: LadderRow[]
	titles: Record<string, TitleRating>
}

const WORD_AGES: Record<string, Record<string, number>> = {
	US: {
		G: 0,
		PG: 8,
		"PG-13": 13,
		R: 17,
		"NC-17": 18,
		"TV-Y": 0,
		"TV-Y7": 7,
		"TV-G": 0,
		"TV-PG": 8,
		"TV-14": 14,
		"TV-MA": 17,
	},
	GB: { U: 0, PG: 8, "12A": 12, "12": 12, "15": 15, "18": 18, R18: 18 },
	AU: { G: 0, PG: 8, M: 15, "MA 15+": 15, "MA15+": 15, "R 18+": 18, "R18+": 18 },
}
const ALL_AGES = new Set(["AL", "ALL", "TP", "U", "T", "A", "AA", "L", "G"])

/** The minimum age a rating code stands for; null for codes that aren't a rating (NR, Unrated). */
export function ageOf(country: string, code: string): number | null {
	const known = WORD_AGES[country]?.[code]
	if (known !== undefined) return known
	const number = code.match(/\d+/)
	if (number) return Math.min(18, Number(number[0]))
	return ALL_AGES.has(code.toUpperCase()) ? 0 : null
}

export const nativeLabel = (country: string, code: string) =>
	country === "DE" ? `FSK ${code}` : code

export interface Step {
	age: number
	label: string
	/** The show rating at the same step, where the country rates shows on another ladder. */
	sub?: string
}

const FIXED_STEPS: Record<string, Step[]> = {
	US: [
		{ age: 0, label: "G", sub: "TV-G" },
		{ age: 8, label: "PG", sub: "TV-PG" },
		{ age: 14, label: "PG-13", sub: "TV-14" },
		{ age: 17, label: "R", sub: "TV-MA" },
	],
}

/** The country's ladder as "up to" steps, lowest first. Falls back to plain ages for a country TMDB has no ladder for. */
export function stepsOf(country: string, ladder: LadderRow[]): Step[] {
	if (FIXED_STEPS[country]) return FIXED_STEPS[country]
	const byAge = new Map<number, string>()
	// Movie codes label a step; show codes fill the steps movies don't have.
	for (const type of ["movie", "show"] as const)
		for (const row of ladder) {
			if (row.media_type !== type) continue
			const age = ageOf(country, row.code)
			if (age !== null && !byAge.has(age))
				byAge.set(age, nativeLabel(country, row.code))
		}
	if (byAge.size < 2)
		return [0, 6, 12, 16, 18].map((age) => ({ age, label: `${age}+` }))
	return [...byAge].sort((a, b) => a[0] - b[0]).map(([age, label]) => ({ age, label }))
}

export interface Resolved {
	/** local: rated in the viewer's country. estimated: rated elsewhere only. none: no rating anywhere. */
	source: "local" | "estimated" | "none"
	age: number | null
	label: string | null
}

export function resolve(rating: TitleRating | undefined, country: string): Resolved {
	const parsed = (rating?.certs ?? []).map((cert) => {
		const at = cert.indexOf("_")
		const cc = cert.slice(0, at)
		const code = cert.slice(at + 1)
		return { cc, code, age: ageOf(cc, code) }
	})
	const local = parsed
		.filter((c) => c.cc === country && c.age !== null)
		.sort((a, b) => (b.age ?? 0) - (a.age ?? 0))[0]
	if (local)
		return { source: "local", age: local.age, label: nativeLabel(country, local.code) }
	const ages = parsed
		.map((c) => c.age)
		.filter((age): age is number => age !== null)
		.sort((a, b) => a - b)
	if (!ages.length) return { source: "none", age: null, label: null }
	const age = ages[Math.floor(ages.length / 2)]
	return { source: "estimated", age, label: `~${age}` }
}

export const FLAGS = [
	{ key: "violence", label: "Graphic violence", match: /violen|gore|blood|brutal|tortur/ },
	{ key: "sex", label: "Sex & nudity", match: /sex|nud|erotic/ },
	{ key: "scary", label: "Scary scenes", match: /scar|horror|fright|disturb|terror/ },
	{ key: "language", label: "Strong language", match: /languag|profan|swear/ },
	{ key: "drugs", label: "Drugs & alcohol", match: /drug|alcohol|substance|smok/ },
] as const
export type FlagKey = (typeof FLAGS)[number]["key"]

/** The content flags a title's advisories raise. */
export function flagsOf(rating: TitleRating | undefined): FlagKey[] {
	const text = (rating?.advisories ?? []).map((a) => String(a).toLowerCase())
	return FLAGS.filter((flag) => text.some((a) => flag.match.test(a))).map(
		(flag) => flag.key,
	)
}

const CHUNK = 40

/** The ratings of the loaded titles, asked for a page at a time so scrolling only fetches the new page. */
export function useAgeRatings(
	keys: TitleKey[],
	country: string | undefined,
	enabled: boolean,
) {
	const chunks: TitleKey[][] = []
	for (let i = 0; i < keys.length; i += CHUNK)
		chunks.push(keys.slice(i, i + CHUNK))
	return useQueries({
		queries: chunks.map((chunk) => ({
			queryKey: ["prototype-age-ratings", country ?? "", chunk.join(",")],
			queryFn: async (): Promise<AgeRatingsResponse> => {
				const params = new URLSearchParams({ keys: chunk.join(",") })
				if (country) params.set("country", country)
				const response = await fetch(`/api/prototype/age-ratings?${params}`)
				if (!response.ok) throw new Error(`age ratings: ${response.status}`)
				return response.json()
			},
			enabled,
		})),
		combine,
	})
}

// Module-level, so the combined result keeps its identity between renders.
function combine(
	results: { data?: AgeRatingsResponse; isLoading: boolean; isError: boolean }[],
) {
	const titles = new Map<TitleKey, TitleRating>()
	let first: AgeRatingsResponse | null = null
	for (const { data } of results) {
		if (!data) continue
		first ??= data
		for (const [key, rating] of Object.entries(data.titles))
			titles.set(Number(key), rating)
	}
	return {
		titles,
		country: first?.country ?? "",
		ladder: first?.ladder ?? [],
		loading: results.some((r) => r.isLoading),
		failed: results.some((r) => r.isError),
	}
}
