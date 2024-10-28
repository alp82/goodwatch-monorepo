import { BookmarkIcon } from "@heroicons/react/20/solid"
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/solid"
import type { ComponentType, HTMLAttributes, ReactNode } from "react"
import type { DiscoverParams, WatchedType } from "~/server/discover.server"
import { Tag } from "~/ui/tags/Tag"
import type { ColorName } from "~/utils/color"

export interface WatchOption {
	name: WatchedType
	label: string
	description: string
	icon: ComponentType<HTMLAttributes<SVGElement>>
	color: ColorName
}

export const watchOptions: WatchOption[] = [
	{
		name: "didnt-watch",
		label: "Didn't Watch",
		description: "Show only what I didn't watch yet",
		icon: EyeSlashIcon,
		color: "orange",
	},
	{
		name: "plan-to-watch",
		label: "Plan to Watch",
		description: "Show only what I plan to watch",
		icon: BookmarkIcon,
		color: "amber",
	},
	{
		name: "watched",
		label: "Seen this",
		description: "Show only what I watched already",
		icon: EyeIcon,
		color: "green",
	},
]

export const DISCOVER_FILTER_TYPES = [
	"watch",
	"streaming",
	"score",
	"genre",
	"dna",
	"release",
	"cast",
	"crew",
] as const

export type DiscoverFilterType = (typeof DISCOVER_FILTER_TYPES)[number]

export interface DiscoverFilterOption {
	label: string
	color: ColorName
	associatedParams: (keyof DiscoverParams)[]
	loginInstructions?: ReactNode
}

export const discoverFilters: Record<DiscoverFilterType, DiscoverFilterOption> =
	{
		watch: {
			label: "Watch",
			color: "blue",
			associatedParams: ["watchedType"],
			loginInstructions: (
				<div className="flex flex-col gap-3">
					<p>Filter by what you've already seen and plan to watch.</p>
					<div className="flex flex-col gap-1">
						{watchOptions.map((watchOption) => (
							<Tag
								key={watchOption.name}
								color={watchOption?.color}
								icon={watchOption?.icon}
							>
								{watchOption?.label}
							</Tag>
						))}
					</div>
				</div>
			),
		},
		streaming: {
			label: "Streaming",
			color: "emerald",
			associatedParams: ["streamingPreset", "withStreamingProviders"],
		},
		score: {
			label: "Score",
			color: "slate",
			associatedParams: ["minScore", "maxScore"],
		},
		genre: {
			label: "Genre",
			color: "amber",
			associatedParams: ["withGenres", "withoutGenres"],
		},
		dna: {
			label: "DNA",
			color: "indigo",
			associatedParams: [],
		},
		release: {
			label: "Release",
			color: "cyan",
			associatedParams: ["minYear", "maxYear"],
		},
		cast: {
			label: "Cast",
			color: "purple",
			associatedParams: ["withCast"],
		},
		crew: {
			label: "Crew",
			color: "pink",
			associatedParams: ["withCrew"],
		},
	}
