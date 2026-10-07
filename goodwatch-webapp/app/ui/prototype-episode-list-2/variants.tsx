// PROTOTYPE - throwaway (#369, round 2). Five ways the episode list and the read-only episode ratings share the
// content area without a tab bar stacked on a season sub-navigation. The hero is the same in all of them.
//   A: one scroll under a season scrubber, after the ratings.
//   B: a season rail (a picker on phones) with one season beside it.
//   C: season cards that open in place.
//   D: one grid: the rating tiles are the marks, with a detail row for the selected episode.
//   E: the ratings keep the page; the list opens in a sheet from the hero box.
import { CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, ExclamationTriangleIcon, ListBulletIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { useEffect, useRef, useState } from "react"
import { formatScore, imdbVibe, vibeTileColor } from "~/ui/details/episode-grid/scale"
import { type Ep, type Season, epCode, isAired, plural, regularSeasons, seasonOf, seasonProgress, specialsOf } from "~/ui/prototype-episode-list/model"
import { EpisodeRow, EpisodeRows, SURFACE, SeasonMeta, ShowProgress, StatePill, seasonTitle } from "~/ui/prototype-episode-list/parts"
import { useStore } from "~/ui/prototype-episode-list/store"
import { FOCUS, Hero, RatingsSection, Ring, SITE_BAR, ScoreChip, SeasonScroll, type SeasonScrollHandle, seasonScore, useCurrentSeason, useDiffers, useGrid, useSeasonDone, useSeasons } from "./shared"

const H2 = "text-2xl font-bold"
const LINK = `cursor-pointer text-sm text-gray-400 underline decoration-white/20 underline-offset-4 hover:text-white ${FOCUS}`
const scrollTo = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }))

/** "4 of 22" for a season, "2 watched · not counted" for the specials. */
function useCount() {
	const { st, today } = useStore()
	return (season: Season) => {
		const p = seasonProgress(season, st, today)
		return { ...p, text: season.number === 0 ? (p.watched ? `${p.watched} watched` : `${p.total}`) : `${p.watched}/${p.aired}` }
	}
}

// ---- A: one scroll -----------------------------------------------------------------------

export function VariantA() {
	const list = useRef<SeasonScrollHandle>(null)
	return (
		<div className="flex flex-col gap-10">
			<Hero onOpen={() => list.current?.toNext(true)} />
			<RatingsSection
				action={
					<button type="button" onClick={() => scrollTo("episodes")} className={LINK}>
						Mark episodes ↓
					</button>
				}
			/>
			<section id="episodes" className="scroll-mt-20">
				<h2 className={H2}>Episodes</h2>
				<div className="mt-2">
					<SeasonScroll ref={list} top={SITE_BAR} thumb />
				</div>
			</section>
		</div>
	)
}

// ---- B: season rail ----------------------------------------------------------------------

