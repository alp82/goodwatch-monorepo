// PROTOTYPE - throwaway. Round 4, variant O: the one episode a tile press opens, inline under its grid row.
// Still, name, score and date, the description (three lines until pressed), Watched, Watched up to here, and the
// episodes either side. Its height is fixed per screen size, so stepping through episodes never moves the page.
// An episode the member has not seen keeps its still and description covered until asked for (one press shows both).
import {
	CheckIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	XMarkIcon,
} from "@heroicons/react/24/solid"
import { useRef, useState } from "react"
import { episodeLabel } from "~/domain/tracking/machine"
import type { PageEpisode } from "~/domain/tracking/show-page"
import { formatScore } from "~/ui/details/episode-grid/scale"
import MediaText from "~/ui/media-text/MediaText"
import { episodeText } from "~/ui/media-text/media-text"
import { type Model, ScoreTile } from "~/ui/tracking/EpisodeList"
import { FOCUS, formatDay } from "~/ui/tracking/store"
import { tmdbImageUrl } from "~/utils/tmdb-image"

const ICON_BUTTON = `inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-300 hover:bg-white/10 hover:text-white disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent sm:h-8 sm:w-8 ${FOCUS}`

/** The card's height, kept the same for every episode of a show: phone, then wider; shorter for a show without descriptions. */
const HEIGHT = { text: "h-[14.5rem] sm:h-[9.75rem]", bare: "h-[9.5rem] sm:h-[9.75rem]" }
const MIN_HEIGHT = { text: "min-h-[14.5rem] sm:min-h-[9.75rem]", bare: "min-h-[9.5rem] sm:min-h-[9.75rem]" }

