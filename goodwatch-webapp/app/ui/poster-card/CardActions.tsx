// A poster card's title actions for a pointer, loaded on demand by the card (MovieTvCard); a touch screen gets them in
// the title quick view instead (ui/quick-view/title-quick-view.tsx):
// - pointer devices: the panel over the poster's foot on hover or keyboard focus: Want to See, Seen (a show: its
//   status), Not interested, and the score under them (its label from 7.5rem, the number alone under it, no score row
//   under 6rem, and no panel at all under 4.5rem, where the poster is only a link);
// - the score picker, a show's status menu;
// - the Not interested cover with Undo.
// The rules are the title page's: Seen on an unscored title asks for the score (useTitleActions.toggleSeen), a seen
// movie's Seen opens its watch log, a show's status goes through its tracking, a guest's Seen asks to sign in.
import { BookmarkIcon, NoSymbolIcon, StarIcon } from "@heroicons/react/20/solid"
import { Suspense, lazy, useContext, useEffect, useRef, useState } from "react"
import UserAction from "~/ui/auth/UserAction"
import TitleScoreDialog from "~/ui/scoring/TitleScoreDialog"
import { HideFeedbackContext } from "~/ui/title-actions/hide-feedback"
import {
	SEEN_INSTRUCTIONS,
	SEEN_SO_NOT_HIDEABLE,
	useTitleActions,
} from "~/ui/title-actions/useTitleActions"
import { STATUS_LOOK } from "~/ui/tracking/status-look"
import type { ScoredMedia } from "~/ui/user/actions/ScoreAction"
import { useUser } from "~/utils/auth"
import { getScoreLabelText, selectedScoreStyle } from "~/utils/ratings"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { HiddenCover } from "./HiddenCover"
import { FOCUS, OFF } from "./look"
import { useTitleMarks } from "./marks"
import { seenFaceOf } from "./seen-face"

const loadShowStatus = () => import("./ShowStatus")
const ShowStatus = lazy(reloadOnStaleChunk(loadShowStatus))
const HowFar = lazy(
	reloadOnStaleChunk(() =>
		import("~/ui/tracking/HeroStatus").then((module) => ({
			default: module.HowFar,
		})),
	),
)

/** Where the actions sit: along the poster's foot, or raised above something else there (Worth adding's pill). */
export type ActionsPlacement = "bottom" | "raised"

/** What the card has open: the score picker (after Seen it offers to skip). */
export type OpenActions = "score" | "seen-score" | null

const PANEL_AT: Record<ActionsPlacement, string> = {
	bottom:
		"inset-x-1 bottom-1 @min-[11rem]/card:inset-x-2 @min-[11rem]/card:bottom-2",
	raised: "inset-x-1 bottom-14 @min-[11rem]/card:inset-x-2",
}

