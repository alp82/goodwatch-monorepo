import { BookmarkIcon } from "@heroicons/react/20/solid";
import {
	EyeIcon,
	EyeSlashIcon,
	RectangleStackIcon,
	Squares2X2Icon,
} from "@heroicons/react/24/solid";
import type { ComponentType, HTMLAttributes, ReactNode } from "react";
import type {
	DiscoverParams,
	SimilarDNACombinationType,
	WatchedType,
} from "~/server/discover.server";
import type { RadioOption } from "~/ui/form/RadioBlock";
import { Tag } from "~/ui/tags/Tag";
import type { ColorName } from "~/utils/color";

export interface WatchOption extends RadioOption {
	name: WatchedType;
	color: ColorName;
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
];

export interface CombinationTypeOption extends RadioOption {
	name: SimilarDNACombinationType;
}

export const combinationTypeOptions: CombinationTypeOption[] = [
	{
		name: "all",
		label: "All",
		description: "All selections must match for each title",
		icon: RectangleStackIcon,
	},
	{
		name: "any",
		label: "Any",
		description: "At least one selection must match",
		icon: Squares2X2Icon,
	},
];

export const DISCOVER_FILTER_TYPES = [
	"watch",
	"streaming",
	"score",
	"similar",
	"dna",
	"genre",
	"release",
	"cast",
	"crew",
] as const;

export type DiscoverFilterType = (typeof DISCOVER_FILTER_TYPES)[number];

export interface DiscoverFilterOption {
	label: string;
	color: ColorName;
	associatedParams: (keyof DiscoverParams)[];
	loginInstructions?: ReactNode;
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
		similar: {
			label: "Similar",
			color: "rose",
			associatedParams: ["similarTitles"],
		},
		dna: {
			label: "DNA",
			color: "indigo",
			associatedParams: ["similarDNA", "similarDNACombinationType"],
		},
		genre: {
			label: "Genre",
			color: "amber",
			associatedParams: ["withGenres", "withoutGenres"],
		},
		release: {
			label: "Release",
			color: "cyan",
			associatedParams: ["minYear", "maxYear"],
		},
		cast: {
			label: "Cast",
			color: "purple",
			associatedParams: ["withCast", "withoutCast"],
		},
		crew: {
			label: "Crew",
			color: "pink",
			associatedParams: ["withCrew", "withoutCrew"],
		},
	};
