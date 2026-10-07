// PROTOTYPE - throwaway (#369, round 2). What every round 2 variant shares: the fixed hero (round 1's variant B,
// with one score control that carries the rate prompt), the season helpers, the season scrubber and the one-scroll
// list. The model, the store and the rows come from round 1 (app/ui/prototype-episode-list).
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/24/solid"
import { useSearchParams } from "@remix-run/react"
import { type ReactNode, type RefObject, forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import type { EpisodeGrid as EpisodeGridData } from "~/server/episode-grid.server"
import type { Score } from "~/server/scores.server"
import EpisodeGrid from "~/ui/details/episode-grid/EpisodeGrid"
import { formatScore, imdbVibe, vibeTileColor } from "~/ui/details/episode-grid/scale"
import { type Season, type Show, epCode, regularSeasons, seasonOf, seasonProgress, standInGrid } from "~/ui/prototype-episode-list/model"
import {
	EpisodeRows,
	HideButton,
	NextEpisode,
	SURFACE,
	SeasonMeta,
	SeenButton,
	ShowProgress,
	StatePill,
	StatusButton,
	StatusMenu,
	WantButton,
	seasonTitle,
	useHasStatus,
} from "~/ui/prototype-episode-list/parts"
import { SCORE_ANCHOR, useStore } from "~/ui/prototype-episode-list/store"
import { ScoreControl } from "~/ui/title-actions/ScoreControl"
import { getScoreLabelText, getVibeColorValue, scoreLabels } from "~/utils/ratings"

const TMDB = "https://image.tmdb.org/t/p"
export const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
/** The fixed site bar's height: sticky pieces stop under it. */
export const SITE_BAR = 64

// ---- seasons and ratings -----------------------------------------------------------------

/** Regular seasons first, specials last. */
export const useSeasons = () => {
	const { show } = useStore()
	return useMemo(() => [...show.seasons.filter((s) => s.number > 0), ...show.seasons.filter((s) => s.number === 0)], [show])
}
/** The season the person is in: the next episode's, or the first. */
export const useCurrentSeason = () => {
	const { show, d } = useStore()
	return d.next ? seasonOf(show, d.next) : (regularSeasons(show)[0]?.number ?? 0)
}
export const useSeasonDone = () => {
	const { st, today } = useStore()
	return (season: Season) => {
		const p = seasonProgress(season, st, today)
		return season.number > 0 && p.aired > 0 && p.watched === p.aired
	}
}

/**
 * The ratings as IMDb numbers them. With `differs`, the stand-in pretends IMDb lists the first season's two-part
 * opener as one episode, which is the most common way the two numberings part: every later episode of that season
 * sits one number lower on IMDb than on TMDB, and the season is one episode shorter.
 */
export function imdbGrid(show: Show, differs: boolean): EpisodeGridData {
	const grid = standInGrid(show)
	const first = grid.seasons[0]
	if (!differs || !first) return grid
	const episodes = first.episodes.filter((e) => e.number !== 2).map((e) => (e.number > 2 ? { ...e, number: e.number - 1 } : e))
	const seasons = [{ ...first, episodes, maxEpisodeNumber: first.maxEpisodeNumber - 1 }, ...grid.seasons.slice(1)]
	return { ...grid, seasons, maxEpisodeNumber: Math.max(0, ...seasons.map((s) => s.maxEpisodeNumber)) }
}
export const useDiffers = () => useSearchParams()[0].get("imdb") === "differs"
export const useGrid = () => {
	const { show } = useStore()
	const differs = useDiffers()
	return useMemo(() => imdbGrid(show, differs), [show, differs])
}
export const seasonScore = (grid: EpisodeGridData, season: number) => grid.seasons.find((s) => s.number === season)?.scores.imdb?.score ?? null

/** A score as a small tile in the episode grid's colours. */
export function ScoreChip({ score, title, className = "" }: { score: number | null; title?: string; className?: string }) {
	if (score == null) return null
	return (
		<span title={title ?? `Season score ${formatScore(score)}`} className={`inline-flex h-5 min-w-8 shrink-0 items-center justify-center rounded-[4px] px-1 text-[11px] font-semibold tabular-nums text-white ${className}`} style={{ background: vibeTileColor(imdbVibe(score)) }}>
			{formatScore(score)}
		</span>
	)
}

export function Ring({ value, max, size = 48, children }: { value: number; max: number; size?: number; children: ReactNode }) {
	const r = (size - 5) / 2
	const c = 2 * Math.PI * r
	return (
		<span className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
			<svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden="true">
				<circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={4} className="stroke-white/10" />
				<circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={4} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - (max ? value / max : 0))} className="stroke-green-500 transition-[stroke-dashoffset] duration-300" />
			</svg>
			{children}
		</span>
	)
}

