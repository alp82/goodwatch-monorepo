// PROTOTYPE (Discover lab, origin): shared pieces for the Made in variants. Production countries (filter-state
// productionCountries: a title fits when any picked country made it, co-productions included). Regions and
// "outside Hollywood" are curated lists of the countries that make most titles. Counts come from one results request
// per country or group (everything else as set), since the results endpoint only counts chosen countries.
import { useQueries } from "@tanstack/react-query"
import { productionCountryName } from "~/domain/production-country"
import { useCountries } from "~/routes/api.countries"
import type { ProtoDiscover } from "../../../kit"

export const POPULAR = ["US", "GB", "FR", "JP", "KR", "DE", "IT", "ES", "IN", "CA", "AU", "SE", "DK", "MX", "BR", "CN"]

export interface Region {
	id: string
	name: string
	codes: string[]
}

export const REGIONS: Region[] = [
	{ id: "na", name: "North America", codes: ["US", "CA"] },
	{
		id: "eu",
		name: "Europe",
		codes: ["GB", "FR", "DE", "IT", "ES", "SE", "DK", "NO", "FI", "NL", "BE", "IE", "PL", "AT", "CH", "PT", "CZ", "HU", "GR", "IS", "RO"],
	},
	{ id: "asia", name: "Asia", codes: ["JP", "KR", "CN", "HK", "TW", "IN", "TH", "ID", "PH", "MY", "SG", "VN"] },
	{ id: "latam", name: "Latin America", codes: ["MX", "BR", "AR", "CL", "CO", "PE", "CU", "UY"] },
	{ id: "mea", name: "Middle East and Africa", codes: ["TR", "IL", "IR", "EG", "LB", "SA", "AE", "ZA", "NG", "MA", "TN"] },
	{ id: "oc", name: "Oceania", codes: ["AU", "NZ"] },
]

export const HOLLYWOOD = ["US"]

export interface Industry {
	id: string
	name: string
	codes: string[]
}

/** Film industries as country sets. Each is "made with at least one of these countries", co-productions included,
 * since productionCountries can only include (there's no exclusion). */
export const INDUSTRIES: Industry[] = [
	{ id: "hollywood", name: "Hollywood", codes: ["US"] },
	{ id: "bollywood", name: "Bollywood", codes: ["IN"] },
	{ id: "korean", name: "Korean", codes: ["KR"] },
	{ id: "japanese", name: "Japanese", codes: ["JP"] },
	{ id: "british", name: "British", codes: ["GB"] },
	{ id: "french", name: "French", codes: ["FR"] },
	{ id: "nollywood", name: "Nollywood", codes: ["NG"] },
	{ id: "hongkong", name: "Hong Kong", codes: ["HK"] },
	{ id: "chinese", name: "Chinese", codes: ["CN"] },
	{ id: "spanish", name: "Spanish", codes: ["ES"] },
	{ id: "italian", name: "Italian", codes: ["IT"] },
	{ id: "turkish", name: "Turkish", codes: ["TR"] },
	{ id: "nordic", name: "Nordic", codes: ["SE", "DK", "NO", "FI", "IS"] },
]

/** The big industries "Rest of the world" leaves out. */
export const BIG = ["US", "IN", "KR", "JP", "GB", "FR", "CN", "HK"]

/** Every other country the catalog knows. A title made with one of them and one of the big ones still fits. */
export const restOfWorld = (list: { code: string }[]) => list.map((c) => c.code).filter((c) => !BIG.includes(c)).sort()
export const WORLD = REGIONS.flatMap((r) => r.codes).filter((c) => c !== "US")

export const flagUrl = (code: string) => `https://flagcdn.com/w80/${code.toLowerCase()}.png`

export function Flag({ code, className = "h-4 w-6" }: { code: string; className?: string }) {
	return <img src={flagUrl(code)} alt="" loading="lazy" className={`shrink-0 rounded-[3px] object-cover ring-1 ring-white/10 ${className}`} />
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && b.every((c) => a.includes(c))

/** Read and write the production countries. */
export function useOrigin(d: ProtoDiscover) {
	const chosen = d.filters.state.productionCountries ?? []
	const set = (codes: string[]) => d.filters.set({ productionCountries: codes.length ? [...new Set(codes)] : undefined })
	const has = (code: string) => chosen.includes(code)
	const toggle = (code: string) => set(has(code) ? chosen.filter((c) => c !== code) : [...chosen, code])
	const allOf = (codes: string[]) => codes.every(has)
	const toggleAll = (codes: string[]) => set(allOf(codes) ? chosen.filter((c) => !codes.includes(c)) : [...chosen, ...codes])
	return {
		chosen,
		has,
		toggle,
		set,
		allOf,
		toggleAll,
		only: (codes: string[]) => set(sameSet(chosen, codes) ? [] : codes),
		isOnly: (codes: string[]) => chosen.length > 0 && sameSet(chosen, codes),
		clear: () => set([]),
	}
}

/** Every country the catalog knows, by name; the picked ones always included. */
export function useAllCountries(chosen: string[]) {
	const countries = useCountries()
	const map = new Map<string, string>()
	for (const c of countries.data ?? []) if (/^[A-Z]{2}$/.test(c.code)) map.set(c.code, productionCountryName(c.code))
	for (const c of [...chosen, ...POPULAR, ...WORLD]) if (!map.has(c)) map.set(c, productionCountryName(c))
	return { list: [...map].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name)), loading: countries.isLoading }
}

export const searchCountries = (list: { code: string; name: string }[], term: string) => {
	const t = term.trim().toLowerCase()
	if (!t) return list
	return list.filter((c) => c.name.toLowerCase().includes(t) || c.code.toLowerCase() === t)
}

/** Titles each group of countries would leave, with everything else as set. `[]` is "any country". */
export function useOriginCounts(d: ProtoDiscover, groups: string[][]): (number | null)[] {
	const base = new URLSearchParams(d.filters.query)
	base.delete("productionCountries")
	base.delete("page")
	const baseKey = base.toString()
	const results = useQueries({
		queries: groups.map((codes) => {
			const p = new URLSearchParams(baseKey)
			if (codes.length) p.set("productionCountries", [...codes].sort().join(","))
			p.set("page", "1")
			const qs = p.toString()
			return {
				queryKey: ["lab-origin-count", qs],
				staleTime: 10 * 60_000,
				queryFn: async ({ signal }: { signal: AbortSignal }) => {
					const r = await fetch(`/api/discover/results?${qs}`, { signal })
					if (!r.ok) throw new Error(`Results ${r.status}`)
					return ((await r.json()) as { total: number }).total
				},
			}
		}),
	})
	return results.map((r) => r.data ?? null)
}
