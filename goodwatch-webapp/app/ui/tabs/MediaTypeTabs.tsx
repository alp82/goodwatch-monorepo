import { FilmIcon, TvIcon } from "@heroicons/react/20/solid"
import React from "react"
import type { MediaType } from "~/server/search.server"
import Tabs, { type Tab } from "~/ui/tabs/Tabs"

export interface MediaTypeTabsProps {
	selected: MediaType
	onSelect: (tab: Tab<MediaType>) => void
}

export default function MediaTypeTabs({
	selected,
	onSelect,
}: MediaTypeTabsProps) {
	const discoverTypeTabs: Tab<MediaType>[] = [
		{
			key: "movie",
			label: "Movies",
			icon: FilmIcon,
			current: selected === "movie",
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
