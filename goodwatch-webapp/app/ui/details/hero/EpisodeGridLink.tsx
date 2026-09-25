import { TableCellsIcon } from "@heroicons/react/20/solid"
import type React from "react"
import { EPISODE_GRID_ANCHOR } from "~/ui/details/episode-grid/scale"

// A chip in the score bar that scrolls down to the episode grid. It is a real in-page
// link, so it works without JavaScript and from the keyboard; with JavaScript it scrolls
// smoothly and moves focus to the grid's heading.
export default function EpisodeGridLink() {
	const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
		const section = document.getElementById(EPISODE_GRID_ANCHOR)
		if (!section) return
		event.preventDefault()
		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		section.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" })
		history.replaceState(history.state, "", `#${EPISODE_GRID_ANCHOR}`)
		section.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true })
	}

	return (
		<a
			href={`#${EPISODE_GRID_ANCHOR}`}
			onClick={onClick}
			className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md bg-white/10 px-2 text-sm font-semibold text-gray-100 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:h-9"
		>
			<TableCellsIcon aria-hidden="true" className="h-4 w-4 text-gray-300" />
			Episode ratings
		</a>
	)
}
