// The episode list of a show page (#369, #384; redesigned in #699), for a member with tracking. One ratings grid is
// both the overview and the way in: a row per season, a tile per episode in its IMDb rating's colour with the score
// inside, watched episodes marked and the Next episode ringed (RatingsGrid.tsx). A Consistency view draws the same
// episodes as dots on one score axis. Pressing a season, or one of its tiles, opens the season under its row
// (OpenSeason.tsx): its head, then one-line rows with tick, name and rating; a press on a row opens it for the
// still, the description and the watch's date. An unwatched episode's still and description stay covered until
// asked for. The specials are one line under the grid.
//
// Loaded when the member comes near the section or asks for it; a show without an episode list keeps today's grid.
import {
	CheckIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	ClockIcon,
	MagnifyingGlassIcon,
} from "@heroicons/react/24/solid"
import {
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import {
	displayNumber,
	displaySeason,
	episodeLabel,
} from "~/domain/tracking/machine"
import { seenPressLine } from "~/domain/tracking/seen-press"
import type { PageEpisode, ShowView } from "~/domain/tracking/show-page"
import type { LogRow } from "~/domain/tracking/storage"
import type { EpisodeGrid } from "~/server/episode-grid.server"
import { useBelowFold } from "~/ui/details/below-fold"
import RatingsGrid from "~/ui/details/episode-grid/RatingsGrid"
import {
	EPISODE_GRID_ANCHOR,
	formatScore,
	imdbVibe,
	vibeTileColor,
} from "~/ui/details/episode-grid/scale"
import { HEADER_HEIGHT } from "~/ui/details/header-height"
import MediaText from "~/ui/media-text/MediaText"
import { episodeText } from "~/ui/media-text/media-text"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { EpisodeScoreFrame, OwnScoreChip } from "./EpisodeScore"
import OpenSeason from "./OpenSeason"
import type { EpisodeScoreStore } from "./episode-score-store"
import { useEpisodeScores } from "./useEpisodeScores"
import {
	ConfirmPanel,
	TAKE_BACK_LOOK,
	TrackingToastHost,
	useDismiss,
} from "./TrackingToast"
import { type TrackingActions, useTrackingActions } from "./actions"
import type { TrackedMedia } from "./gate"
import {
	FOCUS,
	LOCALE_DATES,
	SURFACE,
	type Season,
	type ShowTracking,
	dayOfWatch,
	formatDay,
	formatWatched,
	plural,
	seasonTitle,
	useShowTracking,
} from "./store"

export default function EpisodeList({
	media,
	grid,
	children,
}: {
	media: TrackedMedia
	/** The ratings grid's data in IMDb's numbering, for every site's season score; null for a show without one. */
	grid: EpisodeGrid | null
	/** Today's episode grid, shown until the list is ready; nothing for a show without one. */
	children: ReactNode
}) {
	const tracking = useShowTracking(media.details.tmdb_id)
	const actions = useTrackingActions(tracking.store, media.details.title)
	if (!tracking.ready || !tracking.view) return <>{children}</>
	return (
		<List
			tracking={tracking}
			view={tracking.view}
			actions={actions}
			grid={grid}
			showTitle={media.details.title}
		/>
	)
}

// ---------------------------------------------------------------------------------------------------------
// What every part reads
// ---------------------------------------------------------------------------------------------------------

import { ScoreTile } from "~/ui/details/episode-grid/ScoreTile"

const SITE_BAR_HEIGHT = 64
/** What stays clear above a place the page scrolls to: the site bar and the title page's sticky header. */
const UNDER_HEADERS = `calc(${HEADER_HEIGHT} + ${SITE_BAR_HEIGHT + 16}px)`
const ROW_SCROLL_MARGIN = { scrollMarginTop: UNDER_HEADERS }

export function useIsDesktop() {
	const [is, setIs] = useState(
		() =>
			typeof window !== "undefined" &&
			window.matchMedia("(min-width: 1024px)").matches,
	)
	useEffect(() => {
		const media = window.matchMedia("(min-width: 1024px)")
		const on = () => setIs(media.matches)
		media.addEventListener("change", on)
		on()
		return () => media.removeEventListener("change", on)
	}, [])
	return is
}

export interface Model {
	view: ShowView
	actions: TrackingActions
	/** The member's own season, episode and part scores (#759). */
	scores: EpisodeScoreStore
	showTitle: string
	today: string
	seasons: Season[]
	/** The member has a state for the show or a watch of it: marks are drawn. */
	tracked: boolean
	/** The Next episode's id, while the show has one. */
	nextId: number | null
	seasonScore: (season: number) => number | null
	note: (season: number) => { byTitle: number; missing: number } | null
	aired: (episode: PageEpisode) => boolean
	count: (season: Season) => {
		total: number
		aired: number
		watched: number
		done: boolean
	}
}

interface Target {
	id: number
	at: number
	/** Move keyboard focus to the row. */
	focus?: boolean
	/** A season change: no flash and no scrolling. */
	quiet?: boolean
	/** The request came from outside the list: bring the row to the middle of the screen. */
	page?: boolean
}

export interface Nav {
	seasons: Season[]
	many: boolean
	/** The open season's number; null at the matrix alone. */
	open: number | null
	season: Season
	target: Target | null
	selected: number | null
	goEpisode: (
		episode: PageEpisode,
		how?: Partial<Target>,
		pressed?: boolean,
	) => void
	toggle: (season: Season) => void
	close: () => void
	jumpNext: (page?: boolean) => void
}

function useNav(model: Model): Nav {
	const { seasons, nextId } = model
	const many = seasons.length > 1
	const [opened, setOpened] = useState<number | null>(null)
	const [target, setTarget] = useState<Target | null>(null)
	const [selected, setSelected] = useState<number | null>(null)
	const open = many ? opened : (seasons[0]?.number ?? null)
	const next = useMemo(
		() =>
			nextId === null
				? null
				: (seasons
						.flatMap((season) => season.episodes)
						.find((episode) => episode.id === nextId) ?? null),
		[seasons, nextId],
	)
	const picked =
		open ?? (next ? displaySeason(next) : undefined) ?? seasons[0]?.number ?? 0
	const index = Math.max(
		0,
		seasons.findIndex((season) => season.number === picked),
	)
	const season = seasons[index]

	// A pressed season row stays where it is on the screen, also when the season that closes was above it.
	const hold = useRef<{ season: number; top: number } | null>(null)
	const keep = (number: number) => {
		const row = document.querySelector(`[data-season-row="${number}"]`)
		hold.current = row
			? { season: number, top: row.getBoundingClientRect().top }
			: null
	}
	useLayoutEffect(() => {
		const held = hold.current
		hold.current = null
		const row =
			held && document.querySelector(`[data-season-row="${held.season}"]`)
		if (!held || !row) return
		const by = row.getBoundingClientRect().top - held.top
		if (Math.abs(by) > 1)
			window.scrollBy({ top: by, behavior: "instant" as ScrollBehavior })
	}, [opened])

	const anchor = (of: Season) =>
		next && displaySeason(next) === of.number ? next : of.episodes[0]
	const goSeason = (to: Season | undefined, focus = false, pressed = false) => {
		const episode = to && anchor(to)
		if (!to || !episode) return
		if (pressed && opened !== to.number) keep(to.number)
		setOpened(to.number)
		setSelected(null)
		setTarget({ id: episode.id, at: Date.now(), focus, quiet: true })
	}
	const close = () => {
		if (opened !== null) keep(opened)
		setOpened(null)
		setSelected(null)
	}
	const goEpisode: Nav["goEpisode"] = (episode, how = {}, pressed = false) => {
		if (pressed && opened !== displaySeason(episode))
			keep(displaySeason(episode))
		setOpened(displaySeason(episode))
		setSelected(episode.id)
		setTarget({ id: episode.id, at: Date.now(), ...how })
	}
	return {
		seasons,
		many,
		open,
		season,
		target,
		selected,
		goEpisode,
		close,
		toggle: (to) =>
			opened === to.number ? close() : goSeason(to, false, true),
		jumpNext: (page = false) => {
			if (next) goEpisode(next, { focus: !page, page })
		},
	}
}

// ---------------------------------------------------------------------------------------------------------
// The section
// ---------------------------------------------------------------------------------------------------------

/** What every part of the list reads of the show and the member. */
function useModel(
	tracking: ShowTracking,
	view: ShowView,
	actions: TrackingActions,
	showTitle: string,
): Model {
	const { page, seasons, today } = tracking
	const { store: scores, version } = useEpisodeScores(
		tracking.store,
		page?.episodeScores,
	)
	const model = useMemo<Model>(() => {
		const aired = (episode: PageEpisode) =>
			episode.airDate !== null && episode.airDate <= today
		return {
			view,
			actions,
			scores,
			showTitle,
			today,
			seasons,
			tracked: view.tracked,
			nextId: view.derived.next?.id ?? null,
			seasonScore: (season) => page?.seasonScores[String(season)] ?? null,
			note: (season) => page?.notes[String(season)] ?? null,
			aired,
			count: (season) => {
				const out = season.episodes.filter(aired)
				const watched = out.filter((episode) =>
					view.watched.has(episode.id),
				).length
				return {
					total: season.episodes.length,
					aired: out.length,
					watched,
					done: season.number !== 0 && out.length > 0 && watched === out.length,
				}
			},
		}
		// The scores' version: a changed score draws the list again.
	}, [view, actions, today, seasons, page, scores, showTitle, version])
	return model
}

type View = "grid" | "consistency"

const SWITCH = `inline-flex h-10 items-center rounded-lg px-3 text-xs font-semibold cursor-pointer lg:h-8 ${FOCUS}`

function List({
	tracking,
	view,
	actions,
	grid,
	showTitle,
}: {
	tracking: ShowTracking
	view: ShowView
	actions: TrackingActions
	grid: EpisodeGrid | null
	showTitle: string
}) {
	const { seasons } = tracking
	const { layOutAll } = useBelowFold()
	const section = useRef<HTMLElement>(null)
	const model = useModel(tracking, view, actions, showTitle)
	const nav = useNav(model)
	const desktop = useIsDesktop()
	const [shown, setShown] = useState<View>("grid")
	const regular = model.seasons.filter((season) => season.number !== 0)
	const specials = model.seasons.find((season) => season.number === 0)
	const next =
		model.nextId === null
			? null
			: (model.seasons
					.flatMap((season) => season.episodes)
					.find((episode) => episode.id === model.nextId) ?? null)
	// The open season is as wide as the grid's rows at their widest, so its ratings line up under the tiles.
	const most = Math.max(1, ...regular.map((season) => season.episodes.length))
	const openWidth = Math.max(672, 44 + most * 40 + 36 + (most + 1) * 3)
	const open = (season: Season) =>
		nav.open === season.number ? (
			<div
				className="my-2"
				style={{ maxWidth: openWidth }}
				data-open-season={season.number}
			>
				<OpenSeason nav={nav} model={model} grid={grid} />
			</div>
		) : null

	// The hero asks for the list: at the Next episode, or at its start.
	const asked = tracking.open
	const handled = useRef(0)
	useEffect(() => {
		if (!asked || asked.at === handled.current) return
		handled.current = asked.at
		tracking.store.openHandled()
		// After this render is through: laying out the page's sections is a render of its own.
		queueMicrotask(() => {
			layOutAll()
			const episode =
				asked.episodeId === null
					? null
					: seasons
							.flatMap((season) => season.episodes)
							.find((each) => each.id === asked.episodeId)
			if (episode) nav.goEpisode(episode, { page: true })
			else {
				section.current?.scrollIntoView({ behavior: "smooth", block: "start" })
				section.current
					?.querySelector<HTMLElement>("h2")
					?.focus({ preventScroll: true })
			}
		})
	}, [asked?.at])

	return (
		<section
			ref={section}
			// The links to the episodes (the hero's, the page navigation's) lead here.
			id={EPISODE_GRID_ANCHOR}
			data-episode-list={nav.many ? "grid" : "rows"}
			// The list keeps a pressed season row in place itself; the browser doing the same would move it twice.
			className="[overflow-anchor:none]"
			aria-labelledby="episode-list-title"
			style={ROW_SCROLL_MARGIN}
		>
			<style>
				{
					"@keyframes gwt-flash{0%,40%{background-color:rgb(255 255 255/.22)}100%{background-color:transparent}}.gwt-flash{animation:gwt-flash 1.5s ease-out}@media (prefers-reduced-motion:reduce){.gwt-flash{animation:none;outline:2px solid white;outline-offset:-2px}}"
				}
			</style>
			<div className="flex flex-wrap items-center gap-2">
				<h2
					id="episode-list-title"
					tabIndex={-1}
					className="mr-auto text-xl font-bold focus:outline-none lg:text-2xl"
				>
					Episodes
				</h2>
				{next && (
					<button
						type="button"
						data-jump-next
						onClick={() => nav.jumpNext()}
						title={next.name ?? undefined}
						className={`inline-flex h-10 cursor-pointer items-center gap-1 rounded-lg bg-green-500/15 px-2.5 text-xs font-semibold text-green-300 hover:bg-green-500/25 lg:h-8 ${FOCUS}`}
					>
						Next <span className="tabular-nums">{episodeLabel(next)}</span>
					</button>
				)}
				{nav.many && (
					<div
						role="radiogroup"
						aria-label="Show the episodes as"
						data-view-toggle
						className="flex items-center gap-1"
					>
						{(
							[
								["grid", "Grid"],
								["consistency", "Consistency"],
							] as const
						).map(([key, word]) => (
							<button
								key={key}
								type="button"
								// biome-ignore lint/a11y/useSemanticElements: a two-way switch drawn as buttons, as the site's other switches
								role="radio"
								aria-checked={shown === key}
								onClick={() => setShown(key)}
								className={`${SWITCH} ${shown === key ? "bg-white text-gray-900" : "bg-white/10 text-gray-100 hover:bg-white/20"}`}
							>
								{word}
							</button>
						))}
					</div>
				)}
			</div>
			{tracking.page?.presentation?.note && (
				<p className="mt-2 text-sm text-gray-400">
					{tracking.page.presentation.note}
				</p>
			)}
			<div className="mt-4">
				{regular.length > 0 && (
					<RatingsGrid
						model={model}
						seasons={regular}
						chart={shown === "consistency"}
						selectedSeason={nav.open}
						selectedEpisode={nav.selected}
						onSeason={(season) => nav.toggle(season)}
						onEpisode={(episode) => nav.goEpisode(episode, {}, true)}
						afterRow={open}
						seasonScores={desktop}
					/>
				)}
				{specials && (
					<div
						data-season-row={0}
						className="mt-1.5"
						style={{ maxWidth: openWidth }}
					>
						<button
							type="button"
							data-season-press={0}
							aria-expanded={nav.open === 0}
							onClick={() => nav.toggle(specials)}
							className={`flex h-10 w-full cursor-pointer items-center gap-2 rounded-md px-1.5 text-left text-xs lg:h-8 ${nav.open === 0 ? "bg-white/15 text-white" : "text-gray-500 hover:bg-white/[0.06] hover:text-white"} ${FOCUS}`}
						>
							<span className="font-semibold">Specials</span>
							<span className="tabular-nums text-gray-600">
								{specials.episodes.length}
							</span>
							<ChevronDownIcon
								className={`ml-auto h-3.5 w-3.5 ${nav.open === 0 ? "rotate-180" : ""}`}
							/>
						</button>
						{open(specials)}
					</div>
				)}
			</div>
			<TrackingToastHost tracking={tracking} actions={actions} />
		</section>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The open season's parts
// ---------------------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------------------
// The rows
// ---------------------------------------------------------------------------------------------------------

/** An episode's rating as a small tile in the grid's colours, or a dash where IMDb numbers the season differently. */
function RatingChip({
	episode,
	missing,
}: {
	episode: PageEpisode
	missing: boolean
}) {
	if (episode.rating === null)
		return (
			<span
				data-chip={missing ? "missing" : "none"}
				title={
					missing
						? "No rating shown: IMDb numbers this season differently"
						: undefined
				}
				className="w-8 shrink-0 text-center text-xs text-gray-600"
			>
				{missing ? "–" : ""}
			</span>
		)
	return (
		<span data-chip="rated" className="flex shrink-0">
			<ScoreTile
				score={episode.rating}
				title={`IMDb ${formatScore(episode.rating)}${episode.ratedBy === "title" ? ", matched by title" : ""}`}
				className="h-[18px] w-8 text-[11px]"
			/>
		</span>
	)
}

/** The date of a watch: a day, or that nobody knows it. */
function DateChoice({
	watch,
	today,
	onDay,
	onUnknown,
}: {
	watch: LogRow | null
	today: string
	onDay: (day: string) => void
	onUnknown: () => void
}) {
	const on = "bg-green-500 text-black"
	const day = watch ? dayOfWatch(watch) : null
	return (
		<>
			<label
				className={`${WHEN} min-w-0 gap-2 !px-1.5 lg:!px-3 ${day ? on : WHEN_OFF}`}
			>
				<span className="hidden shrink-0 lg:inline">On</span>
				<input
					type="date"
					data-watch-day
					max={today}
					value={day ?? ""}
					onChange={(event) => event.target.value && onDay(event.target.value)}
					className="min-w-0 flex-1 rounded bg-black/30 px-1 py-1 text-base text-white [color-scheme:dark] lg:w-32 lg:flex-none lg:text-xs"
				/>
			</label>
			<button
				type="button"
				data-watch-unknown
				onClick={onUnknown}
				className={`${WHEN} ${watch && watch.watched_at === null ? on : WHEN_OFF}`}
			>
				Don't know
			</button>
		</>
	)
}

/** The buttons of a watch's date. */
const WHEN = `inline-flex h-11 items-center justify-center rounded-lg px-3 text-xs font-semibold cursor-pointer lg:h-9 ${FOCUS}`
const WHEN_OFF = "bg-white/10 text-gray-100 hover:bg-white/20"

// The icons only tracking draws (Heroicons 24 solid, MIT), written out here: imported from the icon package, or kept
// in a small module of their own, they would be added to a chunk that every page loads.
const icon = (paths: string[]) =>
	function TrackingIcon({ className }: { className?: string }) {
		return (
			<svg
				viewBox="0 0 24 24"
				fill="currentColor"
				aria-hidden="true"
				className={className}
			>
				{paths.map((d) => (
					<path key={d} fillRule="evenodd" clipRule="evenodd" d={d} />
				))}
			</svg>
		)
	}

const EyeSlashIcon = icon([
	"M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.676 12.553a11.249 11.249 0 0 1-2.631 4.31l-3.099-3.099a5.25 5.25 0 0 0-6.71-6.71L7.759 4.577a11.217 11.217 0 0 1 4.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113Z",
	"M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0 1 15.75 12ZM12.53 15.713l-4.243-4.244a3.75 3.75 0 0 0 4.244 4.243Z",
	"M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 0 0-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.704 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A5.25 5.25 0 0 1 6.75 12Z",
])

const COVER = `flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md bg-white/[0.06] text-xs font-semibold text-gray-300 ring-1 ring-inset ring-white/10 hover:bg-white/[0.1] hover:text-white ${FOCUS}`

/**
 * What a row opens to: the still, the description, when it was watched, "Watched up to here", removing the watch.
 * For an episode the member has not watched in any pass, the still and the description are each behind a cover of
 * their own size, so that uncovering one moves nothing.
 */
function RowDetail({
	episode,
	model,
	close,
}: {
	episode: PageEpisode
	model: Model
	close: () => void
}) {
	const { view, actions, today } = model
	const special = episode.season === 0
	const aired = model.aired(episode)
	const watched = view.watched.has(episode.id)
	const pass = view.derived.pass
	const watches = view.watchesOf.get(episode.id) ?? []
	const current = watches.find((row) => row.pass === pass) ?? null
	// A rewatcher has seen it: a watch in any pass uncovers everything.
	const seenIt = watches.length > 0
	const [uncovered, setUncovered] = useState({ image: false, text: false })
	const detail = useRef<HTMLDivElement>(null)
	const uncover = (what: "image" | "text") => {
		setUncovered((now) => ({ ...now, [what]: true }))
		// The cover that had the focus is gone; keep the keyboard in the row.
		detail.current?.focus({ preventScroll: true })
	}
	// Aired regular episodes up to and including this one that are not watched in this pass.
	const upTo =
		special || watched || !aired
			? 0
			: model.seasons
					.filter((season) => season.number !== 0)
					.flatMap((season) => season.episodes)
					.filter(
						(each) =>
							(each.season < episode.season ||
								(each.season === episode.season &&
									each.number <= episode.number)) &&
							model.aired(each) &&
							!view.watched.has(each.id),
					).length
	return (
		<div
			ref={detail}
			data-detail
			tabIndex={-1}
			className="mx-2 mb-2 rounded-lg bg-black/25 p-2.5 focus:outline-none lg:ml-10"
		>
			<div className="flex flex-col gap-2.5 sm:flex-row">
				{episode.still &&
					(seenIt || uncovered.image ? (
						<img
							src={tmdbImageUrl(episode.still, "w300")}
							alt=""
							loading="lazy"
							className="aspect-video w-full rounded-md bg-white/[0.06] object-cover sm:w-40 sm:shrink-0"
						/>
					) : (
						<button
							type="button"
							data-cover="image"
							onClick={() => uncover("image")}
							className={`${COVER} aspect-video w-full sm:w-40 sm:shrink-0`}
						>
							<EyeSlashIcon className="h-4 w-4" />
							Show image
						</button>
					))}
				<div className="min-w-0 flex-1">
					<p className="text-xs text-gray-500">
						{episode.airDate
							? aired
								? formatDay(episode.airDate)
								: `Airs ${formatDay(episode.airDate)}`
							: "No air date"}
						{episode.runtime ? ` · ${episode.runtime} min` : ""}
						{episode.rating !== null
							? ` · IMDb ${formatScore(episode.rating)}${episode.ratedBy === "title" ? " (matched by title)" : ""}`
							: ""}
					</p>
					{episode.overview &&
						(seenIt || uncovered.text ? (
							<MediaText
								as="p"
								data-overview
								value={episodeText(episode, "overview")}
								className="mt-1 text-sm leading-relaxed text-gray-300"
							/>
						) : (
							<div className="relative mt-1 min-h-10">
								{/* The text holds its place under the cover, unseen and unread. */}
								<MediaText
									as="p"
									aria-hidden="true"
									value={episodeText(episode, "overview")}
									className="invisible select-none text-sm leading-relaxed"
								/>
								<button
									type="button"
									data-cover="text"
									onClick={() => uncover("text")}
									className={`${COVER} absolute inset-0 w-full flex-row gap-1.5`}
								>
									<EyeSlashIcon className="h-4 w-4" />
									Show description
								</button>
							</div>
						))}
				</div>
			</div>
			{aired && (
				<div className="mt-3">
					<EpisodeScoreFrame
						store={model.scores}
						target={{
							scope: "episode",
							season: episode.season,
							episode: episode.number,
							episodeTmdbId: episode.id,
						}}
						scoreKey={`e${episode.id}`}
						name={episodeLabel(episode)}
						title={`${episodeLabel(episode)}${episode.name ? ` · ${episode.name}` : ""}`}
						ask="Rate this episode"
					/>
				</div>
			)}
			{aired ? (
				// A label line, then when (Now, a day, or unknown) as one even row, then the bigger actions on a row of their own.
				<div className="mt-3.5 flex flex-col gap-2.5 text-xs text-gray-400">
					<p data-watched-when>
						{current
							? `Watched ${formatWatched(current, today)}${special ? ", not counted" : ""}`
							: "When did you watch it?"}
					</p>
					<div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-1.5 lg:flex lg:gap-2">
						<button
							type="button"
							data-watch-now
							disabled={!!current}
							onClick={() => actions.watch(episode)}
							className={`${WHEN} ${current ? "pointer-events-none opacity-40" : WHEN_OFF}`}
						>
							Now
						</button>
						<DateChoice
							watch={current}
							today={today}
							onDay={(day) =>
								current
									? actions.setWatchDate(current.watch_id, {
											precision: "day",
											day,
										})
									: actions.watch(episode, { precision: "day", day })
							}
							onUnknown={() =>
								current
									? actions.setWatchDate(current.watch_id, {
											precision: "unknown",
										})
									: actions.watch(episode, { precision: "unknown" })
							}
						/>
					</div>
					{(upTo > 1 || current) && (
						<div className="flex flex-wrap items-center justify-between gap-2">
							{upTo > 1 ? (
								<button
									type="button"
									data-up-to-here
									onClick={() => {
										actions.watchUpTo(episode)
										close()
									}}
									className={`${WHEN} gap-1.5 bg-white/10 text-green-300 ring-1 ring-green-400/40 hover:bg-white/20`}
								>
									<CheckIcon className="h-3.5 w-3.5" />
									Watched up to here ({upTo})
								</button>
							) : (
								<span />
							)}
							{current && (
								<button
									type="button"
									data-remove-watch
									onClick={() => {
										actions.unwatch(episode)
										close()
									}}
									className={`${WHEN} text-pink-300 hover:bg-white/10`}
								>
									Remove watch
								</button>
							)}
						</div>
					)}
				</div>
			) : (
				<p className="mt-2 text-xs text-gray-500">
					It can be marked from the day it airs.
				</p>
			)}
			{watches.length > 1 && (
				<ul
					data-episode-log
					className="mt-2.5 border-t border-white/[0.06] pt-2 text-xs text-gray-300"
				>
					<li className="pb-1 text-gray-500">
						Your {watches.length} watches of this episode
					</li>
					{watches.map((row) => (
						<li
							key={row.watch_id}
							data-logged-watch={row.pass}
							className="flex min-h-10 items-center gap-2 lg:min-h-8"
						>
							<span className="w-14 shrink-0 tabular-nums text-gray-500">
								Pass {row.pass}
							</span>
							<span className="min-w-0 flex-1 truncate">
								{formatWatched(row, today)}
							</span>
							<button
								type="button"
								aria-label={`Remove the watch of pass ${row.pass}`}
								onClick={() => actions.deleteWatch(row.watch_id)}
								className={`${CHIP} text-pink-300 hover:bg-white/10`}
							>
								Remove
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}

/**
 * One episode on one line: tick, number, name, the rating, the air date. A press on the line opens the still and
 * the rest in place.
 */
function Row({
	episode,
	model,
	open,
	onToggle,
	selected,
	flash,
}: {
	episode: PageEpisode
	model: Model
	open: boolean
	onToggle: () => void
	selected: boolean
	flash: boolean
}) {
	const { view, actions } = model
	const special = episode.season === 0
	const watched = view.watched.has(episode.id)
	const aired = model.aired(episode)
	const isNext = model.nextId === episode.id
	const missing =
		episode.rating === null && model.note(episode.season) !== null && aired
	return (
		<li
			data-episode={episode.id}
			data-selected={selected || undefined}
			data-watched={watched || undefined}
			// Scrolled to in the page: clear of the sticky header above and of a phone's dock below.
			className={`relative scroll-mb-28 border-t border-white/[0.06] ${flash ? "gwt-flash" : ""} ${selected ? "bg-white/[0.09]" : isNext ? "bg-green-500/[0.07]" : ""}`}
			style={ROW_SCROLL_MARGIN}
		>
			{selected && (
				<span
					aria-hidden="true"
					className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-full bg-white"
				/>
			)}
			<div
				className={`flex h-11 items-center pr-1.5 lg:h-9 lg:pointer-coarse:h-11 ${aired ? "" : "opacity-50"}`}
			>
				<button
					type="button"
					// biome-ignore lint/a11y/useSemanticElements: a checkbox that records at once and shows a clock while the episode has not aired; a button carries both
					role="checkbox"
					data-tick
					disabled={!aired}
					onClick={() =>
						watched ? actions.unwatch(episode) : actions.watch(episode)
					}
					aria-checked={watched}
					aria-label={`Watched: ${episodeLabel(episode)}${episode.name ? `, ${episode.name}` : ""}${aired ? "" : ", not aired yet"}`}
					// The press target is 44 px wherever the pointer is a finger; the box drawn in it is smaller.
					className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg disabled:cursor-not-allowed lg:h-9 lg:w-9 lg:pointer-coarse:h-11 lg:pointer-coarse:w-11 ${FOCUS}`}
				>
					<span
						data-tick-box
						className={`flex h-6 w-6 items-center justify-center rounded-md lg:h-5 lg:w-5 lg:rounded-[5px] ${
							!aired
								? "border-2 border-dashed border-white/25 text-gray-500"
								: watched
									? special
										? "border-2 border-green-400/70 text-green-300"
										: "bg-green-500 text-black"
									: "border-2 border-white/40 text-transparent hover:border-green-400 hover:text-green-400/60"
						}`}
					>
						{aired ? (
							<CheckIcon className="h-3.5 w-3.5" />
						) : (
							<ClockIcon className="h-3 w-3" />
						)}
					</span>
				</button>
				<button
					type="button"
					data-row
					aria-expanded={open}
					onClick={onToggle}
					className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 rounded text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"
				>
					<span className="w-5 shrink-0 text-right text-xs tabular-nums text-gray-500">
						{displaySeason(episode) < 0
							? episodeLabel(episode)
							: displayNumber(episode)}
					</span>
					<MediaText
						value={
							episode.name
								? episodeText(episode, "name")
								: { text: episodeLabel(episode), lang: "en" }
						}
						className={`min-w-0 truncate text-sm ${watched ? "text-gray-400" : "font-medium text-white"}`}
					/>
					{isNext && (
						<span className="shrink-0 rounded bg-green-500 px-1 text-[10px] font-bold uppercase leading-4 text-black">
							Next
						</span>
					)}
					<span className="flex-1" />
					{aired && (
						<OwnScoreChip
							score={model.scores.get(`e${episode.id}`)?.score ?? null}
						/>
					)}
					{!special && aired && (
						<RatingChip episode={episode} missing={missing} />
					)}
					<span className="hidden w-28 shrink-0 whitespace-nowrap text-right text-xs tabular-nums text-gray-500 lg:block">
						{episode.airDate
							? aired
								? formatDay(episode.airDate)
								: `Airs ${formatDay(episode.airDate)}`
							: "No air date"}
					</span>
				</button>
			</div>
			{open && <RowDetail episode={episode} model={model} close={onToggle} />}
		</li>
	)
}

/** A small text button, as the watch log's Remove. */
const CHIP = `inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold cursor-pointer lg:h-8 ${FOCUS}`
const FOLD = `flex h-10 w-full cursor-pointer items-center gap-2 border-t border-white/[0.06] px-3 text-left text-xs text-gray-400 hover:bg-white/[0.05] hover:text-white lg:h-7 ${FOCUS}`

/**
 * A season's rows: a window of `limit` rows around the asked-for or the Next episode, with the rest folded into one
 * line above and one below, each of which opens `limit` more. The rows are part of the page and scroll with it;
 * nothing here scrolls by itself, so a row that opens only pushes down what is under it.
 */
export function Rows({
	season,
	nav,
	model,
	limit,
}: {
	season: Season
	nav: Nav
	model: Model
	limit: number
}) {
	const episodes = season.episodes
	const special = season.number === 0
	const target = nav.target
	const root = useRef<HTMLDivElement>(null)
	const indexOf = (id: number | null | undefined) =>
		id == null ? -1 : episodes.findIndex((episode) => episode.id === id)
	const around = (i: number): [number, number] => {
		const to = Math.min(episodes.length, Math.max(0, i - 1) + limit)
		return [Math.max(0, to - limit), to]
	}
	const [range, setRange] = useState<[number, number]>(() =>
		around(
			Math.max(
				0,
				indexOf(target?.id) >= 0 ? indexOf(target?.id) : indexOf(model.nextId),
			),
		),
	)
	const [openId, setOpenId] = useState<number | null>(null)
	const [flash, setFlash] = useState<number | null>(null)

	useEffect(() => {
		const i = indexOf(target?.id)
		if (!target || i < 0) return
		// The window moves to the row; a season change (quiet) then leaves the page where it is.
		setRange((now) => (i >= now[0] && i < now[1] ? now : around(i)))
		const id = target.id
		const timer = setTimeout(() => {
			const row = root.current?.querySelector<HTMLElement>(
				`[data-episode="${id}"]`,
			)
			if (!row) return
			// The page scrolls, and only as far as it has to: to the middle for a request from the hero, and
			// otherwise just into view, clear of the sticky header (the row's scroll margin).
			if (target.page)
				row.scrollIntoView({ behavior: "smooth", block: "center" })
			else if (!target.quiet) row.scrollIntoView({ block: "nearest" })
			if (target.focus)
				row
					.querySelector<HTMLElement>("[data-row]")
					?.focus({ preventScroll: true })
			if (!target.quiet) setFlash(id)
		}, 40)
		return () => clearTimeout(timer)
	}, [target?.at])
	useEffect(() => {
		if (flash === null) return
		const timer = setTimeout(() => setFlash(null), 1600)
		return () => clearTimeout(timer)
	}, [flash])

	const [from, to] = range
	const shown = episodes.slice(from, to)
	const span = (a: number, b: number) =>
		special
			? ""
			: a === b
				? displaySeason(episodes[a]) < 0
					? episodeLabel(episodes[a])
					: `E${displayNumber(episodes[a])}`
				: displaySeason(episodes[a]) < 0
					? `${episodeLabel(episodes[a])}–${episodeLabel(episodes[b])}`
					: `E${displayNumber(episodes[a])}–E${displayNumber(episodes[b])}`
	return (
		<div ref={root} data-rows={season.number}>
			{from > 0 && (
				<button
					type="button"
					data-fold="earlier"
					onClick={() => setRange([Math.max(0, from - limit), to])}
					className={FOLD}
				>
					<ChevronDownIcon className="h-3.5 w-3.5 rotate-180" />
					<span className="tabular-nums">
						{span(0, from - 1) || plural(from, "earlier special")}
					</span>
				</button>
			)}
			<ul>
				{shown.map((episode) => (
					<Row
						key={episode.id}
						episode={episode}
						model={model}
						open={openId === episode.id}
						onToggle={() =>
							setOpenId(openId === episode.id ? null : episode.id)
						}
						selected={nav.selected === episode.id}
						flash={flash === episode.id}
					/>
				))}
			</ul>
			{to < episodes.length && (
				<button
					type="button"
					data-fold="later"
					onClick={() =>
						setRange([from, Math.min(episodes.length, to + limit)])
					}
					className={FOLD}
				>
					<ChevronDownIcon className="h-3.5 w-3.5" />
					<span className="tabular-nums">
						{span(to, episodes.length - 1) || `${episodes.length - to} more`}
					</span>
				</button>
			)}
		</div>
	)
}
