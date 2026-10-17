// PROTOTYPE - throwaway. Round 2, variant G: the season opens inside the grid. One grid (seasons as rows) is the
// overview and the navigator; pressing a season label or a tile opens today's season rows right under that grid
// row, so the seasons above and below stay in view. Phones keep the rows orientation too (colour-only tiles):
// the columns orientation has no place for an inline panel, and a row per season is the press target today's
// phone matrix already uses.
import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { episodeLabel } from "~/domain/tracking/machine"
import type { PageEpisode, ShowView } from "~/domain/tracking/show-page"
import { formatScore } from "~/ui/details/episode-grid/scale"
import {
	type Model,
	type Nav,
	ScoreTile,
	SeasonPanel,
	Tools,
	useEpisodeKit,
	useIsDesktop,
} from "~/ui/tracking/EpisodeList"
import { TrackingToastHost } from "~/ui/tracking/TrackingToast"
import { type TrackingActions, useTrackingActions } from "~/ui/tracking/actions"
import {
	FOCUS,
	type Season,
	type ShowTracking,
	plural,
	useShowTracking,
} from "~/ui/tracking/store"
import MapGrid, { type Lens } from "./MapGrid"
import type { VariantProps } from "./types"

const CHIP = `inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold cursor-pointer lg:h-8 ${FOCUS}`
const CHIP_OFF = "bg-white/10 text-gray-100 hover:bg-white/20"
const CHIP_ON = "bg-white text-gray-900"

export default function VariantG({ media, gridNode }: VariantProps) {
	const tracking = useShowTracking(media.details.tmdb_id)
	const actions = useTrackingActions(tracking.store, media.details.title)
	if (!tracking.ready || !tracking.view) return <>{gridNode}</>
	return <Inner tracking={tracking} view={tracking.view} actions={actions} />
}

/** Keeps a pressed grid row where it was on the screen when a season above it closes. */
function useHold(open: number | null) {
	const held = useRef<{ season: number; top: number } | null>(null)
	useLayoutEffect(() => {
		const hold = held.current
		held.current = null
		if (!hold) return
		const row = document.querySelector(`[data-map-row="${hold.season}"]`)
		if (!row) return
		const by = row.getBoundingClientRect().top - hold.top
		if (Math.abs(by) > 1)
			window.scrollBy({ top: by, behavior: "instant" as ScrollBehavior })
	}, [open])
	return (season: number) => {
		const row = document.querySelector(`[data-map-row="${season}"]`)
		held.current = row
			? { season, top: row.getBoundingClientRect().top }
			: null
	}
}

function Inner({
	tracking,
	view,
	actions,
}: {
	tracking: ShowTracking
	view: ShowView
	actions: TrackingActions
}) {
	const { model, nav } = useEpisodeKit(tracking, view, actions)
	const desktop = useIsDesktop()
	const [lens, setLens] = useState<Lens>("rating")
	const regular = model.seasons.filter((s) => s.number !== 0)
	const specials = model.seasons.find((s) => s.number === 0)
	const hold = useHold(nav.open)
	const openSeason = (season: Season) => {
		hold(season.number)
		nav.toggle(season)
	}
	const openEpisode = (episode: PageEpisode) => {
		hold(episode.season)
		nav.goEpisode(episode, {}, true)
	}
	// The panel is as wide as the grid's rows at full tile size, so its scores line up under the grid.
	const most = Math.max(1, ...regular.map((s) => s.episodes.length))
	const gridWidth = Math.max(672, 44 + most * 40 + 36 + (most + 1) * 3)
	const panel = (season: Season) =>
		nav.open === season.number ? (
			<div className="my-2" style={{ maxWidth: gridWidth }} data-inline-panel={season.number}>
				<SeasonPanel nav={nav} model={model} beside={false} />
			</div>
		) : null

	return (
		<section aria-labelledby="episodes-g-title">
			<h2 id="episodes-g-title" className="text-2xl font-bold">
				Episodes
			</h2>
			<div className="mt-3 flex flex-col gap-2.5">
				<div className="flex flex-wrap items-center gap-2">
					<div className="min-w-0 flex-1">
						<Tools nav={nav} model={model} />
					</div>
					<div
						role="radiogroup"
						aria-label="Colour the grid by"
						className="flex items-center gap-1"
					>
						{(
							[
								["rating", "Rating"],
								["standouts", "Standouts"],
							] as const
						).map(([key, word]) => (
							<button
								key={key}
								type="button"
								role="radio"
								aria-checked={lens === key}
								onClick={() => setLens(key)}
								title={
									key === "standouts"
										? "Fade episodes close to their season's average, so the ones that stick out show"
										: undefined
								}
								className={`${CHIP} ${lens === key ? CHIP_ON : CHIP_OFF}`}
							>
								{word}
							</button>
						))}
					</div>
				</div>
				<Summary seasons={regular} onPick={openEpisode} />
			</div>
			<div className="mt-3">
				<MapGrid
					model={model}
					seasons={regular}
					orientation="rows"
					lens={lens}
					selectedSeason={nav.open}
					selectedEpisode={nav.selected}
					onSeason={openSeason}
					onEpisode={openEpisode}
					afterRow={panel}
					seasonScores={desktop}
				/>
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
							<span className="ml-auto text-gray-500">
								{nav.open === 0 ? "Close" : "Show"}
							</span>
						</button>
						{panel(specials)}
					</div>
				)}
				<Key model={model} lens={lens} />
			</div>
			<TrackingToastHost tracking={tracking} actions={actions} />
		</section>
	)
}

