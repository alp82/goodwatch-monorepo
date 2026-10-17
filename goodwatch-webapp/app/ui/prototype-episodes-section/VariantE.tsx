// PROTOTYPE - throwaway. Variant E of the title page's episodes section: one dense table of every episode, sticky
// season rows, a toolbar (search, filter, sort, jump), selection with shift ranges and an inline bulk bar.
// Keys while the table has focus: j/k or arrows move, x or Space selects, shift+x extends, Enter opens a row.
// Bulk actions call the real per-episode watch/unwatch for each selected episode (there is no bulk action).
import { CheckIcon, ChevronDownIcon, MagnifyingGlassIcon } from "@heroicons/react/24/solid"
import { useMemo, useRef, useState } from "react"
import { episodeLabel } from "~/domain/tracking/machine"
import type { PageEpisode } from "~/domain/tracking/show-page"
import { ScoreTile, findEpisodes } from "~/ui/tracking/EpisodeList"
import { TrackingToastHost } from "~/ui/tracking/TrackingToast"
import { useTrackingActions } from "~/ui/tracking/actions"
import { FOCUS, SURFACE, formatDay, seasonTitle, useShowTracking } from "~/ui/tracking/store"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { VariantProps } from "./types"

type Filter = "all" | "unwatched" | "watched" | "top"
const FILTERS: [Filter, string][] = [
	["all", "All"],
	["unwatched", "Unwatched"],
	["watched", "Watched"],
	["top", "Top rated"],
]
const CHIP = `inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold cursor-pointer ${FOCUS}`
const BOX = "flex h-4 w-4 items-center justify-center rounded border"

