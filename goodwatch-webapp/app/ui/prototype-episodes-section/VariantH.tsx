// PROTOTYPE - throwaway. Round 2, variant H: show, season and episode as three levels of one master-detail.
// The grid on top is the ratings overview and the navigator. Under it, on a wide screen, the selected season's
// rows (today's rows) sit left and a sticky card for the selected episode sits right. On a phone the grid turns
// to seasons as columns and today's season rows follow, with their own inline detail; there is no card.
// Shift-click or Shift+arrow in the grid selects a range; a bar under the grid marks it watched.
import {
	CheckIcon,
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	EyeIcon,
} from "@heroicons/react/24/solid"
import { useEffect, useMemo, useState } from "react"
import { episodeLabel } from "~/domain/tracking/machine"
import type { PageEpisode, ShowView } from "~/domain/tracking/show-page"
import {
	type Model,
	type Nav,
	Row,
	Rows,
	ScoreTile,
	SeasonHead,
	Tools,
	useEpisodeKit,
	useIsDesktop,
} from "~/ui/tracking/EpisodeList"
import { TrackingToastHost } from "~/ui/tracking/TrackingToast"
import { type TrackingActions, useTrackingActions } from "~/ui/tracking/actions"
import {
	FOCUS,
	SURFACE,
	type ShowTracking,
	formatDay,
	plural,
	useShowTracking,
} from "~/ui/tracking/store"
import { useEpisodeTracking } from "~/ui/tracking/gate"
import MediaText from "~/ui/media-text/MediaText"
import { episodeText } from "~/ui/media-text/media-text"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import MapGrid, { type Lens } from "./MapGrid"
import type { VariantProps } from "./types"

const PANEL = `min-w-0 overflow-hidden rounded-xl border border-white/[0.06] ${SURFACE}`
const CHIP = `inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold cursor-pointer ${FOCUS}`
const FOLD = `flex h-8 w-full cursor-pointer items-center gap-2 border-t border-white/[0.06] px-3 text-left text-xs text-gray-400 hover:bg-white/[0.05] hover:text-white ${FOCUS}`
const WINDOW = 10

export default function VariantH({ media, gridNode }: VariantProps) {
	const member = useEpisodeTracking(media)
	if (!member) return <Shell>{gridNode}</Shell>
	return <Member media={media} gridNode={gridNode} />
}

function Shell({ children }: { children: React.ReactNode }) {
	return (
		<section>
			<h2 className="mb-4 text-2xl font-bold">Episodes</h2>
			{children}
		</section>
	)
}

function Member({ media, gridNode }: Omit<VariantProps, "grid">) {
	const tracking = useShowTracking(media.details.tmdb_id)
	const actions = useTrackingActions(tracking.store, media.details.title)
	if (!tracking.ready || !tracking.view) return <Shell>{gridNode}</Shell>
	return <Inner tracking={tracking} view={tracking.view} actions={actions} />
}

