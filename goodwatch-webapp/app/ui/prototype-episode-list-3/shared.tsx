// PROTOTYPE - throwaway (#369, round 3). What the round 3 variants share: ratings matched to TMDB's episodes without
// guessing, the one-line episode row that opens in place, the bounded list (inner scroll or a folded window), the
// finder ("9x14", "s9e14", part of a name), the per-episode strip, and the navigation state. The model, the store and
// the fixtures are round 1's; the hero and the season helpers are round 2's.
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, ClockIcon, ExclamationTriangleIcon, MagnifyingGlassIcon } from "@heroicons/react/24/solid"
import { useSearchParams } from "@remix-run/react"
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useMemo, useRef, useState } from "react"
import { formatScore, imdbVibe, vibeTileColor } from "~/ui/details/episode-grid/scale"
import { FOCUS, ScoreChip, seasonScore, useCurrentSeason, useGrid, useSeasons } from "~/ui/prototype-episode-list-2/shared"
import { type Ep, type Season, type Show, type When, epCode, fmtDay, fmtWhen, isAired, plural, regularSeasons, seasonOf, seasonProgress, unwatchedUpTo } from "~/ui/prototype-episode-list/model"
import { SeasonMeta, seasonTitle } from "~/ui/prototype-episode-list/parts"
import { useStore } from "~/ui/prototype-episode-list/store"

const TMDB = "https://image.tmdb.org/t/p"
export const H2 = "text-2xl font-bold"
const norm = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "")

export function useIsDesktop() {
	const [is, setIs] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches)
	useEffect(() => {
		const media = window.matchMedia("(min-width: 1024px)")
		const on = () => setIs(media.matches)
		media.addEventListener("change", on)
		on()
		return () => media.removeEventListener("change", on)
	}, [])
	return is
}

// ---- ratings beside TMDB's episodes ------------------------------------------------------

export interface Rated {
	score: number
	/** Found at the same season and number, or elsewhere in the season under the same title. */
	how: "number" | "title"
}

/**
 * IMDb's rating for each TMDB episode, or none. A rating is taken only when IMDb's episode at that season and number
 * has the same title; otherwise the season is searched for the title; otherwise the episode gets no rating. So a
 * season the two sites number differently loses ratings and never shows another episode's.
 */
export function useRatings() {
	const { show } = useStore()
	const grid = useGrid()
	return useMemo(() => {
		const byEp = new Map<number, Rated>()
		const notes = new Map<number, { byTitle: number; missing: number }>()
		const missing = new Set<number>()
		for (const season of regularSeasons(show)) {
			const imdb = grid.seasons.find((x) => x.number === season.number)
			if (!imdb) continue
			const byName = new Map(imdb.episodes.map((e) => [norm(e.name), e]))
			let moved = 0
			let lost = 0
			for (const ep of season.episodes) {
				const at = imdb.episodes.find((e) => e.number === ep.n)
				if (at && norm(at.name) === norm(ep.name)) {
					byEp.set(ep.id, { score: at.score, how: "number" })
					continue
				}
				const named = byName.get(norm(ep.name))
				if (named) {
					byEp.set(ep.id, { score: named.score, how: "title" })
					moved++
				} else if (at) {
					missing.add(ep.id)
					lost++
				}
			}
			if (moved || lost) notes.set(season.number, { byTitle: moved, missing: lost })
		}
		return { byEp, notes, missing }
	}, [show, grid])
}

/** The switch in the white panel: ratings of episodes the person hasn't watched are held back. */
export const useHideUnwatched = () => useSearchParams()[0].get("ratings") === "watched"

/** What a season's ratings lose when IMDb numbers it differently. */
export function NumberingNote({ season }: { season: Season }) {
	const note = useRatings().notes.get(season.number)
	if (!note) return null
	return (
		<p data-numbering-note className="flex items-start gap-1.5 border-t border-white/[0.06] px-3 py-1.5 text-[11px] leading-4 text-amber-200/90">
			<ExclamationTriangleIcon className="mt-px h-3.5 w-3.5 shrink-0" />
			<span>
				IMDb numbers this season differently. {note.byTitle ? `${plural(note.byTitle, "rating")} matched by title` : "No rating could be matched"}
				{note.missing ? `; ${plural(note.missing, "episode")} left without a rating rather than given a neighbour's.` : "."}
			</span>
		</p>
	)
}