export default function CardActions({
	media,
	placement,
	touch,
	open,
	setOpen,
	tile,
	setTile,
}: {
	media: ScoredMedia
	placement: ActionsPlacement
	/** A touch screen: no panel (a tap opens the quick view). */
	touch: boolean
	open: OpenActions
	setOpen: (open: OpenActions) => void
	tile: boolean
	setTile: (tile: boolean) => void
}) {
	const a = useTitleActions(media)
	const { status } = useTitleMarks(media.mediaType, media.details.tmdb_id)
	const { user } = useUser()
	const isShow = media.mediaType === "show"
	/** A member's show: Seen is its status, through its tracking. */
	const tracked = isShow && Boolean(user)
	const opener = useRef<HTMLElement | null>(null)
	const [statusAt, setStatusAt] = useState<HTMLElement | null>(null)
	/**
	 * The status menu or How far was used: ShowStatus stays mounted from then on, because it hosts the toasts (Undo,
	 * Set a date, errors) that tracking answers with, including after How far's dialog closed. Never before, so a grid
	 * of cards nobody touched mounts none.
	 */
	const [trackingUsed, setTrackingUsed] = useState(false)
	const [howFar, setHowFar] = useState(false)
	const undo = useRef<() => void>(() => {})

	const closeDialog = () => {
		setOpen(null)
		setHowFar(false)
	}
	const openScore = (from: HTMLElement | null, afterSeen = false) => {
		opener.current = from
		setOpen(afterSeen ? "seen-score" : "score")
	}

	// A show marked Seen from its status menu, still without a score, asks for one, as Seen does everywhere.
	const askAfterStatus = useRef<HTMLElement | null>(null)
	const lastStatus = useRef(status)
	useEffect(() => {
		if (lastStatus.current === status) return
		lastStatus.current = status
		const from = askAfterStatus.current
		askAfterStatus.current = null
		if (from && status === "seen" && a.score === null) openScore(from, true)
	})

	const pressSeen = (event: { currentTarget: HTMLElement }) => {
		const from = event.currentTarget
		if (tracked) {
			void loadShowStatus().catch(() => {})
			setTrackingUsed(true)
			askAfterStatus.current = from
			setStatusAt((was) => (was ? null : from))
			return
		}
		a.toggleSeen(event, () => openScore(from, true))
	}

	const feedback = useContext(HideFeedbackContext)
	const onHide = (takeBack: () => void) => {
		closeDialog()
		setStatusAt(null)
		if (feedback) return feedback(media, takeBack)
		undo.current = takeBack
		setTile(true)
	}
	const pressHide = () => (a.hidden ? a.unhide() : onHide(a.hide()))
	// The cover goes when hiding failed and the mutation put the title back: the title was hidden while the cover
	// showed, and no longer is. (The sheet hides with its own mutation, so this card's pending flag can't tell.)
	const hiddenUnderCover = useRef(false)
	useEffect(() => {
		if (!tile) hiddenUnderCover.current = false
		else if (a.hidden) hiddenUnderCover.current = true
		else if (hiddenUnderCover.current) setTile(false)
	}, [tile, a.hidden, setTile])

	if (tile)
		return (
			<HiddenCover
				title={media.details.title}
				onUndo={() => {
					undo.current()
					setTile(false)
				}}
			/>
		)

	const seenFace = seenFaceOf(isShow, status, a.seen)
	const seenName = isShow
		? `Status: ${status ? STATUS_LOOK[status].word : "Not started"}. Change it`
		: a.seenLog?.opensLog
			? `Seen${a.seenLog.count ? `, watched ${a.seenLog.count}` : ""}. Open your watches`
			: a.seen
				? "Seen"
				: "Mark as Seen"
	const wantName = a.seen ? "Want to rewatch" : "Want to See"
	const scoreName = a.score
		? `Your score: ${getScoreLabelText(a.score)}. Change it`
		: "Score it"
	const hideName = a.hidden
		? "Not interested. Press to bring it back."
		: a.canHide
			? "Not interested"
			: SEEN_SO_NOT_HIDEABLE
	const seenProps = {
		"aria-pressed": isShow ? undefined : a.seen,
		"aria-haspopup": tracked
			? ("dialog" as const)
			: a.seenLog?.opensLog
				? ("dialog" as const)
				: undefined,
		"aria-expanded": tracked ? Boolean(statusAt) : undefined,
		"aria-label": seenName,
		disabled: !tracked && a.seenPending,
		onPointerEnter: a.seenLog?.onPointerEnter,
		onFocus: a.seenLog?.onFocus,
		onClick: pressSeen,
	}
	const busy = open !== null || statusAt !== null

	return (
		<>
			{!touch && (
				<div
					className={`absolute z-20 hidden transition-opacity can-hover:@min-[4.5rem]/card:block ${PANEL_AT[placement]} ${
						busy
							? "opacity-100"
							: "opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100"
					}`}
				>
					<div className="grid grid-cols-3 gap-1 rounded-lg bg-gray-900/90 p-1 shadow-lg shadow-black/50">
						<button
							type="button"
							aria-pressed={a.want}
							aria-label={wantName}
							title={wantName}
							disabled={a.wantPending}
							onClick={a.toggleWant}
							className={`${PANEL_BTN} ${a.want ? "bg-amber-500 text-black" : OFF}`}
						>
							<BookmarkIcon
								className={a.want ? "" : "text-amber-300"}
								aria-hidden
							/>
						</button>
						<UserAction instructions={SEEN_INSTRUCTIONS}>
							<button
								type="button"
								{...seenProps}
								title={seenName}
								className={`${PANEL_BTN} ${seenFace.on ? seenFace.cls : OFF}`}
							>
								<seenFace.Icon
									className={seenFace.on ? "" : seenFace.tint}
									aria-hidden
								/>
								{a.seenLog?.count && (
									<span className="text-[10px] font-bold tabular-nums">
										{a.seenLog.count}
									</span>
								)}
							</button>
						</UserAction>
						<button
							type="button"
							aria-pressed={a.hidden}
							aria-label={hideName}
							title={hideName}
							disabled={(!a.canHide && !a.hidden) || a.hidePending}
							onClick={pressHide}
							className={`${PANEL_BTN} ${a.hidden ? "bg-pink-500 text-black" : OFF}`}
						>
							<NoSymbolIcon
								className={a.hidden ? "" : "text-pink-300"}
								aria-hidden
							/>
						</button>
						<button
							type="button"
							aria-haspopup="dialog"
							aria-expanded={open === "score"}
							aria-label={scoreName}
							title={scoreName}
							onClick={(event) => openScore(event.currentTarget)}
							className={`${PANEL_KEY} col-span-3 hidden text-xs tabular-nums @min-[6rem]/card:inline-flex ${a.score ? "font-bold text-white" : OFF}`}
							style={a.score ? selectedScoreStyle(a.score) : undefined}
						>
							{a.score ? (
								<>
									<span className="truncate px-1 @min-[7.5rem]/card:hidden">
										{a.score}
									</span>
									<span className="hidden truncate px-1 @min-[7.5rem]/card:inline">
										{getScoreLabelText(a.score)}
									</span>
								</>
							) : (
								<>
									<StarIcon className="text-yellow-300" aria-hidden />
									<span className="hidden @min-[7.5rem]/card:inline">
										Score
									</span>
								</>
							)}
						</button>
					</div>
				</div>
			)}

			{open !== null && (
				<TitleScoreDialog
					media={media}
					open
					onClose={closeDialog}
					opener={opener}
					onRated={() => {
						// A first score on a show that isn't started asks how far, as on the title page.
						if (tracked && !status && a.score === null) {
							void loadShowStatus().catch(() => {})
							setTrackingUsed(true)
							setHowFar(true)
						} else closeDialog()
					}}
					step={
						howFar ? (
							<Suspense fallback={null}>
								<HowFar media={media} score={a.score} onDone={closeDialog} />
							</Suspense>
						) : undefined
					}
					footer={
						open === "seen-score" ? (
							<AfterSeen
								movie={!isShow}
								onChangeDate={() => {
									// The watch log opens beside the Seen button, where its date is changed.
									closeDialog()
									a.toggleSeen({ currentTarget: opener.current }, null)
								}}
								onSkip={closeDialog}
							/>
						) : undefined
					}
				/>
			)}

			{trackingUsed && (
				<Suspense fallback={null}>
					<ShowStatus
						media={media}
						anchor={statusAt}
						onClose={() => setStatusAt(null)}
						onHide={onHide}
					/>
				</Suspense>
			)}
		</>
	)
}

/** A panel button without its display, for the score row that a narrow card leaves out. */
const PANEL_KEY = `h-7 min-w-0 cursor-pointer items-center justify-center gap-1 rounded-md font-semibold transition-colors @min-[6.5rem]/card:h-8 [&_svg]:size-4 [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`
const PANEL_BTN = `inline-flex ${PANEL_KEY}`

/** Under the picker opened by Seen: the watch is now, it can be dated, and the score can wait. */
function AfterSeen({
	movie,
	onChangeDate,
	onSkip,
}: {
	movie: boolean
	onChangeDate: () => void
	onSkip: () => void
}) {
	return (
		<div className="mt-4 flex items-center justify-between gap-3 text-sm">
			{movie ? (
				<span className="min-w-0 text-gray-400">
					Watched just now.{" "}
					<button
						type="button"
						onClick={onChangeDate}
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
				onClick={onSkip}
				className="cursor-pointer text-sm text-gray-400 underline decoration-white/20 underline-offset-2 hover:text-white"
			>
				Skip for now
			</button>
		</div>
	)
}
