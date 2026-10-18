// The rest of a long episode grid. The show page renders the grid's newest part (window.ts); the visitor asks for
// every season with the notice's button, and a member's episode list asks for every site's season scores. Either
// way the whole grid comes from api.episode-grid.ts, once.
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import type { EpisodeGrid } from "~/server/episode-grid.server"
import { formatCount } from "~/ui/details/episode-grid/scale"
import { unpackEpisodeGrid } from "~/utils/episode-grid-wire"

const wholeGridQuery = (grid: EpisodeGrid | null) => {
	const showId = grid?.showId ?? 0
	const language = grid?.window?.language
	return {
		queryKey: ["episode-grid", showId, language ?? null],
		queryFn: async () => {
			const response = await fetch(
				`/api/episode-grid?show=${showId}${language ? `&displayLanguage=${encodeURIComponent(language)}` : ""}`,
			)
			if (!response.ok) throw new Error(`Episode grid: ${response.status}`)
			return unpackEpisodeGrid(await response.json())
		},
	}
}

export interface WholeEpisodeGrid {
	/** The grid to draw: its part until the visitor asks for every season and it is in. */
	shown: EpisodeGrid | null
	/** The whole grid once it is in, for every season's scores; the part until then. */
	scores: EpisodeGrid | null
	/** Whether the visitor asked for every season and it is not in yet, or failed to come. */
	state: "idle" | "loading" | "failed"
	/** Draws every season, loading them first when needed. */
	showAll: () => void
	/** Loads every season without drawing them. */
	load: () => void
	/** Starts loading on intent, so a press finds them in. */
	prefetch: () => void
}

export function useWholeEpisodeGrid(
	grid: EpisodeGrid | null,
): WholeEpisodeGrid {
	const queryClient = useQueryClient()
	const partial = grid?.window ? grid : null
	const [asked, setAsked] = useState(false)
	const [needed, setNeeded] = useState(false)
	const query = useQuery({
		...wholeGridQuery(partial),
		enabled: Boolean(partial) && needed,
	})
	const whole = partial ? (query.data ?? null) : grid
	return {
		shown: asked && whole ? whole : grid,
		scores: whole ?? grid,
		state: !asked || whole ? "idle" : query.isError ? "failed" : "loading",
		showAll: () => {
			setAsked(true)
			setNeeded(true)
			if (query.isError) void query.refetch()
		},
		load: () => setNeeded(true),
		prefetch: () => {
			if (partial) void queryClient.prefetchQuery(wholeGridQuery(partial))
		},
	}
}

/** The line above a part of the grid: what it shows, and the button for every season. */
export function GridWindowNotice({
	grid,
	whole,
}: { grid: EpisodeGrid; whole: WholeEpisodeGrid }) {
	const part = grid.window
	if (!part) return null
	const shownText =
		part.firstEpisodeNumber !== undefined
			? `Showing episodes ${formatCount(part.firstEpisodeNumber)} to ${formatCount(grid.maxEpisodeNumber)}`
			: grid.seasons.length === 1
				? `Showing the latest of ${part.seasons} seasons`
				: `Showing the latest ${grid.seasons.length} of ${part.seasons} seasons`
	const buttonText =
		whole.state === "loading"
			? "Loading"
			: whole.state === "failed"
				? "Couldn't load them. Try again"
				: part.hiddenSeasons > 0
					? `Show all ${part.seasons} seasons`
					: `Show all ${formatCount(part.episodes)} episodes`
	return (
		<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-gray-400">
			<span>{shownText}</span>
			<button
				type="button"
				onClick={whole.showAll}
				onPointerEnter={whole.prefetch}
				onFocus={whole.prefetch}
				aria-busy={whole.state === "loading"}
				className="inline-flex h-8 items-center rounded-lg bg-[#141923] px-2.5 text-xs font-semibold text-gray-200 ring-1 ring-white/20 transition hover:text-white hover:ring-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
			>
				{buttonText}
			</button>
		</div>
	)
}
