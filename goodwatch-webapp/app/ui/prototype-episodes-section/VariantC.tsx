// PROTOTYPE - throwaway. Variant C of the title page's episodes section: "Up next + carousels".
// A focus card for the Next episode first, then one snap-scroll carousel per season (the active season open, the
// rest under "More seasons"), and the ratings grid behind a disclosure at the foot.
import {
	CheckIcon,
	ChevronDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
} from "@heroicons/react/24/solid"
import { useEffect, useMemo, useRef, useState } from "react"
import { episodeLabel } from "~/domain/tracking/machine"
import type { PageEpisode } from "~/domain/tracking/show-page"
import { ScoreTile } from "~/ui/tracking/EpisodeList"
import { TrackingToastHost } from "~/ui/tracking/TrackingToast"
import { type TrackingActions, useTrackingActions } from "~/ui/tracking/actions"
import {
	FOCUS,
	SURFACE,
	type Season,
	type ShowTracking,
	formatDay,
	seasonTitle,
	useShowTracking,
} from "~/ui/tracking/store"
import { imdbVibe, vibeTileColor } from "~/ui/details/episode-grid/scale"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { VariantProps } from "./types"

const BTN = `inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold cursor-pointer lg:h-9 ${FOCUS}`
const BTN_PRIMARY = `${BTN} bg-amber-400 text-black hover:bg-amber-300`
const BTN_QUIET = `${BTN} bg-white/10 text-gray-100 hover:bg-white/20`
const still = (path: string | null, size = "w300") =>
	path ? tmdbImageUrl(path, size as never) : null

function daysUntil(day: string, today: string) {
	return Math.round((Date.parse(day) - Date.parse(today)) / 86_400_000)
}

export default function VariantC({ media, gridNode }: VariantProps) {
	const tracking = useShowTracking(media.details.tmdb_id)
	const actions = useTrackingActions(tracking.store, media.details.title)
	if (!tracking.ready || !tracking.view) return <>{gridNode}</>
	return (
		<section className="flex flex-col gap-6" aria-label="Episodes">
			<h2 className="text-2xl font-bold">Episodes</h2>
			<Body tracking={tracking} actions={actions} gridNode={gridNode} />
			<TrackingToastHost tracking={tracking} actions={actions} />
		</section>
	)
}

