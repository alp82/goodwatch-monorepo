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
		label: "Similar to The Boys",
		params: "similarTitles=76479_tv_Sub-Genres|Mood|Themes|Plot",
	},
	{
		label: "Martial Arts",
		params:
			"similarDNA=307909_Sub-Genres|Martial+Arts&similarDNACombinationType=all",
	},
	{
		label: "With a dark mood",
		params: "similarDNA=308064_Mood|Dark&similarDNACombinationType=any",
	},
	{
		label: "About Time Travel",
		params:
			"similarDNACombinationType=any&similarDNA=293197_Sub-Genres|Time+Travel,309362_Key+Props|Time+Machine+%28Time+Travel+Machine%29",
	},
	{
		label: "About Family Bonds",
		params:
			"similarDNA=308029_Themes|Family+Bonds&similarDNACombinationType=any",
	},
	{
		label: "Launched a Franchise",
		params:
			"similarDNA=309817_Cultural+Impact|Launched+A+Franchise&similarDNACombinationType=any",
	},
	{
		label: "Superhero with Inner Monologue",
		params:
			"similarDNACombinationType=all&similarDNA=275104_Dialog|Inner+Monologue,308743_Sub-Genres|Superhero",
	},
	{
		label: "On the moon",
		params:
			"similarDNACombinationType=any&similarDNA=267072_Place|Moon,249760_Place|Lunar+Surface+%28Moon+Landscape%29,224294_Place|Moon+Base,167708_Plot|Journey+To+The+Moon",
	},
	{
		label: "In Medieval Times",
		params:
			"similarDNACombinationType=any&similarDNA=308692_Time|Medieval+Times",
	},
	{
		label: "Slapstick Humor",
		params: "similarDNACombinationType=all&similarDNA=307874_Humor|Slapstick",
	},
	{
		label: "With Electronic Music",
		params:
			"similarDNACombinationType=all&similarDNA=308078_Score+and+Sound|Electronic+Music",
	},
	{
		label: "Dressed in Fantasy Costumes",
		params:
			"similarDNACombinationType=all&similarDNA=292569_Costume+and+Set|Fantasy+Costumes",
	},
	{
		label: "Writing a Love Letter",
		params:
			"similarDNA=308059_Key+Props|Love+Letters&similarDNACombinationType=any",
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
