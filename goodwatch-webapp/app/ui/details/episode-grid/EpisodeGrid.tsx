// Everyone gets the same season overview, in Grid or Spread (SeasonOverview.tsx). Members add their watch history
// through EpisodeList; this read-only view also serves its first paint.
import { type ReactNode, Suspense, lazy, useMemo, useState } from "react"
import type { EpisodeGrid as EpisodeGridData } from "~/server/episode-grid.server"
import { HEADER_HEIGHT } from "~/ui/details/header-height"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import SeasonOverview, { needsTiles, useWidth } from "./SeasonOverview"
import { useEpisodeChart } from "./episode-view"
import type { GridModel } from "./grid-model"
import { gridSeasons } from "./grid-seasons"
import { FOCUS, seasonTitle } from "./presentation"
import { EPISODE_GRID_ANCHOR } from "./scale"

const SeasonDetails = lazy(reloadOnStaleChunk(() => import("./SeasonDetails")))
const EMPTY_WATCHED = new Set<number>()

export default function EpisodeGrid({
	grid,
	notice,
}: { grid: EpisodeGridData; notice?: ReactNode }) {
	const seasons = useMemo(() => gridSeasons(grid), [grid])
	const chart = useEpisodeChart(grid.showId)
	const [open, setOpen] = useState<number | null>(null)
	const [selected, setSelected] = useState<number | null>(null)
	const specials = seasons.find((s) => s.number === 0)
	const model = useMemo<GridModel>(
		() => ({
			tracked: false,
			nextId: null,
			view: { watched: EMPTY_WATCHED },
			aired: () => true,
			count: (season) => ({
				total: season.episodes.length,
				aired: season.episodes.length,
				watched: 0,
				done: false,
			}),
			seasonScore: (number) =>
				grid.seasons.find((s) => s.number === number)?.scores.imdb?.score ??
				null,
		}),
		[grid],
	)
	const toggle = (number: number) => {
		setOpen(open === number ? null : number)
		setSelected(null)
	}
	const regular = useMemo(
		() => seasons.filter((s) => s.number !== 0),
		[seasons],
	)
	const { ref: box, width } = useWidth()
	const step = (delta: -1 | 1) => {
		const to = regular[regular.findIndex((s) => s.number === open) + delta]
		if (to) toggle(to.number)
	}
	return (
		<section
			id={EPISODE_GRID_ANCHOR}
			aria-labelledby="episode-grid-title"
			style={{ scrollMarginTop: `calc(${HEADER_HEIGHT} + 80px)` }}
		>
			{/* The switch is in the section header (episode-view.tsx); this title is for screen readers. */}
			<div className="h-0 overflow-hidden">
				<h2
					id="episode-grid-title"
					tabIndex={-1}
					className="mr-auto text-xl font-bold focus:outline-none lg:text-2xl"
				>
					Episodes
				</h2>
			</div>
			{grid.note && <p className="mt-2 text-sm text-gray-400">{grid.note}</p>}
			{notice}
			<div ref={box} className="mt-4">
				<SeasonOverview
					model={model}
					seasons={regular}
					chart={chart}
					open={open}
					selected={selected}
					onToggle={(s) => toggle(s.number)}
					renderOpen={(season) => (
						<Suspense
							fallback={
								<output className="block p-3 text-sm text-gray-400">
									Loading episodes…
								</output>
							}
						>
							<SeasonDetails
								grid={grid}
								model={model}
								season={season}
								selected={selected}
								onSelect={setSelected}
								onClose={() => setOpen(null)}
								onStep={step}
								first={regular[0]?.number === season.number}
								last={regular.at(-1)?.number === season.number}
								tiles={needsTiles(regular, width)}
							/>
						</Suspense>
					)}
				/>
				{specials && (
					<>
						<button
							type="button"
							aria-expanded={open === 0}
							onClick={() => toggle(0)}
							className={`mt-2 flex min-h-10 w-full items-center rounded-lg border border-white/10 px-3 text-xs text-gray-400 ${FOCUS}`}
						>
							{seasonTitle(0)}{" "}
							<span className="ml-2">{grid.specials.length}</span>
						</button>
						{open === 0 && (
							<Suspense fallback={<output>Loading specials…</output>}>
								<SeasonDetails
									grid={grid}
									model={model}
									season={specials}
									selected={selected}
									onSelect={setSelected}
									onClose={() => setOpen(null)}
								/>
							</Suspense>
						)}
					</>
				)}
			</div>
		</section>
	)
}