function specialsWatched(model: Model, specials: Season) {
	const watched = specials.episodes.filter((e) => model.view.watched.has(e.id))
		.length
	return watched ? ` · ${watched} watched` : ""
}

/** The show in one line: its average, the best and worst episode (pressing one opens it), how even it is. */
function Summary({
	seasons,
	onPick,
}: {
	seasons: Season[]
	onPick: (episode: PageEpisode) => void
}) {
	const stats = useMemo(() => {
		const rated = seasons
			.flatMap((s) => s.episodes)
			.filter((e) => e.rating !== null)
		if (rated.length < 2) return null
		const scores = rated.map((e) => e.rating as number)
		const mean = scores.reduce((a, b) => a + b, 0) / scores.length
		const spread = Math.sqrt(
			scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length,
		)
		const best = rated.reduce((a, b) => ((b.rating ?? 0) > (a.rating ?? 0) ? b : a))
		const worst = rated.reduce((a, b) => ((b.rating ?? 0) < (a.rating ?? 0) ? b : a))
		const word =
			spread < 0.35
				? "Very consistent"
				: spread < 0.55
					? "Consistent"
					: spread < 0.8
						? "Uneven"
						: "Up and down"
		return { mean, best, worst, word, spread }
	}, [seasons])
	if (!stats) return null
	const pick = (label: string, episode: PageEpisode) => (
		<button
			type="button"
			onClick={() => onPick(episode)}
			title={`${episodeLabel(episode)} · ${episode.name ?? "Untitled"}`}
			className={`inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-white/10 ${FOCUS}`}
		>
			<span className="text-gray-400">{label}</span>
			<ScoreTile score={episode.rating} className="h-4 min-w-7 text-[10px]" />
			<span className="truncate font-semibold text-gray-100">
				{episodeLabel(episode)}
				<span className="hidden font-normal text-gray-400 sm:inline">
					{episode.name ? ` · ${episode.name}` : ""}
				</span>
			</span>
		</button>
	)
	return (
		<p
			data-show-summary
			className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs"
		>
			<span className="inline-flex items-center gap-1.5">
				<span className="text-gray-400">Average</span>
				<ScoreTile score={Math.round(stats.mean * 10) / 10} className="h-4 min-w-7 text-[10px]" />
			</span>
			<span
				className="font-semibold text-gray-200"
				title={`Episode scores spread ±${formatScore(stats.spread)} around the average`}
			>
				{stats.word}
			</span>
			{pick("Best", stats.best)}
			{pick("Lowest", stats.worst)}
		</p>
	)
}

function Key({ model, lens }: { model: Model; lens: Lens }) {
	return (
		<p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] leading-4 text-gray-500">
			<span>
				colour: IMDb rating
				{lens === "standouts" ? " · faded: within 0.4 of the season average" : ""}
			</span>
			{model.tracked && (
				<span className="inline-flex items-center gap-1">
					<span className="relative inline-block h-2.5 w-3 rounded-[2px] bg-white/30">
						<span className="absolute inset-x-[2px] bottom-[1px] h-[2px] rounded-full bg-white" />
					</span>
					watched
				</span>
			)}
			{model.nextId !== null && (
				<span className="inline-flex items-center gap-1.5">
					<span className="ml-0.5 inline-block h-2.5 w-3 rounded-[2px] ring-2 ring-white" />
					next
				</span>
			)}
			<span className="hidden lg:inline">Arrow keys move · Enter opens</span>
		</p>
	)
}

export type { Nav }
