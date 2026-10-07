// PROTOTYPE - throwaway (#369, round 4). The season matrix: every season a short row that is one press target, every
// episode a small cell in its rating's colour, watched or not. A press on a season row opens that season's rows in
// place (or beside the matrix), so the matrix is the season navigation. Also here: the one strip for the whole show,
// the navigation state with "nothing open", and the section's tools. The rows, the finder and the rating matching
// are round 3's, the hero and the season helpers round 2's, the model and the store round 1's.
import { CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, MagnifyingGlassIcon } from "@heroicons/react/24/solid"
import { useSearchParams } from "@remix-run/react"
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react"
import { formatScore, imdbVibe, vibeTileColor } from "~/ui/details/episode-grid/scale"
import { FOCUS, ScoreChip, seasonScore, useCurrentSeason, useGrid, useSeasons } from "~/ui/prototype-episode-list-2/shared"
import { DenseList, Finder, H2, type Nav, NumberingNote, type Target, useCount, useHideUnwatched, useIsDesktop, useRatings } from "~/ui/prototype-episode-list-3/shared"
import { type Ep, type Season, epCode, isAired, plural, regularSeasons, seasonOf } from "~/ui/prototype-episode-list/model"
import { SURFACE, SeasonMeta, seasonTitle } from "~/ui/prototype-episode-list/parts"
import { useStore } from "~/ui/prototype-episode-list/store"

// ---- what the variants vary ----------------------------------------------------------------

/** How a watched cell is told from an unwatched one. Every aired cell keeps its rating colour in all three. */
export type Mark = "line" | "tick" | "fade"
/** How the matrix fits a phone. On a wide screen "zoom" puts the open season beside the matrix; the others open it in place. */
export type Fit = "cols" | "wrap" | "zoom"
export interface Setup {
	mark: Mark
	fit: Fit
	/** Start from one strip for the whole show, which opens to the matrix. */
	strip: boolean
}
export const MARKS: Record<Mark, string> = { line: "line under watched", tick: "tick in watched", fade: "watched faded" }
export const FITS: Record<Fit, string> = { cols: "two columns of seasons", wrap: "big cells, 12 a line", zoom: "zoomed-out rows" }

/** The variant's own setup, unless the white strip's switches (`mark=`, `fit=`) say otherwise. */
export function useSetup(base: Setup): Setup {
	const [params] = useSearchParams()
	const mark = params.get("mark") ?? ""
	const fit = params.get("fit") ?? ""
	return { ...base, mark: mark in MARKS ? (mark as Mark) : base.mark, fit: fit in FITS ? (fit as Fit) : base.fit }
}

const PANEL = `min-w-0 overflow-hidden rounded-xl border border-white/[0.06] ${SURFACE}`
const short = (season: Season) => (season.number === 0 ? "Sp" : `S${season.number}`)

// ---- navigation state: a season open, or none ----------------------------------------------

/**
 * Which season is open (none at level 0) and which episode was asked for. It has the shape of round 3's navigation,
 * so round 3's finder and rows work with it.
 */