export default function EpisodeCard({
	episode,
	model,
	prev,
	next,
	onGo,
	onClose,
	width,
	texts,
}: {
	episode: PageEpisode
	model: Model
	prev: PageEpisode | null
	next: PageEpisode | null
	onGo: (episode: PageEpisode) => void
	onClose: () => void
	width?: number
	/** The show has descriptions: the card keeps room for three lines of one. */
	texts: boolean
}) {
	const { view, actions } = model
	const aired = model.aired(episode)
	const watched = view.watched.has(episode.id)
	const seenIt = (view.watchesOf.get(episode.id) ?? []).length > 0
	const [shown, setShown] = useState<Set<number>>(() => new Set())
	const [expanded, setExpanded] = useState<number | null>(null)
	const uncovered = seenIt || shown.has(episode.id)
	const open = expanded === episode.id
	const reveal = () => setShown((now) => new Set(now).add(episode.id))
	const special = episode.season === 0
	const upTo =
		special || watched || !aired
			? 0
			: model.seasons
					.filter((s) => s.number !== 0)
					.flatMap((s) => s.episodes)
					.filter(
						(each) =>
							(each.season < episode.season ||
								(each.season === episode.season && each.number <= episode.number)) &&
							model.aired(each) &&
							!view.watched.has(each.id),
					).length

	// A swipe sideways on a phone steps to the episode beside.
	const touch = useRef<{ x: number; y: number } | null>(null)
	const onTouchStart = (e: React.TouchEvent) => {
		touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
	}
	const onTouchEnd = (e: React.TouchEvent) => {
		const start = touch.current
		touch.current = null
		if (!start) return
		const dx = e.changedTouches[0].clientX - start.x
		const dy = e.changedTouches[0].clientY - start.y
		if (Math.abs(dx) < 48 || Math.abs(dy) > Math.abs(dx)) return
		const to = dx < 0 ? next : prev
		if (to) onGo(to)
	}

	const meta = [
		episode.airDate ? (aired ? formatDay(episode.airDate) : `Airs ${formatDay(episode.airDate)}`) : null,
		episode.runtime ? `${episode.runtime} min` : null,
	]
		.filter(Boolean)
		.join(" · ")

	const still = (
		<div className="relative aspect-video w-32 shrink-0 self-start overflow-hidden rounded-md bg-white/[0.06] sm:w-56">
			{episode.still && uncovered && (
				<img src={tmdbImageUrl(episode.still, "w300")} alt="" loading="lazy" className="h-full w-full object-cover" />
			)}
			{episode.still && !uncovered && (
				<button
					type="button"
					onClick={reveal}
					aria-label="Show the still and the description"
					className={`absolute inset-0 flex cursor-pointer items-center justify-center text-[11px] font-semibold text-gray-400 hover:bg-white/[0.05] hover:text-white ${FOCUS}`}
				>
					Show
				</button>
			)}
		</div>
	)

	const overview = episode.overview ? (
		uncovered ? (
			<button
				type="button"
				onClick={() => setExpanded(open ? null : episode.id)}
				aria-expanded={open}
				className={`block w-full cursor-pointer text-left text-sm leading-snug text-gray-300 ${FOCUS}`}
			>
				<MediaText
					as="span"
					value={episodeText(episode, "overview")}
					className={open ? "" : "line-clamp-3 sm:line-clamp-2"}
				/>
			</button>
		) : (
			<button
				type="button"
				onClick={reveal}
				className={`block w-full cursor-pointer text-left text-sm text-gray-500 hover:text-gray-300 ${FOCUS}`}
			>
				Description hidden · <span className="underline underline-offset-2">Show</span>
			</button>
		)
	) : null

	const buttons = (where: string) => (
			<div className={`mt-auto flex items-center gap-2 ${where}`}>
				{aired ? (
					<button
						type="button"
						aria-pressed={watched}
						onClick={() => (watched ? actions.unwatch(episode) : actions.watch(episode))}
						className={`inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold sm:h-8 ${watched ? "bg-green-500/15 text-green-300 ring-1 ring-inset ring-green-400/40 hover:bg-green-500/25" : "bg-white text-gray-900 hover:bg-gray-200"} ${FOCUS}`}
					>
						<CheckIcon className="h-4 w-4" />
						{watched ? "Watched" : "Mark watched"}
					</button>
				) : (
					<span className="text-xs text-gray-500">Not aired yet</span>
				)}
				{upTo > 1 && (
					<button
						type="button"
						onClick={() => actions.watchUpTo(episode)}
						className={`inline-flex h-10 cursor-pointer items-center rounded-lg px-2.5 text-xs font-semibold text-gray-300 hover:bg-white/10 hover:text-white sm:h-8 ${FOCUS}`}
					>
						Up to here ({upTo})
					</button>
				)}
				<span className="ml-auto flex items-center">
					<button
						type="button"
						aria-label={prev ? `Previous: ${episodeLabel(prev)}` : "No previous episode"}
						disabled={!prev}
						onClick={() => prev && onGo(prev)}
						className={ICON_BUTTON}
					>
						<ChevronLeftIcon className="h-5 w-5" />
					</button>
					<button
						type="button"
						aria-label={next ? `Next: ${episodeLabel(next)}` : "No next episode"}
						disabled={!next}
						onClick={() => next && onGo(next)}
						className={ICON_BUTTON}
					>
						<ChevronRightIcon className="h-5 w-5" />
					</button>
				</span>
			</div>
	)

	return (
		<div
			data-episode-card={episode.id}
			onTouchStart={onTouchStart}
			onTouchEnd={onTouchEnd}
			className={`relative my-2 flex flex-col gap-2.5 overflow-hidden rounded-xl border border-white/[0.06] bg-[#141923] p-3 ${open ? MIN_HEIGHT[texts ? "text" : "bare"] : HEIGHT[texts ? "text" : "bare"]}`}
			style={width ? { maxWidth: width } : undefined}
		>
			<div className="flex min-w-0 gap-3 sm:flex-1 sm:gap-4">
				{still}
				<div className="flex min-w-0 flex-1 flex-col gap-1.5">
					<div className="flex min-w-0 items-start gap-1">
						<p className="min-w-0 flex-1 pt-1 text-sm font-semibold leading-snug text-white sm:text-base">
							<span className="text-gray-400">{episodeLabel(episode)}</span>
							{episode.name && (
								<>
									<span className="text-gray-500"> · </span>
									<MediaText as="span" value={episodeText(episode, "name")} />
								</>
							)}
						</p>
						<button type="button" aria-label="Close" onClick={onClose} className={ICON_BUTTON}>
							<XMarkIcon className="h-4 w-4" />
						</button>
					</div>
					<p className="flex items-center gap-2 text-xs text-gray-400">
						{episode.rating !== null && (
							<ScoreTile
								score={episode.rating}
								title={`IMDb ${formatScore(episode.rating)}`}
								className="h-5 min-w-8 text-[11px]"
							/>
						)}
						{meta}
					</p>
					<div className="hidden min-w-0 sm:block">{overview}</div>
					{buttons("hidden sm:flex")}
				</div>
			</div>
			{overview && <div className="min-w-0 sm:hidden">{overview}</div>}
			{buttons("sm:hidden")}
		</div>
	)
}
