// A show's episodes: the ratings grid, or for a member with episode tracking the episode list around it. A long grid
// comes as its newest part; the rest loads when the visitor asks or the member's list needs it.
import { useEffect, useRef } from "react"
import type { EpisodeLayout } from "~/domain/tracking/episode-layout"
import type { EpisodeGrid as EpisodeGridData } from "~/server/episode-grid.server"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import EpisodeGrid from "~/ui/details/episode-grid/EpisodeGrid"
import {
	GridWindowNotice,
	useWholeEpisodeGrid,
} from "~/ui/details/episode-grid/whole"
import { TrackedEpisodes, useEpisodeTracking } from "~/ui/tracking/gate"

export function EpisodesSection({
	media,
	episodeGrid,
	episodeLayout,
}: {
	media: MovieResult | ShowResult
	episodeGrid: EpisodeGridData | null
	episodeLayout?: EpisodeLayout | null
}) {
	const tracking = useEpisodeTracking(media)
	const whole = useWholeEpisodeGrid(episodeGrid)
	const grid = whole.shown
	// The button for the rest goes when every season is in; the keyboard focus moves to the grid's heading.
	const partial = Boolean(grid?.window)
	const wasPartial = useRef(partial)
	useEffect(() => {
		if (wasPartial.current && !partial)
			document
				.getElementById("episode-grid-title")
				?.focus({ preventScroll: true })
		wasPartial.current = partial
	}, [partial])
	const gridView = grid && (
		<EpisodeGrid
			grid={grid}
			notice={<GridWindowNotice grid={grid} whole={whole} />}
		/>
	)
	if (tracking)
		return (
			<TrackedEpisodes
				media={media}
				grid={whole.scores}
				layout={episodeLayout}
				onWanted={whole.load}
				wrapper={{ "data-feedback-area": "episodes" }}
			>
				{gridView}
			</TrackedEpisodes>
		)
	return grid ? <div data-feedback-area="episodes">{gridView}</div> : null
}
