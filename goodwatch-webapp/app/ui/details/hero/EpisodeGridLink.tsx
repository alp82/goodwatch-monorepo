import type React from "react"
import type { EpisodeGrid } from "~/server/episode-grid.server"
import { useBelowFold } from "~/ui/details/below-fold"
import { EPISODE_GRID_ANCHOR, imdbVibe, miniatureScores, vibeTileColor } from "~/ui/details/episode-grid/scale"

// The way down to the episode ratings, in the hero's row of site chips: a miniature of the ratings grid in the
// show's own colours, from its first episode to its last, four by three as the Grid toggle of the Episodes
// section draws its picture (ui/tracking/EpisodeList.tsx). It is a real in-page link, so it works without
// JavaScript and from the keyboard; with JavaScript it scrolls smoothly and moves focus to the grid's heading.
export default function EpisodeGridLink({ grid, className = "" }: { grid: EpisodeGrid; className?: string }) {
	const { layOutAll } = useBelowFold()
	const onClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
		const section = document.getElementById(EPISODE_GRID_ANCHOR)
		if (!section) return
		event.preventDefault()
		layOutAll()
		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		section.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" })
		history.replaceState(history.state, "", `#${EPISODE_GRID_ANCHOR}`)
		section.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true })
	}

	return (
		<a
			href={`#${EPISODE_GRID_ANCHOR}`}
			data-episode-ratings
			onClick={onClick}
			aria-label="Episode ratings: every episode in one grid"
			title="Episode ratings: every episode in one grid"
			className={`group inline-flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${className}`}
		>
			<span className="text-xs font-semibold text-gray-300 group-hover:text-white max-sm:hidden">Episodes</span>
			<span className="flex h-7 w-10 items-center justify-center rounded-lg bg-[#141923] ring-1 ring-white/20 transition group-hover:ring-white/60">
				<span aria-hidden="true" className="grid grid-cols-4 gap-px">
					{miniatureScores(grid).map((score, index) => (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: a fixed drawing
							key={index}
							className="h-[5px] w-[7px] rounded-[1px]"
							style={{ background: vibeTileColor(imdbVibe(score)) }}
						/>
					))}
				</span>
			</span>
		</a>
	)
}
