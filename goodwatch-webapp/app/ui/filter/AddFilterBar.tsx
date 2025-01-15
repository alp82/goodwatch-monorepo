import { PlusIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import React, { useState } from "react"
import type { DiscoverParams } from "~/server/discover.server"
import {
	type DiscoverFilterType,
	discoverFilters,
} from "~/server/types/discover-types"
import UserAction from "~/ui/auth/UserAction"
import FilterBarSection from "~/ui/filter/FilterBarSection"
import Appear from "~/ui/fx/Appear"
import { useOnceMounted } from "~/utils/hydration"

const presets = [
	{
		label: "Didn't Watch",
		params: "watchedType=didnt-watch",
	},
	{
		label: "My Streaming",
		params: "streamingPreset=mine",
	},
	{
		label: "Score above 80",
		params: "minScore=80&maxScore=100",
	},
	{
		label: "Similar to The Truman Show",
		params: "similarTitles=37165:movie:Sub-Genres;Mood;Themes;Plot",
	},
	{
		label: "With a dark mood",
		params: "similarDNA=Mood_Dark&similarDNACombinationType=any",
	},
	{
		label: "About Time Travel",
		params: "similarDNACombinationType=any&similarDNA=Themes_Time+Travel",
	},
	{
		label: "About Family Bonds",
		params: "similarDNACombinationType=any&similarDNA=Themes_Family+Bonds",
	},
	{
		label: "Launched a Franchise",
		params:
			"similarDNACombinationType=any&similarDNA=Cultural+Impact_Launched+A+Franchise",
	},
	{
		label: "Superhero with Inner Monologue",
		params:
			"similarDNACombinationType=all&similarDNA=Dialog_Inner+Monologue,Sub-Genres_Superhero",
	},
	{
		label: "On the moon",
		params:
			"similarDNACombinationType=any&similarDNA=Place_Moon,Place_Moon+Surface,Place_Moon+Colony",
	},
	{
		label: "In Medieval Times",
		params: "similarDNACombinationType=any&similarDNA=Time_Medieval+Times",
	},
	{
		label: "Slapstick Humor",
		params: "similarDNACombinationType=any&similarDNA=Humor_Slapstick",
	},
	{
		label: "With Electronic Music",
		params:
			"similarDNA=Score+and+Sound_Electronic+Music&similarDNACombinationType=any",
	},
	{
		label: "Dressed in Fantasy Costumes",
		params:
			"similarDNA=Costume+and+Set_Fantasy+Costumes&similarDNACombinationType=any",
	},
	{
		label: "Writing a Love Letter",
		params: "similarDNA=Key+Props_Love+Letter&similarDNACombinationType=any",
	},
	{
		label: "Released after 2020",
		params: `minYear=2020&maxYear=${new Date().getFullYear()}`,
	},
]

interface AddFilterBarParams {
	params: DiscoverParams
	isVisible: boolean
	onSelect: (filterType: DiscoverFilterType) => void
}

export default function AddFilterBar({
	params,
	isVisible,
	onSelect,
}: AddFilterBarParams) {
	const [randomPresets, setRandomPresets] = useState(presets)

	useOnceMounted({
		onMount: () => {
			setRandomPresets(presets.sort(() => Math.random() - 0.5).slice(0, 5))
		},
	})

	const unusedFilters = Object.entries(discoverFilters).filter(
		([_, discoverFilter]) => {
			return (
				discoverFilter.associatedParams.filter((associatedParam) => {
					return params[associatedParam]
				}).length === 0
			)
		},
	)

	return (
		<div className="m-auto max-w-7xl w-full px-4 flex flex-col flex-wrap gap-1 text-sm border-gray-900 rounded-lg">
			<Appear isVisible={Boolean(isVisible) && unusedFilters.length > 0}>
				<Appear
					isVisible={
						unusedFilters.length === Object.keys(discoverFilters).length
					}
				>
					<div className="mb-2 flex items-center flex-wrap gap-4 text-xs">
						Try:
						{randomPresets.map((preset) => (
							<Link
								key={preset.label}
								className="text-blue-400 hover:underline cursor-pointer"
								to={`/discover?${preset.params}`}
								prefetch="viewport"
							>
								{preset.label}
							</Link>
						))}
					</div>
				</Appear>
				<div className="flex items-center flex-wrap gap-2 text-sm sm:text-base md:text-lg">
					{/*<FilterBarSection isCompact={true} color="stone" isActive={false}>*/}
					{/*	<PlusIcon className="h-8" title="Add filter" />*/}
					{/*</FilterBarSection>*/}
					{unusedFilters.map(([filterType, discoverFilter]) => (
						<UserAction
							key={filterType}
							requiresLogin={Boolean(discoverFilter.loginInstructions)}
							instructions={discoverFilter.loginInstructions}
						>
							<FilterBarSection
								isCompact={true}
								isActive={false}
								color={discoverFilter.color}
								onClick={() => onSelect(filterType as DiscoverFilterType)}
							>
								<span className="px-1.5 py-0.5 font-semibold">
									{discoverFilter.label}
								</span>
							</FilterBarSection>
						</UserAction>
					))}
				</div>
			</Appear>
		</div>
	)
}
