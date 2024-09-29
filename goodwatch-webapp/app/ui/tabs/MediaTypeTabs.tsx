import { FilmIcon, TvIcon } from "@heroicons/react/20/solid"
import { RectangleGroupIcon } from "@heroicons/react/24/solid"
import React from "react"
import type { FilterMediaType } from "~/server/search.server"
import Tabs, { type Tab } from "~/ui/tabs/Tabs"

export interface MediaTypeTabsProps {
	selected: FilterMediaType
	onSelect: (tab: Tab<FilterMediaType>) => void
}

export default function MediaTypeTabs({
	selected,
	onSelect,
}: MediaTypeTabsProps) {
	const discoverTypeTabs: Tab<FilterMediaType>[] = [
		{
			key: "all",
			label: "All",
			icon: RectangleGroupIcon,
			current: selected === "all",
		},
		{
			key: "movies",
			label: "Movies",
			icon: FilmIcon,
			current: selected === "movies",
		},
		{
			key: "tv",
			label: "TV Shows",
			icon: TvIcon,
			current: selected === "tv",
		},
	]
	return <Tabs tabs={discoverTypeTabs} pills={false} onSelect={onSelect} />
}
