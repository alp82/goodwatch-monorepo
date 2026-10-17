// PROTOTYPE - throwaway. What every variant of the episodes section gets.
import type { ReactNode } from "react"
import type { EpisodeGrid } from "~/server/episode-grid.server"
import type { TrackedMedia } from "~/ui/tracking/gate"
export interface VariantProps {
	media: TrackedMedia
	/** The show's IMDb ratings grid data, or null. */
	grid: EpisodeGrid | null
	/** Today's rendered EpisodeGrid component, for variants that reuse it as is. */
	gridNode: ReactNode
}