export function useNav4() {
	const { show, d } = useStore()
	const seasons = useSeasons()
	const current = useCurrentSeason()
	const many = seasons.length > 1
	const [opened, setOpened] = useState<number | null>(null)
	const [target, setTarget] = useState<Target | null>(null)
	const [selected, setSelected] = useState<number | null>(null)
	const input = useRef<HTMLInputElement>(null)
	const open = many ? opened : (seasons[0]?.number ?? null)
	const picked = open ?? current
	const index = Math.max(0, seasons.findIndex((x) => x.number === picked))
	const season = seasons[index]

	// A pressed season row stays where it is on the screen, also when the season that closes was above it.
	const hold = useRef<{ n: number; top: number } | null>(null)
	const keep = (n: number) => {
		const el = document.querySelector(`[data-season="${n}"]`)
		hold.current = el ? { n, top: el.getBoundingClientRect().top } : null
	}
	useLayoutEffect(() => {
		const held = hold.current
		hold.current = null
		const el = held && document.querySelector(`[data-season="${held.n}"]`)
		if (!held || !el) return
		const by = el.getBoundingClientRect().top - held.top
		if (Math.abs(by) > 1) window.scrollBy({ top: by, behavior: "instant" as ScrollBehavior })
	}, [opened])

	const anchor = (of: Season) => (d.next && of.episodes.includes(d.next) ? d.next : of.episodes[0])
	const goSeason = (to: Season | undefined, focus = false, pressed = false) => {
		const ep = to && anchor(to)
		if (!to || !ep) return
		if (pressed && opened !== to.number) keep(to.number)
		setOpened(to.number)
		setSelected(null)
		setTarget({ id: ep.id, t: Date.now(), focus, quiet: true })
	}
	const close = () => {
		if (opened != null) keep(opened)
		setOpened(null)
		setSelected(null)
	}
	/** A press on a season row: open it, or close it when it is the open one. */
	const toggle = (to: Season) => (opened === to.number ? close() : goSeason(to, false, true))
	const goEp = (ep: Ep, how: Partial<Target> = {}, pressed = false) => {
		const n = seasonOf(show, ep)
		if (pressed && opened !== n) keep(n)
		setOpened(n)
		setSelected(ep.id)
		setTarget({ id: ep.id, t: Date.now(), ...how })
	}
	const jumpNext = (page = false) => {
		const next = d.next
		if (!next) {
			if (page) document.getElementById("episodes")?.scrollIntoView({ behavior: "smooth", block: "start" })
			return
		}
		goEp(next, { focus: !page })
		// From the hero the row is far away: bring it to the middle of the screen.
		if (page) setTimeout(() => document.querySelector(`#episodes [data-ep="${next.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120)
	}
	const step = (by: number) => goSeason(seasons[index + by], true)

	// "f" puts the cursor in the finder ("/" is the site search's), "n" goes to the next episode.
	const keys = useRef({ jumpNext })
	keys.current = { jumpNext }
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return
			if (e.key === "f") {
				e.preventDefault()
				input.current?.focus()
			}
			if (e.key === "n") keys.current.jumpNext()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [])

	return { seasons, many, picked, season, index, target, selected, input, goEp, goSeason, jumpNext, step, open, toggle, close }
}
export type Nav4 = ReturnType<typeof useNav4>

// ---- the section's tools -------------------------------------------------------------------

/** The heading line: the finder (behind a magnifier on a phone, to keep the section short) and the jump to the next episode. */
export function Tools({ nav }: { nav: Nav4 }) {
	const { show, d } = useStore()
	const desktop = useIsDesktop()
	const [finding, setFinding] = useState(false)
	const small = !nav.many && nav.season.episodes.length <= 12
	useEffect(() => {
		if (finding) nav.input.current?.focus()
	}, [finding, nav.input])
	return (
		<div className="flex flex-wrap items-center gap-x-2 gap-y-2">
			<h2 className={`${H2} mr-auto lg:mr-1`}>Episodes</h2>
			{!small && !desktop && (
				<button type="button" data-finder-open aria-expanded={finding} aria-label="Find an episode" onClick={() => setFinding(!finding)} className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg ${finding ? "bg-white/20 text-white" : "bg-white/[0.07] text-gray-300"} ${FOCUS}`}>
					<MagnifyingGlassIcon className="h-4 w-4" />
				</button>
			)}
			{!small && <Finder nav={nav as unknown as Nav} className={desktop ? "w-72" : finding ? "order-last w-full" : "hidden"} />}
			{!small && d.next && (
				<button type="button" data-jump-next onClick={() => nav.jumpNext()} className={`inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-green-500/15 px-2.5 text-xs font-bold text-green-300 ring-1 ring-green-400/40 hover:bg-green-500/25 lg:h-8 ${FOCUS}`}>
					Next · {epCode(show, d.next)}
				</button>
			)}
		</div>
	)
}

// ---- cells -----------------------------------------------------------------------------------

/** What every row of the matrix needs, read once. */
function useMatrix(setup: Setup, nav: Nav4) {
	const { show, st, today, d } = useStore()
	const { byEp } = useRatings()
	return { show, st, today, byEp, nav, mark: setup.mark, hide: useHideUnwatched(), grid: useGrid(), count: useCount(), tracking: d.started || st.seenMarked, next: d.started ? d.next : null }
}
type M = ReturnType<typeof useMatrix>

