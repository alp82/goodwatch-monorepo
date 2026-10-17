// PROTOTYPE - throwaway. Round 2, variant F: one grid, today's season panel beside it (desktop) or under it (phone).
import { useEffect, useState } from "react"
import { displaySeason } from "~/domain/tracking/machine"
import type { ShowView } from "~/domain/tracking/show-page"
import { SeasonPanel, Tools, useEpisodeKit, useIsDesktop } from "~/ui/tracking/EpisodeList"
import { TrackingToastHost } from "~/ui/tracking/TrackingToast"
import { type TrackingActions, useTrackingActions } from "~/ui/tracking/actions"
import { type ShowTracking, useShowTracking } from "~/ui/tracking/store"
import MapGrid, { type Lens } from "./MapGrid"
import type { VariantProps } from "./types"

export default function VariantF({ media, gridNode }: VariantProps) {
	const tracking = useShowTracking(media.details.tmdb_id)
	const actions = useTrackingActions(tracking.store, media.details.title)
	if (!tracking.ready || !tracking.view) return <>{gridNode}</>
	return <Inner tracking={tracking} view={tracking.view} actions={actions} />
}

function Inner({ tracking, view, actions }: { tracking: ShowTracking; view: ShowView; actions: TrackingActions }) {
	const { model, nav } = useEpisodeKit(tracking, view, actions)
	const desktop = useIsDesktop()
	const [lens, setLens] = useState<Lens>("rating")
	const regular = model.seasons.filter((s) => s.number !== 0)
	// A season is always open: the Next episode's to start with, so nothing reflows on the first press.
	useEffect(() => {
		if (nav.open === null) nav.goSeason(nav.season)
	}, [nav.open])
	const open = nav.open === null ? null : nav.season
	return (
		<section>
			<h2 className="text-2xl font-bold">Episodes</h2>
			<div className="mt-3 flex flex-wrap items-start gap-2">
				<div className="min-w-0 flex-1"><Tools nav={nav} model={model} /></div>
				<div role="radiogroup" aria-label="Colour" className="inline-flex h-10 rounded-lg bg-white/[0.06] p-1 text-xs font-semibold lg:h-9">
					{(["rating", "standouts"] as const).map((each) => (
						<button key={each} type="button" role="radio" aria-checked={lens === each} onClick={() => setLens(each)} className={`cursor-pointer rounded-md px-3 ${lens === each ? "bg-white/15 text-white" : "text-gray-400 hover:text-white"}`}>
							{each === "rating" ? "All ratings" : "Standouts"}
						</button>
					))}
				</div>
			</div>
			<div className={`mt-4 ${desktop && open ? "grid grid-cols-[minmax(0,1fr)_minmax(0,30rem)] items-start gap-4" : ""}`}>
				<div>
					<MapGrid
						model={model}
						seasons={regular}
						lens={lens}
						selectedSeason={nav.open}
						selectedEpisode={nav.selected}
						onSeason={(s) => nav.goSeason(s, false, true)}
						onEpisode={(e) => nav.goEpisode(e, {}, true)}
					/>
				</div>
				{open && <div className={desktop ? "sticky top-24" : "mt-3"}><SeasonPanel nav={nav} model={model} beside={desktop} /></div>}
			</div>
			<TrackingToastHost tracking={tracking} actions={actions} />
		</section>
	)
}