function Inner({
	tracking,
	view,
	actions,
}: { tracking: ShowTracking; view: ShowView; actions: TrackingActions }) {
	const { model, nav } = useEpisodeKit(tracking, view, actions)
	const desktop = useIsDesktop()
	const [lens, setLens] = useState<Lens>("rating")
	const regular = useMemo(
		() => model.seasons.filter((s) => s.number !== 0),
		[model.seasons],
	)
	const specials = model.seasons.find((s) => s.number === 0) ?? null
	const flat = useMemo(() => regular.flatMap((s) => s.episodes), [regular])
	const all = useMemo(
		() => model.seasons.flatMap((s) => s.episodes),
		[model.seasons],
	)

	// The selection lives in today's navigation, so the finder and Next pick it as well.
	useEffect(() => {
		if (nav.selected !== null) return
		const start =
			flat.find((e) => e.id === model.nextId) ?? flat[0] ?? all[0] ?? null
		if (start) nav.goEpisode(start, { quiet: true })
	}, [])
	const selected = all.find((e) => e.id === nav.selected) ?? null

	// A range: from the anchor (the last plain selection) to the shift-selected episode, in grid order.
	const [anchor, setAnchor] = useState<number | null>(null)
	const [rangeEnd, setRangeEnd] = useState<number | null>(null)
	const rangeIds = useMemo(() => {
		if (anchor === null || rangeEnd === null) return new Set<number>()
		const i = flat.findIndex((e) => e.id === anchor)
		const j = flat.findIndex((e) => e.id === rangeEnd)
		if (i < 0 || j < 0) return new Set<number>()
		const [lo, hi] = i < j ? [i, j] : [j, i]
		return new Set(flat.slice(lo, hi + 1).map((e) => e.id))
	}, [anchor, rangeEnd, flat])
	const pick = (e: PageEpisode, shift = false) => {
		if (shift) {
			setAnchor((a) => a ?? nav.selected ?? e.id)
			setRangeEnd(e.id)
		} else {
			setAnchor(e.id)
			setRangeEnd(null)
		}
		nav.goEpisode(e, {}, true)
	}
	const clearRange = () => setRangeEnd(null)
	const todo = flat.filter(
		(e) => rangeIds.has(e.id) && !view.watched.has(e.id) && model.aired(e),
	)
	const markRange = () => {
		if (!todo.length) return clearRange()
		const last = todo[todo.length - 1]
		const before = flat.slice(0, flat.indexOf(todo[0]))
		// Everything before is watched: one "up to here" covers the range and has one Undo.
		if (before.every((e) => view.watched.has(e.id) || !model.aired(e)))
			actions.watchUpTo(last)
		else for (const e of todo) actions.watch(e)
		clearRange()
	}
	useEffect(() => {
		if (rangeEnd === null) return
		const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && clearRange()
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [rangeEnd])

	const watchedCount = flat.filter((e) => view.watched.has(e.id)).length
	const airedCount = flat.filter(model.aired).length

	return (
		<section aria-labelledby="h-episodes-title">
			<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
				<h2 id="h-episodes-title" className="text-2xl font-bold">
					Episodes
				</h2>
				{model.tracked && (
					<p className="text-sm tabular-nums text-gray-400">
						<span className="font-semibold text-white">{watchedCount}</span> of{" "}
						{airedCount} watched
					</p>
				)}
			</div>

			<div className="mt-3 flex flex-wrap items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<Tools nav={nav} model={model} />
				</div>
				<div
					role="radiogroup"
					aria-label="Grid colour"
					className="flex shrink-0 rounded-lg bg-white/[0.06] p-0.5"
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
							className={`${CHIP} h-7 ${lens === key ? "bg-white/15 text-white" : "text-gray-400 hover:text-white"}`}
						>
							{word}
						</button>
					))}
				</div>
			</div>

			<div className={`mt-3 p-3 ${PANEL}`}>
				<MapGrid
					model={model}
					seasons={regular}
					lens={lens}
					selectedSeason={nav.open}
					selectedEpisode={nav.selected}
					maxCell={48}
					marked={rangeIds.size > 1 ? rangeIds : undefined}
					onSeason={(s) => {
						clearRange()
						nav.goSeason(s, false, true)
					}}
					onEpisode={(e, { shift }) => pick(e, shift)}
				/>
				<div className="mt-2 flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
					{rangeIds.size > 1 ? (
						<>
							<span className="text-xs font-semibold text-sky-300">
								{plural(rangeIds.size, "episode")} selected
							</span>
							<button
								type="button"
								onClick={markRange}
								disabled={!todo.length}
								className={`${CHIP} h-7 bg-white text-black hover:bg-gray-200 disabled:cursor-default disabled:opacity-40`}
							>
								<CheckIcon className="h-3.5 w-3.5" />
								{todo.length ? `Mark ${todo.length} watched` : "All watched"}
							</button>
							<button
								type="button"
								onClick={clearRange}
								className={`${CHIP} h-7 bg-white/10 text-gray-200 hover:bg-white/20`}
							>
								Clear
							</button>
						</>
					) : (
						<Legend model={model} lens={lens} />
					)}
					{specials && (
						<button
							type="button"
							onClick={() => {
								clearRange()
								nav.goSeason(specials, false, true)
							}}
							className={`ml-auto cursor-pointer rounded px-1 text-[11px] hover:text-white ${nav.open === 0 ? "text-white" : ""} ${FOCUS}`}
						>
							{plural(specials.episodes.length, "special")}
							{model.tracked &&
								` · ${specials.episodes.filter((e) => view.watched.has(e.id)).length} watched`}{" "}
							· not counted
						</button>
					)}
				</div>
			</div>

			{desktop ? (
				<div className="mt-4 grid grid-cols-[minmax(0,55fr)_minmax(0,45fr)] items-start gap-4">
					<SeasonList nav={nav} model={model} onPick={(e) => pick(e)} />
					<div className="sticky top-24">
						{selected ? (
							<Card
								key={selected.id}
								episode={selected}
								model={model}
								order={selected.season === 0 ? (specials?.episodes ?? []) : flat}
								onGo={(e) => pick(e)}
							/>
						) : (
							<div className={`h-[31rem] ${PANEL}`} />
						)}
					</div>
				</div>
			) : (
				nav.open !== null && (
					<div className={`mt-3 ${PANEL}`}>
						<SeasonHead nav={nav} model={model} steppers />
						<Rows key={nav.season.number} season={nav.season} nav={nav} model={model} limit={8} />
					</div>
				)
			)}
			<TrackingToastHost tracking={tracking} actions={actions} />
		</section>
	)
}

