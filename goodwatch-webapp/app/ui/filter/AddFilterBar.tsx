import { PlusIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import React from "react"
import type { DiscoverParams } from "~/server/discover.server"
import {
	type DiscoverFilterType,
	discoverFilters,
} from "~/server/types/discover-types"
import UserAction from "~/ui/auth/UserAction"
import FilterBarSection from "~/ui/filter/FilterBarSection"
import Appear from "~/ui/fx/Appear"

const presets = [
	{
		label: "Didn't Watch",
		paramms: "watchedType=didnt-watch",
	},
	{
		label: "My Streaming",
		paramms: "streamingPreset=mine",
	},
	{
		label: "Score above 80",
		paramms: "minScore=80&maxScore=100",
	},
	{
		label: "Similar to The Truman Show",
		paramms: "similarTitles=37165:movie:Sub-Genres;Mood;Themes;Plot",
	},
	{
		label: "With a dark mood",
		paramms: "similarDNA=Mood:Dark&similarDNACombinationType=any",
	},
	{
		label: "About Time Travel",
		paramms: "similarDNACombinationType=any&similarDNA=Themes:Time+Travel",
	},
	{
		label: "About Family Bonds",
		paramms: "similarDNACombinationType=any&similarDNA=Themes:Family+Bonds",
	},
	{
		label: "Launched a Franchise",
		paramms:
			"similarDNACombinationType=any&similarDNA=Cultural+Impact:Launched+A+Franchise",
	},
	{
		label: "Superhero with Inner Monologue",
		paramms:
			"similarDNACombinationType=all&similarDNA=Dialog:Inner+Monologue,Sub-Genres:Superhero",
	},
	{
		label: "On the moon",
		paramms:
			"similarDNACombinationType=any&similarDNA=Place:Moon,Place:Moon+Surface,Place:Moon+Colony",
	},
	{
		label: "In Medieval Times",
		paramms: "similarDNACombinationType=any&similarDNA=Time:Medieval+Times",
	},
	{
		label: "Slapstick Humor",
		paramms: "similarDNACombinationType=any&similarDNA=Humor:Slapstick",
	},
	{
		label: "With Electronic Music",
		paramms:
			"similarDNA=Score+and+Sound:Electronic+Music&similarDNACombinationType=any",
	},
	{
		label: "Dressed in Fantasy Costumes",
		paramms:
			"similarDNA=Costume+and+Set:Fantasy+Costumes&similarDNACombinationType=any",
	},
	{
		label: "Writing a Love Letter",
		paramms: "similarDNA=Key+Props:Love+Letter&similarDNACombinationType=any",
	},
	{
		label: "Released after 2020",
		paramms: `minYear=2020&maxYear=${new Date().getFullYear()}`,
	},
]

const randomPresets = presets.sort(() => Math.random() - 0.5).slice(0, 5)

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
								to={`/discover?${preset.paramms}`}
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
