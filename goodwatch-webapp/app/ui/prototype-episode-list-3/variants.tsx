// PROTOTYPE - throwaway (#369, round 3). Three dense takes on round 2's season rail, each with a finder and a jump
// to the next episode, and each mixing the episode ratings into the list a step further:
//   A (light): the ratings stay out of the rows; the season navigation carries the season score and a strip per
//      season, solid where watched and hollow where not. The ratings grid stays as its own section.
//   B (medium): every row carries its rating as a small tile; the ratings grid folds to a link.
//   C (full): a compact grid of every episode (solid watched, hollow not) is the navigation; a press on a cell
//      opens that episode's row.
// A limited series gets no season navigation in any of them.
import { CheckIcon } from "@heroicons/react/24/solid"
import { type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react"
import { formatScore, imdbVibe, vibeTextColor, vibeTileColor } from "~/ui/details/episode-grid/scale"
import { FOCUS, Hero, RatingsSection, SITE_BAR, ScoreChip, seasonScore, useGrid } from "~/ui/prototype-episode-list-2/shared"
import { type Ep, type Season, epCode, isAired, plural, regularSeasons, specialsOf } from "~/ui/prototype-episode-list/model"
import { SURFACE, seasonTitle } from "~/ui/prototype-episode-list/parts"
import { useStore } from "~/ui/prototype-episode-list/store"
import { DenseList, HeatStrip, type Nav, NumberingNote, SeasonHead, Toolbar, useCount, useHideUnwatched, useIsDesktop, useNav, useRatings } from "./shared"

const PANEL = `min-w-0 overflow-hidden rounded-xl border border-white/[0.06] ${SURFACE}`
const LINK = `cursor-pointer text-sm text-gray-400 underline decoration-white/20 underline-offset-4 hover:text-white ${FOCUS}`
const short = (season: Season) => (season.number === 0 ? "Sp" : `S${season.number}`)
const single = (season: Season) => plural(season.episodes.length, "episode")

/** Everything under the hero. Its height is what round 3 is about, so the checks measure this element. */
function Content({ children }: { children: ReactNode }) {
	return (
		<div data-content className="flex flex-col gap-6">
			{children}
		</div>
	)
}

/** The ratings grid, folded to a link for variants whose list already carries the ratings. */
function RatingsLink() {
	const [open, setOpen] = useState(false)
	return (
		<div data-ratings-link>
			<button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={LINK}>
				{open ? "Hide the ratings grid" : "All ratings as one grid, in IMDb's numbering"}
			</button>
			{open && (
				<div className="mt-3">
					<RatingsSection />
				</div>
			)}
		</div>
	)
}

// ---- A: light ----------------------------------------------------------------------------

function RailRow({ season, on, pick }: { season: Season; on: boolean; pick: () => void }) {
	const grid = useGrid()
	const c = useCount()(season)
	const special = season.number === 0
	return (
		<button type="button" data-rail={season.number} aria-current={on || undefined} title={seasonTitle(season)} onClick={pick} className={`relative flex h-7 w-full shrink-0 cursor-pointer items-center gap-2 rounded-md pl-2.5 pr-1.5 text-left ${FOCUS} ${on ? "bg-white/15 text-white" : "text-gray-300 hover:bg-white/[0.07]"}`}>
			{on && <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-full bg-white" />}
			<span className="w-7 shrink-0 text-xs font-bold tabular-nums">{short(season)}</span>
			{special ? <span className="min-w-0 flex-1 truncate text-[11px] text-gray-500">not counted</span> : <HeatStrip season={season} className="h-3 flex-1" />}
			<span className={`w-9 shrink-0 text-right text-[11px] tabular-nums ${c.done ? "text-green-300" : "text-gray-400"}`}>
				{c.done ? <CheckIcon className="inline h-3.5 w-3.5" aria-label="Watched" /> : special ? c.watched || "" : `${c.watched}/${c.aired}`}
			</span>
			{special ? <span className="w-8 shrink-0" /> : <ScoreChip score={seasonScore(grid, season.number)} />}
		</button>
	)
}

/** A season as a small square for phones: the number over a band in the season score's colour, solid as far as watched. */
function SeasonSquare({ season, on, pick }: { season: Season; on: boolean; pick: () => void }) {
	const grid = useGrid()
	const c = useCount()(season)
	const score = seasonScore(grid, season.number)
	const colour = score == null ? "rgb(255 255 255 / 0.4)" : `var(--color-vibe-${imdbVibe(score)})`
	return (
		<button
			type="button"
			data-square={season.number}
			aria-current={on || undefined}
			aria-label={`${seasonTitle(season)}, ${c.watched} of ${c.aired} watched${score == null ? "" : `, season score ${formatScore(score)}`}`}
			onClick={pick}
			className={`relative flex h-11 min-w-0 cursor-pointer flex-col items-center rounded-md pt-1.5 ${FOCUS} ${on ? "bg-white/20 ring-2 ring-inset ring-white" : "bg-white/[0.07]"}`}
		>
			<span className={`text-xs font-bold tabular-nums ${c.done ? "text-green-300" : on ? "text-white" : "text-gray-300"}`}>{season.number === 0 ? "Sp" : season.number}</span>
			{season.number > 0 && (
				<span aria-hidden="true" className="absolute inset-x-1.5 bottom-1.5 h-1.5 overflow-hidden rounded-full" style={{ boxShadow: `inset 0 0 0 1px ${colour}` }}>
					<span className="block h-full" style={{ width: `${c.aired ? (c.watched / c.aired) * 100 : 0}%`, background: colour }} />
				</span>
			)}
		</button>
	)
}

export function VariantA() {
	const nav = useNav()
	const { seasons, many, season } = nav
	return (
		<div className="flex flex-col gap-8">
			<Hero onOpen={() => nav.jumpNext(true)} />
			<Content>
				<section id="episodes" className="scroll-mt-20">
					<Toolbar nav={nav} />
					<div className={`mt-2 ${many ? "lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:gap-3" : "max-w-3xl"}`}>
						{many && (
							<nav aria-label="Seasons" className={`hidden max-h-[29.75rem] flex-col gap-px overflow-y-auto rounded-xl border border-white/[0.06] p-1.5 lg:flex ${SURFACE}`}>
								{seasons.map((x) => (
									<RailRow key={x.number} season={x} on={x.number === season.number} pick={() => nav.goSeason(x)} />
								))}
							</nav>
						)}
						{many && (
							<nav aria-label="Seasons" className="mb-2 grid gap-1 lg:hidden" style={{ gridTemplateColumns: `repeat(${Math.min(8, seasons.length)}, minmax(0, 1fr))` }}>
								{seasons.map((x) => (
									<SeasonSquare key={x.number} season={x} on={x.number === season.number} pick={() => nav.goSeason(x)} />
								))}
							</nav>
						)}
						<div className={PANEL}>
							<SeasonHead season={season} label={many ? undefined : single(season)} />
							{season.number > 0 && (
								<div className={`px-3 pb-2 ${many ? "lg:hidden" : ""}`}>
									<HeatStrip season={season} className="h-2.5" />
								</div>
							)}
							<NumberingNote season={season} />
							<DenseList key={season.number} season={season} target={nav.target} layout="scroll" scrollClass="max-h-[22rem] lg:max-h-[27rem]" onStep={many ? nav.step : undefined} />
						</div>
					</div>
				</section>
				<RatingsSection />
			</Content>
		</div>
	)
}

// ---- B: medium ---------------------------------------------------------------------------

/** The seasons as one line of chips: number, season score, and a bar filled as far as watched. */
function SeasonChips({ nav }: { nav: Nav }) {
	const grid = useGrid()
	const count = useCount()
	const strip = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const box = strip.current
		const chip = box?.querySelector<HTMLElement>("[aria-current]")
		if (box && chip) box.scrollLeft = chip.offsetLeft - box.clientWidth / 2 + chip.offsetWidth / 2
	}, [nav.picked])
	return (
		<div ref={strip} className="sticky z-20 -mx-4 overflow-x-auto bg-gray-900 px-4 py-1.5 [scrollbar-width:none] lg:static lg:mx-0 lg:overflow-visible lg:px-0" style={{ top: SITE_BAR }}>
			<nav aria-label="Seasons" className="relative flex gap-1.5">
				{nav.seasons.map((season) => {
					const c = count(season)
					const on = season.number === nav.season.number
					const score = seasonScore(grid, season.number)
					return (
						<button
							key={season.number}
							type="button"
							data-chip-season={season.number}
							aria-current={on || undefined}
							aria-label={`${seasonTitle(season)}, ${c.watched} of ${c.aired} watched`}
							onClick={() => nav.goSeason(season)}
							className={`relative flex h-11 w-[3.25rem] shrink-0 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg pb-1 leading-none lg:h-10 lg:w-auto lg:min-w-0 lg:max-w-24 lg:flex-1 ${FOCUS} ${on ? "bg-white/20 ring-2 ring-inset ring-white" : "bg-white/[0.07] hover:bg-white/[0.12]"}`}
						>
							<span className={`flex items-center gap-0.5 text-xs font-bold tabular-nums ${on ? "text-white" : "text-gray-200"}`}>
								{short(season)}
								{c.done && <CheckIcon className="h-3 w-3 text-green-400" aria-hidden="true" />}
							</span>
							<span className="mt-0.5 text-[10px] font-semibold tabular-nums" style={score == null ? undefined : { color: vibeTextColor(imdbVibe(score)) }}>
								{score == null ? (season.number === 0 ? "extra" : " ") : formatScore(score)}
							</span>
							{season.number > 0 && (
								<span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
									<span className="block h-full bg-green-500" style={{ width: `${c.aired ? (c.watched / c.aired) * 100 : 0}%` }} />
								</span>
							)}
						</button>
					)
				})}
			</nav>
		</div>
	)
}