/** The real episode grid, read-only as on the show page, fed stand-in numbers. */
export function RatingsSection({ action }: { action?: ReactNode }) {
	const grid = useGrid()
	const differs = useDiffers()
	if (!grid.seasons.length) return null
	return (
		<div>
			<EpisodeGrid grid={grid} />
			<p className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
				<span>
					Prototype: TMDB votes stand in for IMDb ratings.
					{differs ? " IMDb numbering is simulated to differ in the first season: its opener counts as one episode there." : ""}
				</span>
				{action}
			</p>
		</div>
	)
}

// ---- the hero: fixed for every variant ---------------------------------------------------

/**
 * The page's one score control. When the show is watched through and has no score, its heading becomes the question,
 * with a soft highlight and "Not now". The real ScoreControl prints its own heading only together with "Clear
 * score", so the heading is drawn here; the real thing would take the heading as a prop.
 */
function ScoreBlock() {
	const s = useStore()
	const value = s.st.score as Score | null
	const prompt = s.d.ratePrompt
	const link = `shrink-0 cursor-pointer text-xs underline underline-offset-2 hover:text-white ${FOCUS}`
	return (
		<div id={SCORE_ANCHOR} data-prompt={prompt || undefined} className={`scroll-mt-24 rounded-xl transition-[background-color,box-shadow,padding,margin] duration-500 ${prompt ? "gw-nudge -mx-2 bg-amber-300/[0.09] p-2 ring-1 ring-amber-300/50" : "ring-1 ring-transparent"}`}>
			<style>{"@keyframes gw-nudge{0%{box-shadow:0 0 0 0 rgb(252 211 77/.5)}100%{box-shadow:0 0 0 16px rgb(252 211 77/0)}}.gw-nudge{animation:gw-nudge 1.1s ease-out 2}@media (prefers-reduced-motion:reduce){.gw-nudge{animation:none}}"}</style>
			<div className="mb-2 flex min-h-5 items-baseline justify-between gap-3">
				<p className={`text-sm font-semibold ${prompt ? "text-white" : "text-gray-400"}`}>
					{prompt ? (
						<>
							You've watched all of {s.show.name}. <span className="text-amber-200">How was it?</span>
						</>
					) : value ? (
						<>
							Your score: <span style={{ color: getVibeColorValue(value) }}>{getScoreLabelText(value)}</span>
						</>
					) : (
						scoreLabels[0]
					)}
				</p>
				{prompt ? (
					<button type="button" onClick={s.dismissRate} className={`${link} text-gray-300 decoration-white/30`}>
						Not now
					</button>
				) : value ? (
					<button type="button" onClick={() => s.rate(null)} className={`${link} text-gray-400 decoration-white/20`}>
						Clear score
					</button>
				) : null}
			</div>
			<ScoreControl value={value} onRate={(score) => s.rate(score)} />
		</div>
	)
}