function Legend({ model, lens }: { model: Model; lens: Lens }) {
	return (
		<>
			<span>
				{lens === "standouts"
					? "Faded: within 0.4 of the season's average"
					: "Colour: IMDb rating"}
			</span>
			{model.tracked && (
				<span className="inline-flex items-center gap-1">
					<span className="relative inline-block h-3 w-3 rounded-[2px] bg-white/25">
						<span className="absolute inset-x-[2px] bottom-[1px] h-[2px] rounded-full bg-white" />
					</span>
					watched
				</span>
			)}
			{model.nextId !== null && (
				<span className="inline-flex items-center gap-1">
					<span className="inline-block h-3 w-3 rounded-[2px] ring-2 ring-white" /> next
				</span>
			)}
			<span className="hidden lg:inline">Shift-click selects a range</span>
		</>
	)
}

/**
 * The selected season as today's rows. A press on a row selects it for the card instead of opening it; the rows
 * show a window around the selection, with the rest folded above and below.
 */
function SeasonList({
	nav,
	model,
	onPick,
}: { nav: Nav; model: Model; onPick: (e: PageEpisode) => void }) {
	const season = nav.season
	const episodes = season.episodes
	const at = Math.max(
		0,
		episodes.findIndex((e) => e.id === nav.selected),
	)
	const around = (i: number): [number, number] => {
		const to = Math.min(episodes.length, Math.max(0, i - 2) + WINDOW)
		return [Math.max(0, to - WINDOW), to]
	}
	const [range, setRange] = useState<[number, number]>(() => around(at))
	useEffect(() => {
		setRange((now) => (at >= now[0] && at < now[1] ? now : around(at)))
	}, [at, season.number])
	const [from, to] = range
	return (
		<div className={PANEL} data-season-list={season.number}>
			<SeasonHead nav={nav} model={model} />
			{from > 0 && (
				<button
					type="button"
					onClick={() => setRange([0, to])}
					className={FOLD}
				>
					<ChevronDownIcon className="h-3.5 w-3.5 rotate-180" />
					{plural(from, "earlier episode")}
				</button>
			)}
			<ul>
				{episodes.slice(from, to).map((e) => (
					<Row
						key={e.id}
						episode={e}
						model={model}
						open={false}
						onToggle={() => onPick(e)}
						selected={nav.selected === e.id}
						flash={false}
					/>
				))}
			</ul>
			{to < episodes.length && (
				<button
					type="button"
					onClick={() => setRange([from, episodes.length])}
					className={FOLD}
				>
					<ChevronDownIcon className="h-3.5 w-3.5" />
					{episodes.length - to} more
				</button>
			)}
		</div>
	)
}

