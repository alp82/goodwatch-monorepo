// The person's Seen and score, one control in the hero's ratings: two halves of one frame, because they go
// together. A movie is [Seen | score]; a show a member tracks is [status ▾ | score]; a show for a guest, or one
// without an episode list, is [Seen | score] too.
//
// - Seen on a movie that isn't Seen records a watch for now (the watch log's toast offers another date), then asks
//   for the score; the picker then offers to change the watch's date. On a Seen movie it opens the watch log, as
//   before: pressing Seen never removes a watch.
// - The score half opens the score picker (ScoreDialog). For a movie, the picker's title carries a Seen switch: on
//   records a watch, off asks first (NotSeenConfirm), because the score and the logged watches go with it. Clear
//   score asks the same when the score's watch is the movie's only one, since the movie stops being Seen with it.
// - A score marks a movie Seen (rating records a watch). A show's score never changes its status: after a first
//   score on a show that isn't started, the picker asks "How far are you?" (ui/tracking/HeroStatus.tsx).
//
// The picker, the question, the confirmation, and the tracked status with its menu load on first use.
import { Suspense, lazy, useEffect, useRef, useState } from "react"
import { useSeenToggle } from "~/hooks/useSeenToggle"
import { useUserScore, useWatchState } from "~/hooks/useUserDataAccessors"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import UserAction from "~/ui/auth/UserAction"
import {
	SEEN_INSTRUCTIONS,
	useTitleActions,
} from "~/ui/title-actions/useTitleActions"
import { STATUS_LOOK, useEpisodeTracking } from "~/ui/tracking/gate"
import { useScoreAction } from "~/ui/user/actions/ScoreAction"
import { useUser } from "~/utils/auth"
import { useOpenedOnce } from "~/utils/first-use"
import { useHydrated } from "~/utils/hydrated"
import { scoreLabels } from "~/utils/ratings"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { useReplayedTap } from "~/utils/useReplayedTap"
import {
	HALF_FOCUS,
	ScoreFace,
	SeenFace,
	SeenSwitch,
	SplitFrame,
	StatusFace,
} from "./seen-score-faces"

const loadScoreDialog = () => import("~/ui/scoring/ScoreDialog")
const ScoreDialog = lazy(reloadOnStaleChunk(loadScoreDialog))
const preloadScoreDialog = () => {
	void loadScoreDialog().catch(() => {})
}
const NotSeenConfirm = lazy(
	reloadOnStaleChunk(() => import("./NotSeenConfirm")),
)
const loadHeroStatus = () => import("~/ui/tracking/HeroStatus")
const HeroStatus = lazy(reloadOnStaleChunk(loadHeroStatus))
const HowFar = lazy(
	reloadOnStaleChunk(() =>
		loadHeroStatus().then((module) => ({ default: module.HowFar })),
	),
)

/** Sent on `window` to open the picker from elsewhere on the page: the prompt to rate of a tracked show. */
const OPEN_SCORE_EVENT = "gw:open-score"
/** Sent on `window` when the server has answered a score, so that what depends on it can be read again. */
export const SCORE_SAVED_EVENT = "gw:score-saved"
/**
 * Sent by a tracked show's hero (ui/tracking/HeroTracking.tsx) when a score is due or no longer due: its detail is
 * "partway" after a few episodes, "all" once every episode is watched, or null. The score half then says so.
 */
export const RATE_DUE_EVENT = "gw:rate-due"

export function openScorePicker() {
	preloadScoreDialog()
	window.dispatchEvent(new Event(OPEN_SCORE_EVENT))
}

