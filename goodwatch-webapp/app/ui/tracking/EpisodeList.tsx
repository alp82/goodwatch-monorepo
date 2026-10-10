// The episode list of a show page (#369, variant D of round 4; #384), for a member with tracking. It starts small
// and opens by choice: a matrix with a row per season and a cell per episode in its rating's colour, watched cells
// faded and the Next episode ringed; a press on a season row opens it into one-line rows with tick, name, air date
// and rating; a press on a row opens it for the still, the date and "Watched up to here". On a wide screen the open
// season sits beside the matrix. A show with one season shows only its rows. For a member who never tracked the
// show the matrix is the ratings overview. The toggle at the right of the heading line swaps the matrix for the
// grid in IMDb's numbering, in place. An unwatched episode's still and description stay covered until asked for.
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
import { episodeLabel } from "~/domain/tracking/machine"
import { seenPressLine } from "~/domain/tracking/seen-press"
import type { PageEpisode, ShowView } from "~/domain/tracking/show-page"
import type { LogRow } from "~/domain/tracking/storage"
import { useBelowFold } from "~/ui/details/below-fold"
import {
	EPISODE_GRID_ANCHOR,
	formatScore,
	imdbVibe,
	vibeTileColor,
} from "~/ui/details/episode-grid/scale"
import { HEADER_HEIGHT } from "~/ui/details/header-height"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import {
	ConfirmPanel,
	POPOVER,
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
	seasonShort,
	seasonTitle,
	useShowTracking,
} from "./store"

export default function EpisodeList({
	media,
	children,
}: {
	media: TrackedMedia
	/** Today's episode grid, in IMDb's numbering; nothing for a show without one. */
	children: ReactNode
}) {
	const tracking = useShowTracking(media.details.tmdb_id)
	const actions = useTrackingActions(tracking.store, media.details.title)
	if (!tracking.ready || !tracking.view) return <>{children}</>
	return (
		<List tracking={tracking} view={tracking.view} actions={actions}>
			{children}
		</List>
	)
}

// ---------------------------------------------------------------------------------------------------------
// What every part reads
// ---------------------------------------------------------------------------------------------------------

/** A score as a small tile in the episode grid's colours. */
export function ScoreTile({
	score,
	title,
	className = "h-5 min-w-8 text-[11px]",
}: {
	score: number | null
	title?: string
	className?: string
}) {
	if (score === null) return null
	return (
		<span
			title={title}
			className={`inline-flex shrink-0 items-center justify-center rounded-[4px] px-1 font-semibold tabular-nums text-white ${className}`}
			style={{ background: vibeTileColor(imdbVibe(score)) }}
		>
			{formatScore(score)}
		</span>
	)
}

const SITE_BAR_HEIGHT = 64
/** What stays clear above a place the page scrolls to: the site bar and the title page's sticky header. */
const UNDER_HEADERS = `calc(${HEADER_HEIGHT} + ${SITE_BAR_HEIGHT + 16}px)`
const ROW_SCROLL_MARGIN = { scrollMarginTop: UNDER_HEADERS }