function RailRow({ season, on, pick }: { season: Season; on: boolean; pick: () => void }) {
	const grid = useGrid()
	const count = useCount()(season)
	const done = useSeasonDone()(season)
	const special = season.number === 0
	return (
		<button type="button" aria-current={on || undefined} onClick={pick} className={`relative flex h-11 w-full shrink-0 cursor-pointer items-center gap-2 overflow-hidden rounded-lg px-3 text-left lg:h-10 ${FOCUS} ${on ? "bg-white/15 text-white" : "text-gray-300 hover:bg-white/[0.07]"}`}>
			{on && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-white" />}
			<span className="min-w-0 flex-1 truncate text-sm font-semibold">{seasonTitle(season)}</span>
			<span className={`text-xs tabular-nums ${done ? "font-semibold text-green-300" : "text-gray-400"}`}>
				{done ? <CheckIcon className="inline h-3.5 w-3.5" aria-label="Watched" /> : special ? (count.watched ? `${count.watched} watched` : "extra") : count.text}
			</span>
			{special ? <span className="min-w-8" /> : <ScoreChip score={seasonScore(grid, season.number)} />}
			{!special && !done && count.watched > 0 && <span aria-hidden="true" className="absolute bottom-0 left-3 h-0.5 rounded-full bg-green-500" style={{ width: `calc((100% - 1.5rem) * ${count.watched / count.aired})` }} />}
		</button>
	)
}

export function VariantB() {
	const seasons = useSeasons()
	const current = useCurrentSeason()
	const grid = useGrid()
	const count = useCount()
	const [picked, setPicked] = useState(current)
	const [picker, setPicker] = useState(false)
	const index = Math.max(0, seasons.findIndex((x) => x.number === picked))
	const season = seasons[index]
	const many = seasons.length > 1
	const go = (to: Season | undefined, top = false) => {
		if (!to) return
		setPicked(to.number)
		setPicker(false)
		if (top) scrollTo("episodes")
	}
	const arrow = (to: Season | undefined, Icon: typeof ChevronLeftIcon, label: string) => (
		<button type="button" disabled={!to} onClick={() => go(to)} aria-label={label} className={`flex h-11 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20 disabled:cursor-default disabled:opacity-30 lg:h-9 lg:w-9 ${FOCUS}`}>
			<Icon className="h-4 w-4" />
		</button>
	)
	return (
		<div className="flex flex-col gap-10">
			<Hero
				onOpen={() => {
					setPicked(current)
					scrollTo("episodes")
				}}
			/>
			<section id="episodes" className="scroll-mt-20">
				<h2 className={H2}>Episodes</h2>
				<div className={`mt-4 ${many ? "lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-4" : "max-w-3xl"}`}>
					{many && (
						<nav aria-label="Seasons" className={`sticky hidden max-h-[calc(100vh-6rem)] flex-col gap-0.5 overflow-y-auto rounded-2xl border border-white/[0.06] p-1.5 lg:flex ${SURFACE}`} style={{ top: SITE_BAR + 16 }}>
							{seasons.map((x) => (
								<RailRow key={x.number} season={x} on={x.number === season.number} pick={() => go(x)} />
							))}
						</nav>
					)}
					<div className="min-w-0">
						{many && (
							<div className="sticky z-20 -mx-1 flex items-center gap-1.5 bg-gray-900 px-1 py-2 lg:hidden" style={{ top: SITE_BAR }}>
								{arrow(seasons[index - 1], ChevronLeftIcon, "Previous season")}
								<button type="button" aria-haspopup="dialog" aria-expanded={picker} onClick={() => setPicker(true)} className={`flex h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg bg-white/10 px-3 text-left hover:bg-white/20 ${FOCUS}`}>
									<span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{seasonTitle(season)}</span>
									<span className="text-xs tabular-nums text-gray-400">{season.number === 0 ? "not counted" : count(season).text}</span>
									<ScoreChip score={seasonScore(grid, season.number)} />
									<ChevronDownIcon className="h-4 w-4 shrink-0 text-gray-400" />
								</button>
								{arrow(seasons[index + 1], ChevronRightIcon, "Next season")}
							</div>
						)}
						<div className={`rounded-2xl border border-white/[0.06] ${SURFACE}`}>
							<div className="flex items-center justify-between gap-3 px-3 py-3">
								<h3 className="flex min-w-0 items-center gap-2 font-semibold text-white">
									<span className="truncate">{seasonTitle(season)}</span>
									<ScoreChip score={seasonScore(grid, season.number)} className="max-lg:hidden" />
								</h3>
								<SeasonMeta season={season} />
							</div>
							<EpisodeRows key={season.number} season={season} thumb />
						</div>
						{many && (
							<div className="mt-3 flex items-center justify-between gap-3">
								{seasons[index - 1] ? (
									<button type="button" onClick={() => go(seasons[index - 1], true)} className={LINK}>
										← {seasonTitle(seasons[index - 1])}
									</button>
								) : (
									<span />
								)}
								{seasons[index + 1] && (
									<button type="button" onClick={() => go(seasons[index + 1], true)} className={`inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/20 ${FOCUS}`}>
										{seasonTitle(seasons[index + 1])} <ChevronRightIcon className="h-4 w-4" />
									</button>
								)}
							</div>
						)}
					</div>
				</div>
			</section>
			<RatingsSection />
			{picker && (
				<div className="fixed inset-0 z-[70] lg:hidden">
					<button type="button" aria-label="Close" onClick={() => setPicker(false)} className="absolute inset-0 cursor-default bg-black/70" />
					{/* biome-ignore lint/a11y/useSemanticElements: prototype sheet */}
					<div role="dialog" aria-modal="true" aria-label="Seasons" className="absolute inset-x-0 bottom-0 flex max-h-[75vh] flex-col rounded-t-2xl border border-white/10 bg-gray-900 p-2 pb-6">
						<div className="flex items-center justify-between px-2 py-1.5">
							<p className="text-sm font-bold text-white">Seasons</p>
							<button type="button" onClick={() => setPicker(false)} aria-label="Close" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-white hover:bg-white/10">
								<XMarkIcon className="h-5 w-5" />
							</button>
						</div>
						<div className="flex min-h-0 flex-col gap-0.5 overflow-y-auto overscroll-contain">
							{seasons.map((x) => (
								<RailRow key={x.number} season={x} on={x.number === season.number} pick={() => go(x)} />
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

// ---- C: season cards ---------------------------------------------------------------------

/** One sliver per episode in its rating's colour: the season's shape without a title or a still. */
function HeatStrip({ season }: { season: Season }) {
	const grid = useGrid()
	const rated = new Map(grid.seasons.find((s) => s.number === season.number)?.episodes.map((e) => [e.number, e.score]))
	return (
		<span aria-hidden="true" className="flex h-1.5 w-full gap-px overflow-hidden rounded-full">
			{season.episodes.map((e) => {
				const score = rated.get(e.n)
				return <span key={e.id} className="min-w-0 flex-1 bg-white/10" style={score == null ? undefined : { background: vibeTileColor(imdbVibe(score)) }} />
			})}
		</span>
	)
}

function SeasonCard({ season, on, pick }: { season: Season; on: boolean; pick: () => void }) {
	const { d, show } = useStore()
	const grid = useGrid()
	const count = useCount()(season)
	const done = useSeasonDone()(season)
	const special = season.number === 0
	const year = season.episodes.find((e) => e.air_date)?.air_date?.slice(0, 4)
	const here = d.next && seasonOf(show, d.next) === season.number
	return (
		<button
			type="button"
			aria-expanded={on}
			onClick={pick}
			className={`relative flex min-w-0 cursor-pointer flex-col items-center gap-1.5 rounded-2xl border px-2 pb-2.5 pt-3 text-center transition-colors ${FOCUS} ${on ? "border-white/60 bg-white/[0.12]" : `border-white/[0.06] hover:border-white/25 ${SURFACE}`}`}
		>
			{special ? (
				<span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-white/25 text-xs font-bold text-gray-300">{count.watched || "+"}</span>
			) : (
				<Ring value={count.watched} max={count.aired}>
					{done ? <CheckIcon className="h-5 w-5 text-green-400" aria-label="Watched" /> : <span className="text-sm font-bold tabular-nums text-white">{season.number}</span>}
				</Ring>
			)}
			<span className="w-full truncate text-sm font-semibold text-white">{seasonTitle(season)}</span>
			<span className="w-full truncate text-[11px] tabular-nums text-gray-400">{special ? (count.watched ? `${count.watched} of ${count.total} watched` : plural(count.total, "extra")) : `${count.watched} of ${count.aired}${year ? ` · ${year}` : ""}`}</span>
			{special ? <span className="-my-1 text-[10px] leading-3 text-gray-500">not counted</span> : <HeatStrip season={season} />}
			<ScoreChip score={seasonScore(grid, season.number)} className="absolute right-1.5 top-1.5" />
			{here && <span className="absolute left-1.5 top-1.5 rounded bg-green-500 px-1 text-[9px] font-bold uppercase leading-4 text-black">Next</span>}
		</button>
	)
}

export function VariantC() {
	const seasons = useSeasons()
	const current = useCurrentSeason()
	const grid = useGrid()
	const many = seasons.length > 1
	const [picked, setPicked] = useState<number | null>(current)
	const panel = useRef<HTMLDivElement>(null)
	const pick = (n: number | null) => {
		setPicked(n)
		if (n != null) requestAnimationFrame(() => panel.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }))
	}
	const body = (season: Season) => (
		<div ref={panel} className={`col-span-full scroll-mb-24 scroll-mt-24 rounded-2xl border ${many ? "border-white/25" : "border-white/[0.06]"} ${SURFACE}`}>
			<div className="flex items-center justify-between gap-2 px-3 py-3">
				<h3 className="flex min-w-0 items-center gap-2 font-semibold text-white">
					<span className="truncate">{seasonTitle(season)}</span>
					<ScoreChip score={seasonScore(grid, season.number)} />
				</h3>
				<span className="flex items-center gap-1">
					<SeasonMeta season={season} />
					{many && (
						<button type="button" onClick={() => setPicked(null)} aria-label={`Close ${seasonTitle(season)}`} className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white ${FOCUS}`}>
							<XMarkIcon className="h-5 w-5" />
						</button>
					)}
				</span>
			</div>
			<EpisodeRows season={season} thumb />
		</div>
	)
	return (
		<div className="flex flex-col gap-10">
			<Hero
				onOpen={() => {
					pick(current)
					scrollTo("episodes")
				}}
			/>
			<section id="episodes" className="scroll-mt-20">
				<h2 className={H2}>{many ? "Seasons" : "Episodes"}</h2>
				{many ? (
					// Dense flow: the open season's list takes the row under its card, and the cards after it close the gap.
					<div className="mt-4 grid grid-flow-row-dense grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
						{seasons.map((season) => [<SeasonCard key={season.number} season={season} on={picked === season.number} pick={() => pick(picked === season.number ? null : season.number)} />, picked === season.number && <div key="open" className="contents">{body(season)}</div>])}
					</div>
				) : (
					<div className="mt-4 max-w-3xl">{body(seasons[0])}</div>
				)}
			</section>
			<RatingsSection />
		</div>
	)
}

// ---- D: one grid -------------------------------------------------------------------------

const norm = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "")
const CELL_REM = 2.5
const LABEL_REM = 5.25

type Selected = { ep: Ep } | { season: Season } | null

export function VariantD() {
	const s = useStore()
	const { show, st, d, today } = s
	const grid = useGrid()
	const differs = useDiffers()
	const seasons = regularSeasons(show)
	const specials = specialsOf(show)
	const count = useCount()
	const [sel, setSel] = useState<Selected>(() => (d.next ? { ep: d.next } : seasons[0]?.episodes[0] ? { ep: seasons[0].episodes[0] } : null))
	const [specialsOpen, setSpecialsOpen] = useState(false)
	const box = useRef<HTMLDivElement>(null)
	const [width, setWidth] = useState(0)
	useEffect(() => {
		if (!box.current) return
		const watch = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
		watch.observe(box.current)
		return () => watch.disconnect()
	}, [])
	const columns = Math.max(0, ...seasons.map((x) => x.episodes.length))
	const rem = typeof window === "undefined" ? 16 : Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
	const wide = width >= (LABEL_REM + columns * (CELL_REM + 3 / 16) + 0.5) * rem

	/** What IMDb has at this season and number. With another numbering it is another episode's rating. */
	const imdbAt = (season: Season, ep: Ep) => grid.seasons.find((x) => x.number === season.number)?.episodes.find((e) => e.number === ep.n) ?? null
	const off = (season: Season, ep: Ep) => {
		const r = imdbAt(season, ep)
		return !!r && norm(r.name) !== norm(ep.name)
	}
	const seasonOff = (season: Season) => season.episodes.some((e) => off(season, e))
	const selected = (ep: Ep) => !!sel && "ep" in sel && sel.ep.id === ep.id

	const cell = (season: Season, ep: Ep, size: string) => {
		const special = season.number === 0
		const aired = isAired(ep, today)
		const watch = st.watches[ep.id]
		const r = special ? null : imdbAt(season, ep)
		const on = selected(ep)
		const isNext = d.next === ep
		return (
			<button
				key={ep.id}
				type="button"
				data-cell={ep.id}
				aria-pressed={!!watch}
				aria-label={`${epCode(show, ep)}${r ? `, rated ${formatScore(r.score)}` : ""}${watch ? ", watched" : aired ? "" : ", not aired"}`}
				onClick={() => {
					// A press selects. A press on the selected tile marks it, or removes the mark.
					if (!on || !aired) return setSel({ ep })
					watch ? s.unmarkOne(ep) : s.markOne(ep)
				}}
				className={`relative block shrink-0 cursor-pointer rounded-[4px] font-semibold tabular-nums outline-offset-1 transition-[filter] hover:brightness-125 focus-visible:outline-2 focus-visible:outline-white ${size} ${
					!aired ? "border border-dashed border-white/20 text-gray-500" : r ? "text-white" : "bg-white/10 text-gray-400"
				} ${on ? "z-[1] outline-2 outline-white" : isNext ? "outline-2 outline-dashed outline-white/80" : ""}`}
				style={aired && r ? { background: vibeTileColor(imdbVibe(r.score)) } : undefined}
			>
				{!aired ? <ClockIcon className="mx-auto h-3.5 w-3.5" /> : r ? formatScore(r.score) : special ? ep.n : "–"}
				{watch && (
					<span aria-hidden="true" className={`absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-1 ring-black/40 ${special ? "border border-white bg-gray-900 text-white" : "bg-white text-black"}`}>
						<CheckIcon className="h-2.5 w-2.5" />
					</span>
				)}
				{!special && off(season, ep) && <span aria-hidden="true" className="absolute bottom-0 left-0 h-1.5 w-1.5 rounded-bl-[4px] rounded-tr-[4px] bg-amber-300" />}
			</button>
		)
	}

	const label = (season: Season, stacked: boolean) => {
		const c = count(season)
		const done = c.aired > 0 && c.watched === c.aired
		const on = !!sel && "season" in sel && sel.season.number === season.number
		return (
			<button type="button" onClick={() => setSel({ season })} aria-label={`${seasonTitle(season)}, ${c.watched} of ${c.aired} watched`} className={`flex cursor-pointer rounded px-1 py-0.5 hover:bg-white/10 ${FOCUS} ${stacked ? "flex-col items-center gap-0.5" : "w-full items-baseline gap-1.5"} ${on ? "bg-white/15" : ""}`}>
				<span className="text-sm font-semibold text-white">
					S{season.number}
					{seasonOff(season) && <span className="text-amber-300">*</span>}
				</span>
				<span className={`text-[11px] tabular-nums ${done ? "font-bold text-green-300" : "text-gray-400"}`}>{done ? "✓" : `${c.watched}/${c.aired}`}</span>
			</button>
		)
	}

	const WIDE = "h-8 w-10 text-[12.5px]"
	const NARROW = "h-8 w-full min-w-[2.125rem] text-xs"
	const numbers = Array.from({ length: columns }, (_, i) => i + 1)
	const table = wide ? (
		<table className="border-separate border-spacing-[3px]">
			<caption className="sr-only">Every episode, one row per season: its rating, and whether you watched it</caption>
			<thead>
				<tr className="text-[11px] text-gray-500">
					<th className="min-w-[5.25rem]" />
					{numbers.map((n) => (
						<th key={n} scope="col" className="font-normal tabular-nums">
							{n}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{seasons.map((season) => (
					<tr key={season.number}>
						<th scope="row" className="pr-1 text-left font-normal">
							{label(season, false)}
						</th>
						{season.episodes.map((ep) => (
							<td key={ep.id} className="p-0">
								{cell(season, ep, WIDE)}
							</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	) : (
		<table className="w-full border-separate border-spacing-[3px]">
			<caption className="sr-only">Every episode, one column per season: its rating, and whether you watched it</caption>
			<thead>
				<tr>
					<th className={`sticky left-0 z-10 w-6 ${SURFACE}`} />
					{seasons.map((season) => (
						<th key={season.number} scope="col" className="pb-1 font-normal">
							<span className="flex justify-center">{label(season, true)}</span>
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{numbers.map((n) => (
					<tr key={n}>
						<th scope="row" className={`sticky left-0 z-10 pr-1 text-right text-[11px] font-normal tabular-nums text-gray-500 ${SURFACE}`}>
							{n}
						</th>
						{seasons.map((season) => (
							<td key={season.number} className="p-0">
								{season.episodes[n - 1] && cell(season, season.episodes[n - 1], NARROW)}
							</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	)

	// The detail row: the list's own row for the selected episode, or the season's mark.
	const flat = seasons.flatMap((x) => x.episodes)
	const step = (by: number) => {
		if (!sel || !("ep" in sel)) return
		const list = flat.includes(sel.ep) ? flat : (specials?.episodes ?? [])
		const to = list[list.indexOf(sel.ep) + by]
		if (to) setSel({ ep: to })
	}
	const selSeason = sel && "ep" in sel ? show.seasons.find((x) => x.episodes.includes(sel.ep)) : null
	const selRating = sel && "ep" in sel && selSeason && selSeason.number > 0 ? imdbAt(selSeason, sel.ep) : null
	const nav = (by: number, Icon: typeof ChevronLeftIcon, text: string) => (
		<button type="button" onClick={() => step(by)} aria-label={text} className={`flex h-9 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-300 hover:bg-white/10 hover:text-white ${FOCUS}`}>
			<Icon className="h-4 w-4" />
		</button>
	)
	const detail = (
		<div className="sticky z-20 -mx-1 bg-gray-900 px-1 py-2" style={{ top: SITE_BAR }} data-detail>
			<div className="rounded-2xl border border-white/25 bg-[#1b2130] shadow-[0_8px_16px_-8px_rgb(0_0_0/0.8)]">
				{sel && "ep" in sel && selSeason ? (
					<>
						<div className="flex items-center gap-1 pl-3 pr-1 pt-1.5">
							<p className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
								<span className="truncate">{selSeason.number === 0 ? "Special · not counted" : `${seasonTitle(selSeason)} · episode ${sel.ep.n}`}</span>
								<ScoreChip score={selRating?.score ?? null} title="IMDb rating" />
							</p>
							{nav(-1, ChevronLeftIcon, "Previous episode")}
							{nav(1, ChevronRightIcon, "Next episode")}
						</div>
						<ul className="[&>li]:border-t-0">
							<EpisodeRow key={sel.ep.id} ep={sel.ep} special={selSeason.number === 0} />
						</ul>
						{selSeason.number > 0 && off(selSeason, sel.ep) && selRating && (
							<p className="mx-3 mb-2.5 flex items-start gap-2 rounded-lg bg-amber-300/10 px-2.5 py-2 text-xs text-amber-100">
								<ExclamationTriangleIcon className="mt-px h-4 w-4 shrink-0 text-amber-300" />
								<span>
									IMDb's episode {sel.ep.n} of this season is “{selRating.name}”, not “{sel.ep.name}”. The {formatScore(selRating.score)} on this tile belongs to that episode.
								</span>
							</p>
						)}
						{selSeason.number > 0 && !selRating && isAired(sel.ep, today) && differs && <p className="mx-3 mb-2.5 rounded-lg bg-amber-300/10 px-2.5 py-2 text-xs text-amber-100">IMDb has no episode {sel.ep.n} in this season, so this tile has no rating.</p>}
					</>
				) : sel && "season" in sel ? (
					<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-3">
						<p className="flex min-w-0 items-center gap-2 font-semibold text-white">
							<span className="truncate">{seasonTitle(sel.season)}</span>
							<ScoreChip score={seasonScore(grid, sel.season.number)} />
						</p>
						<SeasonMeta season={sel.season} />
						{seasonOff(sel.season) && <p className="basis-full text-xs text-amber-100">* IMDb numbers this season differently. Tiles with a yellow corner show another episode's rating.</p>}
					</div>
				) : (
					<p className="px-3 py-3 text-sm text-gray-400">Pick a tile.</p>
				)}
			</div>
		</div>
	)

	const sp = specials ? count(specials) : null
	return (
		<div className="flex flex-col gap-10">
			<Hero
				onOpen={() => {
					if (d.next) setSel({ ep: d.next })
					scrollTo("episodes")
				}}
			/>
			<section id="episodes" className="scroll-mt-20">
				<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
					<h2 className={H2}>Episodes</h2>
					<p className="text-xs text-gray-400">Press a tile to pick it. Press it again to mark it watched.</p>
				</div>
				{detail}
				<div ref={box} className={`rounded-2xl border border-white/[0.06] p-2 sm:p-3 ${SURFACE}`}>
					<div className="overflow-x-auto overscroll-x-contain pr-1 pt-1">{width > 0 && table}</div>
					{specials && sp && (
						<div className="mt-2 border-t border-white/[0.06] pt-2">
							<button type="button" aria-expanded={specialsOpen} onClick={() => setSpecialsOpen(!specialsOpen)} className={`flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm font-semibold text-gray-300 hover:text-white ${FOCUS}`}>
								<ChevronDownIcon className={`h-4 w-4 transition-transform ${specialsOpen ? "" : "-rotate-90"}`} />
								{plural(sp.total, "special")}
								<span className="text-xs font-normal text-gray-400">{sp.watched ? `${sp.watched} watched · ` : ""}not counted</span>
							</button>
							{specialsOpen && <div className="mt-1.5 flex flex-wrap gap-[3px] pr-1 pt-1">{specials.episodes.map((ep) => cell(specials, ep, WIDE))}</div>}
						</div>
					)}
				</div>
				<p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
					<span className="inline-flex items-center gap-1.5">
						<span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-black">
							<CheckIcon className="h-2.5 w-2.5" />
						</span>
						watched
					</span>
					<span className="inline-flex items-center gap-1.5">
						<span className="h-3.5 w-5 rounded-[3px] outline-2 -outline-offset-2 outline-dashed outline-white/80" />
						next episode
					</span>
					<span className="inline-flex items-center gap-1.5">
						<span className="h-3.5 w-5 rounded-[3px] border border-dashed border-white/20" />
						not aired
					</span>
					<span>Tile: rating (TMDB votes stand in for IMDb). Rows and numbers: TMDB's.</span>
				</p>
			</section>
		</div>
	)
}

// ---- E: the list in a sheet --------------------------------------------------------------

function EpisodeSheet() {
	const s = useStore()
	const body = useRef<HTMLDivElement>(null)
	const list = useRef<SeasonScrollHandle>(null)
	useEffect(() => {
		list.current?.toNext()
		const before = document.body.style.overflow
		document.body.style.overflow = "hidden"
		return () => {
			document.body.style.overflow = before
		}
	}, [])
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && !s.dialog && s.setSheet(false)
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
	return (
		<div className="fixed inset-0 z-[70]">
			<button type="button" aria-label="Close the episode list" onClick={() => s.setSheet(false)} className="absolute inset-0 cursor-default bg-black/70" />
			{/* biome-ignore lint/a11y/useSemanticElements: prototype sheet */}
			<div role="dialog" aria-modal="true" aria-label={`Episodes of ${s.show.name}`} className="absolute inset-x-0 bottom-0 top-[5.5rem] flex flex-col rounded-t-2xl border border-white/10 bg-gray-900 text-white md:left-auto md:right-0 md:top-16 md:w-[36rem] md:rounded-none md:border-y-0 md:border-r-0">
				<div className="px-4 pb-2 pt-3">
					<span aria-hidden="true" className="mx-auto mb-2 block h-1 w-10 rounded-full bg-white/20 md:hidden" />
					<div className="flex items-center justify-between gap-3">
						<h2 className="min-w-0 truncate text-lg font-bold">{s.show.name}</h2>
						<span className="flex items-center gap-2">
							<StatePill />
							<button type="button" onClick={() => s.setSheet(false)} aria-label="Close" className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg hover:bg-white/10 ${FOCUS}`}>
								<XMarkIcon className="h-5 w-5" />
							</button>
						</span>
					</div>
					<ShowProgress className="mt-1.5" />
				</div>
				<div ref={body} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-28">
					<SeasonScroll ref={list} scroller={body} top={0} />
				</div>
			</div>
		</div>
	)
}

export function VariantE() {
	const s = useStore()
	const open = () => s.setSheet(true)
	const started = s.d.started || s.st.seenMarked
	return (
		<div className="flex flex-col gap-10">
			<Hero
				onOpen={open}
				boxFooter={
					<button type="button" onClick={open} className={`mt-3 flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-lg bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/20 ${FOCUS}`}>
						<span className="flex items-center gap-2">
							<ListBulletIcon className="h-4 w-4 text-green-300" />
							{started ? "All episodes" : "Mark the episodes you've watched"}
						</span>
						<ChevronRightIcon className="h-4 w-4 text-gray-400" />
					</button>
				}
			/>
			<RatingsSection
				action={
					<button type="button" onClick={open} className={LINK}>
						Mark episodes
					</button>
				}
			/>
			{s.sheet && <EpisodeSheet />}
		</div>
	)
}
