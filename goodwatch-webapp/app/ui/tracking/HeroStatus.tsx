// A tracked show's half of the Seen and score control (ui/title-actions/SeenScore.tsx), and the question its score
// dialog asks after a first score on a show that isn't started. Loaded for a member on a show page, after the page
// is up; until then the control shows the status the member data has.
//
// - Started: the status, how far, and the status menu (HeroTracking's StatusPill).
// - Not started: a menu with Watching, which asks for the last episode seen, Seen, and Not interested.
// - After a first score on a Not started show: "How far are you?" with the same two answers, and Only the score.
// A score never changes a show's status by itself.
import { NoSymbolIcon } from "@heroicons/react/24/solid"
import { type ReactNode, useLayoutEffect, useRef, useState } from "react"
import { episodeLabel } from "~/domain/tracking/machine"
import type { PageEpisode } from "~/domain/tracking/show-page"
import type { Score } from "~/server/scores.server"
import {
	EyeIcon,
	EyeSlashIcon,
	HALF_FOCUS,
	StatusFace,
} from "~/ui/details/hero/seen-score-faces"
import { useTitleActions } from "~/ui/title-actions/useTitleActions"
import { useUndoToast, warmUndoToast } from "~/ui/title-actions/useUndoToast"
import { getVibeColorValue, scoreLabels } from "~/utils/ratings"
import { StatusPill } from "./HeroTracking"
import { MENU_UP, POPOVER, useDismiss } from "./TrackingToast"
import { type TrackingActions, useTrackingActions } from "./actions"
import type { TrackedMedia } from "./gate"
import { FOCUS, type ShowTracking, plural, useShowTracking } from "./store"

/** How far, for the status half: the furthest episode watched in this pass, then watched of aired. */
function progressOf(tracking: ShowTracking): string | null {
	const view = tracking.view
	if (!view || view.derived.aired === 0) return null
	const furthest = (tracking.page?.episodes ?? [])
		.filter((episode) => episode.season > 0 && view.watched.has(episode.id))
		.reduce<PageEpisode | null>(
			(last, episode) =>
				!last ||
				episode.season > last.season ||
				(episode.season === last.season && episode.number > last.number)
					? episode
					: last,
			null,
		)
	const count = `${view.derived.watched}/${view.derived.aired}`
	return furthest && view.derived.state !== "seen"
		? `${episodeLabel(furthest)} · ${count}`
		: count
}

export default function HeroStatus({
	media,
	first,
	seenHalf,
}: {
	media: TrackedMedia
	/** The face the first paint showed, while the show's tracking is read. */
	first: ReactNode
	/** For a show without an episode list, or whose tracking could not be read: Seen for the whole show. */
	seenHalf: ReactNode
}) {
	const tracking = useShowTracking(media.details.tmdb_id)
	const actions = useTrackingActions(tracking.store, media.details.title)
	const { toggleWant } = useTitleActions(media)
	const { view, page } = tracking
	if (tracking.failed || (page && !tracking.ready)) return <>{seenHalf}</>
	if (!tracking.ready || !view) return <>{first}</>
	const { derived } = view
	if (derived.state === "not_started")
		return <StartMenu media={media} tracking={tracking} actions={actions} />
	return (
		<StatusPill
			view={view}
			actions={actions}
			onRewatch={toggleWant}
			face={
				<StatusFace
					tone={derived.displayState === "new_episodes" ? "new_episodes" : derived.state}
					label={derived.label}
					detail={progressOf(tracking)}
					chevron={view.menu.length > 0}
				/>
			}
		/>
	)
}

/** Not started: a menu with the two ways in, Watching (up to an episode) and Seen, then Not interested. */
function StartMenu({
	media,
	tracking,
	actions,
}: { media: TrackedMedia; tracking: ShowTracking; actions: TrackingActions }) {
	const a = useTitleActions(media)
	const toast = useUndoToast()
	const [open, setOpen] = useState(false)
	const root = useRef<HTMLDivElement>(null)
	const button = useRef<HTMLButtonElement>(null)
	useDismiss(open, root, (byKey) => {
		setOpen(false)
		if (byKey) button.current?.focus()
	})
	return (
		<div
			ref={root}
			className="relative flex h-full"
			onPointerEnter={warmUndoToast}
			onFocus={warmUndoToast}
		>
			<button
				ref={button}
				type="button"
				data-status-pill="not_started"
				aria-expanded={open}
				aria-label="Not started. Set the status"
				onClick={() => setOpen((was) => !was)}
				className={`flex h-full cursor-pointer rounded-l-xl hover:bg-white/10 ${HALF_FOCUS}`}
			>
				<StatusFace tone="none" label="Not started" detail="Set status" />
			</button>
			{open && (
				<div
					data-start-menu
					className={`absolute left-0 top-full z-40 mt-1.5 w-80 max-w-[calc(100vw-2.5rem)] ${MENU_UP} p-2 ${POPOVER}`}
				>
					<Choices
						tracking={tracking}
						actions={actions}
						onDone={() => setOpen(false)}
					/>
					{(a.canHide || a.hidden) && (
						<button
							type="button"
							data-how-far-answer="not_interested"
							aria-pressed={a.hidden}
							disabled={a.hidePending}
							onClick={() => {
								setOpen(false)
								if (a.hidden) a.unhide()
								else
									toast.say(
										`${media.details.title} is hidden from your recommendations`,
										a.hide(),
									)
							}}
							className={`${ROW} mt-2 ${a.hidden ? "bg-pink-500/[0.12] ring-pink-400/50" : "bg-transparent ring-white/10 hover:bg-white/[0.06]"}`}
						>
							<NoSymbolIcon className="h-5 w-5 shrink-0 text-pink-300" />
							<span className="min-w-0 flex-1 leading-tight">
								<span className="block text-sm font-bold text-gray-200">
									Not interested
								</span>
								<span className="block text-xs text-gray-400">
									{a.hidden
										? "Hidden from your recommendations. Press to bring it back."
										: "Hide it from your recommendations"}
								</span>
							</span>
						</button>
					)}
				</div>
			)}
			{toast.node}
		</div>
	)
}