/** The view of the episodes section the member chose last in this browser: the list, or the grid. */
const VIEW_KEY = "gw:episodes-view"
function recall(): boolean {
	try {
		return window.localStorage.getItem(VIEW_KEY) === "grid"
	} catch {
		return false
	}
}
function remember(grid: boolean) {
	try {
		if (grid) window.localStorage.setItem(VIEW_KEY, "grid")
		else window.localStorage.removeItem(VIEW_KEY)
	} catch {}
}
const PANEL = `min-w-0 overflow-hidden rounded-xl border border-white/[0.06] ${SURFACE}`
const norm = (name: string | null) =>
	(name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")

function useIsDesktop() {
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

interface Model {
	view: ShowView
	actions: TrackingActions
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

interface Nav {
	seasons: Season[]
	many: boolean
	/** The open season's number; null at the matrix alone. */
	open: number | null
	season: Season
	index: number
	target: Target | null
	selected: number | null
	goEpisode: (
		episode: PageEpisode,
		how?: Partial<Target>,
		pressed?: boolean,
	) => void
	goSeason: (
		season: Season | undefined,
		focus?: boolean,
		pressed?: boolean,
	) => void
	toggle: (season: Season) => void
	close: () => void
	step: (by: number) => void
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
	const picked = open ?? next?.season ?? seasons[0]?.number ?? 0
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
		next && next.season === of.number ? next : of.episodes[0]
	const goSeason: Nav["goSeason"] = (to, focus = false, pressed = false) => {
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
		if (pressed && opened !== episode.season) keep(episode.season)
		setOpened(episode.season)
		setSelected(episode.id)
		setTarget({ id: episode.id, at: Date.now(), ...how })
	}
	return {
		seasons,
		many,
		open,
		season,
		index,
		target,
		selected,
		goEpisode,
		goSeason,
		close,
		toggle: (to) =>
			opened === to.number ? close() : goSeason(to, false, true),
		step: (by) => goSeason(seasons[index + by], true),
		jumpNext: (page = false) => {
			if (next) goEpisode(next, { focus: !page, page })
		},
	}
}

// ---------------------------------------------------------------------------------------------------------
// The section
// ---------------------------------------------------------------------------------------------------------

function List({
	tracking,
	view,
	actions,
	children,
}: {
	tracking: ShowTracking
	view: ShowView
	actions: TrackingActions
	children: ReactNode
}) {
	const { page, seasons, today } = tracking
	const { layOutAll } = useBelowFold()
	const section = useRef<HTMLElement>(null)
	// Which of the two views the section shows: the matrix, or the grid in IMDb's numbering. Remembered per browser.
	const [gridOpen, setGridOpen] = useState(() => Boolean(children) && recall())
	const chooseGrid = (on: boolean) => {
		setGridOpen(on)
		remember(on)
	}
	const model = useMemo<Model>(() => {
		const aired = (episode: PageEpisode) =>
			episode.airDate !== null && episode.airDate <= today
		return {
			view,
			actions,
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
					done: season.number > 0 && out.length > 0 && watched === out.length,
				}
			},
		}
	}, [view, actions, today, seasons, page])
	const nav = useNav(model)

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
	// The finder, Next and the hero's link lead to a row of the list, so they bring the list back.
	useEffect(() => {
		if (nav.target) setGridOpen(false)
	}, [nav.target?.at])

	return (
		<section
			ref={section}
			// The link in the hero's ratings row leads here. The grid carries the same anchor while it is shown.
			id={gridOpen ? undefined : EPISODE_GRID_ANCHOR}
			data-episode-list={nav.many ? "matrix" : "rows"}
			data-view={gridOpen ? "grid" : "list"}
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
			<Tools
				nav={nav}
				model={model}
				grid={children ? { on: gridOpen, choose: chooseGrid } : null}
			/>
			{gridOpen ? (
				// The grid brings its own heading; this section's stands for both.
				<div
					data-imdb-grid
					className="mt-1 [&>section>div:first-child]:justify-end [&_#episode-grid-title]:sr-only"
				>
					{children}
				</div>
			) : (
				<>
					<PressLine view={view} actions={actions} />
					<div className="mt-3">
						{nav.many ? (
							<Matrix nav={nav} model={model} />
						) : (
							<div className={`max-w-3xl ${PANEL}`}>
								<SeasonHead nav={nav} model={model} only />
								<Rows
									key={nav.season.number}
									season={nav.season}
									nav={nav}
									model={model}
									limit={12}
								/>
							</div>
						)}
					</div>
				</>
			)}
			<TrackingToastHost tracking={tracking} actions={actions} />
		</section>
	)
}

/**
 * The Seen press that stands, in one line: when it was made and what it covered, and the way to take it back.
 * Take back asks first, under the line, in the status menu's words; the toast that follows offers Undo.
 */
function PressLine({
	view,
	actions,
}: {
	view: ShowView
	actions: TrackingActions
}) {
	const [asking, setAsking] = useState(false)
	const root = useRef<HTMLDivElement>(null)
	const link = useRef<HTMLButtonElement>(null)
	useDismiss(asking, root, (byKey) => {
		setAsking(false)
		if (byKey) link.current?.focus()
	})
	const { press } = view
	if (!press) return null
	// What taking it back does is the machine's to say: the menu's entry, which is there while the press stands.
	const entry = view.menu.find((each) => each.id === "takeBack")
	return (
		<div ref={root} data-seen-press className="relative mt-2">
			<p className="flex flex-wrap items-baseline gap-x-2 text-xs leading-5 text-gray-400">
				<span>{seenPressLine(press, LOCALE_DATES)}</span>
				{entry && (
					<button
						ref={link}
						type="button"
						data-take-back
						aria-haspopup="dialog"
						aria-expanded={asking}
						onClick={() => setAsking(!asking)}
						className={`-my-2 cursor-pointer py-2 font-semibold text-gray-300 underline decoration-white/30 underline-offset-4 hover:text-white ${FOCUS}`}
					>
						Take back
					</button>
				)}
			</p>
			{asking && entry && (
				// Over the matrix, so that nothing below moves when it opens.
				<div
					role="alertdialog"
					aria-label={entry.label}
					className={`absolute left-0 top-full z-30 mt-1 w-80 max-w-full ${POPOVER}`}
				>
					<ConfirmPanel
						name="takeBack"
						title="Take back Seen?"
						text={entry.note}
						action="Take back"
						look={TAKE_BACK_LOOK}
						onCancel={() => {
							setAsking(false)
							link.current?.focus()
						}}
						onConfirm={() => {
							setAsking(false)
							actions.undoSeen()
						}}
					/>
				</div>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The heading line: the finder and the jump to the Next episode
// ---------------------------------------------------------------------------------------------------------

type Found = { episode: PageEpisode } | { season: Season }

/** "9x14", "s9e14", "9.14", "s9", "14" (in the open season) or part of a name. */
export function findEpisodes(
	seasons: Season[],
	picked: number,
	query: string,
): Found[] {
	const q = query.trim().toLowerCase()
	if (!q) return []
	const out: Found[] = []
	const has = (episode: PageEpisode) =>
		out.some((found) => "episode" in found && found.episode === episode)
	const add = (season: Season | undefined, number: number) => {
		const episode = season?.episodes.find((each) => each.number === number)
		if (episode && !has(episode)) out.push({ episode })
	}
	const regular = (number: number) =>
		seasons.find((season) => season.number === number && number > 0)
	const code = q.match(/^s?\s*(\d{1,4})\s*(?:[xe.:\-\s]|\s*e)\s*(\d{1,4})$/)
	if (code) add(regular(Number(code[1])), Number(code[2]))
	const whole = q.match(/^s(?:eason)?\s*(\d{1,4})$/)
	const season = whole && regular(Number(whole[1]))
	if (season) out.push({ season })
	if (/^\d{1,4}$/.test(q)) {
		add(
			seasons.find((each) => each.number === picked),
			Number(q),
		)
		const other = regular(Number(q))
		if (other) out.push({ season: other })
	}
	const key = norm(q)
	if (key.length >= 2 && !code) {
		const hits = seasons.flatMap((each) =>
			each.episodes.filter((episode) => norm(episode.name).includes(key)),
		)
		hits.sort(
			(a, b) =>
				Number(norm(b.name).startsWith(key)) -
				Number(norm(a.name).startsWith(key)),
		)
		for (const episode of hits)
			if (out.length < 7 && !has(episode)) out.push({ episode })
	}
	return out.slice(0, 7)
}

function Finder({
	nav,
	model,
	className,
	autoFocus,
}: {
	nav: Nav
	model: Model
	className: string
	autoFocus?: boolean
}) {
	const [query, setQuery] = useState("")
	const [at, setAt] = useState(0)
	const [open, setOpen] = useState(false)
	const input = useRef<HTMLInputElement>(null)
	useEffect(() => {
		if (autoFocus) input.current?.focus()
	}, [autoFocus])
	const found = useMemo(
		() => findEpisodes(nav.seasons, nav.season.number, query),
		[nav.seasons, nav.season.number, query],
	)
	const pick = (choice: Found | undefined) => {
		if (!choice) return
		if ("episode" in choice) nav.goEpisode(choice.episode, { focus: true })
		else nav.goSeason(choice.season, true)
		setQuery("")
		setOpen(false)
	}
	return (
		<div className={`relative ${className}`}>
			<MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
			<input
				ref={input}
				type="search"
				role="combobox"
				aria-expanded={open && found.length > 0}
				aria-controls="episode-finder-results"
				aria-label="Find an episode"
				autoComplete="off"
				placeholder="Find: 9x14, s9e14 or a name"
				value={query}
				onChange={(event) => {
					setQuery(event.target.value)
					setAt(0)
					setOpen(true)
				}}
				onFocus={() => setOpen(true)}
				onBlur={() => setOpen(false)}
				onKeyDown={(event) => {
					if (event.key === "ArrowDown" || event.key === "ArrowUp") {
						event.preventDefault()
						const by = event.key === "ArrowDown" ? 1 : -1
						setAt((i) =>
							found.length ? (i + by + found.length) % found.length : 0,
						)
					}
					if (event.key === "Enter") pick(found[at])
					if (event.key === "Escape") {
						setQuery("")
						event.currentTarget.blur()
					}
				}}
				// 16 px on a phone, so that the browser does not zoom the page when the field takes focus.
				className="h-10 w-full rounded-lg bg-white/[0.07] pl-8 pr-2 text-base text-white placeholder:text-gray-500 focus:bg-white/10 focus:outline-2 focus:outline-white/60 lg:h-8 lg:text-sm"
			/>
			{open && query.trim() && (
				<div
					id="episode-finder-results"
					className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-white/10 bg-gray-800 shadow-2xl lg:min-w-80"
				>
					{found.length === 0 && (
						<p className="px-3 py-2 text-xs text-gray-400">
							No episode found. Try 9x14, s9e14 or part of a name.
						</p>
					)}
					{found.map((choice, i) => (
						<button
							key={
								"episode" in choice
									? choice.episode.id
									: `s${choice.season.number}`
							}
							type="button"
							data-found
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => pick(choice)}
							className={`flex h-11 w-full cursor-pointer items-center gap-2 px-3 text-left text-sm lg:h-8 ${i === at ? "bg-white/15" : "hover:bg-white/10"}`}
						>
							{"episode" in choice ? (
								<>
									<span className="w-16 shrink-0 text-xs font-bold tabular-nums text-gray-300">
										{episodeLabel(choice.episode)}
									</span>
									<span className="min-w-0 flex-1 truncate text-white">
										{choice.episode.name}
									</span>
									{model.view.watched.has(choice.episode.id) && (
										<CheckIcon className="h-3.5 w-3.5 shrink-0 text-green-400" />
									)}
								</>
							) : (
								<span className="font-semibold text-white">
									{seasonTitle(choice.season.number)}
								</span>
							)}
						</button>
					))}
				</div>
			)}
		</div>
	)
}

/** Twelve cells in the grid's colours: what the toggle leads to, in small. */
const MINIATURE = [8.2, 8.6, 7.9, 9.1, 7.4, 8.3, 8.8, 6.6, 8.0, 9.3, 8.5, 7.7]

// A picture that is a toggle button looks as a streaming service does in the Discover filters (`OptionLogo` in
// ui/filter-bar/FilterGroups.tsx): in full colour inside a green ring while on, grey and dim until the pointer is
// over it while off, with the filters' amber focus ring. The class names are written out here and not shared: a
// module of them would be added to a chunk that every page loads.
const TILE_TOGGLE =
	"group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
const TILE_ON = "ring-2 ring-emerald-400 ring-offset-2 ring-offset-gray-900"
const TILE_OFF =
	"opacity-45 grayscale group-hover:opacity-90 group-hover:grayscale-0"

/** The switch between the list and the ratings grid in IMDb's numbering. It stays in the heading line. */
function ViewToggle({
	on,
	choose,
}: {
	on: boolean
	choose: (on: boolean) => void
}) {
	return (
		<button
			type="button"
			data-view-toggle
			aria-pressed={on}
			aria-label="All ratings as one grid, in IMDb's numbering"
			title={
				on
					? "Back to the episode list"
					: "All ratings as one grid, in IMDb's numbering"
			}
			onClick={() => choose(!on)}
			className={`inline-flex h-10 shrink-0 items-center gap-2.5 rounded-xl px-1 lg:ml-auto lg:h-8 lg:pr-2 ${TILE_TOGGLE}`}
		>
			{/* The miniature is the picture: in colour inside a green ring while the grid is shown, grey and dim otherwise. */}
			<span
				data-toggle-tile={on ? "on" : "off"}
				className={`flex h-7 w-10 items-center justify-center rounded-lg transition ${SURFACE} ${on ? TILE_ON : `ring-1 ring-white/20 ${TILE_OFF}`}`}
			>
				<span aria-hidden="true" className="grid grid-cols-4 gap-px">
					{MINIATURE.map((score, index) => (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: a fixed drawing
							key={index}
							className="h-[5px] w-[7px] rounded-[1px]"
							style={{ background: vibeTileColor(imdbVibe(score)) }}
						/>
					))}
				</span>
			</span>
			<span
				className={`hidden text-xs font-semibold transition-colors lg:inline ${on ? "text-white" : "text-gray-400 group-hover:text-gray-200"}`}
			>
				Grid
			</span>
		</button>
	)
}

function Tools({
	nav,
	model,
	grid,
}: {
	nav: Nav
	model: Model
	/** The switch to the ratings grid; null for a show without one. */
	grid: { on: boolean; choose: (on: boolean) => void } | null
}) {
	const desktop = useIsDesktop()
	const [finding, setFinding] = useState(false)
	// A short single season is in view as a whole: nothing to find and nothing to jump to.
	const small = !nav.many && nav.season.episodes.length <= 12
	const next =
		model.nextId === null
			? null
			: nav.seasons
					.flatMap((season) => season.episodes)
					.find((episode) => episode.id === model.nextId)
	return (
		<div className="flex flex-wrap items-center gap-x-2 gap-y-2">
			<h2
				id="episode-list-title"
				tabIndex={-1}
				className="mr-auto text-2xl font-bold focus:outline-none lg:mr-1"
			>
				Episodes
			</h2>
			{!small && !desktop && (
				<button
					type="button"
					data-finder-open
					aria-expanded={finding}
					aria-label="Find an episode"
					onClick={() => setFinding(!finding)}
					className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg ${finding ? "bg-white/20 text-white" : "bg-white/[0.07] text-gray-300"} ${FOCUS}`}
				>
					<MagnifyingGlassIcon className="h-4 w-4" />
				</button>
			)}
			{!small && (desktop || finding) && (
				<Finder
					nav={nav}
					model={model}
					autoFocus={!desktop}
					className={desktop ? "w-72" : "order-last w-full"}
				/>
			)}
			{!small && next && (
				<button
					type="button"
					data-jump-next
					onClick={() => nav.jumpNext()}
					className={`inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-green-500/15 px-2.5 text-xs font-bold text-green-300 ring-1 ring-green-400/40 hover:bg-green-500/25 lg:h-8 ${FOCUS}`}
				>
					Next · {episodeLabel(next)}
				</button>
			)}
			{grid && <ViewToggle {...grid} />}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The matrix
// ---------------------------------------------------------------------------------------------------------

/** A closed season row is one thin line of cells; the open one on a phone is enlarged to twelve big cells a line. */
type Shape = "thin" | "big"

/**
 * One cell per episode of a season, in TMDB's order. An aired episode is in its rating's colour whether it is
 * watched or not, and grey without a matched rating; a watched one is faded; one that has not aired is a dashed
 * outline; the Next episode has a white ring.
 */
function Cells({
	season,
	model,
	nav,
	shape,
	columns,
	press,
}: {
	season: Season
	model: Model
	nav: Nav
	shape: Shape
	columns: number
	press: boolean
}) {
	const big = shape === "big"
	return (
		<span
			data-cells={season.number}
			className={`grid ${big ? "gap-y-0.5" : ""}`}
			style={{
				gridTemplateColumns: `repeat(${columns}, minmax(0, ${big ? 26 : 22}px))`,
			}}
		>
			{season.episodes.map((episode) => {
				const watched = model.tracked && model.view.watched.has(episode.id)
				const aired = model.aired(episode)
				const isNext = model.nextId === episode.id
				const colour =
					episode.rating === null
						? "rgb(255 255 255 / 0.24)"
						: vibeTileColor(imdbVibe(episode.rating))
				const background = !aired
					? undefined
					: watched
						? `color-mix(in oklab, ${colour} 42%, #141923)`
						: colour
				const label = `${episodeLabel(episode)} · ${episode.name ?? "Untitled"}${episode.rating === null ? "" : ` · ${formatScore(episode.rating)}`}${watched ? " · watched" : aired ? "" : " · not aired"}`
				const body = (
					<span
						key="body"
						className={`relative mr-px flex items-center justify-center rounded-[2px] ${big ? "h-[18px]" : "h-3.5"} ${aired ? "" : "border border-dashed border-white/20"} ${isNext ? "z-[1] ring-2 ring-white" : ""}`}
						style={{ background }}
					>
						{watched && big && (
							<CheckIcon className="h-2.5 w-2.5 text-white/60" />
						)}
					</span>
				)
				const data = {
					"data-cell": episode.id,
					"data-watched": watched || undefined,
					"data-next": isNext || undefined,
					"data-rated":
						episode.rating === null ? undefined : formatScore(episode.rating),
				}
				return press ? (
					<button
						key={episode.id}
						type="button"
						{...data}
						tabIndex={-1}
						aria-label={label}
						title={label}
						onClick={() => nav.goEpisode(episode, {}, true)}
						className="pointer-events-auto relative block min-w-0 cursor-pointer hover:brightness-125 focus-visible:outline-2 focus-visible:outline-white"
					>
						{body}
					</button>
				) : (
					<span key={episode.id} {...data} className="relative block min-w-0">
						{body}
					</span>
				)
			})}
		</span>
	)
}

/**
 * A season as one row of the matrix. The whole row is the press target that opens the season: 40 pixels high on a
 * phone and wherever the pointer is a finger, 22 with a mouse. The cells lie on top of it and are shortcuts to
 * their episode where they are wide enough to hit.
 */
function SeasonRow({
	season,
	model,
	nav,
	shape,
	columns,
	press,
}: {
	season: Season
	model: Model
	nav: Nav
	shape: Shape
	columns: number
	press: boolean
}) {
	const count = model.count(season)
	const special = season.number === 0
	const on = nav.open === season.number
	const score = model.seasonScore(season.number)
	return (
		<div
			data-season-row={season.number}
			className={`pointer-events-none relative flex min-w-0 items-center gap-1.5 px-1.5 ${shape === "big" ? "min-h-11 py-1" : "h-10 lg:h-[22px] lg:pointer-coarse:h-10"}`}
		>
			<button
				type="button"
				data-season-press={season.number}
				aria-expanded={on}
				aria-label={`${seasonTitle(season.number)}, ${special || model.tracked ? `${count.watched} of ${count.aired} watched` : plural(count.aired, "episode")}${score === null ? "" : `, season score ${formatScore(score)}`}`}
				onClick={() => nav.toggle(season)}
				// The press target is the whole row; what is drawn is two pixels shorter, so that rows read as rows.
				className={`pointer-events-auto absolute inset-0 cursor-pointer bg-clip-content py-px ${on ? "bg-white/15" : "bg-white/[0.04] hover:bg-white/[0.09]"} rounded-md ${FOCUS}`}
			/>
			<span
				className={`relative w-7 shrink-0 text-xs font-bold tabular-nums ${count.done ? "text-green-300" : on ? "text-white" : "text-gray-300"}`}
			>
				{seasonShort(season.number)}
			</span>
			<span className="relative min-w-0 flex-1">
				{special ? (
					<span className="block truncate text-[11px] text-gray-500">
						{plural(season.episodes.length, "special")}, not counted
					</span>
				) : (
					<Cells
						season={season}
						model={model}
						nav={nav}
						shape={shape}
						columns={columns}
						press={press}
					/>
				)}
			</span>
			<span className="relative flex shrink-0 items-center gap-1.5">
				<span
					data-count
					className={`min-w-8 text-right text-[11px] tabular-nums ${count.done ? "text-green-300" : "text-gray-400"}`}
				>
					{count.done ? (
						<CheckIcon
							className="inline h-3.5 w-3.5"
							aria-label="All watched"
						/>
					) : model.tracked || (special && count.watched) ? (
						`${count.watched}/${count.aired}`
					) : (
						count.aired
					)}
				</span>
				{special ? (
					<span className="w-7" />
				) : (
					<ScoreTile
						score={score}
						title={
							score === null ? undefined : `Season score ${formatScore(score)}`
						}
						className="h-4 w-7 text-[10px]"
					/>
				)}
				{!special && score === null && <span className="w-7" />}
			</span>
		</div>
	)
}

function Legend({ model }: { model: Model }) {
	const box = "inline-block h-2.5 w-2 rounded-[2px] bg-white/40"
	return (
		<div className="mt-1.5 flex min-h-4 flex-wrap items-center gap-x-3 gap-y-1 text-[10px] leading-4 text-gray-500">
			<span>colour: IMDb rating</span>
			{model.tracked && (
				<span className="inline-flex items-center gap-1">
					<span className={`${box} opacity-40`} /> watched
				</span>
			)}
			{model.nextId !== null && (
				<span className="inline-flex items-center gap-1.5">
					<span className={`${box} ml-0.5 ring-2 ring-white`} /> next
				</span>
			)}
		</div>
	)
}

function Matrix({ nav, model }: { nav: Nav; model: Model }) {
	const desktop = useIsDesktop()
	const most = Math.max(
		1,
		...nav.seasons
			.filter((season) => season.number > 0)
			.map((season) => season.episodes.length),
	)
	const openSeason = nav.open === null ? null : nav.season
	const next =
		model.nextId === null
			? null
			: nav.seasons
					.flatMap((season) => season.episodes)
					.find((episode) => episode.id === model.nextId)
	const rows = (
		<div data-matrix className="flex flex-col lg:gap-0.5">
			{nav.seasons.map((season) => {
				const big = !desktop && openSeason === season
				return (
					<div key={season.number}>
						<SeasonRow
							season={season}
							model={model}
							nav={nav}
							shape={big ? "big" : "thin"}
							columns={big ? Math.min(12, most) : most}
							// A cell is a shortcut where it is wide enough to hit: with a mouse, and in the enlarged row.
							press={desktop || big}
						/>
						{!desktop && openSeason === season && (
							<SeasonPanel nav={nav} model={model} beside={false} />
						)}
					</div>
				)
			})}
		</div>
	)
	if (!desktop)
		return (
			<div>
				{rows}
				<Legend model={model} />
			</div>
		)
	return (
		<div className="grid grid-cols-[30rem_minmax(0,1fr)] items-start gap-3">
			<div>
				{rows}
				<Legend model={model} />
			</div>
			{openSeason ? (
				<SeasonPanel nav={nav} model={model} beside />
			) : (
				<div
					data-beside-empty
					className={`${PANEL} flex min-h-24 flex-col items-start justify-center gap-2 p-4 text-sm text-gray-400`}
				>
					<p>
						Press a season to see its episodes here, or a cell to go straight to
						that episode.
					</p>
					{next && (
						<button
							type="button"
							onClick={() => nav.jumpNext()}
							className={`cursor-pointer text-left text-sm font-semibold text-green-300 underline decoration-green-400/40 underline-offset-4 hover:text-green-200 ${FOCUS}`}
						>
							Next: {episodeLabel(next)}
							{next.name ? ` · ${next.name}` : ""}
						</button>
					)}
				</div>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The open season
// ---------------------------------------------------------------------------------------------------------

const CHIP = `inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold cursor-pointer lg:h-8 ${FOCUS}`
const CHIP_OFF = "bg-white/10 text-gray-100 hover:bg-white/20"

/** The open season's own line: its title and score, the count, and the whole-season mark. */
function SeasonHead({
	nav,
	model,
	only = false,
	steppers = false,
}: {
	nav: Nav
	model: Model
	/** The show's only season: no title, nothing to close. */
	only?: boolean
	/** A phone: arrows to the seasons beside it, to correct a press on the wrong row. */
	steppers?: boolean
}) {
	const season = nav.season
	const count = model.count(season)
	const special = season.number === 0
	const stepper = `flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-300 hover:bg-white/10 disabled:cursor-default disabled:opacity-25 ${FOCUS}`
	const left = count.aired - count.watched
	return (
		<div className="flex min-h-11 items-center gap-1 py-1 pl-3 pr-1">
			{steppers && (
				<button
					type="button"
					data-step="-1"
					aria-label="Previous season"
					disabled={nav.index === 0}
					onClick={() => nav.goSeason(nav.seasons[nav.index - 1], false, true)}
					className={`${stepper} -ml-2`}
				>
					<ChevronRightIcon className="h-4 w-4 rotate-180" />
				</button>
			)}
			<h3 className="flex min-w-0 items-center gap-2 text-sm font-bold text-white">
				<span className="truncate">
					{only
						? plural(season.episodes.length, "episode")
						: steppers
							? seasonShort(season.number)
							: seasonTitle(season.number)}
				</span>
				{!steppers && (
					<ScoreTile
						score={model.seasonScore(season.number)}
						title="Season score"
					/>
				)}
			</h3>
			{steppers && (
				<button
					type="button"
					data-step="1"
					aria-label="Next season"
					disabled={nav.index === nav.seasons.length - 1}
					onClick={() => nav.goSeason(nav.seasons[nav.index + 1], false, true)}
					className={stepper}
				>
					<ChevronRightIcon className="h-4 w-4" />
				</button>
			)}
			<span className="flex-1" />
			<span
				data-season-count
				className={`shrink-0 text-xs tabular-nums ${count.done ? "font-semibold text-green-300" : "text-gray-400"}`}
			>
				{special
					? `${count.watched} watched · not counted`
					: model.tracked
						? `${count.watched}/${count.aired}`
						: plural(count.aired, "episode")}
				{count.total > count.aired && !special
					? ` · ${count.total - count.aired} to air`
					: ""}
			</span>
			{!special && left > 0 && (
				<button
					type="button"
					data-mark-season
					onClick={() => model.actions.markSeason(season.number)}
					className={`${CHIP} ml-1.5 shrink-0 bg-white/10 text-green-300 hover:bg-white/20`}
				>
					<CheckIcon className="h-3.5 w-3.5" />
					Mark season
				</button>
			)}
			{!only && (
				<button
					type="button"
					data-close-season
					aria-label={`Close ${seasonTitle(season.number)}`}
					onClick={nav.close}
					className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-400 hover:bg-white/10 hover:text-white ${FOCUS}`}
				>
					<ChevronDownIcon className="h-4 w-4 rotate-180" />
				</button>
			)}
		</div>
	)
}

/** What a season's ratings lose when IMDb numbers it differently. */
function NumberingNote({ season, model }: { season: Season; model: Model }) {
	const note = model.note(season.number)
	if (!note) return null
	return (
		<p
			data-numbering-note
			className="flex items-start gap-1.5 border-t border-white/[0.06] px-3 py-1.5 text-[11px] leading-4 text-amber-200/90"
		>
			<span aria-hidden="true" className="font-bold">
				!
			</span>
			<span>
				IMDb numbers this season differently.{" "}
				{note.byTitle
					? `${plural(note.byTitle, "rating")} matched by title`
					: "No rating could be matched by title"}
				{note.missing
					? `; ${plural(note.missing, "episode")} left without a rating rather than given a neighbour's.`
					: "."}
			</span>
		</p>
	)
}

function SeasonPanel({
	nav,
	model,
	beside,
}: {
	nav: Nav
	model: Model
	beside: boolean
}) {
	const season = nav.season
	return (
		<div
			data-season-panel={season.number}
			className={`${PANEL} ${beside ? "" : "my-1"}`}
		>
			<SeasonHead nav={nav} model={model} steppers={!beside} />
			<NumberingNote season={season} model={model} />
			<Rows
				key={season.number}
				season={season}
				nav={nav}
				model={model}
				// Beside the matrix there is room for a few more rows than under a phone's season row.
				limit={beside ? 10 : 8}
			/>
		</div>
	)
}

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
			<label className={`${CHIP} ${day ? on : CHIP_OFF}`}>
				On
				<input
					type="date"
					data-watch-day
					max={today}
					value={day ?? ""}
					onChange={(event) => event.target.value && onDay(event.target.value)}
					className="w-[8.25rem] rounded bg-black/30 px-1 py-0.5 text-base text-white [color-scheme:dark] lg:w-[7.25rem] lg:text-xs"
				/>
			</label>
			<button
				type="button"
				data-watch-unknown
				onClick={onUnknown}
				className={`${CHIP} ${watch && watch.watched_at === null ? on : CHIP_OFF}`}
			>
				Don't know when
			</button>
		</>
	)
}

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
					.filter((season) => season.number > 0)
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
							<p
								data-overview
								className="mt-1 text-sm leading-relaxed text-gray-300"
							>
								{episode.overview}
							</p>
						) : (
							<div className="relative mt-1 min-h-10">
								{/* The text holds its place under the cover, unseen and unread. */}
								<p
									aria-hidden="true"
									className="invisible select-none text-sm leading-relaxed"
								>
									{episode.overview}
								</p>
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
			{aired ? (
				<div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
					<span data-watched-when>
						{current
							? `Watched ${formatWatched(current, today)}${special ? ", not counted" : ""}:`
							: "Watched it:"}
					</span>
					{!current && (
						<button
							type="button"
							data-watch-now
							onClick={() => actions.watch(episode)}
							className={`${CHIP} ${CHIP_OFF}`}
						>
							Now
						</button>
					)}
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
					{upTo > 1 && (
						<button
							type="button"
							data-up-to-here
							onClick={() => {
								actions.watchUpTo(episode)
								close()
							}}
							className={`${CHIP} bg-white/10 text-green-300 ring-1 ring-green-400/40 hover:bg-white/20`}
						>
							<CheckIcon className="h-3.5 w-3.5" />
							Watched up to here ({upTo})
						</button>
					)}
					{current && (
						<button
							type="button"
							data-remove-watch
							onClick={() => {
								actions.unwatch(episode)
								close()
							}}
							className={`${CHIP} text-pink-300 hover:bg-white/10`}
						>
							Remove watch
						</button>
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
						{episode.number}
					</span>
					<span
						className={`min-w-0 truncate text-sm ${watched ? "text-gray-400" : "font-medium text-white"}`}
					>
						{episode.name ?? episodeLabel(episode)}
					</span>
					{isNext && (
						<span className="shrink-0 rounded bg-green-500 px-1 text-[10px] font-bold uppercase leading-4 text-black">
							Next
						</span>
					)}
					<span className="flex-1" />
					{!special && aired && (
						<RatingChip episode={episode} missing={missing} />
					)}
					<span className="hidden w-28 shrink-0 whitespace-nowrap text-right text-xs tabular-nums text-gray-500 sm:block">
						{episode.airDate
							? aired
								? formatDay(episode.airDate)
								: `Airs ${formatDay(episode.airDate)}`
							: "No air date"}
					</span>
					<ChevronDownIcon
						className={`h-3.5 w-3.5 shrink-0 text-gray-600 transition-transform ${open ? "rotate-180" : ""}`}
					/>
				</button>
			</div>
			{open && <RowDetail episode={episode} model={model} close={onToggle} />}
		</li>
	)
}

const FOLD = `flex h-10 w-full cursor-pointer items-center gap-2 border-t border-white/[0.06] px-3 text-left text-xs text-gray-400 hover:bg-white/[0.05] hover:text-white lg:h-7 ${FOCUS}`

/**
 * A season's rows: a window of `limit` rows around the asked-for or the Next episode, with the rest folded into one
 * line above and one below, each of which opens `limit` more. The rows are part of the page and scroll with it;
 * nothing here scrolls by itself, so a row that opens only pushes down what is under it.
 */
function Rows({
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
				? `E${episodes[a].number}`
				: `E${episodes[a].number}–E${episodes[b].number}`
	const watchedIn = (a: number, b: number) =>
		episodes.slice(a, b).filter((episode) => model.view.watched.has(episode.id))
			.length
	return (
		<div ref={root} data-rows={season.number}>
			{special && (
				<p className="border-t border-white/[0.06] px-3 py-1.5 text-[11px] text-gray-400">
					Specials can be marked. They never count toward your progress or
					toward the show being Seen.
				</p>
			)}
			{from > 0 && (
				<button
					type="button"
					data-fold="earlier"
					onClick={() => setRange([Math.max(0, from - limit), to])}
					className={FOLD}
				>
					<ChevronDownIcon className="h-3.5 w-3.5 rotate-180" />
					<span className="tabular-nums">
						{plural(from, "earlier episode")}
						{span(0, from - 1) && ` · ${span(0, from - 1)}`}
						{model.tracked &&
							` · ${watchedIn(0, from) === from ? "all watched" : `${watchedIn(0, from)} watched`}`}
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
						{episodes.length - to} more
						{span(to, episodes.length - 1) &&
							` · ${span(to, episodes.length - 1)}`}
					</span>
				</button>
			)}
		</div>
	)
}
