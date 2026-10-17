// PROTOTYPE - throwaway. Round 3, variant K: J on a desktop (all seasons readable, scores inside). On a phone the
// grid stays short: closed seasons are thin colour strips, a whole strip is one 40 px press target, and one
// season is always readable: wrapped tiles with their scores, today's season rows under them. It starts at the
// Next episode's season (S1 for a fresh show); closing the rows keeps that season readable.
import { useEffect, useMemo, useRef, useState } from "react"
import type { PageEpisode, ShowView } from "~/domain/tracking/show-page"
import { SeasonPanel, Tools, useEpisodeKit, useIsDesktop } from "~/ui/tracking/EpisodeList"
import { TrackingToastHost } from "~/ui/tracking/TrackingToast"
import { type TrackingActions, useTrackingActions } from "~/ui/tracking/actions"
import { FOCUS, type Season, type ShowTracking, plural, useShowTracking } from "~/ui/tracking/store"
import MapGrid from "./MapGrid"
import { Key, Summary, specialsWatched, useHold } from "./VariantG"
import { ViewSwitch, type View } from "./VariantJ"
import { Chart, ChartLegend, statsOf } from "./VariantI"
import type { VariantProps } from "./types"

export default function VariantK({ media, gridNode }: VariantProps) {
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
	// One season is open from the start: the Next episode's, or the first.
	useEffect(() => {
		if (!desktop && nav.open === null) nav.goSeason(nav.season)
	}, [])
	// The readable season on a phone: the open one, or the last one open after its rows were closed.
	const last = useRef<number | null>(null)
	if (nav.open !== null) last.current = nav.open
	const readable = nav.open ?? last.current ?? nav.season.number
	const openSeason = (season: Season) => {
		hold(season.number)
		// On a phone a strip switches the readable season; pressing the readable one opens or closes its rows.
		if (!desktop && season.number !== nav.open) nav.goSeason(season, false, true)
		else nav.toggle(season)
	}
	const openEpisode = (episode: PageEpisode) => {
		hold(episode.season)
		nav.goEpisode(episode, {}, true)
	}
	const most = Math.max(1, ...regular.map((s) => s.episodes.length))
	// Strips only where they are needed: when the longest season can't keep its scores on one line.
	const box = useRef<HTMLDivElement>(null)
	const [boxWidth, setBoxWidth] = useState(0)
	useEffect(() => {
		const el = box.current
		if (!el) return
		const observer = new ResizeObserver(() => setBoxWidth(el.clientWidth))
		observer.observe(el)
		return () => observer.disconnect()
	}, [])
	const fits = boxWidth > 0 && (boxWidth - 44 - 3 - 3 * most) / most >= 21
	const strips = !desktop && !fits
	const gridWidth = Math.max(672, 44 + most * 40 + 36 + (most + 1) * 3)
	const panel = (season: Season) =>
		nav.open === season.number ? (
			<div className="my-2" style={{ maxWidth: gridWidth }} data-inline-panel={season.number}>
				<SeasonPanel nav={nav} model={model} beside={false} />
			</div>
		) : null

	return (
		<section aria-labelledby="episodes-k-title" data-variant-k>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 id="episodes-k-title" className="text-2xl font-bold">
					Episodes
				</h2>
				<ViewSwitch view={mode} onChange={setMode} />
			</div>
			<div className="mt-3 flex flex-col gap-2.5">
				<Tools nav={nav} model={model} />
				<Summary seasons={regular} onPick={openEpisode} />
			</div>
			{strips && mode === "grid" && <style>{stripStyle(readable)}</style>}
			<div className="mt-3" ref={box}>
				{mode === "grid" ? (
					<MapGrid
						model={model}
						seasons={regular}
						orientation="rows"
						wrap
						compactRow={strips ? (s) => s.number !== readable : undefined}
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

/**
 * A phone's strips, styled from outside MapGrid: each closed season's row is 40 px high and is one press target
 * (its label button stretched over the row, the tiles let presses through). The readable season's tiles come in
 * with a short fade and scale, transform and opacity only.
 */
function stripStyle(readable: number) {
	const root = "[data-variant-k]"
	const thin = `${root} [data-map-row]:not([data-map-row="${readable}"]):not([data-map-row="0"])`
	return `
${thin}{position:relative}
${thin}>div:first-child{min-height:40px;align-items:center!important}
${thin}>div:first-child>div:nth-child(2){padding-top:0!important}
${thin} [data-map-season]{position:absolute;inset:0;z-index:0;align-items:center;border-radius:8px;background:rgb(255 255 255/.03)}
${thin} [data-map-season]:hover{background:rgb(255 255 255/.08)}
${thin} [data-map-cell]{pointer-events:none;z-index:1;border-radius:2px}
${thin} [data-map-cell][data-next]{box-shadow:0 0 0 2px #fff;transform:scaleY(1.45)}
${thin} [data-map-cell][data-watched]{opacity:.45}
${thin} [data-map-cell][data-watched]>span{display:none}
${root} [data-map-row="${readable}"]>div:first-child>div:nth-child(2){animation:gwk-open .2s ease-out}
${root} [data-map-row="${readable}"] [data-map-season]{background:rgb(255 255 255/.15);color:#fff}
@keyframes gwk-open{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){${root} [data-map-row]>div>div{animation:none!important}}
`
}
