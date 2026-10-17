// PROTOTYPE - throwaway. Variant B of the title page's episodes section: season tabs + episode cards.
// A sticky, scrollable season tab strip (sparkline of ratings + watched fraction per season), then the chosen
// season's episodes as wide cards. Cards expand in place for the description and the date actions.
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/24/solid"
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react"
import { displayNumber, displaySeason } from "~/domain/tracking/machine"
import type { PageEpisode } from "~/domain/tracking/show-page"
import { HEADER_HEIGHT } from "~/ui/details/header-height"
import { imdbVibe, vibeTileColor } from "~/ui/details/episode-grid/scale"
import { ScoreTile } from "~/ui/tracking/EpisodeList"
import { TrackingToastHost } from "~/ui/tracking/TrackingToast"
import { type TrackingActions, useTrackingActions } from "~/ui/tracking/actions"
import {
	FOCUS,
	SURFACE,
	type Season,
	type ShowTracking,
	formatDay,
	seasonShort,
	seasonTitle,
	useShowTracking,
} from "~/ui/tracking/store"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { VariantProps } from "./types"

const CHIP = `inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold cursor-pointer lg:h-8 ${FOCUS}`
const CHIP_OFF = "bg-white/10 text-gray-100 hover:bg-white/20"
const CHIP_ON = "bg-white text-black"

export default function VariantB({ media, gridNode }: VariantProps) {
	const tracking = useShowTracking(media.details.tmdb_id)
	const actions = useTrackingActions(tracking.store, media.details.title)
	if (!tracking.ready || !tracking.view)
		return tracking.failed ? <>{gridNode}</> : <p className="h-96 text-sm text-gray-500">Loading episodes…</p>
	return <Tabs tracking={tracking} actions={actions} />
}