/** Round 1's variant B hero, kept: the box with status, progress, Next episode and one-press Watched. */
export function Hero({ onOpen, boxFooter }: { onOpen: () => void; boxFooter?: ReactNode }) {
	const s = useStore()
	const { show } = s
	const hasStatus = useHasStatus()
	return (
		<div className="grid gap-4 md:grid-cols-[13rem_minmax(0,1fr)] [&>*]:min-w-0">
			<img src={show.poster_path ? `${TMDB}/w342${show.poster_path}` : undefined} alt="" className="hidden aspect-[2/3] w-full rounded-xl object-cover md:block" />
			<div className="relative isolate flex min-w-0 flex-col rounded-2xl border border-white/10 bg-stone-950 md:rounded-xl">
				<div className="absolute inset-0 -z-10 overflow-hidden rounded-2xl md:rounded-xl" aria-hidden="true">
					{show.backdrop_path && <img src={`${TMDB}/w780${show.backdrop_path}`} alt="" className="h-full w-full scale-110 object-cover object-[center_25%]" />}
					<div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
				</div>
				<div className="flex grow flex-col px-4 pb-5 pt-4 md:p-5 lg:p-6">
					<div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
						<h2 className="min-w-0 truncate text-xl font-bold text-white">
							{show.name} <span className="font-normal text-gray-400">({show.year})</span>
						</h2>
						<StatePill />
					</div>
					<div className="mt-3">
						<ScoreBlock />
					</div>
					<div aria-hidden="true" className="my-4 h-px bg-white/10" />
					<div className={`rounded-xl p-3 ${s.d.started || s.st.seenMarked ? "bg-white/[0.08] ring-1 ring-white/10" : "bg-white/[0.04]"}`}>
						<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
							{hasStatus && <StatusMenu />}
							<ShowProgress className="min-w-48 flex-1" />
						</div>
						<NextEpisode className="mt-3" onOpen={onOpen} />
						{boxFooter}
					</div>
					<div className="@container mt-4">
						<div className="grid grid-cols-2 gap-2 @lg:grid-cols-3">
							<WantButton />
							<SeenButton />
							{/* Once an episode is watched, Dropped takes the place of Not interested. */}
							{hasStatus ? <StatusButton status="dropped" className="col-span-2 @lg:col-span-1" /> : <HideButton className="col-span-2 @lg:col-span-1" />}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

// ---- the season scrubber -----------------------------------------------------------------

/**
 * One segment per season, as wide as the season is long and filled as far as it is watched. A press jumps; a
 * sideways drag scrubs through the seasons.
 */
export function Scrubber({ active, onJump, className = "" }: { active: number; onJump: (season: number) => void; className?: string }) {
	const { st, today, d, show } = useStore()
	const seasons = useSeasons()
	const dragging = useRef(false)
	const last = useRef<number | null>(null)
	const nextSeason = d.next ? seasonOf(show, d.next) : null
	const at = (x: number, y: number) => {
		const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-jump]")
		if (!el) return
		const n = Number(el.dataset.jump)
		if (n === last.current) return
		last.current = n
		onJump(n)
	}
	return (
		<div
			aria-label="Jump to a season"
			className={`flex h-9 touch-pan-y select-none gap-[3px] ${className}`}
			onPointerDown={(e) => {
				dragging.current = true
				last.current = null
				e.currentTarget.setPointerCapture(e.pointerId)
				at(e.clientX, e.clientY)
			}}
			onPointerMove={(e) => dragging.current && at(e.clientX, e.currentTarget.getBoundingClientRect().top + 4)}
			onPointerUp={() => {
				dragging.current = false
			}}
			onPointerCancel={() => {
				dragging.current = false
			}}
		>
			{seasons.map((season) => {
				const p = seasonProgress(season, st, today)
				const special = season.number === 0
				const on = active === season.number
				return (
					<button
						key={season.number}
						type="button"
						data-jump={season.number}
						aria-current={on || undefined}
						title={`${seasonTitle(season)} · ${special ? `${p.watched} watched, not counted` : `${p.watched} of ${p.aired} watched`}`}
						onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onJump(season.number)}
						className={`relative min-w-0 cursor-pointer overflow-hidden rounded-md text-[11px] font-bold tabular-nums ${FOCUS} ${special ? "w-8 shrink-0" : "basis-0"} ${on ? "bg-white/25 text-white ring-2 ring-inset ring-white" : "bg-white/10 text-gray-300 hover:bg-white/20"}`}
						style={special ? undefined : { flexGrow: season.episodes.length }}
					>
						{!special && <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-green-500/60 transition-[width] duration-300" style={{ width: `${p.aired ? (p.watched / p.aired) * 100 : 0}%` }} />}
						{nextSeason === season.number && <span aria-hidden="true" className="absolute inset-x-1 bottom-0.5 h-0.5 rounded-full bg-white" />}
						<span className="relative">{special ? "Sp" : season.number}</span>
					</button>
				)
			})}
		</div>
	)
}

// ---- one scroll --------------------------------------------------------------------------

export interface SeasonScrollHandle {
	toNext: (smooth?: boolean) => void
	toSeason: (season: number) => void
}

const STRIP = 52

/**
 * Every season in one scroll under sticky season headers, with the scrubber stuck above them. Seasons that were
 * watched through when the list opened, and the specials, start folded to their header. `scroller` is the box that
 * scrolls; without it the page does.
 */
export const SeasonScroll = forwardRef<SeasonScrollHandle, { scroller?: RefObject<HTMLElement | null>; top: number; thumb?: boolean; stripClass?: string }>(function SeasonScroll(
	{ scroller, top, thumb, stripClass = "bg-gray-900" },
	ref,
) {
	const s = useStore()
	const seasons = useSeasons()
	const grid = useGrid()
	const done = useSeasonDone()
	const current = useCurrentSeason()
	const wrap = useRef<HTMLDivElement>(null)
	const [folded, setFolded] = useState(() => new Set(seasons.filter((x) => x.number === 0 || done(x)).map((x) => x.number)))
	const [active, setActive] = useState(current)

	useEffect(() => {
		const target: HTMLElement | Window = scroller?.current ?? window
		let frame = 0
		const read = () => {
			frame = 0
			const line = (scroller?.current?.getBoundingClientRect().top ?? 0) + top + STRIP + 24
			let found = seasons[0]?.number ?? 0
			for (const el of wrap.current?.querySelectorAll<HTMLElement>("[data-season]") ?? []) if (el.getBoundingClientRect().top <= line) found = Number(el.dataset.season)
			setActive(found)
		}
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(read)
		}
		target.addEventListener("scroll", onScroll, { passive: true })
		read()
		return () => {
			target.removeEventListener("scroll", onScroll)
			cancelAnimationFrame(frame)
		}
	}, [scroller, top, seasons])

	const open = (n: number) =>
		setFolded((f) => {
			if (!f.has(n)) return f
			const next = new Set(f)
			next.delete(n)
			return next
		})
	const go = (selector: string, block: ScrollLogicalPosition, smooth = false) => requestAnimationFrame(() => wrap.current?.querySelector(selector)?.scrollIntoView({ block, behavior: smooth ? "smooth" : "instant" }))
	const toSeason = (n: number) => {
		open(n)
		go(`[data-season="${n}"]`, "start")
	}
	const toNext = (smooth = false) => {
		const next = s.d.next
		if (!next) return go("[data-season]", "start", smooth)
		open(seasonOf(s.show, next))
		go(`[data-ep="${next.id}"]`, "center", smooth)
	}
	useImperativeHandle(ref, () => ({ toNext, toSeason }))

	return (
		<div ref={wrap}>
			{seasons.length > 1 && (
				<div className={`sticky z-20 -mx-1 flex items-center gap-2 px-1 py-2 ${stripClass}`} style={{ top }}>
					<Scrubber active={active} onJump={toSeason} className="min-w-0 flex-1" />
					{s.d.next && (
						<button type="button" onClick={() => toNext(true)} className={`hidden h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-green-500/15 px-2.5 text-xs font-bold text-green-300 ring-1 ring-green-400/40 hover:bg-green-500/25 sm:inline-flex ${FOCUS}`}>
							Next · {epCode(s.show, s.d.next)}
						</button>
					)}
				</div>
			)}
			<div className="flex flex-col gap-2">
				{seasons.map((season) => {
					const isFolded = folded.has(season.number)
					return (
						<section key={season.number} data-season={season.number} className={`rounded-2xl border border-white/[0.06] ${SURFACE}`} style={{ scrollMarginTop: top + (seasons.length > 1 ? STRIP : 0) + 4 }}>
							<div className={`sticky z-10 flex items-center bg-[#1b2130] ${isFolded ? "rounded-2xl" : "rounded-t-2xl shadow-[0_6px_10px_-6px_rgb(0_0_0/0.7)]"}`} style={{ top: top + (seasons.length > 1 ? STRIP : 0) }}>
								<button
									type="button"
									aria-expanded={!isFolded}
									onClick={() =>
										setFolded((f) => {
											const next = new Set(f)
											next.has(season.number) ? next.delete(season.number) : next.add(season.number)
											return next
										})
									}
									className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-2xl px-3 py-2.5 text-left ${FOCUS}`}
								>
									<ChevronDownIcon className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isFolded ? "-rotate-90" : ""}`} />
									<span className="truncate text-sm font-bold text-white">{seasonTitle(season)}</span>
									<ScoreChip score={seasonScore(grid, season.number)} />
									{done(season) && <CheckIcon className="h-4 w-4 shrink-0 text-green-400" aria-label="Watched" />}
								</button>
								<span className="pr-2.5">
									<SeasonMeta season={season} />
								</span>
							</div>
							{!isFolded && <EpisodeRows season={season} thumb={thumb} />}
						</section>
					)
				})}
			</div>
		</div>
	)
})