function Body({
	tracking,
	actions,
	gridNode,
}: {
	tracking: ShowTracking
	actions: TrackingActions
	gridNode: React.ReactNode
}) {
	const view = tracking.view!
	const { seasons, today } = tracking
	const aired = (e: PageEpisode) => e.airDate !== null && e.airDate <= today
	const nextId = view.derived.next?.id ?? null
	const all = useMemo(() => seasons.flatMap((s) => s.episodes), [seasons])
	// "Not now" peeks past the Next episode locally; it writes nothing.
	const [skipped, setSkipped] = useState<number[]>([])
	useEffect(() => setSkipped([]), [nextId])
	const focus = useMemo(() => {
		const regular = all.filter((e) => e.season !== 0)
		const start = nextId ? regular.findIndex((e) => e.id === nextId) : -1
		if (start < 0) return null
		return (
			regular
				.slice(start)
				.find((e) => !skipped.includes(e.id) && !view.watched.has(e.id)) ??
			null
		)
	}, [all, nextId, skipped, view.watched])
	const upcoming = useMemo(
		() =>
			all.find(
				(e) => e.season !== 0 && e.airDate !== null && e.airDate > today,
			) ?? null,
		[all, today],
	)
	const activeSeason =
		(focus && seasons.find((s) => s.number === focus.season)?.number) ??
		[...seasons].reverse().find((s) => s.number !== 0 && s.episodes.some(aired))
			?.number ??
		seasons[0]?.number
	const active = seasons.find((s) => s.number === activeSeason)
	const rest = seasons
		.filter((s) => s.number !== activeSeason)
		.sort((a, b) =>
			a.number === 0 ? 1 : b.number === 0 ? -1 : b.number - a.number,
		)
	const [more, setMore] = useState(false)
	const [ratings, setRatings] = useState(false)
	const fresh = !view.tracked

	return (
		<>
			<UpNext
				episode={focus && aired(focus) ? focus : null}
				fresh={fresh}
				upcoming={upcoming}
				today={today}
				watchedCount={view.derived.watched}
				airedCount={view.derived.aired}
				actions={actions}
				onSkip={(e) => setSkipped((s) => [...s, e.id])}
			/>
			{active && (
				<SeasonCarousel
					season={active}
					tracking={tracking}
					actions={actions}
					nextId={focus?.id ?? nextId}
				/>
			)}
			{rest.length > 0 && (
				<div className={`rounded-xl border border-white/[0.06] ${SURFACE}`}>
					<button
						type="button"
						aria-expanded={more}
						onClick={() => setMore((m) => !m)}
						className={`flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-gray-200 hover:bg-white/[0.04] ${FOCUS}`}
					>
						<span>
							More seasons{" "}
							<span className="font-normal text-gray-400">
								· {rest.length}
							</span>
						</span>
						<ChevronDownIcon
							className={`size-5 transition-transform ${more ? "rotate-180" : ""}`}
						/>
					</button>
					{more && (
						<div className="flex flex-col gap-6 border-t border-white/[0.06] p-4">
							{rest.map((s) => (
								<SeasonCarousel
									key={s.number}
									season={s}
									tracking={tracking}
									actions={actions}
									nextId={focus?.id ?? nextId}
								/>
							))}
						</div>
					)}
				</div>
			)}
			{gridNode && (
				<div className={`rounded-xl border border-white/[0.06] ${SURFACE}`}>
					<button
						type="button"
						aria-expanded={ratings}
						onClick={() => setRatings((r) => !r)}
						className={`flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-gray-200 hover:bg-white/[0.04] ${FOCUS}`}
					>
						Ratings overview
						<ChevronDownIcon
							className={`size-5 transition-transform ${ratings ? "rotate-180" : ""}`}
						/>
					</button>
					{ratings && <div className="border-t border-white/[0.06] p-3">{gridNode}</div>}
				</div>
			)}
		</>
	)
}