const vibe = (score: number) => `var(--color-vibe-${imdbVibe(score)})`

/** An episode's rating as a small tile in the grid's colours. Held back, it is an empty dashed tile. */
export function EpChip({ rated, held, missing }: { rated?: Rated; held: boolean; missing: boolean }) {
	const base = "inline-flex h-[18px] w-8 shrink-0 items-center justify-center rounded-[4px] text-[11px] font-semibold tabular-nums"
	if (rated && held)
		return (
			<span data-chip="held" title="Rating held back until you've watched it" className={`${base} border border-dashed border-white/25`}>
				<span className="sr-only">Rating held back</span>
			</span>
		)
	if (!rated)
		return (
			<span data-chip={missing ? "missing" : "none"} title={missing ? "No rating shown: IMDb numbers this season differently" : undefined} className="w-8 shrink-0 text-center text-xs text-gray-600">
				{missing ? "–" : ""}
			</span>
		)
	return (
		<span data-chip="rated" title={`IMDb ${formatScore(rated.score)}${rated.how === "title" ? ", matched by title" : ""}`} className={`${base} text-white`} style={{ background: vibeTileColor(imdbVibe(rated.score)) }}>
			{formatScore(rated.score)}
		</span>
	)
}

/**
 * One sliver per episode of a season, in TMDB's order: solid when watched, hollow when not, in the rating's colour
 * where there is a rating to show. Progress and quality in one thin object.
 */
export function HeatStrip({ season, className = "h-3" }: { season: Season; className?: string }) {
	const { st, today, d } = useStore()
	const { byEp } = useRatings()
	const hide = useHideUnwatched()
	return (
		<span data-strip={season.number} aria-hidden="true" className={`flex min-w-0 gap-px ${className}`}>
			{season.episodes.map((ep) => {
				const watched = !!st.watches[ep.id]
				const rated = byEp.get(ep.id)
				const colour = rated && (watched || !hide) ? vibe(rated.score) : null
				const style = !isAired(ep, today)
					? { background: "rgb(255 255 255 / 0.05)" }
					: watched
						? { background: colour ?? "rgb(255 255 255 / 0.4)" }
						: { boxShadow: `inset 0 0 0 1px ${colour ?? "rgb(255 255 255 / 0.25)"}` }
				return <span key={ep.id} data-solid={watched || undefined} className={`min-w-0 flex-1 rounded-[1.5px] ${d.next === ep ? "outline outline-1 outline-offset-1 outline-white" : ""}`} style={style} />
			})}
		</span>
	)
}

// ---- navigation state --------------------------------------------------------------------

export interface Target {
	id: number
	t: number
	/** Move keyboard focus to the row. */
	focus?: boolean
	/** Scroll the page to the episodes section (the press came from the hero). */
	page?: boolean
	/** A season change: no flash and no page scroll. */
	quiet?: boolean
}

