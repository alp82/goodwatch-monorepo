// PROTOTYPE - throwaway. Variant D of the title page's episodes section: the ratings map is the navigator.
// One row per season, a cell per episode in its rating's colour. A press selects a cell and the detail pane
// shows it: beside the map on a wide screen (sticky), under the selected season's row on a phone. Arrow keys
// move the selection, Enter toggles watched, Home/End jump in the row. Shift-click or press-and-drag across a
// season's cells selects a range to mark watched in one go.
import {
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
} from "@heroicons/react/24/solid"
import { useEffect, useMemo, useRef, useState } from "react"
import {
	displayNumber,
	displaySeason,
	episodeLabel,
} from "~/domain/tracking/machine"
import type { PageEpisode } from "~/domain/tracking/show-page"
import {
	formatScore,
	imdbVibe,
	vibeTileColor,
} from "~/ui/details/episode-grid/scale"
import { ScoreTile } from "~/ui/tracking/EpisodeList"
import { TrackingToastHost } from "~/ui/tracking/TrackingToast"
import { type TrackingActions, useTrackingActions } from "~/ui/tracking/actions"
import {
	FOCUS,
	SURFACE,
	type ShowTracking,
	formatDay,
	seasonShort,
	seasonTitle,
	useShowTracking,
} from "~/ui/tracking/store"
import { useEpisodeTracking } from "~/ui/tracking/gate"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { VariantProps } from "./types"

export default function VariantD({ media, gridNode }: VariantProps) {
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
	return <RatingsMap tracking={tracking} actions={actions} />
}

type Row = { number: number; episodes: PageEpisode[] }

function useWide() {
	const [wide, setWide] = useState(false)
	useEffect(() => {
		const q = window.matchMedia("(min-width: 1024px)")
		const set = () => setWide(q.matches)
		set()
		q.addEventListener("change", set)
		return () => q.removeEventListener("change", set)
	}, [])
	return wide
}

const avg = (eps: PageEpisode[]) => {
	const r = eps.map((e) => e.rating).filter((r): r is number => r != null)
	return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null
}