/**
 * "How far are you?" after a first score on a show that isn't started: in the score dialog, in place of the picker.
 * Every answer settles the server's own question ("Have you seen all of it?"), so it isn't asked again.
 */
export function HowFar({
	media,
	score,
	onDone,
}: { media: TrackedMedia; score: Score | null; onDone: () => void }) {
	const tracking = useShowTracking(media.details.tmdb_id)
	const actions = useTrackingActions(tracking.store, media.details.title)
	const box = useRef<HTMLDivElement>(null)
	useLayoutEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
		box.current?.animate(
			[
				{ opacity: 0, transform: "translateX(16px)" },
				{ opacity: 1, transform: "none" },
			],
			{ duration: 200, easing: "cubic-bezier(.2,.8,.2,1)" },
		)
	}, [])
	const color = score ? getVibeColorValue(score) : ""
	return (
		<div ref={box} data-how-far className="mt-1">
			<div className="flex items-center gap-2.5">
				{score && (
					<span
						className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base font-black"
						style={{
							background: color,
							color: score <= 3 ? "#fff" : "#0a0a0a",
						}}
					>
						{score}
					</span>
				)}
				<span className="min-w-0 leading-tight">
					<span className="block text-lg font-bold text-white">
						How far are you?
					</span>
					<span className="block text-xs text-gray-400">
						{score
							? `Your score of ${score} (${scoreLabels[score]}) is saved.`
							: "Your score is saved."}
					</span>
				</span>
			</div>
			<div className="mt-4">
				{tracking.ready ? (
					<Choices
						tracking={tracking}
						actions={actions}
						onDone={onDone}
						onlyScore={() => {
							actions.answerSeenQuestion("just_rating")
							onDone()
						}}
					/>
				) : (
					<button
						type="button"
						onClick={onDone}
						className={`h-10 w-full cursor-pointer rounded-lg bg-white/10 text-sm font-semibold text-white hover:bg-white/20 ${FOCUS}`}
					>
						Done
					</button>
				)}
			</div>
		</div>
	)
}

const ROW = `flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 transition-colors ${FOCUS}`

/** Watching (opens the episode picker), Seen, and, after a score, Only the score. A poster card's status menu shows them for a show that isn't started. */
export function Choices({
	tracking,
	actions,
	onDone,
	onlyScore,
}: {
	tracking: ShowTracking
	actions: TrackingActions
	onDone: () => void
	onlyScore?: () => void
}) {
	const [picking, setPicking] = useState(false)
	const aired = tracking.view?.derived.aired ?? 0
	const seenWord = tracking.view?.derived.running ? "Caught up" : "Seen"
	return (
		<div className="flex flex-col gap-2">
			<button
				type="button"
				data-how-far-answer="watching"
				aria-expanded={picking}
				onClick={() => setPicking((was) => !was)}
				className={`${ROW} ${picking ? "bg-sky-500/[0.12] ring-sky-400/60" : "bg-white/[0.04] ring-white/10 hover:bg-white/[0.08]"}`}
			>
				<svg
					viewBox="0 0 20 20"
					fill="currentColor"
					className="h-5 w-5 shrink-0 text-sky-300"
					aria-hidden="true"
				>
					<path d="M6.3 2.84A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.27l9.344-5.891a1.5 1.5 0 0 0 0-2.538L6.3 2.841Z" />
				</svg>
				<span className="min-w-0 flex-1 leading-tight">
					<span className="block text-sm font-bold text-white">Watching</span>
					<span className="block text-xs text-gray-400">
						Pick the last episode you saw
					</span>
				</span>
			</button>
			{picking && (
				<EpisodePicker
					tracking={tracking}
					onPick={(episode) => {
						actions.watchUpTo(episode)
						onDone()
					}}
				/>
			)}
			<button
				type="button"
				data-how-far-answer="seen"
				onClick={() => {
					actions.pressSeen()
					onDone()
				}}
				className={`${ROW} bg-white/[0.04] ring-white/10 hover:bg-white/[0.08]`}
			>
				<EyeIcon className="h-5 w-5 shrink-0 text-green-400" />
				<span className="min-w-0 flex-1 leading-tight">
					<span className="block text-sm font-bold text-white">{seenWord}</span>
					<span className="block text-xs text-gray-400">
						{aired ? `All ${plural(aired, "aired episode")}` : "The whole show"}
					</span>
				</span>
			</button>
			{onlyScore && (
				<button
					type="button"
					data-how-far-answer="just_rating"
					onClick={onlyScore}
					className={`${ROW} bg-transparent ring-white/10 hover:bg-white/[0.06]`}
				>
					<EyeSlashIcon className="h-5 w-5 shrink-0 text-gray-400" />
					<span className="min-w-0 flex-1 leading-tight">
						<span className="block text-sm font-bold text-gray-200">
							Only the score
						</span>
						<span className="block text-xs text-gray-400">
							It stays Not started
						</span>
					</span>
				</button>
			)}
		</div>
	)
}

