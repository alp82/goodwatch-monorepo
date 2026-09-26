import { TableCellsIcon } from "@heroicons/react/20/solid"
import type React from "react"
import { EPISODE_GRID_ANCHOR } from "~/ui/details/episode-grid/scale"

// A quiet text link in the ratings row that scrolls down to the episode grid. It is a real
// in-page link, so it works without JavaScript and from the keyboard; with JavaScript it scrolls
// smoothly and moves focus to the grid's heading.
export default function EpisodeGridLink({ className = "" }: { className?: string }) {
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
			className={`inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-gray-300 underline decoration-white/25 underline-offset-4 hover:text-white hover:decoration-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${className}`}
		>
			<TableCellsIcon aria-hidden="true" className="h-4 w-4 text-gray-400" />
			Episode ratings
		</a>
	)
}
