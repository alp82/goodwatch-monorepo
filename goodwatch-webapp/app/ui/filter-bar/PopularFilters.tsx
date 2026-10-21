// Popular one-tap filters: what many people look for. The count line offers a few while no filter is set, and the
// sheet shows them as tiles above "Add a filter".
import { PlusIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import type { FilterName, FilterState } from "~/domain/filter-state"
import type { FilterGroupsData } from "./FilterGroups"
import type { CardKey } from "./filter-cards"
import { TAP } from "./motion"
import { PROVIDER_LOGO } from "./useFilterData"

/** A one-tap filter many people look for: it sets the value and brings in its card. */
export interface Popular {
	id: string
	label: string
	key: CardKey
	on: (s: FilterState) => boolean
	apply: (data: FilterGroupsData) => Partial<FilterState>
	count?: (data: FilterGroupsData) => number | null
	logo?: (data: FilterGroupsData) => string | null
}

const addTo = <T,>(list: T[] | undefined, v: T) => [
	...new Set([...(list ?? []), v]),
]
const oc = (data: FilterGroupsData, g: FilterName, o: string) =>
	data.counts?.optionCounts[g]?.[o] ?? null
const NETFLIX = 8

const POPULAR: Popular[] = [
	{
		id: "netflix",
		label: "On Netflix",
		key: "services",
		on: (s) => !s.onMyServices && !!s.services?.includes(NETFLIX),
		apply: () => ({
			onMyServices: false,
			anyService: undefined,
			services: [NETFLIX],
		}),
		logo: (data) => {
			const p = data.countryProviders.find((x) => x.id === NETFLIX)
			return p ? `${PROVIDER_LOGO}${p.logo_path}` : null
		},
	},
	{
		id: "comedy",
		label: "Comedy",
		key: "genres",
		on: (s) => s.genres.includes("Comedy"),
		apply: (d) => ({ genres: addTo(d.state.genres, "Comedy") }),
		count: (d) => oc(d, "genres", "Comedy"),
	},
	{
		id: "feelgood",
		label: "Feel-good",
		key: "moods",
		on: (s) => s.moods.includes("feelgood"),
		apply: (d) => ({ moods: addTo(d.state.moods, "feelgood").slice(-3) }),
		count: (d) => oc(d, "moods", "feelgood"),
	},
	{
		id: "score80",
		label: "Score 80+",
		key: "minScore",
		on: (s) => s.minScore >= 80,
		apply: () => ({ minScore: 80 }),
		count: (d) => oc(d, "minScore", "80"),
	},
	{
		id: "recent",
		label: "Last 3 years",
		key: "released",
		on: (s) => s.released === "recent",
		apply: () => ({ released: "recent", years: undefined }),
		count: (d) => oc(d, "released", "recent"),
	},
	{
		id: "short",
		label: "Under 90 min",
		key: "runtime",
		on: (s) => s.runtime?.max === 90 && !s.runtime.min,
		apply: () => ({ runtime: { max: 90 } }),
	},
	{
		id: "agree",
		label: "Critics and audiences agree",
		key: "scoreGap",
		on: (s) => s.scoreGap === "agree",
		apply: () => ({ scoreGap: "agree" }),
		count: (d) => oc(d, "scoreGap", "agree"),
	},
	{
		id: "mind",
		label: "Mind-bending",
		key: "moods",
		on: (s) => s.moods.includes("mind"),
		apply: (d) => ({ moods: addTo(d.state.moods, "mind").slice(-3) }),
		count: (d) => oc(d, "moods", "mind"),
	},
	{
		id: "imdb8",
		label: "IMDb 8.0+",
		key: "sourceScores",
		on: (s) => (s.sourceScores?.imdb ?? 0) >= 80,
		apply: (d) => ({
			sourceScores: { ...(d.state.sourceScores ?? {}), imdb: 80 },
		}),
	},
	{
		id: "horror",
		label: "Horror",
		key: "genres",
		on: (s) => s.genres.includes("Horror"),
		apply: (d) => ({ genres: addTo(d.state.genres, "Horror") }),
		count: (d) => oc(d, "genres", "Horror"),
	},
	{
		id: "noanime",
		label: "No anime",
		key: "type",
		on: (s) => s.anime === "none",
		apply: () => ({ anime: "none" }),
		count: (d) => oc(d, "anime", "none"),
	},
	{
		id: "episodes",
		label: "Short episodes",
		key: "runtime",
		on: (s) => s.type === "show" && s.runtime?.max === 35,
		apply: () => ({ type: "show", runtime: { max: 35 } }),
	},
]

export const popularFor = (data: FilterGroupsData) =>
	POPULAR.filter((p) => !p.on(data.state) && (!p.logo || p.logo(data)))

/** The popular filters as quiet one-tap links, for the count line when nothing is set: "Try + Comedy + Score 80+ …". */
export function PopularInline({
	data,
	max = 5,
}: { data: FilterGroupsData; max?: number }) {
	const picks = popularFor(data).slice(0, max)
	if (!picks.length) return null
	return (
		<span className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
			<span className="text-sm text-gray-500">Try</span>
			{picks.map((p) => (
				<motion.button
					key={p.id}
					type="button"
					whileTap={TAP}
					onClick={() => data.onChange({ ...data.state, ...p.apply(data) })}
					className="flex items-center gap-1.5 rounded-md text-sm font-semibold whitespace-nowrap text-gray-300 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<PlusIcon className="h-3.5 w-3.5 text-gray-500" />
					{p.label}
				</motion.button>
			))}
		</span>
	)
}