type Shape = "stack" | "inline" | "wrap" | "tiny"
const CELL_HEIGHT: Record<Shape, string> = { stack: "h-[11px]", inline: "h-[18px] lg:h-3.5", wrap: "h-[15px]", tiny: "h-[11px]" }
const CELL_WIDTH: Record<Shape, number> = { stack: 14, inline: 22, wrap: 26, tiny: 14 }

/**
 * One cell per episode of a season, in TMDB's order. An aired episode is always in its rating's colour, watched or
 * not; one without a matched rating is grey; one not aired yet is a dashed outline. Watched is the mark on top:
 * a white line under the cell, a tick (a dot when the cell is a sliver) inside it, or the cell faded.
 */
function Cells({ season, m, shape, columns, press }: { season: Season; m: M; shape: Shape; columns: number; press: boolean }) {
	const big = shape === "inline" || shape === "wrap"
	return (
		<span data-cells={season.number} className={`grid ${shape === "wrap" ? "gap-y-0.5" : ""}`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, ${CELL_WIDTH[shape]}px))` }}>
			{season.episodes.map((ep) => {
				const watched = !!m.st.watches[ep.id]
				const aired = isAired(ep, m.today)
				const rated = m.byEp.get(ep.id)
				const shown = rated && (watched || !m.hide) ? rated : null
				const isNext = m.next === ep
				const colour = shown ? vibeTileColor(imdbVibe(shown.score)) : "rgb(255 255 255 / 0.24)"
				const background = !aired ? undefined : m.mark === "fade" && watched ? `color-mix(in oklab, ${colour} 42%, #141923)` : colour
				const label = `${epCode(m.show, ep)} · ${ep.name}${shown ? ` · ${formatScore(shown.score)}` : ""}${watched ? " · watched" : aired ? "" : " · not aired"}`
				const body = (
					<span key="body" className="block">
						<span className={`relative mr-px flex items-center justify-center rounded-[2px] ${CELL_HEIGHT[shape]} ${aired ? "" : "border border-dashed border-white/20"} ${isNext ? "z-[1] ring-2 ring-white" : ""}`} style={{ background }}>
							{watched && m.mark === "tick" && (big ? <CheckIcon className="h-3 w-3 rounded-full bg-black/75 p-px text-white" /> : <span className="h-1 w-1 rounded-full bg-black ring-1 ring-white/80" />)}
							{watched && m.mark === "fade" && big && <CheckIcon className="h-2.5 w-2.5 text-white/60" />}
						</span>
						{m.mark === "line" && <span className={`mt-0.5 block h-[3px] ${watched ? "bg-white" : ""}`} />}
					</span>
				)
				const data = { "data-cell": ep.id, "data-watched": watched || undefined, "data-next": isNext || undefined, "data-rated": shown ? formatScore(shown.score) : undefined }
				return press ? (
					<button key={ep.id} type="button" {...data} tabIndex={-1} aria-label={label} title={label} onClick={() => m.nav.goEp(ep, {}, true)} className="pointer-events-auto relative block min-w-0 cursor-pointer hover:brightness-125 focus-visible:outline-2 focus-visible:outline-white">
						{body}
					</button>
				) : (
					<span key={ep.id} {...data} className="relative block min-w-0">
						{body}
					</span>
				)
			})}
		</span>
	)
}

function MiniScore({ score, tiny }: { score: number | null; tiny?: boolean }) {
	if (score == null) return <span className={tiny ? "w-6" : "w-7"} />
	return (
		<span className={`inline-flex shrink-0 items-center justify-center rounded-[3px] font-semibold tabular-nums text-white ${tiny ? "h-3.5 w-6 text-[9px]" : "h-4 w-7 text-[10px]"}`} style={{ background: vibeTileColor(imdbVibe(score)) }}>
			{formatScore(score)}
		</span>
	)
}

/**
 * A season as one row of the matrix. The whole row is the press target that opens the season; the cells lie on top
 * of it and are shortcuts to their episode where they are wide enough to hit.
 */