function RatingsMap({
	tracking,
	actions,
}: { tracking: ShowTracking; actions: TrackingActions }) {
	const view = tracking.view!
	const wide = useWide()
	// Rows by display season, specials last.
	const rows: Row[] = useMemo(() => {
		const by = new Map<number, PageEpisode[]>()
		for (const s of tracking.seasons)
			for (const e of s.episodes) {
				const n = s.number === 0 ? 0 : displaySeason(e)
				by.set(n, [...(by.get(n) ?? []), e])
			}
		return [...by.entries()]
			.sort(([a], [b]) => (a === 0 ? 1 : b === 0 ? -1 : a - b))
			.map(([number, episodes]) => ({ number, episodes }))
	}, [tracking.seasons])
	const flat = useMemo(() => rows.flatMap((r) => r.episodes), [rows])
	const nextId = view.derived.next?.id ?? null
	const [sel, setSel] = useState<number | null>(
		nextId ?? flat[0]?.id ?? null,
	)
	const [range, setRange] = useState<{ a: number; b: number } | null>(null)
	const drag = useRef<number | null>(null)
	const cellRefs = useRef(new Map<number, HTMLButtonElement>())

	const pos = (id: number | null) => {
		for (let r = 0; r < rows.length; r++) {
			const c = rows[r].episodes.findIndex((e) => e.id === id)
			if (c >= 0) return { r, c }
		}
		return null
	}
	const selected = flat.find((e) => e.id === sel) ?? null
	const rangeIds = useMemo(() => {
		if (!range) return new Set<number>()
		const i = flat.findIndex((e) => e.id === range.a)
		const j = flat.findIndex((e) => e.id === range.b)
		const [lo, hi] = i < j ? [i, j] : [j, i]
		return new Set(flat.slice(lo, hi + 1).map((e) => e.id))
	}, [range, flat])

	const focus = (id: number) => {
		setSel(id)
		cellRefs.current.get(id)?.focus({ preventScroll: false })
	}
	const toggle = (e: PageEpisode) =>
		view.watched.has(e.id) ? actions.unwatch(e) : actions.watch(e)

	const markRange = () => {
		const ids = [...rangeIds]
		const todo = flat.filter(
			(e) => ids.includes(e.id) && !view.watched.has(e.id) && aired(e),
		)
		if (!todo.length) return setRange(null)
		const last = todo[todo.length - 1]
		const before = flat.slice(0, flat.indexOf(todo[0]))
		// When everything before the range is watched, one "up to here" covers it and has one Undo.
		if (before.every((e) => e.season === 0 || view.watched.has(e.id) || !aired(e)))
			actions.watchUpTo(last)
		else for (const e of todo) actions.watch(e)
		setRange(null)
	}
	const aired = (e: PageEpisode) => !!e.airDate && e.airDate <= tracking.today

	const onKey = (ev: React.KeyboardEvent) => {
		const p = pos(sel)
		if (!p) return
		const row = rows[p.r].episodes
		let to: PageEpisode | undefined
		if (ev.key === "ArrowRight") to = row[p.c + 1] ?? rows[p.r + 1]?.episodes[0]
		else if (ev.key === "ArrowLeft")
			to = row[p.c - 1] ?? rows[p.r - 1]?.episodes.at(-1)
		else if (ev.key === "ArrowDown") {
			const n = rows[p.r + 1]?.episodes
			to = n?.[Math.min(p.c, n.length - 1)]
		} else if (ev.key === "ArrowUp") {
			const n = rows[p.r - 1]?.episodes
			to = n?.[Math.min(p.c, n.length - 1)]
		} else if (ev.key === "Home") to = row[0]
		else if (ev.key === "End") to = row.at(-1)
		else if (ev.key === "Enter" || ev.key === " ") {
			ev.preventDefault()
			if (rangeIds.size > 1) markRange()
			else if (selected) toggle(selected)
			return
		} else if (ev.key === "Escape") return setRange(null)
		if (!to) return
		ev.preventDefault()
		if (ev.shiftKey) setRange((r) => ({ a: r?.a ?? sel!, b: to!.id }))
		else setRange(null)
		focus(to.id)
	}

	useEffect(() => {
		const up = () => (drag.current = null)
		window.addEventListener("pointerup", up)
		return () => window.removeEventListener("pointerup", up)
	}, [])

	const watchedCount = flat.filter(
		(e) => e.season !== 0 && view.watched.has(e.id),
	).length
	const total = flat.filter((e) => e.season !== 0).length
	const selRow = pos(sel)?.r ?? -1
	const pane = selected && (
		<Pane
			episode={selected}
			flat={flat}
			tracking={tracking}
			actions={actions}
			onGo={focus}
		/>
	)

	return (
		<section>
			<div className="mb-4 flex flex-wrap items-end justify-between gap-3">
				<h2 className="text-2xl font-bold">Episodes</h2>
				<p className="text-sm text-gray-400">
					<span className="font-semibold text-white">{watchedCount}</span> of{" "}
					{total} watched
				</p>
			</div>
			<div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6">
				<div
					className={`rounded-xl border border-white/[0.06] p-3 sm:p-4 ${SURFACE}`}
					role="grid"
					aria-label="Episodes by season"
					onKeyDown={onKey}
				>
					<div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-400">
						<Legend />
						<span className="ml-auto hidden sm:inline">
							Arrows move · Enter marks · Shift or drag selects a range
						</span>
					</div>
					<div className="flex flex-col gap-1.5">
						{rows.map((row, r) => (
							<div key={row.number}>
								<div className="flex items-center gap-2" role="row">
									<span className="w-9 shrink-0 text-xs font-semibold text-gray-300">
										{row.number === 0 ? "Sp" : seasonShort(row.number)}
									</span>
									<div className="flex min-w-0 flex-1 gap-1 overflow-x-auto p-1 [scrollbar-width:thin]">
										{row.episodes.map((e) => {
											const w = view.watched.has(e.id)
											const isSel = e.id === sel
											const inRange = rangeIds.has(e.id)
											const isNext = e.id === nextId
											return (
												<button
													key={e.id}
													ref={(el) => {
														el
															? cellRefs.current.set(e.id, el)
															: cellRefs.current.delete(e.id)
													}}
													type="button"
													role="gridcell"
													aria-selected={isSel}
													tabIndex={isSel ? 0 : -1}
													aria-label={`${episodeLabel(e)}${e.name ? `, ${e.name}` : ""}${w ? ", watched" : ""}`}
													onPointerDown={(ev) => {
														if (ev.shiftKey && sel != null) {
															setRange({ a: sel, b: e.id })
														} else {
															drag.current = e.id
															setRange(null)
														}
														setSel(e.id)
													}}
													onPointerEnter={() => {
														if (drag.current != null && drag.current !== e.id) {
															setRange({ a: drag.current, b: e.id })
															setSel(e.id)
														}
													}}
													className={`relative flex size-8 shrink-0 cursor-pointer select-none items-center justify-center rounded-[4px] text-[11px] font-semibold tabular-nums text-white transition-[opacity,transform] lg:size-9 ${FOCUS} ${w ? "opacity-40" : ""} ${isSel ? "z-10 scale-110 ring-2 ring-white" : ""} ${inRange && !isSel ? "ring-2 ring-sky-400" : ""} ${isNext && !isSel ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-[#141923]" : ""}`}
													style={{
														background:
															e.rating != null
																? vibeTileColor(imdbVibe(e.rating))
																: "rgba(255,255,255,0.08)",
														touchAction: "none",
													}}
												>
													<span className="hidden lg:inline">
														{e.rating != null ? formatScore(e.rating) : displayNumber(e)}
													</span>
													<span className="lg:hidden">{displayNumber(e)}</span>
													{w && (
														<CheckIcon className="absolute right-0 top-0 size-3 text-white" />
													)}
												</button>
											)
										})}
									</div>
									<span className="w-10 shrink-0 text-right">
										<ScoreTile
											score={avg(row.episodes)}
											title={`${seasonTitle(row.number)} average`}
										/>
									</span>
								</div>
								{!wide && r === selRow && <div className="my-2">{pane}</div>}
							</div>
						))}
					</div>
					{rangeIds.size > 1 && (
						<div className="mt-3 flex items-center gap-2 text-sm">
							<span className="text-gray-300">
								{rangeIds.size} episodes selected
							</span>
							<button
								type="button"
								onClick={markRange}
								className={`h-9 cursor-pointer rounded-lg bg-white px-3 text-xs font-semibold text-black hover:bg-gray-200 ${FOCUS}`}
							>
								Mark as watched
							</button>
							<button
								type="button"
								onClick={() => setRange(null)}
								className={`h-9 cursor-pointer rounded-lg bg-white/10 px-3 text-xs font-semibold hover:bg-white/20 ${FOCUS}`}
							>
								Clear
							</button>
						</div>
					)}
				</div>
				{wide && <div className="sticky top-24">{pane}</div>}
			</div>
			<TrackingToastHost tracking={tracking} actions={actions} />
		</section>
	)
}

