// Everyone gets the same wrapping ratings tiles and Grid / Consistency view. Members add
// their watch history through EpisodeList; this read-only view also serves its first paint.
import { type ReactNode, Suspense, lazy, useMemo, useState } from "react"
import type { EpisodeGrid as EpisodeGridData } from "~/server/episode-grid.server"
import { HEADER_HEIGHT } from "~/ui/details/header-height"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import RatingsGrid, { type GridModel } from "./RatingsGrid"
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
	const [chart, setChart] = useState(false)
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
	return (
		<section
			id={EPISODE_GRID_ANCHOR}
			aria-labelledby="episode-grid-title"
			style={{ scrollMarginTop: `calc(${HEADER_HEIGHT} + 80px)` }}
		>
			<div className="flex flex-wrap items-center gap-2">
				<h2
					id="episode-grid-title"
					tabIndex={-1}
					className="mr-auto text-xl font-bold focus:outline-none lg:text-2xl"
				>
					Episodes
				</h2>
				<div
					role="radiogroup"
					aria-label="Show the episodes as"
					data-view-toggle
					className="flex items-center gap-1"
				>
					{[false, true].map((on) => (
						<button
							key={String(on)}
							type="button"
							// biome-ignore lint/a11y/useSemanticElements: matches the member's two-button switch
							role="radio"
							aria-checked={chart === on}
							onClick={() => setChart(on)}
							className={`inline-flex h-10 cursor-pointer items-center rounded-lg px-3 text-xs font-semibold lg:h-8 ${FOCUS} ${chart === on ? "bg-white text-gray-900" : "bg-white/10 text-gray-100 hover:bg-white/20"}`}
						>
							{on ? "Consistency" : "Grid"}
						</button>
					))}
				</div>
			</div>
			{grid.note && <p className="mt-2 text-sm text-gray-400">{grid.note}</p>}
			{notice}
			<div className="mt-4">
				<RatingsGrid
					model={model}
					seasons={seasons.filter((s) => s.number !== 0)}
					chart={chart}
					selectedSeason={open}
					selectedEpisode={selected}
					onSeason={(s) => toggle(s.number)}
					onEpisode={(e) => {
						setOpen(e.season)
						setSelected(e.id)
					}}
					seasonScores
					afterRow={(season) =>
						open === season.number && (
							<Suspense
								fallback={
									<output className="block p-3 text-sm text-gray-400">
										Loading episodes…
									</output>
								}
							>
								<SeasonDetails
									grid={grid}
									season={season}
									selected={selected}
									onSelect={setSelected}
									onClose={() => setOpen(null)}
								/>
							</Suspense>
						)
					}
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