function Tile({ season, m, shape, columns, press, dense }: { season: Season; m: M; shape: Shape; columns: number; press: boolean; dense?: boolean }) {
	const c = m.count(season)
	const special = season.number === 0
	const on = m.nav.open === season.number
	const score = seasonScore(m.grid, season.number)
	const tiny = shape === "tiny"
	const text = tiny ? "text-[10px]" : "text-[11px]"
	const label = <span className={`shrink-0 font-bold tabular-nums ${tiny ? "w-6 text-[10px]" : "w-8 text-xs"} ${c.done ? "text-green-300" : on ? "text-white" : "text-gray-300"}`}>{short(season)}</span>
	const count = (
		<span data-count className={`shrink-0 text-right tabular-nums ${text} ${tiny ? "w-8" : "min-w-8"} ${c.done ? "text-green-300" : "text-gray-400"}`}>
			{c.done ? <CheckIcon className="inline h-3.5 w-3.5" aria-label="All watched" /> : special ? (c.watched ? `${c.watched}/${c.aired}` : c.aired) : m.tracking ? `${c.watched}/${c.aired}` : c.aired}
		</span>
	)
	const cells = special ? (
		<span className={`block truncate text-gray-500 ${text}`}>{shape === "stack" ? "extras, not counted" : `${plural(season.episodes.length, "special")}, not counted`}</span>
	) : (
		<Cells season={season} m={m} shape={shape} columns={columns} press={press} />
	)
	const height = shape === "stack" ? "h-10 flex-col justify-center gap-0.5 px-1.5" : shape === "tiny" ? "h-5 items-center gap-1 px-1" : shape === "wrap" ? "min-h-11 items-center gap-1.5 px-1.5 py-1" : `${dense ? "lg:h-[22px]" : "lg:h-7"} min-h-10 items-center gap-1.5 px-1.5 lg:min-h-0`
	return (
		<div data-season={season.number} className={`pointer-events-none relative flex min-w-0 rounded-md ${height} ${on ? "bg-white/15" : "bg-white/[0.04]"}`}>
			<button
				type="button"
				data-row={season.number}
				aria-expanded={on}
				aria-label={`${seasonTitle(season)}, ${special || m.tracking ? `${c.watched} of ${c.aired} watched` : plural(c.aired, "episode")}${score == null ? "" : `, season score ${formatScore(score)}`}`}
				onClick={() => m.nav.toggle(season)}
				className={`pointer-events-auto absolute inset-0 cursor-pointer rounded-md hover:bg-white/[0.07] ${on ? "ring-1 ring-inset ring-white/70" : ""} ${FOCUS}`}
			/>
			{shape === "stack" ? (
				<>
					<span className="relative flex items-center gap-1">
						{label}
						<span className="flex-1" />
						{count}
						{!special && <MiniScore score={score} />}
					</span>
					<span className="relative block">{cells}</span>
				</>
			) : (
				<>
					<span className="relative">{label}</span>
					<span className="relative min-w-0 flex-1">{cells}</span>
					<span className="relative flex items-center gap-1.5">
						{count}
						{!special && <MiniScore score={score} tiny={tiny} />}
					</span>
				</>
			)}
		</div>
	)
}

// ---- the open season --------------------------------------------------------------------------