function Legend() {
	const steps = [9, 8, 7, 6, 5]
	return (
		<span className="flex items-center gap-1.5">
			{steps.map((s) => (
				<span key={s} className="flex items-center gap-1">
					<span
						className="size-3 rounded-[3px]"
						style={{ background: vibeTileColor(imdbVibe(s)) }}
					/>
					{s}+
				</span>
			))}
			<span className="ml-2 flex items-center gap-1">
				<span className="size-3 rounded-[3px] ring-2 ring-amber-400" /> Next
			</span>
			<span className="flex items-center gap-1">
				<span className="size-3 rounded-[3px] bg-white/30 opacity-40" /> Watched
			</span>
		</span>
	)
}

function Pane({
	episode: e,
	flat,
	tracking,
	actions,
	onGo,
}: {
	episode: PageEpisode
	flat: PageEpisode[]
	tracking: ShowTracking
	actions: TrackingActions
	onGo: (id: number) => void
}) {
	const view = tracking.view!
	const w = view.watched.has(e.id)
	const [revealed, setRevealed] = useState(false)
	useEffect(() => setRevealed(false), [e.id])
	const covered = !w && !revealed
	const i = flat.indexOf(e)
	const prev = flat[i - 1]
	const next = flat[i + 1]
	const aired = !!e.airDate && e.airDate <= tracking.today
	const upTo =
		e.season === 0 || w || !aired
			? 0
			: flat
					.slice(0, i + 1)
					.filter(
						(x) =>
							x.season !== 0 &&
							!view.watched.has(x.id) &&
							!!x.airDate &&
							x.airDate <= tracking.today,
					).length
	const NAV = `flex size-9 cursor-pointer items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 disabled:cursor-default disabled:opacity-30 ${FOCUS}`
	return (
		<div
			className={`flex min-h-[28rem] flex-col gap-3 rounded-xl border border-white/[0.06] p-3 ${SURFACE}`}
		>
			<div className="relative aspect-video overflow-hidden rounded-md bg-white/[0.04]">
				{e.still && (
					<img
						src={tmdbImageUrl(e.still, "w500")}
						alt=""
						className={`size-full object-cover ${covered ? "blur-xl brightness-50" : ""}`}
					/>
				)}
				{covered && (
					<button
						type="button"
						onClick={() => setRevealed(true)}
						className={`absolute inset-0 flex cursor-pointer items-center justify-center text-xs font-semibold text-gray-200 ${FOCUS}`}
					>
						Show still and description
					</button>
				)}
			</div>
			<div className="flex items-start gap-2">
				<div className="min-w-0 flex-1">
					<p className="text-xs text-gray-400">
						{episodeLabel(e)}
						{e.airDate && ` · ${formatDay(e.airDate, tracking.today)}`}
						{e.runtime && ` · ${e.runtime} min`}
					</p>
					<p className="truncate font-semibold">{e.name ?? "Untitled"}</p>
				</div>
				<ScoreTile score={e.rating} className="h-7 min-w-10 text-sm" />
			</div>
			<p
				className={`line-clamp-4 min-h-[5rem] text-sm text-gray-300 ${covered ? "invisible" : ""}`}
			>
				{e.overview ?? "No description."}
			</p>
			<div className="mt-auto flex flex-wrap gap-2">
				<button
					type="button"
					disabled={!aired && !w}
					onClick={() => (w ? actions.unwatch(e) : actions.watch(e))}
					className={`flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-semibold disabled:cursor-default disabled:opacity-40 ${w ? "bg-green-500 text-black" : "bg-white text-black hover:bg-gray-200"} ${FOCUS}`}
				>
					<CheckIcon className="size-4" />
					{w ? "Watched" : aired ? "Mark as watched" : "Not aired"}
				</button>
				{upTo > 1 && (
					<button
						type="button"
						onClick={() => actions.watchUpTo(e)}
						className={`h-9 cursor-pointer rounded-lg bg-white/10 px-3 text-xs font-semibold hover:bg-white/20 ${FOCUS}`}
					>
						Watched up to here ({upTo})
					</button>
				)}
				<span className="ml-auto flex gap-1.5">
					<button
						type="button"
						aria-label="Previous episode"
						disabled={!prev}
						onClick={() => prev && onGo(prev.id)}
						className={NAV}
					>
						<ChevronLeftIcon className="size-4" />
					</button>
					<button
						type="button"
						aria-label="Next episode"
						disabled={!next}
						onClick={() => next && onGo(next.id)}
						className={NAV}
					>
						<ChevronRightIcon className="size-4" />
					</button>
				</span>
			</div>
		</div>
	)
}