/** Which season is open and which episode was asked for, shared by the three variants. */
export function useNav() {
	const s = useStore()
	const { show, d } = s
	const seasons = useSeasons()
	const current = useCurrentSeason()
	const [picked, setPicked] = useState(current)
	const [target, setTarget] = useState<Target | null>(null)
	const [selected, setSelected] = useState<number | null>(() => d.next?.id ?? seasons[0]?.episodes[0]?.id ?? null)
	const input = useRef<HTMLInputElement>(null)
	const index = Math.max(0, seasons.findIndex((x) => x.number === picked))
	const season = seasons[index]
	const anchor = (of: Season) => (d.next && of.episodes.includes(d.next) ? d.next : of.episodes[0])
	const goEp = (ep: Ep, how: Partial<Target> = {}) => {
		setPicked(seasonOf(show, ep))
		setSelected(ep.id)
		setTarget({ id: ep.id, t: Date.now(), ...how })
	}
	const goSeason = (to: Season | undefined, focus = false) => {
		const ep = to && anchor(to)
		if (!to || !ep) return
		setPicked(to.number)
		setSelected(ep.id)
		setTarget({ id: ep.id, t: Date.now(), focus, quiet: true })
	}
	const jumpNext = (page = false) => {
		if (d.next) goEp(d.next, { page, focus: !page })
		else if (page) document.getElementById("episodes")?.scrollIntoView({ behavior: "smooth", block: "start" })
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

	return { seasons, many: seasons.length > 1, picked, season, index, target, selected, input, goEp, goSeason, jumpNext, step }
}
export type Nav = ReturnType<typeof useNav>

// ---- the finder --------------------------------------------------------------------------

type Found = { ep: Ep; season: Season } | { season: Season }

/** "9x14", "s9e14", "9.14", "s9", "14" (in the open season) or part of a name. */
export function findEpisodes(show: Show, seasons: Season[], picked: number, query: string): Found[] {
	const q = query.trim().toLowerCase()
	if (!q) return []
	const out: Found[] = []
	const add = (season: Season | undefined, n: number) => {
		const ep = season?.episodes.find((e) => e.n === n)
		if (season && ep && !out.some((f) => "ep" in f && f.ep === ep)) out.push({ ep, season })
	}
	const regular = (n: number) => seasons.find((x) => x.number === n && n > 0)
	const code = q.match(/^s?\s*(\d{1,2})\s*(?:[xe.:\-\s]|\s*e)\s*(\d{1,3})$/)
	if (code) add(regular(Number(code[1])), Number(code[2]))
	const whole = q.match(/^s(?:eason)?\s*(\d{1,2})$/)
	const season = whole && regular(Number(whole[1]))
	if (season) out.push({ season })
	if (/^\d{1,3}$/.test(q)) {
		add(seasons.find((x) => x.number === picked), Number(q))
		const other = regular(Number(q))
		if (other) out.push({ season: other })
	}
	const key = norm(q)
	if (key.length >= 2 && !code) {
		const hits = seasons.flatMap((x) => x.episodes.filter((e) => norm(e.name).includes(key)).map((ep) => ({ ep, season: x })))
		hits.sort((a, b) => Number(norm(b.ep.name).startsWith(key)) - Number(norm(a.ep.name).startsWith(key)))
		for (const hit of hits) if (out.length < 7 && !out.some((f) => "ep" in f && f.ep === hit.ep)) out.push(hit)
	}
	return out.slice(0, 7)
}

export function Finder({ nav, className = "" }: { nav: Nav; className?: string }) {
	const { show, st } = useStore()
	const [q, setQ] = useState("")
	const [at, setAt] = useState(0)
	const [open, setOpen] = useState(false)
	const found = useMemo(() => findEpisodes(show, nav.seasons, nav.picked, q), [show, nav.seasons, nav.picked, q])
	const pick = (f: Found | undefined) => {
		if (!f) return
		if ("ep" in f) nav.goEp(f.ep, { focus: true })
		else nav.goSeason(f.season, true)
		setQ("")
		setOpen(false)
	}
	return (
		<div className={`relative ${className}`}>
			<MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
			<input
				ref={nav.input}
				type="search"
				role="combobox"
				aria-expanded={open && found.length > 0}
				aria-controls="gw3-found"
				aria-label="Find an episode"
				autoComplete="off"
				placeholder="Find: 9x14, s9e14 or a name"
				value={q}
				onChange={(e) => {
					setQ(e.target.value)
					setAt(0)
					setOpen(true)
				}}
				onFocus={() => setOpen(true)}
				onBlur={() => setOpen(false)}
				onKeyDown={(e) => {
					if (e.key === "ArrowDown" || e.key === "ArrowUp") {
						e.preventDefault()
						setAt((i) => (found.length ? (i + (e.key === "ArrowDown" ? 1 : -1) + found.length) % found.length : 0))
					}
					if (e.key === "Enter") pick(found[at])
					if (e.key === "Escape") {
						setQ("")
						e.currentTarget.blur()
					}
				}}
				className="h-10 w-full rounded-lg bg-white/[0.07] pl-8 pr-2 text-sm text-white placeholder:text-gray-500 focus:bg-white/10 focus:outline-2 focus:outline-white/60 lg:h-8"
			/>
			{open && q.trim() && (
				<div id="gw3-found" className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-white/10 bg-gray-800 shadow-2xl lg:min-w-80">
					{found.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">No episode found. Try 9x14, s9e14 or part of a name.</p>}
					{found.map((f, i) => (
						<button
							// biome-ignore lint/suspicious/noArrayIndexKey: a short result list
							key={i}
							type="button"
							data-found
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => pick(f)}
							className={`flex h-11 w-full cursor-pointer items-center gap-2 px-3 text-left text-sm lg:h-8 ${i === at ? "bg-white/15" : "hover:bg-white/10"}`}
						>
							{"ep" in f ? (
								<>
									<span className="w-16 shrink-0 text-xs font-bold tabular-nums text-gray-300">{epCode(show, f.ep)}</span>
									<span className="min-w-0 flex-1 truncate text-white">{f.ep.name}</span>
									{st.watches[f.ep.id] && <CheckIcon className="h-3.5 w-3.5 shrink-0 text-green-400" />}
								</>
							) : (
								<span className="font-semibold text-white">{seasonTitle(f.season)}</span>
							)}
						</button>
					))}
				</div>
			)}
		</div>
	)
}

/** The section's one line of tools: the finder and the jump to the next episode. A short single season has neither. */
export function Toolbar({ nav, title = "Episodes" }: { nav: Nav; title?: string }) {
	const { show, d } = useStore()
	const small = !nav.many && nav.season.episodes.length <= 12
	return (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
			<h2 className={H2}>{title}</h2>
			{!small && <Finder nav={nav} className="order-last w-full sm:order-none sm:w-72" />}
			{!small && d.next && (
				<button type="button" data-jump-next onClick={() => nav.jumpNext()} className={`ml-auto inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-green-500/15 px-2.5 text-xs font-bold text-green-300 ring-1 ring-green-400/40 hover:bg-green-500/25 sm:ml-0 lg:h-8 ${FOCUS}`}>
					Next · {epCode(show, d.next)}
				</button>
			)}
			{!small && (
				<p className="ml-auto hidden text-[11px] text-gray-500 xl:block">
					<Kbd>F</Kbd> find · <Kbd>N</Kbd> next episode · in the list <Kbd>↑</Kbd>
					<Kbd>↓</Kbd> rows, {nav.many && (
						<>
							<Kbd>←</Kbd>
							<Kbd>→</Kbd> seasons,{" "}
						</>
					)}
					<Kbd>W</Kbd> watched
				</p>
			)}
		</div>
	)
}
const Kbd = ({ children }: { children: string }) => <kbd className="mx-0.5 rounded border border-white/15 bg-white/5 px-1 font-sans text-[10px] text-gray-300">{children}</kbd>

// ---- the one-line row --------------------------------------------------------------------

const CHIP = `inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold cursor-pointer lg:h-7 ${FOCUS}`
const CHIP_OFF = "bg-white/10 text-gray-100 hover:bg-white/20"

/** What a row opens to: the still, the description, when it was watched, "watched up to here", removing the watch. */
function RowDetail({ ep, special, rated, close }: { ep: Ep; special: boolean; rated?: Rated; close: () => void }) {
	const s = useStore()
	const watch = s.st.watches[ep.id]
	const aired = isAired(ep, s.today)
	const earlier = special || watch || !aired ? 0 : unwatchedUpTo(s.show, s.st, s.today, ep).length - 1
	const on = "bg-green-500 text-black"
	const pick = (when: When) => {
		if (watch) s.setWhen(ep, when)
		else s.markOne(ep, when)
	}
	return (
		<div data-detail className="mx-2 mb-2 rounded-lg bg-black/25 p-2.5 lg:ml-10">
			<div className="flex flex-col gap-2.5 sm:flex-row">
				{ep.still_path && <img src={`${TMDB}/w300${ep.still_path}`} alt="" loading="lazy" className="aspect-video w-full rounded-md object-cover sm:w-40 sm:shrink-0" />}
				<div className="min-w-0">
					<p className="text-xs text-gray-500">
						{ep.air_date ? (aired ? fmtDay(ep.air_date) : `Airs ${fmtDay(ep.air_date)}`) : "No air date"}
						{ep.runtime ? ` · ${ep.runtime} min` : ""}
						{rated ? ` · IMDb ${formatScore(rated.score)}${rated.how === "title" ? " (matched by title)" : ""}` : ""}
					</p>
					<p className="mt-1 text-sm leading-relaxed text-gray-300">{ep.overview || "No description."}</p>
				</div>
			</div>
			{aired ? (
				<div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
					<span>{watch ? `Watched ${fmtWhen(watch.when, s.today)}${special ? ", not counted" : ""}:` : "Watched it"}</span>
					<button type="button" onClick={() => pick({ kind: "moment", at: new Date().toISOString() })} className={`${CHIP} ${watch?.when.kind === "moment" ? on : CHIP_OFF}`}>
						Now
					</button>
					<label className={`${CHIP} ${watch?.when.kind === "day" ? on : CHIP_OFF}`}>
						On
						<input type="date" max={s.today} value={watch?.when.kind === "day" ? watch.when.day : ""} onChange={(e) => e.target.value && pick({ kind: "day", day: e.target.value })} className="w-[7.25rem] rounded bg-black/30 px-1 py-0.5 text-xs text-white [color-scheme:dark]" />
					</label>
					<button type="button" onClick={() => pick({ kind: "unknown" })} className={`${CHIP} ${watch?.when.kind === "unknown" ? on : CHIP_OFF}`}>
						Don't know when
					</button>
					{earlier > 0 && (
						<button
							type="button"
							onClick={() => {
								s.upTo(ep)
								close()
							}}
							className={`${CHIP} bg-white/10 text-green-300 ring-1 ring-green-400/40 hover:bg-white/20`}
						>
							<CheckIcon className="h-3.5 w-3.5" />
							Watched up to here ({earlier + 1})
						</button>
					)}
					{watch && (
						<button
							type="button"
							onClick={() => {
								s.unmarkOne(ep)
								close()
							}}
							className={`${CHIP} text-pink-300 hover:bg-white/10`}
						>
							Remove watch
						</button>
					)}
				</div>
			) : (
				<p className="mt-2 text-xs text-gray-500">It can be marked from the day it airs.</p>
			)}
		</div>
	)
}

/**
 * One episode on one line: tick, number, name, the rating where the variant shows it, the air date. A press on the
 * line opens the still and the description in place; until then an unwatched episode shows neither.
 */
function DenseRow({ ep, special, chips, dates, open, onToggle, selected, flash }: { ep: Ep; special: boolean; chips: boolean; dates: boolean; open: boolean; onToggle: () => void; selected: boolean; flash: boolean }) {
	const s = useStore()
	const { byEp, missing } = useRatings()
	const hide = useHideUnwatched()
	const watch = s.st.watches[ep.id]
	const aired = isAired(ep, s.today)
	const isNext = s.d.next === ep
	const rated = byEp.get(ep.id)
	const held = hide && !watch && !open
	return (
		<li data-ep={ep.id} data-selected={selected || undefined} className={`relative scroll-mt-24 border-t border-white/[0.06] ${flash ? "gw3-flash" : ""} ${selected ? "bg-white/[0.09]" : isNext ? "bg-green-500/[0.07]" : ""}`}>
			{selected && <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-full bg-white" />}
			<div className={`flex h-11 items-center pr-1.5 lg:h-9 ${aired ? "" : "opacity-50"}`}>
				<button
					type="button"
					disabled={!aired}
					onClick={() => (watch ? s.unmarkOne(ep) : s.markOne(ep))}
					aria-pressed={!!watch}
					aria-label={`${watch ? "Watched" : "Mark as watched"}: ${ep.name}`}
					className={`flex h-11 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full disabled:cursor-not-allowed lg:h-9 lg:w-9 ${FOCUS}`}
				>
					<span
						className={`flex h-6 w-6 items-center justify-center rounded-full lg:h-5 lg:w-5 ${
							!aired
								? "border-2 border-dashed border-white/25 text-gray-500"
								: watch
									? special
										? "border-2 border-green-400/70 text-green-300"
										: "bg-green-500 text-black"
									: "border-2 border-white/30 text-transparent hover:border-green-400 hover:text-green-400/60"
						}`}
					>
						{aired ? <CheckIcon className="h-3.5 w-3.5" /> : <ClockIcon className="h-3 w-3" />}
					</span>
				</button>
				<button type="button" data-rowbtn aria-expanded={open} onClick={onToggle} className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 rounded text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white">
					<span className="w-5 shrink-0 text-right text-xs tabular-nums text-gray-500">{ep.n}</span>
					<span className={`min-w-0 truncate text-sm ${watch ? "text-gray-400" : "font-medium text-white"}`}>{ep.name}</span>
					{isNext && <span className="shrink-0 rounded bg-green-500 px-1 text-[10px] font-bold uppercase leading-4 text-black">Next</span>}
					<span className="flex-1" />
					{chips && !special && aired && <EpChip rated={rated} held={held} missing={missing.has(ep.id)} />}
					<span className={`shrink-0 whitespace-nowrap text-right text-xs tabular-nums text-gray-500 ${!dates ? "hidden" : chips ? "hidden sm:block" : ""}`}>{ep.air_date ? (aired ? fmtDay(ep.air_date) : `Airs ${fmtDay(ep.air_date)}`) : "No air date"}</span>
					<ChevronDownIcon className={`h-3.5 w-3.5 shrink-0 text-gray-600 transition-transform ${open ? "rotate-180" : ""}`} />
				</button>
			</div>
			{open && <RowDetail ep={ep} special={special} rated={chips || open ? rated : undefined} close={onToggle} />}
		</li>
	)
}

const FOLD = `flex h-9 w-full cursor-pointer items-center gap-2 border-t border-white/[0.06] px-3 text-left text-xs text-gray-400 hover:bg-white/[0.05] hover:text-white lg:h-7 ${FOCUS}`

/**
 * A season's rows at a bounded height. "scroll" keeps every row in a box that scrolls inside the page, opened at
 * the asked-for or the next episode. "fold" shows a window of `limit` rows around it and folds the rest into one
 * line above and one below. `columns` splits the rows in two on wide screens.
 */
export function DenseList({
	season,
	target,
	chips = false,
	dates = true,
	layout,
	limit = 8,
	columns = false,
	scrollClass = "",
	selectedId = null,
	onStep,
}: {
	season: Season
	target: Target | null
	chips?: boolean
	dates?: boolean
	layout: "scroll" | "fold"
	limit?: number
	columns?: boolean
	scrollClass?: string
	selectedId?: number | null
	onStep?: (by: number) => void
}) {
	const s = useStore()
	const eps = season.episodes
	const special = season.number === 0
	const root = useRef<HTMLDivElement>(null)
	const box = useRef<HTMLDivElement>(null)
	const indexOfTarget = target ? eps.findIndex((e) => e.id === target.id) : -1
	const around = (i: number): [number, number] => {
		const to = Math.min(eps.length, Math.max(0, i - (limit > 6 ? 1 : 2)) + limit)
		return [Math.max(0, to - limit), to]
	}
	const [range, setRange] = useState<[number, number]>(() => around(indexOfTarget >= 0 ? indexOfTarget : Math.max(0, s.d.next ? eps.indexOf(s.d.next) : 0)))
	const [openId, setOpenId] = useState<number | null>(null)
	const [flash, setFlash] = useState<number | null>(null)

	useEffect(() => {
		const i = target ? eps.findIndex((e) => e.id === target.id) : -1
		if (target && i < 0) return
		const id = target ? target.id : s.d.next && eps.includes(s.d.next) ? s.d.next.id : null
		if (layout === "fold" && i >= 0) setRange((r) => (i >= r[0] && i < r[1] ? r : around(i)))
		const timer = setTimeout(() => {
			const row = id == null ? null : root.current?.querySelector<HTMLElement>(`[data-ep="${id}"]`)
			if (!row) return
			const scroller = box.current
			if (scroller && scroller.scrollHeight > scroller.clientHeight) scroller.scrollTop = row.offsetTop - scroller.clientHeight / 2 + row.offsetHeight / 2
			if (!target) return
			if (target.page) document.getElementById("episodes")?.scrollIntoView({ behavior: "smooth", block: "start" })
			else if (!target.quiet) row.scrollIntoView({ block: "nearest" })
			if (target.focus) row.querySelector<HTMLElement>("[data-rowbtn]")?.focus({ preventScroll: true })
			if (!target.quiet) setFlash(id)
		}, 40)
		return () => clearTimeout(timer)
	}, [target?.t])
	useEffect(() => {
		if (flash == null) return
		const timer = setTimeout(() => setFlash(null), 1600)
		return () => clearTimeout(timer)
	}, [flash])

	const onKey = (e: ReactKeyboardEvent) => {
		const button = (e.target as HTMLElement).closest<HTMLElement>("[data-rowbtn]")
		if (!button || !root.current) return
		const all = [...root.current.querySelectorAll<HTMLElement>("[data-rowbtn]")]
		const i = all.indexOf(button)
		if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			e.preventDefault()
			all[i + (e.key === "ArrowDown" ? 1 : -1)]?.focus()
		} else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && onStep) {
			// The seasons, not the prototype's variant switcher.
			e.preventDefault()
			e.stopPropagation()
			onStep(e.key === "ArrowRight" ? 1 : -1)
		} else if (e.key === "w" || e.key === "W") {
			const ep = eps.find((x) => x.id === Number(button.closest<HTMLElement>("[data-ep]")?.dataset.ep))
			if (ep && isAired(ep, s.today)) s.st.watches[ep.id] ? s.unmarkOne(ep) : s.markOne(ep)
		}
	}

	const [from, to] = layout === "fold" ? range : [0, eps.length]
	const shown = eps.slice(from, to)
	const half = Math.ceil(shown.length / 2)
	const lists = columns && shown.length > 8 ? [shown.slice(0, half), shown.slice(half)] : [shown]
	const span = (a: number, b: number) => (special ? "" : a === b ? `E${eps[a].n}` : `E${eps[a].n}–E${eps[b].n}`)
	const watchedIn = (a: number, b: number) => eps.slice(a, b).filter((e) => s.st.watches[e.id]).length
	return (
		<div ref={root} data-list={season.number} onKeyDown={onKey}>
			<style>{"@keyframes gw3-flash{0%,40%{background-color:rgb(255 255 255/.22)}100%{background-color:transparent}}.gw3-flash{animation:gw3-flash 1.5s ease-out}@media (prefers-reduced-motion:reduce){.gw3-flash{animation:none;outline:2px solid white;outline-offset:-2px}}"}</style>
			{special && <p className="border-t border-white/[0.06] px-3 py-1.5 text-[11px] text-gray-400">Specials can be marked. They never count toward your progress or toward the show being Seen.</p>}
			{from > 0 && (
				<button type="button" data-fold="earlier" onClick={() => setRange([Math.max(0, from - limit), to])} className={FOLD}>
					<ChevronUpIcon className="h-3.5 w-3.5" />
					<span className="tabular-nums">
						{plural(from, "earlier episode")} {span(0, from - 1) && `· ${span(0, from - 1)}`} · {watchedIn(0, from) === from ? "all watched" : `${watchedIn(0, from)} watched`}
					</span>
				</button>
			)}
			<div ref={box} className={`relative ${layout === "scroll" ? `overflow-y-auto ${scrollClass}` : ""} ${lists.length > 1 ? "lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-3" : ""}`}>
				{lists.map((list) => (
					<ul key={list[0]?.id ?? "empty"}>
						{list.map((ep) => (
							<DenseRow key={ep.id} ep={ep} special={special} chips={chips} dates={dates} open={openId === ep.id} onToggle={() => setOpenId(openId === ep.id ? null : ep.id)} selected={selectedId === ep.id} flash={flash === ep.id} />
						))}
					</ul>
				))}
			</div>
			{to < eps.length && (
				<button type="button" data-fold="later" onClick={() => setRange([from, Math.min(eps.length, to + limit)])} className={FOLD}>
					<ChevronDownIcon className="h-3.5 w-3.5" />
					<span className="tabular-nums">
						{eps.length - to} more {span(to, eps.length - 1) && `· ${span(to, eps.length - 1)}`}
					</span>
				</button>
			)}
		</div>
	)
}

/** The open season's own line: title, season score, count and the whole-season mark. */
export function SeasonHead({ season, label }: { season: Season; label?: string }) {
	const grid = useGrid()
	return (
		<div className="flex min-h-11 items-center justify-between gap-2 py-1 pl-3 pr-1.5">
			<h3 className="flex min-w-0 items-center gap-2 text-sm font-bold text-white">
				<span className="truncate">{label ?? seasonTitle(season)}</span>
				<ScoreChip score={seasonScore(grid, season.number)} />
			</h3>
			<SeasonMeta season={season} showBar={false} />
		</div>
	)
}

export const useCount = () => {
	const { st, today } = useStore()
	return (season: Season) => {
		const p = seasonProgress(season, st, today)
		return { ...p, done: season.number > 0 && p.aired > 0 && p.watched === p.aired }
	}
}