/** Level 1: the open season's own line and its one-line rows with the rating tile. */
function SeasonPanel({ nav, beside, steppers }: { nav: Nav4; beside: boolean; steppers: boolean }) {
	const grid = useGrid()
	const desktop = useIsDesktop()
	const season = nav.season
	const stepper = `flex h-10 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-300 hover:bg-white/10 disabled:cursor-default disabled:opacity-25 ${FOCUS}`
	return (
		<div data-panel={season.number} className={`${PANEL} ${beside ? "" : "my-1"}`}>
			<div className="flex min-h-11 items-center gap-1.5 py-1 pl-3 pr-1">
				{steppers && (
					<button type="button" data-step="-1" aria-label="Previous season" disabled={nav.index === 0} onClick={() => nav.goSeason(nav.seasons[nav.index - 1], false, true)} className={`${stepper} -ml-2`}>
						<ChevronLeftIcon className="h-4 w-4" />
					</button>
				)}
				<h3 className="flex min-w-0 items-center gap-2 text-sm font-bold text-white">
					<span className="truncate">{steppers ? short(season) : seasonTitle(season)}</span>
					<span className={steppers ? "hidden" : "contents"}>
						<ScoreChip score={seasonScore(grid, season.number)} />
					</span>
				</h3>
				{steppers && (
					<button type="button" data-step="1" aria-label="Next season" disabled={nav.index === nav.seasons.length - 1} onClick={() => nav.goSeason(nav.seasons[nav.index + 1], false, true)} className={stepper}>
						<ChevronRightIcon className="h-4 w-4" />
					</button>
				)}
				<span className="flex-1" />
				<SeasonMeta season={season} showBar={false} />
				<button type="button" data-close aria-label={`Close ${seasonTitle(season)}`} onClick={nav.close} className={`flex h-10 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-400 hover:bg-white/10 hover:text-white ${FOCUS}`}>
					<ChevronUpIcon className="h-4 w-4" />
				</button>
			</div>
			<NumberingNote season={season} />
			{beside ? (
				<DenseList key={season.number} season={season} target={nav.target} layout="scroll" scrollClass="max-h-[20.5rem]" chips selectedId={nav.selected} onStep={nav.step} />
			) : (
				<DenseList key={`${season.number}-${desktop}`} season={season} target={nav.target} layout="fold" limit={desktop ? 24 : 8} columns chips selectedId={nav.selected} onStep={nav.step} />
			)}
		</div>
	)
}

// ---- the matrix -------------------------------------------------------------------------------

function Legend({ m, action }: { m: M; action?: ReactNode }) {
	const box = "inline-block h-2.5 w-2 rounded-[2px] bg-white/40"
	return (
		<div className="mt-1 flex min-h-4 flex-wrap items-center gap-x-3 gap-y-1 text-[10px] leading-4 text-gray-500">
			<span>colour: IMDb rating</span>
			{m.tracking && (
				<span className="inline-flex items-center gap-1">
					{m.mark === "line" && <span className="inline-block h-[3px] w-4 bg-white" />}
					{m.mark === "tick" && (
						<span className={`${box} relative`}>
							<span className="absolute left-0.5 top-[3px] h-1 w-1 rounded-full bg-black" />
						</span>
					)}
					{m.mark === "fade" && <span className={`${box} opacity-40`} />}
					watched
				</span>
			)}
			{m.next && (
				<span className="inline-flex items-center gap-1.5">
					<span className={`${box} ml-0.5 ring-2 ring-white`} /> next
				</span>
			)}
			{action && <span className="ml-auto">{action}</span>}
		</div>
	)
}

/**
 * Level 0 and its way into level 1. Seasons are rows of at least 40 pixels on a phone, in two columns when there
 * are more than eight; "wrap" gives every season two lines of big cells instead; "zoom" draws all seasons as thin
 * rows and enlarges the one that is open. A wide screen gets two columns, or (with "zoom") one column with the open
 * season beside it.
 */
