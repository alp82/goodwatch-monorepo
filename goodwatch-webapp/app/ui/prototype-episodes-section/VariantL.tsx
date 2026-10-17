// PROTOTYPE - throwaway. Round 3, variant L: J on a wide screen (the season opens inside the grid). On a phone the
// grid turns to seasons as columns, each wide enough for its score; with more seasons than fit, a window of them
// pages with ‹ and › (or a swipe), a one-line minimap of every season shows where the window is, and the open
// season's rows sit under the grid. A show with one or two seasons keeps J's wrapped rows, where a column would be
// a narrow strip.
import { useMemo, useState } from "react"
import type { PageEpisode, ShowView } from "~/domain/tracking/show-page"
import { SeasonPanel, Tools, useEpisodeKit, useIsDesktop } from "~/ui/tracking/EpisodeList"
import { TrackingToastHost } from "~/ui/tracking/TrackingToast"
import { type TrackingActions, useTrackingActions } from "~/ui/tracking/actions"
import { FOCUS, type Season, type ShowTracking, plural, useShowTracking } from "~/ui/tracking/store"
import MapGrid from "./MapGrid"
import { Key, Summary, specialsWatched, useHold } from "./VariantG"
import { Chart, ChartLegend, statsOf } from "./VariantI"
import { type View, ViewSwitch } from "./VariantJ"
import SeasonColumns from "./VariantLColumns"
import type { VariantProps } from "./types"

export default function VariantL({ media, gridNode }: VariantProps) {
	const tracking = useShowTracking(media.details.tmdb_id)
	const actions = useTrackingActions(tracking.store, media.details.title)
	if (!tracking.ready || !tracking.view) return <>{gridNode}</>
	return <Inner tracking={tracking} view={tracking.view} actions={actions} />
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
		<section aria-labelledby="episodes-l-title">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 id="episodes-l-title" className="text-2xl font-bold">
					Episodes
				</h2>
				<ViewSwitch view={mode} onChange={setMode} />
			</div>
			<div className="mt-3 flex flex-col gap-2.5">
				<Tools nav={nav} model={model} />
				<Summary seasons={regular} onPick={openEpisode} />
			</div>
			<div className="mt-3">
				{mode === "grid" && !desktop && regular.length >= 3 ? (
					<>
						<SeasonColumns
							model={model}
							nav={nav}
							seasons={regular}
							onSeason={(s) => nav.toggle(s)}
							onEpisode={(e) => nav.goEpisode(e, {}, true)}
						/>
						{nav.open !== null && nav.open !== 0 && (
							<div className="mt-3" data-inline-panel={nav.open}>
								<SeasonPanel nav={nav} model={model} beside={false} />
							</div>
						)}
					</>
				) : mode === "grid" ? (
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