function UpNext({
	episode,
	fresh,
	upcoming,
	today,
	watchedCount,
	airedCount,
	actions,
	onSkip,
}: {
	episode: PageEpisode | null
	fresh: boolean
	upcoming: PageEpisode | null
	today: string
	watchedCount: number
	airedCount: number
	actions: TrackingActions
	onSkip: (e: PageEpisode) => void
}) {
	const [revealed, setRevealed] = useState(false)
	// The card slides out and the following episode slides in, on transform and opacity only.
	const [leaving, setLeaving] = useState(false)
	const shown = useRef<number | null>(null)
	const [entering, setEntering] = useState(false)
	useEffect(() => {
		const id = episode?.id ?? null
		if (shown.current !== null && id !== shown.current) {
			setEntering(true)
			const t = requestAnimationFrame(() =>
				requestAnimationFrame(() => setEntering(false)),
			)
			setRevealed(false)
			shown.current = id
			return () => cancelAnimationFrame(t)
		}
		shown.current = id
	}, [episode?.id])
	const go = (run: () => void) => {
		setLeaving(true)
		setTimeout(() => {
			run()
			setLeaving(false)
		}, 180)
	}
	const pct = airedCount ? Math.round((watchedCount / airedCount) * 100) : 0

	if (!episode) {
		const days = upcoming?.airDate ? daysUntil(upcoming.airDate, today) : null
		return (
			<div
				className={`flex min-h-40 flex-col justify-center gap-2 rounded-2xl border border-white/[0.06] p-6 ${SURFACE}`}
			>
				<p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
					{watchedCount > 0 ? "You're caught up" : "Nothing to watch yet"}
				</p>
				{upcoming && days !== null ? (
					<p className="text-xl font-bold">
						{episodeLabel(upcoming)}
						{upcoming.name ? ` · ${upcoming.name}` : ""}
						<span className="mt-1 block text-base font-normal text-gray-300">
							{days <= 0
								? "Airs today"
								: days === 1
									? "Airs tomorrow"
									: `Airs in ${days} days`}{" "}
							· {formatDay(upcoming.airDate!, today)}
						</span>
					</p>
				) : (
					<p className="text-lg text-gray-300">
						Every aired episode is watched.
					</p>
				)}
			</div>
		)
	}

	const src = still(episode.still, "w780")
	const moving = leaving
		? "translate-x-[-24px] opacity-0"
		: entering
			? "translate-x-[24px] opacity-0"
			: "translate-x-0 opacity-100"
	return (
		<div
			className={`overflow-hidden rounded-2xl border border-white/[0.06] ${SURFACE}`}
			data-up-next
		>
			<div
				className={`grid gap-0 transition-[transform,opacity] duration-200 ease-out md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] ${moving}`}
			>
				<div className="relative aspect-video bg-black/40">
					{src && revealed ? (
						<img src={src} alt="" className="size-full object-cover" />
					) : (
						<button
							type="button"
							onClick={() => setRevealed(true)}
							disabled={!src}
							className={`flex size-full cursor-pointer flex-col items-center justify-center gap-1 bg-white/[0.04] text-sm font-semibold text-gray-300 hover:bg-white/[0.08] hover:text-white disabled:cursor-default ${FOCUS}`}
						>
							{src ? "Show still" : "No still"}
							{src && (
								<span className="text-xs font-normal text-gray-500">
									Hidden to avoid spoilers
								</span>
							)}
						</button>
					)}
				</div>
				<div className="flex min-w-0 flex-col gap-3 p-5 md:p-6">
					<p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
						{fresh ? `Start with ${episodeLabel(episode)}` : "Up next"}
					</p>
					<div className="flex items-start gap-3">
						<div className="min-w-0 flex-1">
							<p className="text-sm text-gray-400">{episodeLabel(episode)}</p>
							<h3 className="text-xl font-bold leading-tight md:text-2xl">
								{episode.name ?? "Untitled episode"}
							</h3>
						</div>
						<ScoreTile score={episode.rating} className="h-7 min-w-10 text-sm" />
					</div>
					<p className="text-sm text-gray-400">
						{episode.airDate ? formatDay(episode.airDate, today) : "No air date"}
						{episode.runtime ? ` · ${episode.runtime} min` : ""}
					</p>
					<div className="mt-auto flex flex-wrap gap-2 pt-2">
						<button
							type="button"
							className={BTN_PRIMARY}
							onClick={() => go(() => actions.watch(episode))}
						>
							<CheckIcon className="size-4" /> Mark watched
						</button>
						<button
							type="button"
							className={BTN_QUIET}
							onClick={() =>
								go(() => actions.watch(episode, { precision: "unknown" }))
							}
						>
							Watched earlier
						</button>
						<button
							type="button"
							className={BTN_QUIET}
							onClick={() => go(() => onSkip(episode))}
						>
							Skip
						</button>
					</div>
					{!fresh && (
						<div className="flex items-center gap-2 text-xs text-gray-400">
							<div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
								<div
									className="h-full rounded-full bg-sky-500"
									style={{ width: `${pct}%` }}
								/>
							</div>
							{watchedCount} of {airedCount}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

function SeasonCarousel({
	season,
	tracking,
	actions,
	nextId,
}: {
	season: Season
	tracking: ShowTracking
	actions: TrackingActions
	nextId: number | null
}) {
	const view = tracking.view!
	const { today } = tracking
	const strip = useRef<HTMLDivElement>(null)
	const [open, setOpen] = useState<number | null>(null)
	const [edges, setEdges] = useState({ start: true, end: false })
	const aired = season.episodes.filter((e) => e.airDate !== null && e.airDate <= today)
	const watched = aired.filter((e) => view.watched.has(e.id)).length
	const done = season.number !== 0 && aired.length > 0 && watched === aired.length

	const measure = () => {
		const el = strip.current
		if (!el) return
		setEdges({
			start: el.scrollLeft < 4,
			end: el.scrollLeft + el.clientWidth > el.scrollWidth - 4,
		})
	}
	useEffect(() => {
		measure()
		// Start at the Next episode, without moving the page.
		const el = strip.current
		const target = el?.querySelector<HTMLElement>("[data-next]")
		if (el && target) el.scrollLeft = target.offsetLeft - 8
		measure()
	}, [])
	const page = (dir: 1 | -1) =>
		strip.current?.scrollBy({
			left: dir * strip.current.clientWidth * 0.85,
			behavior: "smooth",
		})
	const onKey = (event: React.KeyboardEvent) => {
		if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return
		const tiles = [
			...(strip.current?.querySelectorAll<HTMLElement>("[data-tile]") ?? []),
		]
		const at = tiles.indexOf(document.activeElement as HTMLElement)
		if (at < 0) return
		event.preventDefault()
		event.stopPropagation()
		const to = tiles[Math.max(0, Math.min(tiles.length - 1, at + (event.key === "ArrowRight" ? 1 : -1)))]
		to?.focus()
		to?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" })
	}
	const opened = season.episodes.find((e) => e.id === open) ?? null

	return (
		<div className="flex flex-col gap-3" data-season={season.number}>
			<div className="flex items-center gap-3">
				<h3 className="text-lg font-bold">{seasonTitle(season.number)}</h3>
				<span className="text-sm text-gray-400">
					{watched} of {aired.length} watched
				</span>
				<div className="ml-auto flex items-center gap-2">
					{season.number !== 0 &&
						(done ? (
							<button
								type="button"
								className={`${BTN_QUIET} h-8 text-xs`}
								onClick={() => actions.unmarkSeason(season.number)}
							>
								Unmark season
							</button>
						) : aired.length > 0 ? (
							<button
								type="button"
								className={`${BTN_QUIET} h-8 text-xs`}
								onClick={() => actions.markSeason(season.number)}
							>
								<CheckIcon className="size-3.5" /> Mark season
							</button>
						) : null)}
					<div className="hidden gap-1 md:flex">
						<button
							type="button"
							aria-label="Earlier episodes"
							disabled={edges.start}
							onClick={() => page(-1)}
							className={`${BTN_QUIET} h-8 w-8 px-0 disabled:opacity-30`}
						>
							<ChevronLeftIcon className="size-4" />
						</button>
						<button
							type="button"
							aria-label="Later episodes"
							disabled={edges.end}
							onClick={() => page(1)}
							className={`${BTN_QUIET} h-8 w-8 px-0 disabled:opacity-30`}
						>
							<ChevronRightIcon className="size-4" />
						</button>
					</div>
				</div>
			</div>
			<div
				ref={strip}
				onScroll={measure}
				onKeyDown={onKey}
				className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:thin] sm:-mx-0 sm:px-0 sm:scroll-px-0"
			>
				{season.episodes.map((e) => (
					<Tile
						key={e.id}
						episode={e}
						watched={view.watched.has(e.id)}
						next={e.id === nextId}
						aired={e.airDate !== null && e.airDate <= today}
						open={open === e.id}
						onPress={() => setOpen((o) => (o === e.id ? null : e.id))}
					/>
				))}
			</div>
			{opened && (
				<Detail
					key={opened.id}
					episode={opened}
					watched={view.watched.has(opened.id)}
					today={today}
					actions={actions}
					onClose={() => setOpen(null)}
				/>
			)}
		</div>
	)
}

function Tile({
	episode,
	watched,
	next,
	aired,
	open,
	onPress,
}: {
	episode: PageEpisode
	watched: boolean
	next: boolean
	aired: boolean
	open: boolean
	onPress: () => void
}) {
	// Stills of watched episodes show; unwatched ones stay blurred against spoilers.
	const src = still(episode.still)
	return (
		<button
			type="button"
			data-tile
			data-next={next || undefined}
			aria-expanded={open}
			onClick={onPress}
			className={`group relative flex w-40 shrink-0 snap-start cursor-pointer flex-col overflow-hidden rounded-xl border text-left transition-colors sm:w-48 ${SURFACE} ${
				open
					? "border-white/40"
					: next
						? "border-amber-400/70"
						: "border-white/[0.06] hover:border-white/20"
			} ${FOCUS}`}
		>
			<div className="relative aspect-video bg-black/40">
				{src && (
					<img
						src={src}
						alt=""
						loading="lazy"
						className={`size-full object-cover ${watched ? "opacity-60" : "scale-110 blur-md opacity-50"}`}
					/>
				)}
				<span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
					E{episode.number}
				</span>
				{watched && (
					<span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-green-500 text-black">
						<CheckIcon className="size-4" />
					</span>
				)}
				{next && !watched && (
					<span className="absolute right-2 top-2 rounded bg-amber-400 px-1.5 py-0.5 text-[11px] font-bold text-black">
						Next
					</span>
				)}
			</div>
			<div
				className="h-1"
				style={{
					background:
						episode.rating !== null
							? vibeTileColor(imdbVibe(episode.rating))
							: "rgba(255,255,255,0.06)",
				}}
			/>
			<div className="flex min-h-14 flex-col gap-0.5 p-2.5">
				<p
					className={`line-clamp-2 text-sm font-semibold leading-snug ${watched ? "text-gray-400" : "text-white"}`}
				>
					{episode.name ?? "Untitled"}
				</p>
				{!aired && (
					<p className="text-xs text-gray-500">
						{episode.airDate ? `Airs ${episode.airDate}` : "Not aired"}
					</p>
				)}
			</div>
		</button>
	)
}

function Detail({
	episode,
	watched,
	today,
	actions,
	onClose,
}: {
	episode: PageEpisode
	watched: boolean
	today: string
	actions: TrackingActions
	onClose: () => void
}) {
	const [revealed, setRevealed] = useState(watched)
	const src = still(episode.still, "w780")
	const aired = episode.airDate !== null && episode.airDate <= today
	return (
		<div
			className={`grid gap-4 rounded-xl border border-white/[0.08] p-4 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] ${SURFACE}`}
		>
			<div className="relative aspect-video overflow-hidden rounded-lg bg-black/40">
				{src && revealed ? (
					<img src={src} alt="" className="size-full object-cover" />
				) : (
					<button
						type="button"
						disabled={!src}
						onClick={() => setRevealed(true)}
						className={`flex size-full cursor-pointer items-center justify-center text-sm font-semibold text-gray-300 hover:bg-white/[0.06] disabled:cursor-default ${FOCUS}`}
					>
						{src ? "Show still" : "No still"}
					</button>
				)}
			</div>
			<div className="flex min-w-0 flex-col gap-2">
				<div className="flex items-start gap-3">
					<div className="min-w-0 flex-1">
						<p className="text-sm text-gray-400">{episodeLabel(episode)}</p>
						<h4 className="text-lg font-bold">{episode.name ?? "Untitled episode"}</h4>
					</div>
					<ScoreTile score={episode.rating} className="h-6 min-w-9 text-xs" />
				</div>
				<p className="text-sm text-gray-400">
					{episode.airDate ? formatDay(episode.airDate, today) : "No air date"}
					{episode.runtime ? ` · ${episode.runtime} min` : ""}
				</p>
				{episode.overview && revealed && (
					<p className="text-sm leading-relaxed text-gray-300">{episode.overview}</p>
				)}
				<div className="mt-auto flex flex-wrap gap-2 pt-2">
					{aired &&
						(watched ? (
							<button
								type="button"
								className={BTN_QUIET}
								onClick={() => actions.unwatch(episode)}
							>
								Mark not watched
							</button>
						) : (
							<>
								<button
									type="button"
									className={BTN_PRIMARY}
									onClick={() => actions.watch(episode)}
								>
									<CheckIcon className="size-4" /> Mark watched
								</button>
								<button
									type="button"
									className={BTN_QUIET}
									onClick={() => actions.watchUpTo(episode)}
								>
									Watched up to here
								</button>
							</>
						))}
					<button type="button" className={`${BTN_QUIET} ml-auto`} onClick={onClose}>
						Close
					</button>
				</div>
			</div>
		</div>
	)
}