/** The selected episode, in a card of fixed height so that a new selection never moves the page. */
function Card({
	episode: e,
	model,
	order,
	onGo,
}: {
	episode: PageEpisode
	model: Model
	order: PageEpisode[]
	onGo: (e: PageEpisode) => void
}) {
	const { view, actions, today } = model
	const watched = view.watched.has(e.id)
	const seen = (view.watchesOf.get(e.id) ?? []).length > 0
	const aired = model.aired(e)
	const [revealed, setRevealed] = useState(false)
	const covered = !seen && !revealed
	const i = order.findIndex((x) => x.id === e.id)
	const prev = order[i - 1]
	const next = order[i + 1]
	const upTo =
		e.season === 0 || watched || !aired
			? 0
			: order
					.slice(0, i + 1)
					.filter((x) => !view.watched.has(x.id) && model.aired(x)).length
	const isNext = model.nextId === e.id
	const NAV = `flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 disabled:cursor-default disabled:opacity-30 ${FOCUS}`
	return (
		<div
			data-episode-card={e.id}
			className={`flex h-[31rem] flex-col gap-3 p-3 ${PANEL}`}
		>
			<div className="relative aspect-video shrink-0 overflow-hidden rounded-lg bg-white/[0.04]">
				{e.still && (
					<img
						src={tmdbImageUrl(e.still, "w500")}
						alt=""
						className={`h-full w-full object-cover transition-[filter] duration-300 ${covered ? "scale-110 blur-2xl brightness-50" : ""}`}
					/>
				)}
				{covered && (
					<button
						type="button"
						onClick={() => setRevealed(true)}
						className={`absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-1 text-xs font-semibold text-gray-200 hover:text-white ${FOCUS}`}
					>
						<EyeIcon className="h-5 w-5" />
						Show still and description
					</button>
				)}
				{isNext && (
					<span className="absolute left-2 top-2 rounded bg-green-500 px-1.5 text-[10px] font-bold uppercase leading-5 text-black">
						Next
					</span>
				)}
			</div>
			<div className="flex items-start gap-3">
				<div className="min-w-0 flex-1">
					<p className="text-xs tabular-nums text-gray-400">
						{episodeLabel(e)}
						{e.airDate &&
							` · ${aired ? formatDay(e.airDate, today) : `Airs ${formatDay(e.airDate, today)}`}`}
						{e.runtime ? ` · ${e.runtime} min` : ""}
					</p>
					<MediaText
						value={
							e.name
								? episodeText(e, "name")
								: { text: episodeLabel(e), lang: "en" }
						}
						className="block truncate text-base font-semibold text-white"
					/>
				</div>
				<ScoreTile score={e.rating} className="h-7 min-w-10 text-sm" />
			</div>
			<div className="min-h-0 flex-1">
				{covered ? (
					<p className="text-sm italic text-gray-500">
						Description hidden until you've seen it.
					</p>
				) : (
					<p className="line-clamp-5 text-sm leading-relaxed text-gray-300">
						{e.overview ?? "No description yet."}
					</p>
				)}
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<button
					type="button"
					disabled={!aired && !watched}
					onClick={() => (watched ? actions.unwatch(e) : actions.watch(e))}
					className={`${CHIP} h-9 px-3 disabled:cursor-default disabled:opacity-40 ${watched ? "bg-green-500 text-black hover:bg-green-400" : "bg-white text-black hover:bg-gray-200"}`}
				>
					<CheckIcon className="h-4 w-4" />
					{watched ? "Watched" : aired ? "Mark watched" : "Not aired yet"}
				</button>
				{upTo > 1 && (
					<button
						type="button"
						onClick={() => actions.watchUpTo(e)}
						className={`${CHIP} h-9 bg-white/10 px-3 text-gray-100 hover:bg-white/20`}
					>
						Watched up to here · {upTo}
					</button>
				)}
				<span className="ml-auto flex gap-1.5">
					<button
						type="button"
						aria-label="Previous episode"
						disabled={!prev}
						onClick={() => prev && onGo(prev)}
						className={NAV}
					>
						<ChevronLeftIcon className="h-4 w-4" />
					</button>
					<button
						type="button"
						aria-label="Next episode"
						disabled={!next}
						onClick={() => next && onGo(next)}
						className={NAV}
					>
						<ChevronRightIcon className="h-4 w-4" />
					</button>
				</span>
			</div>
		</div>
	)
}