export default function SeenScore({
	media,
	className = "",
}: { media: MovieResult | ShowResult; className?: string }) {
	const { mediaType } = media
	const tmdbId = media.details.tmdb_id
	const movie = mediaType === "movie"
	const { user } = useUser()
	const hydrated = useHydrated()
	const score = useUserScore(mediaType, tmdbId)?.score ?? null
	const entry = useWatchState(mediaType, tmdbId)
	const tracked = useEpisodeTracking(media)
	const { rate, isPending } = useScoreAction(media)
	const a = useTitleActions(media)

	const [open, setOpen] = useState(false)
	/** The picker was opened by marking the title Seen: it offers to skip. */
	const [afterSeen, setAfterSeen] = useState(false)
	/** A first score on a show that isn't started: the picker asks how far next. */
	const [howFar, setHowFar] = useState(false)
	/** Asking before the movie stops being Seen: from the switch, or from Clear score when the score's watch is the only one. */
	const [confirming, setConfirming] = useState<"switch" | "clear" | null>(null)
	const opened = useOpenedOnce(open)
	const scoreButton = useRef<HTMLButtonElement>(null)
	const seenButton = useRef<HTMLButtonElement>(null)
	const root = useRef<HTMLDivElement>(null)

	const close = () => {
		setOpen(false)
		setAfterSeen(false)
		setHowFar(false)
	}

	const [due, setDue] = useState<"partway" | "all" | null>(null)
	useEffect(() => {
		const onDue = (event: Event) =>
			setDue((event as CustomEvent<"partway" | "all" | null>).detail)
		window.addEventListener(RATE_DUE_EVENT, onDue)
		return () => window.removeEventListener(RATE_DUE_EVENT, onDue)
	}, [])

	useEffect(() => {
		const onOpen = () => setOpen(true)
		window.addEventListener(OPEN_SCORE_EVENT, onOpen)
		return () => window.removeEventListener(OPEN_SCORE_EVENT, onOpen)
	}, [])

	const wasPending = useRef(false)
	useEffect(() => {
		if (wasPending.current && !isPending)
			window.dispatchEvent(new Event(SCORE_SAVED_EVENT))
		wasPending.current = isPending
	}, [isPending])

	// The hero is in the server's HTML, so a tap can come before the app's script; the mark carries what Seen showed.
	useReplayedTap("seen", (el) => Boolean(root.current?.contains(el)))
	// The score half too: a tap from before the app was there opens the picker once it is ready.
	useReplayedTap("score", (el) => Boolean(root.current?.contains(el)))

	const pressSeen = (event: { currentTarget: EventTarget | null }) => {
		const was = a.seen
		a.toggleSeen(event)
		// Marking a title Seen asks for its score next.
		if (!was && score === null) {
			preloadScoreDialog()
			setAfterSeen(true)
			setOpen(true)
		}
	}

	// The score dialog's switch. Off takes a single watch from a movie without a score at once; with a score or more
	// watches to lose, it asks first.
	const seenToggle = useSeenToggle(mediaType, tmdbId)
	const pressSwitch = () => {
		if (!a.seen) a.toggleSeen()
		else if (score === null && seenToggle.watches <= 1)
			seenToggle.toggle("remove")
		else setConfirming("switch")
	}
	// Clearing the score takes its watch: a movie with no other watch stops being Seen, so that asks first.
	const clearScore = () => {
		if (movie && user && score !== null && seenToggle.watches <= 1)
			setConfirming("clear")
		else rate(null)
	}

	const seenHalf = (
		<UserAction instructions={SEEN_INSTRUCTIONS}>
			<button
				ref={seenButton}
				type="button"
				aria-pressed={a.seen}
				aria-label={
					a.seen
						? movie
							? "Seen. Open your watches"
							: "Seen. Take it back"
						: "Mark as Seen"
				}
				data-seen-half={a.seen ? "on" : "off"}
				data-replay-tap={`seen:${a.seen ? "on" : "off"}`}
				disabled={a.seenPending}
				onPointerEnter={a.seenLog?.onPointerEnter}
				onFocus={a.seenLog?.onFocus}
				onClick={pressSeen}
				className={`flex h-full cursor-pointer rounded-l-xl hover:brightness-110 disabled:cursor-wait ${a.seen ? "" : "hover:bg-white/10"} ${HALF_FOCUS}`}
			>
				<SeenFace seen={a.seen} count={a.seenLog?.count ?? null} />
			</button>
		</UserAction>
	)

	// A tracked show's status, as the member data has it, until its tracking is read.
	const show = media.mediaType === "show" ? media : null
	const firstStatus = (
		<span className="flex h-full rounded-l-xl">
			<StatusFace
				tone={entry?.state ?? "none"}
				label={
					entry ? STATUS_LOOK[entry.state].word : "Not started"
				}
				detail={
					entry
						? entry.episodesWatched && show?.details.number_of_episodes
							? `${entry.episodesWatched}/${show.details.number_of_episodes}`
							: null
						: "Set status"
				}
			/>
		</span>
	)
	const left = !tracked ? (
		seenHalf
	) : hydrated ? (
		<Suspense fallback={firstStatus}>
			<HeroStatus media={media} first={firstStatus} seenHalf={seenHalf} />
		</Suspense>
	) : (
		firstStatus
	)

	const ask =
		due === "all"
			? "How was it?"
			: !show || !entry
				? "Rate it"
				: entry.state === "watching" || entry.state === "on_hold"
					? "Rate it so far"
					: "Rate it"
	return (
		<div ref={root} className={className}>
			<SplitFrame
				big
				score={score}
				left={left}
				right={
					<button
						ref={scoreButton}
						type="button"
						data-own-score={score ?? "none"}
						data-replay-tap={`score:${score ?? "none"}`}
						aria-haspopup="dialog"
						aria-expanded={open}
						aria-label={
							score
								? `Your score: ${score}, ${scoreLabels[score]}. Change it`
								: `Rate this ${mediaType}`
						}
						onClick={() => setOpen(true)}
						onPointerEnter={preloadScoreDialog}
						onTouchStart={preloadScoreDialog}
						onFocus={preloadScoreDialog}
						className={`flex min-w-0 flex-1 cursor-pointer rounded-r-xl hover:bg-white/[0.06] ${HALF_FOCUS}`}
					>
						<ScoreFace score={score} ask={ask} due={Boolean(due) && !score} />
					</button>
				}
			/>
			{opened && (
				<Suspense fallback={null}>
					<ScoreDialog
						title={media.details.title}
						open={open}
						value={score}
						busy={isPending}
						opener={scoreButton}
						aside={
							movie && user && !howFar ? (
								<SeenSwitch
									on={a.seen}
									disabled={a.seenPending}
									onPress={pressSwitch}
								/>
							) : undefined
						}
						step={
							howFar ? (
								<Suspense fallback={null}>
									<HowFar media={media} score={score} onDone={close} />
								</Suspense>
							) : undefined
						}
						footer={
							afterSeen ? (
								<div className="mt-4 flex items-center justify-between gap-3 text-sm">
									{movie ? (
										<span className="min-w-0 text-gray-400">
											Watched just now.{" "}
											<button
												type="button"
												data-change-date
												onClick={() => {
													// The watch log opens beside the Seen half, where its date is changed.
													close()
													a.toggleSeen({ currentTarget: seenButton.current })
												}}
												className="cursor-pointer font-semibold text-white underline decoration-white/30 underline-offset-2 hover:decoration-white"
											>
												Change date
											</button>
										</span>
									) : (
										<span />
									)}
									<button
										type="button"
										data-skip-score
										onClick={close}
										className="cursor-pointer text-sm text-gray-400 underline decoration-white/20 underline-offset-2 hover:text-white"
									>
										Skip for now
									</button>
								</div>
							) : undefined
						}
						onRate={(value) => {
							// A guest at the rating limit gets the sign-up prompt instead; either way the picker is done.
							const sent = rate(value)
							if (sent && tracked && !entry && score === null) setHowFar(true)
							else close()
						}}
						onClear={clearScore}
						onClose={close}
					/>
				</Suspense>
			)}
			{confirming && (
				<Suspense fallback={null}>
					<NotSeenConfirm
						media={media}
						score={score}
						poster={media.details.poster_path || null}
						year={media.details.release_year || null}
						onDone={() => setConfirming(null)}
						anchor={() =>
							document.querySelector(
								`[data-score-dialog] ${confirming === "clear" ? "[data-clear-score]" : "[data-seen-switch]"}`,
							)
						}
					/>
				</Suspense>
			)}
		</div>
	)
}
