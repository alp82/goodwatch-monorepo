// PROTOTYPE - throwaway. Round 3, variant J: G (the season opens inside the grid) with a Grid / Consistency
// switch in place of Standouts. Every tile keeps its score: a season too long for the width wraps onto more lines
// at a round number of tiles per line (on a phone, 10 or 8), instead of shrinking to colour-only tiles.
import { useMemo, useState } from "react"
import type { PageEpisode, ShowView } from "~/domain/tracking/show-page"
import { SeasonPanel, Tools, useEpisodeKit, useIsDesktop } from "~/ui/tracking/EpisodeList"
import { TrackingToastHost } from "~/ui/tracking/TrackingToast"
import { type TrackingActions, useTrackingActions } from "~/ui/tracking/actions"
import { FOCUS, type Season, type ShowTracking, plural, useShowTracking } from "~/ui/tracking/store"
import MapGrid from "./MapGrid"
import { Key, Summary, specialsWatched, useHold } from "./VariantG"
import { Chart, ChartLegend, statsOf } from "./VariantI"
import type { VariantProps } from "./types"

export const CHIP = `inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold cursor-pointer lg:h-8 ${FOCUS}`
export const CHIP_OFF = "bg-white/10 text-gray-100 hover:bg-white/20"
export const CHIP_ON = "bg-white text-gray-900"
export type View = "grid" | "consistency"

export default function VariantJ({ media, gridNode }: VariantProps) {
	const tracking = useShowTracking(media.details.tmdb_id)
	const actions = useTrackingActions(tracking.store, media.details.title)
	if (!tracking.ready || !tracking.view) return <>{gridNode}</>
	return <Inner tracking={tracking} view={tracking.view} actions={actions} />
}

export function ViewSwitch({ view, onChange }: { view: View; onChange: (view: View) => void }) {
	return (
		<div role="radiogroup" aria-label="Show the episodes as" className="flex items-center gap-1">
			{(
				[
					["grid", "Grid"],
					["consistency", "Consistency"],
				] as const
			).map(([key, word]) => (
				<button
					key={key}
					type="button"
					role="radio"
					aria-checked={view === key}
					onClick={() => onChange(key)}
					className={`${CHIP} ${view === key ? CHIP_ON : CHIP_OFF}`}
				>
					{word}
				</button>
			))}
		</div>
	)
}

function Inner({ tracking, view, actions }: { tracking: ShowTracking; view: ShowView; actions: TrackingActions }) {
	const { model, nav } = useEpisodeKit(tracking, view, actions)
	const desktop = useIsDesktop()
	const [mode, setMode] = useState<View>("grid")
	const regular = model.seasons.filter((s) => s.number !== 0)
	const specials = model.seasons.find((s) => s.number === 0)
	const stats = useMemo(() => regular.map(statsOf), [regular])
	const all = stats.flatMap((s) => s.rated)
	const showAvg = all.length ? all.reduce((sum, e) => sum + (e.rating ?? 0), 0) / all.length : null
	const hold = useHold(nav.open)
	const openSeason = (season: Season) => {
		hold(season.number)
		nav.toggle(season)
	}
	const openEpisode = (episode: PageEpisode) => {
		hold(episode.season)
		nav.goEpisode(episode, {}, true)
	}
	const most = Math.max(1, ...regular.map((s) => s.episodes.length))
	const gridWidth = Math.max(672, 44 + most * 40 + 36 + (most + 1) * 3)
	const panel = (season: Season) =>
		nav.open === season.number ? (
			<div className="my-2" style={{ maxWidth: gridWidth }} data-inline-panel={season.number}>
				<SeasonPanel nav={nav} model={model} beside={false} />
			</div>
		) : null

	return (
		<section aria-labelledby="episodes-j-title">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 id="episodes-j-title" className="text-2xl font-bold">
					Episodes
				</h2>
				<ViewSwitch view={mode} onChange={setMode} />
			</div>
			<div className="mt-3 flex flex-col gap-2.5">
				<Tools nav={nav} model={model} />
				<Summary seasons={regular} onPick={openEpisode} />
			</div>
			<div className="mt-3">
				{mode === "grid" ? (
					<MapGrid
						model={model}
						seasons={regular}
						orientation="rows"
						wrap
						selectedSeason={nav.open}
						selectedEpisode={nav.selected}
						onSeason={openSeason}
						onEpisode={openEpisode}
						afterRow={panel}
						seasonScores={desktop}
					/>
				) : (
					<Chart stats={stats} showAvg={showAvg} model={model} nav={nav} panel={panel} />
				)}
				{specials && (
					<div data-map-row={0} className="mt-1.5" style={{ maxWidth: gridWidth }}>
						<button
							type="button"
							aria-expanded={nav.open === 0}
							onClick={() => openSeason(specials)}
							className={`flex h-10 w-full cursor-pointer items-center gap-2 rounded-md px-1.5 text-left text-xs lg:h-8 ${nav.open === 0 ? "bg-white/15 text-white" : "text-gray-400 hover:bg-white/[0.06] hover:text-white"} ${FOCUS}`}
						>
							<span className="w-[38px] font-bold text-gray-300">Sp</span>
							<span>
								{plural(specials.episodes.length, "special")}
								{specialsWatched(model, specials)}
							</span>
							<span className="ml-auto text-gray-500">{nav.open === 0 ? "Close" : "Show"}</span>
						</button>
						{panel(specials)}
					</div>
				)}
				{mode === "grid" ? <Key model={model} lens="rating" /> : <ChartLegend model={model} chart />}
			</div>
			<TrackingToastHost tracking={tracking} actions={actions} />
		</section>
	)
}