export default function VariantE({ media, gridNode }: VariantProps) {
	const tracking = useShowTracking(media.details.tmdb_id)
	const actions = useTrackingActions(tracking.store, media.details.title)
	const view = tracking.view
	const { seasons, today, page } = tracking

	const [query, setQuery] = useState("")
	const [filter, setFilter] = useState<Filter>("all")
	const [sort, setSort] = useState<"order" | "score">("order")
	const [selected, setSelected] = useState<Set<number>>(new Set())
	const [anchor, setAnchor] = useState<number | null>(null)
	const [cursor, setCursor] = useState<number | null>(null)
	const [open, setOpen] = useState<number | null>(null)
	const [revealed, setRevealed] = useState<Set<number>>(new Set())
	const table = useRef<HTMLDivElement>(null)

	const aired = (e: PageEpisode) => e.airDate !== null && e.airDate <= today
	const watched = (e: PageEpisode) => view?.watched.has(e.id) ?? false

	const groups = useMemo(() => {
		if (!view) return []
		const found = query.trim() ? findEpisodes(seasons, seasons[0]?.number ?? 1, query) : null
		const hit = found
			? new Set(
					found.flatMap((f) =>
						"episode" in f ? [f.episode.id] : f.season.episodes.map((e) => e.id),
					),
				)
			: null
		const scores = seasons.flatMap((s) => s.episodes.map((e) => e.rating).filter((r): r is number => r !== null))
		const top = scores.sort((a, b) => b - a)[Math.floor(scores.length * 0.2)] ?? 10
		return seasons
			.map((season) => {
				let episodes = season.episodes.filter((e) => {
					if (hit && !hit.has(e.id)) return false
					if (filter === "unwatched") return !view.watched.has(e.id)
					if (filter === "watched") return view.watched.has(e.id)
					if (filter === "top") return e.rating !== null && e.rating >= top
					return true
				})
				if (sort === "score") episodes = [...episodes].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
				return { season, episodes }
			})
			.filter((g) => g.episodes.length)
	}, [view, seasons, query, filter, sort])
	const flat = groups.flatMap((g) => g.episodes)

	if (!tracking.ready || !view) return gridNode ? <div>{gridNode}</div> : null
	const nextId = view.derived.next?.id ?? null

	const focusRow = (id: number) => {
		setCursor(id)
		const row = table.current?.querySelector<HTMLElement>(`[data-row="${id}"]`)
		row?.focus({ preventScroll: true })
		row?.scrollIntoView({ block: "nearest", behavior: "smooth" })
	}
	const toggle = (id: number, range: boolean) => {
		setSelected((before) => {
			const next = new Set(before)
			if (range && anchor !== null) {
				const a = flat.findIndex((e) => e.id === anchor)
				const b = flat.findIndex((e) => e.id === id)
				const on = !before.has(id)
				for (const e of flat.slice(Math.min(a, b), Math.max(a, b) + 1))
					if (aired(e)) on ? next.add(e.id) : next.delete(e.id)
			} else next.has(id) ? next.delete(id) : next.add(id)
			return next
		})
		setAnchor(id)
	}
	const toggleSeason = (episodes: PageEpisode[]) => {
		const ids = episodes.filter(aired).map((e) => e.id)
		const all = ids.every((id) => selected.has(id))
		setSelected((before) => {
			const next = new Set(before)
			for (const id of ids) all ? next.delete(id) : next.add(id)
			return next
		})
	}
	const chosen = flat.filter((e) => selected.has(e.id))
	const toWatch = chosen.filter((e) => !watched(e) && aired(e))
	const toUnwatch = chosen.filter(watched)
	const bulk = (list: PageEpisode[], act: (e: PageEpisode) => void) => {
		for (const e of list) act(e)
		setSelected(new Set())
	}

	const onKey = (event: React.KeyboardEvent) => {
		const target = event.target as HTMLElement
		if (target.tagName === "INPUT" || target.tagName === "SELECT") return
		const at = flat.findIndex((e) => e.id === cursor)
		const move = (d: number) => {
			const e = flat[Math.max(0, Math.min(flat.length - 1, (at < 0 ? -1 : at) + d))]
			if (e) focusRow(e.id)
			event.preventDefault()
		}
		if (event.key === "j" || event.key === "ArrowDown") move(1)
		else if (event.key === "k" || event.key === "ArrowUp") move(-1)
		else if ((event.key === "x" || event.key === "X" || event.key === " ") && cursor !== null) {
			event.preventDefault()
			const e = flat[at]
			if (e && aired(e)) toggle(cursor, event.shiftKey)
		} else if (event.key === "Enter" && cursor !== null) {
			event.preventDefault()
			setOpen((o) => (o === cursor ? null : cursor))
		} else if (event.key === "Escape") setSelected(new Set())
	}

	const jumpNext = () => {
		if (nextId === null) return
		setQuery("")
		setFilter("all")
		requestAnimationFrame(() => focusRow(nextId))
	}
	const jumpSeason = (n: number) => {
		table.current
			?.querySelector<HTMLElement>(`[data-season-head="${n}"]`)
			?.scrollIntoView({ block: "start", behavior: "smooth" })
	}
	const total = seasons.reduce((n, s) => n + s.episodes.filter((e) => s.number > 0 && aired(e)).length, 0)
	const done = seasons.reduce((n, s) => n + s.episodes.filter((e) => s.number > 0 && watched(e)).length, 0)

	return (
		<section aria-labelledby="ep-e-title" className="[overflow-anchor:none]">
			<div className="flex items-baseline justify-between gap-3">
				<h2 id="ep-e-title" className="text-2xl font-bold">
					Episodes
				</h2>
				<span className="text-sm tabular-nums text-gray-400">
					{done}/{total} watched
				</span>
			</div>

			{/* Toolbar */}
			<div className="mt-4 flex flex-wrap items-center gap-2">
				<label className="relative min-w-0 flex-1 basis-56">
					<MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
					<input
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search name, S2E5, or season 3"
						className={`h-9 w-full rounded-lg bg-white/10 pl-8 pr-2 text-sm text-white placeholder:text-gray-500 ${FOCUS}`}
					/>
				</label>
				<div role="radiogroup" aria-label="Show" className="flex rounded-lg bg-white/10 p-0.5">
					{FILTERS.map(([key, label]) => (
						<button
							key={key}
							type="button"
							role="radio"
							aria-checked={filter === key}
							onClick={() => setFilter(key)}
							className={`h-8 rounded-md px-2.5 text-xs font-semibold cursor-pointer ${FOCUS} ${filter === key ? "bg-white text-black" : "text-gray-300 hover:text-white"}`}
						>
							{label}
						</button>
					))}
				</div>
				<button
					type="button"
					onClick={() => setSort((s) => (s === "order" ? "score" : "order"))}
					className={`${CHIP} bg-white/10 text-gray-100 hover:bg-white/20`}
				>
					Sort: {sort === "order" ? "Order" : "Score"}
				</button>
				<label className="relative">
					<span className="sr-only">Jump to season</span>
					<select
						onChange={(e) => jumpSeason(Number(e.target.value))}
						value=""
						className={`h-9 appearance-none rounded-lg bg-white/10 pl-2.5 pr-7 text-xs font-semibold text-gray-100 ${FOCUS}`}
					>
						<option value="" disabled>
							Season…
						</option>
						{groups.map((g) => (
							<option key={g.season.number} value={g.season.number} className="bg-gray-900">
								{seasonTitle(g.season.number)}
							</option>
						))}
					</select>
					<ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
				</label>
				{nextId !== null && (
					<button type="button" onClick={jumpNext} className={`${CHIP} bg-sky-500 text-black hover:bg-sky-400`}>
						Jump to Next
					</button>
				)}
			</div>
			<p className="mt-2 hidden text-xs text-gray-500 lg:block">
				Keys: j/k move · x select · shift+x range · Enter open · Esc clear. Shift-click selects a range.
			</p>

			{/* Table */}
			<div
				ref={table}
				onKeyDown={onKey}
				role="grid"
				aria-label="Episodes"
				aria-multiselectable
				className={`mt-3 rounded-xl border border-white/[0.06] ${SURFACE}`}
			>
				<div className="hidden grid-cols-[2rem_4rem_1fr_7rem_3rem_6rem] gap-2 border-b border-white/[0.06] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 lg:grid">
					<span />
					<span>#</span>
					<span>Name</span>
					<span>Aired</span>
					<span>IMDb</span>
					<span className="text-right">Watched</span>
				</div>
				{groups.length === 0 && <p className="p-6 text-center text-sm text-gray-400">No episodes match.</p>}
				{groups.map(({ season, episodes }) => {
					const pick = episodes.filter(aired)
					const all = pick.length > 0 && pick.every((e) => selected.has(e.id))
					const some = pick.some((e) => selected.has(e.id))
					const w = season.episodes.filter(watched).length
					const score = page?.seasonScores[String(season.number)] ?? null
					return (
						<div key={season.number} role="rowgroup">
							<div
								data-season-head={season.number}
								className={`sticky top-0 z-10 flex h-10 items-center gap-2 border-b border-white/[0.06] px-3 ${SURFACE}`}
								style={{ scrollMarginTop: 140 }}
							>
								<button
									type="button"
									role="checkbox"
									aria-checked={all ? true : some ? "mixed" : false}
									aria-label={`Select ${seasonTitle(season.number)}`}
									onClick={() => toggleSeason(episodes)}
									disabled={!pick.length}
									className={`flex h-8 w-8 items-center justify-center rounded cursor-pointer disabled:opacity-30 ${FOCUS}`}
								>
									<span className={`${BOX} ${all || some ? "border-white bg-white text-black" : "border-gray-500"}`}>
										{all ? <CheckIcon className="h-3 w-3" /> : some ? <span className="h-0.5 w-2 bg-black" /> : null}
									</span>
								</button>
								<span className="text-sm font-bold">{seasonTitle(season.number)}</span>
								<span className="text-xs tabular-nums text-gray-400">
									{w}/{season.episodes.length}
								</span>
								<div className="ml-auto flex items-center gap-2">
									{score !== null && <ScoreTile score={score} title="Season average" />}
								</div>
							</div>
							{episodes.map((e) => (
								<Row
									key={e.id}
									e={e}
									isNext={e.id === nextId}
									isAired={aired(e)}
									isWatched={watched(e)}
									isSelected={selected.has(e.id)}
									isCursor={cursor === e.id}
									isOpen={open === e.id}
									revealed={revealed.has(e.id)}
									today={today}
									onSelect={(range) => toggle(e.id, range)}
									onFocus={() => setCursor(e.id)}
									onOpen={() => setOpen((o) => (o === e.id ? null : e.id))}
									onReveal={() => setRevealed((r) => new Set(r).add(e.id))}
									onTick={() => (watched(e) ? actions.unwatch(e) : actions.watch(e))}
									onUpTo={() => actions.watchUpTo(e)}
								/>
							))}
						</div>
					)
				})}
				{/* Bulk bar: always takes its height so selecting never shifts the page. */}
				<div className={`sticky bottom-0 z-20 h-14 rounded-b-xl border-t border-white/[0.06] ${SURFACE}`}>
					<div
						className={`flex h-full items-center gap-2 px-3 transition-opacity duration-150 ${chosen.length ? "opacity-100" : "pointer-events-none opacity-0"}`}
						aria-hidden={!chosen.length}
					>
						<span className="mr-auto text-sm font-semibold tabular-nums">{chosen.length} selected</span>
						<button
							type="button"
							disabled={!toWatch.length}
							onClick={() => bulk(toWatch, actions.watch)}
							className={`${CHIP} bg-green-500 text-black hover:bg-green-400 disabled:opacity-40`}
						>
							<CheckIcon className="h-3.5 w-3.5" />
							Mark {toWatch.length} watched
						</button>
						<button
							type="button"
							disabled={!toUnwatch.length}
							onClick={() => bulk(toUnwatch, actions.unwatch)}
							className={`${CHIP} text-pink-300 hover:bg-white/10 disabled:opacity-40`}
						>
							Mark unwatched
						</button>
						<button type="button" onClick={() => setSelected(new Set())} className={`${CHIP} text-gray-300 hover:bg-white/10`}>
							Clear
						</button>
					</div>
				</div>
			</div>
			<TrackingToastHost tracking={tracking} actions={actions} />
		</section>
	)
}