function Tabs({ tracking, actions }: { tracking: ShowTracking; actions: TrackingActions }) {
	const view = tracking.view!
	const { seasons, today } = tracking
	const nextId = view.derived.next?.id ?? null
	const next = useMemo(
		() => seasons.flatMap((s) => s.episodes).find((e) => e.id === nextId) ?? null,
		[seasons, nextId],
	)
	const [picked, setPicked] = useState<number>(
		() => (next ? displaySeason(next) : seasons[0]?.number) ?? 0,
	)
	const [hideWatched, setHideWatched] = useState(false)
	const [opened, setOpened] = useState<number | null>(null)
	const tabRefs = useRef<Record<number, HTMLButtonElement | null>>({})
	const season = seasons.find((s) => s.number === picked) ?? seasons[0]
	const aired = (e: PageEpisode) => e.airDate !== null && e.airDate <= today
	const counts = (s: Season) => {
		const airedOnes = s.episodes.filter(aired)
		const watched = s.episodes.filter((e) => view.watched.has(e.id)).length
		return { total: s.episodes.length, aired: airedOnes.length, watched }
	}

	useEffect(() => {
		tabRefs.current[picked]?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" })
	}, [picked])

	const onKey = (event: KeyboardEvent) => {
		const i = seasons.findIndex((s) => s.number === picked)
		let to = -1
		if (event.key === "ArrowRight") to = Math.min(seasons.length - 1, i + 1)
		else if (event.key === "ArrowLeft") to = Math.max(0, i - 1)
		else if (event.key === "Home") to = 0
		else if (event.key === "End") to = seasons.length - 1
		if (to < 0) return
		event.preventDefault()
		const s = seasons[to]
		setPicked(s.number)
		setOpened(null)
		tabRefs.current[s.number]?.focus()
	}

	if (!season) return null
	const c = counts(season)
	const shown = hideWatched ? season.episodes.filter((e) => !view.watched.has(e.id)) : season.episodes
	const seasonDone = c.aired > 0 && c.watched >= c.aired

	return (
		<section aria-labelledby="eps-b-head" className="flex flex-col gap-3">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h2 id="eps-b-head" className="text-2xl font-bold">Episodes</h2>
				{next && (
					<button
						type="button"
						className={`${CHIP} ${CHIP_OFF}`}
						onClick={() => {
							setPicked(displaySeason(next))
							setOpened(next.id)
							requestAnimationFrame(() =>
								document.querySelector(`[data-b-ep="${next.id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }),
							)
						}}
					>
						Next: S{displaySeason(next)} E{displayNumber(next)}
					</button>
				)}
			</div>

			{/* The tab strip sticks under the page header while the member scrolls the season. */}
			<div className={`sticky z-10 -mx-4 px-4 py-2 sm:mx-0 sm:rounded-xl sm:px-2 ${SURFACE}`} style={{ top: HEADER_HEIGHT }}>
				<div
					role="tablist"
					aria-label="Seasons"
					onKeyDown={onKey}
					className="flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
				>
					{seasons.map((s) => {
						const sc = counts(s)
						const on = s.number === picked
						const done = sc.aired > 0 && sc.watched >= sc.aired
						return (
							<button
								key={s.number}
								ref={(el) => { tabRefs.current[s.number] = el }}
								type="button"
								role="tab"
								id={`eps-b-tab-${s.number}`}
								aria-selected={on}
								aria-controls="eps-b-panel"
								tabIndex={on ? 0 : -1}
								onClick={() => { setPicked(s.number); setOpened(null) }}
								className={`flex w-28 shrink-0 snap-start cursor-pointer flex-col gap-1.5 rounded-lg p-2 text-left transition-opacity ${FOCUS} ${on ? "bg-white/[0.12] ring-1 ring-white/30" : "opacity-70 hover:bg-white/[0.06] hover:opacity-100"}`}
							>
								<span className="flex items-center justify-between text-xs font-semibold">
									<span>{seasonShort(s.number)}</span>
									<span className={`tabular-nums ${done ? "text-green-400" : "text-gray-400"}`}>
										{done ? <CheckIcon className="h-3.5 w-3.5" aria-label="watched" /> : `${sc.watched}/${sc.aired || sc.total}`}
									</span>
								</span>
								<Sparkline episodes={s.episodes} />
								<span className="h-0.5 overflow-hidden rounded bg-white/10">
									<span
										className="block h-full origin-left bg-sky-400 transition-transform"
										style={{ transform: `scaleX(${sc.aired ? sc.watched / sc.aired : 0})` }}
									/>
								</span>
							</button>
						)
					})}
				</div>
			</div>

			<div id="eps-b-panel" role="tabpanel" aria-labelledby={`eps-b-tab-${picked}`} className="flex flex-col gap-2">
				<div className="flex flex-wrap items-center gap-2">
					<h3 className="mr-auto text-base font-semibold">
						{seasonTitle(season.number)}{" "}
						<span className="font-normal text-gray-400">· {c.watched} of {c.aired || c.total} watched</span>
					</h3>
					<button
						type="button"
						aria-pressed={hideWatched}
						onClick={() => setHideWatched((v) => !v)}
						className={`${CHIP} ${hideWatched ? CHIP_ON : CHIP_OFF}`}
					>
						Hide watched
					</button>
					{seasonDone ? (
						<button type="button" className={`${CHIP} ${CHIP_OFF}`} onClick={() => actions.unmarkSeason(season.number)}>
							Unmark season
						</button>
					) : (
						<button type="button" className={`${CHIP} bg-sky-500 text-black hover:bg-sky-400`} onClick={() => actions.markSeason(season.number)}>
							<CheckIcon className="h-4 w-4" /> Mark season watched
						</button>
					)}
				</div>

				{shown.length === 0 && (
					<p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-400">
						Every episode of this season is watched.
					</p>
				)}
				<ol className="flex flex-col gap-2">
					{shown.map((e) => (
						<Card
							key={e.id}
							episode={e}
							watched={view.watched.has(e.id)}
							isNext={e.id === nextId}
							aired={aired(e)}
							today={today}
							open={opened === e.id}
							onOpen={() => setOpened((o) => (o === e.id ? null : e.id))}
							actions={actions}
						/>
					))}
				</ol>
			</div>
			<TrackingToastHost tracking={tracking} actions={actions} />
		</section>
	)
}

function Sparkline({ episodes }: { episodes: PageEpisode[] }) {
	const max = 10
	return (
		<span className="flex h-5 items-end gap-px" aria-hidden>
			{episodes.slice(0, 26).map((e) => (
				<span
					key={e.id}
					className="w-full min-w-[2px] rounded-[1px]"
					style={{
						height: e.rating === null ? "15%" : `${Math.max(15, ((e.rating - 4) / (max - 4)) * 100)}%`,
						background: e.rating === null ? "rgba(255,255,255,0.15)" : vibeTileColor(imdbVibe(e.rating)),
					}}
				/>
			))}
		</span>
	)
}

function Card({
	episode: e,
	watched,
	isNext,
	aired,
	today,
	open,
	onOpen,
	actions,
}: {
	episode: PageEpisode
	watched: boolean
	isNext: boolean
	aired: boolean
	today: string
	open: boolean
	onOpen: () => void
	actions: TrackingActions
}) {
	const [revealed, setRevealed] = useState(false)
	const covered = !watched && !revealed
	return (
		<li
			data-b-ep={e.id}
			className={`overflow-hidden rounded-xl border ${SURFACE} ${isNext ? "border-sky-400/70 ring-1 ring-sky-400/40" : "border-white/[0.06]"} ${!aired ? "opacity-60" : ""}`}
		>
			<div className="flex items-stretch gap-3 p-2">
				{/* Fixed still box: 16:9, so nothing shifts when the image arrives or is revealed. */}
				<button
					type="button"
					onClick={() => (covered && e.still ? setRevealed(true) : onOpen())}
					className={`relative aspect-video w-28 shrink-0 cursor-pointer overflow-hidden rounded-md bg-white/[0.06] sm:w-40 ${FOCUS}`}
					aria-label={covered ? "Show the still" : "Open episode"}
				>
					{e.still && (
						<img
							src={tmdbImageUrl(e.still, "w300")}
							alt=""
							loading="lazy"
							className={`h-full w-full object-cover transition-opacity ${covered ? "opacity-0" : "opacity-100"}`}
						/>
					)}
					{covered && e.still && (
						<span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-gray-400">
							Tap to reveal
						</span>
					)}
					{watched && (
						<span className="absolute inset-0 bg-black/40" aria-hidden />
					)}
				</button>
				<button type="button" onClick={onOpen} aria-expanded={open} className={`flex min-w-0 flex-1 cursor-pointer flex-col justify-center gap-1 text-left ${FOCUS}`}>
					<span className="flex items-center gap-2 text-xs text-gray-400">
						<span className="font-semibold tabular-nums text-gray-200">E{displayNumber(e)}</span>
						{isNext && <span className="rounded bg-sky-500 px-1.5 py-px text-[10px] font-bold uppercase text-black">Next</span>}
						{e.airDate && <span>{aired ? formatDay(e.airDate, today) : `Airs ${formatDay(e.airDate, today)}`}</span>}
						{e.runtime && <span className="hidden sm:inline">· {e.runtime} min</span>}
					</span>
					<span className={`truncate text-sm font-semibold ${watched ? "text-gray-400" : "text-white"}`}>
						{e.name ?? `Episode ${displayNumber(e)}`}
					</span>
				</button>
				<div className="flex shrink-0 items-center gap-2">
					<ScoreTile score={e.rating} title="IMDb rating" className="h-7 min-w-10 text-xs" />
					<button
						type="button"
						disabled={!aired}
						aria-pressed={watched}
						aria-label={watched ? "Mark not watched" : "Mark watched"}
						onClick={() => (watched ? actions.unwatch(e) : actions.watch(e))}
						className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-transform active:scale-90 disabled:cursor-not-allowed ${FOCUS} ${watched ? "bg-green-500 text-black" : "bg-white/10 text-gray-300 hover:bg-white/20"}`}
					>
						<CheckIcon className="h-5 w-5" />
					</button>
					<ChevronDownIcon
						aria-hidden
						className={`hidden h-4 w-4 text-gray-500 transition-transform sm:block ${open ? "rotate-180" : ""}`}
					/>
				</div>
			</div>
			{open && (
				<div className="flex flex-col gap-3 border-t border-white/[0.06] p-3 text-sm">
					{e.overview ? (
						covered ? (
							<button type="button" className={`${CHIP} ${CHIP_OFF} self-start`} onClick={() => setRevealed(true)}>
								Show description (may spoil)
							</button>
						) : (
							<p className="text-gray-300">{e.overview}</p>
						)
					) : (
						<p className="text-gray-500">No description.</p>
					)}
					{aired && (
						<div className="flex flex-wrap gap-2">
							{!watched && (
								<button type="button" className={`${CHIP} ${CHIP_OFF}`} onClick={() => actions.watchUpTo(e)}>
									Watched up to here
								</button>
							)}
							{!watched && (
								<button type="button" className={`${CHIP} ${CHIP_OFF}`} onClick={() => actions.watch(e, { precision: "unknown" })}>
									Watched, date unknown
								</button>
							)}
							{watched && (
								<button type="button" className={`${CHIP} ${CHIP_OFF}`} onClick={() => actions.unwatch(e)}>
									Mark not watched
								</button>
							)}
						</div>
					)}
				</div>
			)}
		</li>
	)
}