/** Season chips, then that season's aired episodes: the press marks every aired episode up to it, without dates. */
function EpisodePicker({
	tracking,
	onPick,
}: { tracking: ShowTracking; onPick: (episode: PageEpisode) => void }) {
	const seasons = tracking.seasons
		.filter((season) => season.number > 0)
		.map((season) => ({
			...season,
			episodes: season.episodes.filter(
				(episode) =>
					episode.airDate !== null && episode.airDate <= tracking.today,
			),
		}))
		.filter((season) => season.episodes.length > 0)
	const [seasonNumber, setSeasonNumber] = useState(seasons[0]?.number ?? 1)
	const [chosen, setChosen] = useState<PageEpisode | null>(null)
	const season =
		seasons.find((each) => each.number === seasonNumber) ?? seasons[0]
	const before = seasons
		.filter((each) => each.number < seasonNumber)
		.reduce((sum, each) => sum + each.episodes.length, 0)
	const count =
		chosen && season ? before + season.episodes.indexOf(chosen) + 1 : 0
	const chip = `flex h-8 cursor-pointer items-center justify-center rounded-lg text-xs font-bold tabular-nums ${FOCUS}`
	if (!season) return null
	return (
		<div
			data-episode-picker
			className="rounded-xl bg-sky-500/[0.06] p-3 ring-1 ring-sky-400/25"
		>
			<div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
				Season
			</div>
			<div className="mt-1.5 flex flex-wrap gap-1.5">
				{seasons.map((each) => (
					<button
						key={each.number}
						type="button"
						aria-pressed={each.number === seasonNumber}
						aria-label={`Season ${each.episodes[0]?.displaySeason ?? each.number}`}
						onClick={() => {
							setSeasonNumber(each.number)
							setChosen(null)
						}}
						className={`${chip} min-w-8 px-2 ${each.number === seasonNumber ? "bg-sky-400 text-black" : "bg-white/[0.06] text-gray-200 hover:bg-white/[0.12]"}`}
					>
						{each.episodes[0]?.displaySeason ?? each.number}
					</button>
				))}
			</div>
			<div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
				Last episode you saw
			</div>
			<div className="mt-1.5 grid grid-cols-8 gap-1.5">
				{season.episodes.map((episode, index) => {
					const at = chosen ? season.episodes.indexOf(chosen) : -1
					return (
						<button
							key={episode.id}
							type="button"
							aria-pressed={episode === chosen}
							aria-label={episodeLabel(episode)}
							data-pick-episode={episode.id}
							onClick={() => setChosen(episode)}
							className={`${chip} ${episode === chosen ? "bg-sky-400 text-black" : index < at ? "bg-sky-400/25 text-sky-100" : "bg-white/[0.06] text-gray-200 hover:bg-white/[0.12]"}`}
						>
							{episode.displayNumber ?? episode.number}
						</button>
					)
				})}
			</div>
			<button
				type="button"
				data-pick-confirm
				disabled={!chosen}
				onClick={() => chosen && onPick(chosen)}
				className={`mt-3 h-10 w-full cursor-pointer rounded-lg bg-sky-500 text-sm font-bold text-black hover:bg-sky-400 disabled:cursor-default disabled:opacity-40 ${FOCUS}`}
			>
				{chosen ? `Watching, up to ${episodeLabel(chosen)}` : "Pick an episode"}
			</button>
			{chosen && (
				<p className="mt-1.5 text-center text-xs text-gray-400">{`${count} of ${plural(tracking.view?.derived.aired ?? count, "episode")}`}</p>
			)}
		</div>
	)
}