export function VariantB() {
	const nav = useNav()
	const { many, season } = nav
	const desktop = useIsDesktop()
	return (
		<div className="flex flex-col gap-8">
			<Hero onOpen={() => nav.jumpNext(true)} />
			<Content>
				<section id="episodes" className="scroll-mt-20">
					<Toolbar nav={nav} />
					{many && (
						<div className="mt-1">
							<SeasonChips nav={nav} />
						</div>
					)}
					<div className={`${PANEL} ${many ? "mt-1" : "mt-2 max-w-3xl"}`}>
						<SeasonHead season={season} label={many ? undefined : single(season)} />
						<NumberingNote season={season} />
						<DenseList key={`${season.number}-${desktop}`} season={season} target={nav.target} layout="fold" limit={desktop ? 24 : 8} columns chips onStep={many ? nav.step : undefined} />
					</div>
				</section>
				<RatingsLink />
			</Content>
		</div>
	)
}

// ---- C: full -----------------------------------------------------------------------------

/**
 * Every regular episode as a cell, one row per season, in TMDB's order: solid when watched, hollow when not, in the
 * colour of the rating where one can be shown. A press opens that episode's row; the arrow keys walk the cells.
 */
function NavGrid({ nav }: { nav: Nav }) {
	const s = useStore()
	const { show, st, today, d } = s
	const { byEp } = useRatings()
	const hide = useHideUnwatched()
	const grid = useGrid()
	const count = useCount()
	const desktop = useIsDesktop()
	const seasons = regularSeasons(show)
	const specials = specialsOf(show)
	const columns = Math.max(1, ...seasons.map((x) => x.episodes.length))
	const template = { gridTemplateColumns: `1.5rem repeat(${columns}, minmax(0, 2.5rem))${desktop ? " 5.25rem" : ""}` }
	const ROW = "grid items-center gap-0.5"

	const onKey = (e: ReactKeyboardEvent) => {
		const id = Number((e.target as HTMLElement).closest<HTMLElement>("[data-cell]")?.dataset.cell)
		const si = seasons.findIndex((x) => x.episodes.some((ep) => ep.id === id))
		if (si < 0) return
		const ei = seasons[si].episodes.findIndex((ep) => ep.id === id)
		const here = seasons[si].episodes[ei]
		let to: Ep | undefined
		if (e.key === "ArrowLeft") to = seasons[si].episodes[ei - 1]
		else if (e.key === "ArrowRight") to = seasons[si].episodes[ei + 1]
		else if (e.key === "ArrowUp") to = seasons[si - 1]?.episodes[Math.min(ei, seasons[si - 1].episodes.length - 1)]
		else if (e.key === "ArrowDown") to = seasons[si + 1]?.episodes[Math.min(ei, seasons[si + 1].episodes.length - 1)]
		else if (e.key === "w" || e.key === "W") {
			if (isAired(here, today)) st.watches[here.id] ? s.unmarkOne(here) : s.markOne(here)
			return
		} else return
		// The cells, not the prototype's variant switcher.
		e.preventDefault()
		e.stopPropagation()
		if (!to) return
		nav.goEp(to, { quiet: true })
		;(e.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-cell="${to.id}"]`)?.focus()
	}

	return (
		<div data-navgrid className={`${PANEL} p-2 lg:p-2.5`} onKeyDown={onKey}>
			<div className={`${ROW} mb-0.5`} style={template} aria-hidden="true">
				<span />
				{Array.from({ length: columns }, (_, i) => i + 1).map((n) => (
					<span key={n} className="text-center text-[9px] tabular-nums leading-3 text-gray-500">
						{desktop || n === 1 || n % 5 === 0 ? n : ""}
					</span>
				))}
			</div>
			<div className="flex flex-col gap-0.5">
				{seasons.map((season) => {
					const c = count(season)
					const on = season.number === nav.season.number
					return (
						<div key={season.number} className={ROW} style={template}>
							<button type="button" data-grid-season={season.number} aria-current={on || undefined} aria-label={`${seasonTitle(season)}, ${c.watched} of ${c.aired} watched`} onClick={() => nav.goSeason(season)} className={`h-4 cursor-pointer rounded-[3px] text-center text-[11px] leading-4 font-bold tabular-nums lg:h-[22px] ${FOCUS} ${on ? "bg-white/20 text-white" : c.done ? "text-green-300 hover:bg-white/10" : "text-gray-400 hover:bg-white/10"}`}>
								{season.number}
							</button>
							{season.episodes.map((ep) => {
								const watched = !!st.watches[ep.id]
								const aired = isAired(ep, today)
								const rated = byEp.get(ep.id)
								const shown = rated && (watched || !hide) ? rated : null
								const step = shown ? imdbVibe(shown.score) : 0
								const picked = nav.selected === ep.id
								const style = !aired
									? undefined
									: watched
										? { background: shown ? vibeTileColor(step) : "rgb(255 255 255 / 0.35)" }
										: { boxShadow: `inset 0 0 0 1.5px ${shown ? `var(--color-vibe-${step})` : "rgb(255 255 255 / 0.25)"}`, color: shown ? vibeTextColor(step) : undefined }
								const label = `${epCode(show, ep)} · ${ep.name}${shown ? ` · ${formatScore(shown.score)}` : ""}${watched ? " · watched" : aired ? "" : " · not aired"}`
								return (
									<button
										key={ep.id}
										type="button"
										data-cell={ep.id}
										data-solid={watched || undefined}
										data-rated={shown ? formatScore(shown.score) : undefined}
										tabIndex={picked ? 0 : -1}
										aria-pressed={picked}
										aria-label={label}
										title={label}
										onClick={() => nav.goEp(ep)}
										className={`relative flex h-4 min-w-0 cursor-pointer items-center justify-center rounded-[3px] text-[10px] font-semibold tabular-nums text-white hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white lg:h-[22px] ${aired ? "" : "border border-dashed border-white/15"} ${
											picked ? "z-[1] outline outline-2 outline-offset-1 outline-white" : d.next === ep ? "outline outline-1 outline-offset-1 outline-dashed outline-white/80" : ""
										}`}
										style={style}
									>
										{desktop && shown ? formatScore(shown.score) : ""}
									</button>
								)
							})}
							{desktop && (
								<span className="flex items-center justify-end gap-1.5" style={{ gridColumn: columns + 2 }}>
									<span className={`text-[11px] tabular-nums ${c.done ? "text-green-300" : "text-gray-400"}`}>{c.done ? <CheckIcon className="inline h-3.5 w-3.5" aria-label="Watched" /> : `${c.watched}/${c.aired}`}</span>
									<ScoreChip score={seasonScore(grid, season.number)} />
								</span>
							)}
						</div>
					)
				})}
			</div>
			<div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
				<p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-500">
					<span className="inline-flex items-center gap-1">
						<span className="h-2.5 w-3.5 rounded-[2px] bg-white/40" /> watched
					</span>
					<span className="inline-flex items-center gap-1">
						<span className="h-2.5 w-3.5 rounded-[2px] shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.4)]" /> not yet
					</span>
					<span className="inline-flex items-center gap-1">
						<span className="h-2.5 w-3.5 rounded-[2px] outline outline-1 outline-dashed outline-white/80" /> next
					</span>
					<span>colour: IMDb rating</span>
				</p>
				{specials && (
					<button type="button" data-grid-season={0} aria-current={nav.season.number === 0 || undefined} onClick={() => nav.goSeason(specials)} className={`inline-flex h-9 cursor-pointer items-center rounded-md px-2 text-xs font-semibold lg:h-7 ${FOCUS} ${nav.season.number === 0 ? "bg-white/20 text-white" : "bg-white/[0.07] text-gray-300 hover:bg-white/[0.12]"}`}>
						{plural(specials.episodes.length, "special")}
						{d.specialsWatched ? ` · ${d.specialsWatched} watched` : ""}
					</button>
				)}
			</div>
		</div>
	)
}

export function VariantC() {
	const nav = useNav()
	const { many, season } = nav
	const desktop = useIsDesktop()
	return (
		<div className="flex flex-col gap-8">
			<Hero onOpen={() => nav.jumpNext(true)} />
			<Content>
				<section id="episodes" className="scroll-mt-20">
					<Toolbar nav={nav} />
					<div className={`mt-2 ${many ? "flex flex-col gap-2 lg:grid lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-3" : "max-w-3xl"}`}>
						{many && <NavGrid nav={nav} />}
						<div className={PANEL}>
							<SeasonHead season={season} label={many ? undefined : single(season)} />
							<NumberingNote season={season} />
							{many ? (
								<DenseList key={`${season.number}-${desktop}`} season={season} target={nav.target} layout={desktop ? "scroll" : "fold"} limit={5} scrollClass="max-h-[25rem]" chips dates={false} selectedId={nav.selected} onStep={nav.step} />
							) : (
								<DenseList key={season.number} season={season} target={nav.target} layout="fold" limit={12} chips />
							)}
						</div>
					</div>
				</section>
				<RatingsLink />
			</Content>
		</div>
	)
}