export function Matrix({ nav, setup, action }: { nav: Nav4; setup: Setup; action?: ReactNode }) {
	const m = useMatrix(setup, nav)
	const desktop = useIsDesktop()
	const tiles = nav.seasons
	const long = tiles.length > 8
	const most = Math.max(1, ...regularSeasons(m.show).map((x) => x.episodes.length))
	const beside = desktop && setup.fit === "zoom"
	const cols = (desktop ? !beside : setup.fit === "cols") && long ? 2 : 1
	const shapeOf = (season: Season): Shape => {
		if (desktop || !long) return "inline"
		if (setup.fit === "cols") return "stack"
		if (setup.fit === "wrap") return "wrap"
		return nav.open === season.number ? "wrap" : "tiny"
	}
	const perCol = Math.ceil(tiles.length / cols)
	const lines = Array.from({ length: perCol }, (_, r) => Array.from({ length: cols }, (_, c) => tiles[c * perCol + r]).filter(Boolean))
	const openSeason = nav.open == null ? null : nav.season
	const rows = (
		<div data-matrix data-fit={setup.fit} data-mark={setup.mark} className="flex flex-col gap-[3px] lg:gap-0.5">
			{lines.map((line) => (
				<div key={line[0].number}>
					<div className="grid gap-x-1 lg:gap-x-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
						{line.map((season) => {
							const shape = shapeOf(season)
							return <Tile key={season.number} season={season} m={m} shape={shape} columns={shape === "wrap" ? Math.min(12, most) : most} press={shape !== "stack" || most <= 12} dense={beside} />
						})}
					</div>
					{!beside && openSeason && line.includes(openSeason) && <SeasonPanel nav={nav} beside={false} steppers={!desktop && long && setup.fit === "zoom"} />}
				</div>
			))}
		</div>
	)
	if (!beside)
		return (
			<div className={cols === 1 && desktop ? "max-w-3xl" : ""}>
				{rows}
				<Legend m={m} action={action} />
			</div>
		)
	return (
		<div className="grid grid-cols-[30rem_minmax(0,1fr)] items-start gap-3">
			<div>
				{rows}
				<Legend m={m} action={action} />
			</div>
			{openSeason ? (
				<SeasonPanel nav={nav} beside steppers={false} />
			) : (
				<div data-beside-empty className={`${PANEL} flex min-h-24 flex-col items-start justify-center gap-2 p-4 text-sm text-gray-400`}>
					<p>Press a season to see its episodes here, or a cell to go straight to that episode.</p>
					{m.next && (
						<button type="button" onClick={() => nav.jumpNext()} className={`cursor-pointer text-sm font-semibold text-green-300 underline decoration-green-400/40 underline-offset-4 hover:text-green-200 ${FOCUS}`}>
							Next: {epCode(m.show, m.next)} · {m.next.name}
						</button>
					)}
				</div>
			)}
		</div>
	)
}

// ---- one strip for the whole show -------------------------------------------------------------

/**
 * The smallest form: one block per season, as wide as the season is long, in the season score's colour, with a
 * white line under it as far as the season is watched. One press opens the matrix.
 */
export function ShowStrip({ onOpen }: { onOpen: () => void }) {
	const { show, d } = useStore()
	const grid = useGrid()
	const count = useCount()
	const seasons = regularSeasons(show)
	const current = d.started && d.next ? seasonOf(show, d.next) : null
	const left = d.aired.length - d.watched.length
	return (
		<button type="button" data-strip aria-expanded={false} aria-label={`${plural(seasons.length, "season")}, ${d.watched.length} of ${d.aired.length} episodes watched. Show the seasons`} onClick={onOpen} className={`block w-full cursor-pointer rounded-xl border border-white/[0.06] p-2 text-left hover:bg-white/[0.04] ${SURFACE} ${FOCUS}`}>
			<span className="flex gap-0.5">
				{seasons.map((season) => {
					const c = count(season)
					const score = seasonScore(grid, season.number)
					return (
						<span key={season.number} data-strip-season={season.number} className="block min-w-4" style={{ flex: `${Math.max(1, season.episodes.length)} 1 0%` }}>
							<span className={`flex h-8 items-center justify-center rounded-[3px] text-[10px] font-bold tabular-nums text-white ${current === season.number ? "ring-2 ring-white" : ""}`} style={{ background: score == null ? "rgb(255 255 255 / 0.24)" : vibeTileColor(imdbVibe(score)) }}>
								{season.number}
							</span>
							<span className="mt-0.5 block h-[3px]">
								<span className="block h-full bg-white" style={{ width: `${c.aired ? (c.watched / c.aired) * 100 : 0}%` }} />
							</span>
						</span>
					)
				})}
			</span>
			<span className="mt-1.5 flex items-center gap-2 text-xs text-gray-400">
				<span className="min-w-0 flex-1 truncate">
					{current ? `In season ${current} · ${plural(left, "episode")} left` : left ? `${plural(left, "episode")} left` : "All watched"}
				</span>
				<span className="inline-flex shrink-0 items-center gap-1 font-semibold text-gray-200">
					Seasons <ChevronDownIcon className="h-3.5 w-3.5" />
				</span>
			</span>
		</button>
	)
}