function Row(p: {
	e: PageEpisode
	isNext: boolean
	isAired: boolean
	isWatched: boolean
	isSelected: boolean
	isCursor: boolean
	isOpen: boolean
	revealed: boolean
	today: string
	onSelect: (range: boolean) => void
	onFocus: () => void
	onOpen: () => void
	onReveal: () => void
	onTick: () => void
	onUpTo: () => void
}) {
	const { e } = p
	const label = episodeLabel(e)
	const covered = !p.isWatched && !p.revealed
	return (
		<div className="border-b border-white/[0.04]">
			<div
				data-row={e.id}
				role="row"
				aria-selected={p.isSelected}
				tabIndex={p.isCursor ? 0 : -1}
				onFocus={p.onFocus}
				onClick={p.onOpen}
				className={`grid cursor-pointer grid-cols-[2.25rem_1fr_auto] items-center gap-x-2 px-3 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white lg:grid-cols-[2rem_4rem_1fr_7rem_3rem_6rem] lg:py-0 lg:h-10 ${p.isSelected ? "bg-sky-500/15" : "hover:bg-white/[0.04]"} ${p.isAired ? "" : "opacity-50"} ${p.isNext ? "shadow-[inset_3px_0_0_rgb(56,189,248)]" : ""}`}
			>
				<button
					type="button"
					role="checkbox"
					aria-checked={p.isSelected}
					aria-label={`Select ${label}`}
					disabled={!p.isAired}
					onClick={(ev) => {
						ev.stopPropagation()
						p.onSelect(ev.shiftKey)
					}}
					className={`row-span-2 flex h-9 w-9 items-center justify-center rounded cursor-pointer disabled:cursor-not-allowed lg:row-span-1 lg:h-8 lg:w-8 ${FOCUS}`}
				>
					<span className={`${BOX} ${p.isSelected ? "border-sky-400 bg-sky-400 text-black" : "border-gray-500"}`}>
						{p.isSelected && <CheckIcon className="h-3 w-3" />}
					</span>
				</button>
				{/* Phone: two lines. Desktop: the columns. */}
				<span className="hidden text-xs tabular-nums text-gray-400 lg:block">{label}</span>
				<span className="min-w-0 truncate text-sm">
					<span className="mr-1.5 text-xs tabular-nums text-gray-400 lg:hidden">{label}</span>
					{e.name ?? label}
					{p.isNext && <span className="ml-2 rounded bg-sky-500 px-1.5 py-0.5 text-[10px] font-bold text-black">NEXT</span>}
				</span>
				<span className="hidden text-xs tabular-nums text-gray-400 lg:block">
					{e.airDate ? formatDay(e.airDate, p.today) : "TBA"}
				</span>
				<span className="hidden lg:block">
					<ScoreTile score={e.rating} />
				</span>
				<span className="row-span-2 flex justify-end lg:row-span-1">
					<button
						type="button"
						disabled={!p.isAired}
						onClick={(ev) => {
							ev.stopPropagation()
							p.onTick()
						}}
						aria-pressed={p.isWatched}
						aria-label={`Watched: ${label}`}
						className={`inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold cursor-pointer disabled:cursor-not-allowed lg:h-7 ${FOCUS} ${p.isWatched ? "text-green-300 hover:bg-white/10" : "text-gray-500 hover:bg-white/10 hover:text-white"}`}
					>
						<CheckIcon className={`h-4 w-4 ${p.isWatched ? "" : "opacity-40"}`} />
						<span className="hidden sm:inline">{p.isWatched ? "Watched" : p.isAired ? "Mark" : "Soon"}</span>
					</button>
				</span>
				<span className="col-start-2 flex items-center gap-2 text-xs tabular-nums text-gray-400 lg:hidden">
					{e.airDate ? formatDay(e.airDate, p.today) : "TBA"}
					<ScoreTile score={e.rating} />
				</span>
			</div>
			{p.isOpen && (
				<div className="flex flex-col gap-3 px-3 pb-3 pt-1 sm:flex-row lg:pl-[6.5rem]">
					<div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-md bg-white/[0.06] sm:w-56">
						{e.still && !covered && (
							<img src={tmdbImageUrl(e.still, "w300")} alt="" className="h-full w-full object-cover" />
						)}
						{covered && (
							<button
								type="button"
								onClick={p.onReveal}
								className={`absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-300 hover:text-white cursor-pointer ${FOCUS}`}
							>
								Show still and description
							</button>
						)}
					</div>
					<div className="min-w-0 text-sm text-gray-300">
						<p>{covered ? "Hidden to avoid spoilers." : (e.overview ?? "No description.")}</p>
						{p.isAired && !p.isWatched && (
							<button
								type="button"
								onClick={p.onUpTo}
								className={`${CHIP} mt-3 bg-white/10 text-green-300 ring-1 ring-green-400/40 hover:bg-white/20`}
							>
								<CheckIcon className="h-3.5 w-3.5" />
								Watched up to here
							</button>
						)}
					</div>
				</div>
			)}
		</div>
	)
}
