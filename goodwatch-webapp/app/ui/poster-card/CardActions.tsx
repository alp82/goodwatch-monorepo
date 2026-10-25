// A poster card's title actions, loaded on demand by the card (MovieTvCard):
// - pointer devices: the panel over the poster's foot on hover or keyboard focus: Want to See, Seen (a show: its
//   status), Not interested, and the score under them;
// - touch screens, after the first tap on the poster: tiles over the lower art (Seen | Score, Want | Not for me) and
//   an Open bar; a card under 7.5rem has Open and Actions, which opens the phone sheet;
// - the score picker, the phone sheet (the picker with the whole action set and Open details), a show's status menu;
// - the Not interested cover with Undo.
// The rules are the title page's: Seen on an unscored title asks for the score (useTitleActions.toggleSeen), a seen
// movie's Seen opens its watch log, a show's status goes through its tracking, a guest's Seen asks to sign in.
import {
	BookmarkIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	EyeIcon,
	EyeSlashIcon,
	NoSymbolIcon,
	PauseIcon,
	PlayIcon,
	StarIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { Link, useNavigate } from "@remix-run/react"
import {
	type ReactNode,
	type RefObject,
	Suspense,
	lazy,
	useContext,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import UserAction from "~/ui/auth/UserAction"
import TitleScoreDialog from "~/ui/scoring/TitleScoreDialog"
import { TitleActionSet } from "~/ui/title-actions/TitleActionSet"
import { HideFeedbackContext } from "~/ui/title-actions/hide-feedback"
import {
	SEEN_INSTRUCTIONS,
	SEEN_SO_NOT_HIDEABLE,
	useTitleActions,
} from "~/ui/title-actions/useTitleActions"
import { STATUS_LOOK } from "~/ui/tracking/gate"
import type { ScoredMedia } from "~/ui/user/actions/ScoreAction"
import { useUser } from "~/utils/auth"
import {
	getScoreLabelText,
	scoreLabels,
	selectedScoreStyle,
} from "~/utils/ratings"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { HiddenCover } from "./HiddenCover"
import { DARK, FOCUS, OFF } from "./look"
import { type WatchStatus, useTitleMarks } from "./marks"
import { getRevealed, setRevealed } from "./reveal"

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

/** What the card has open: the score picker (after Seen it offers to skip), or the phone sheet. */
export type OpenActions = "score" | "seen-score" | "sheet" | null

const PANEL_AT: Record<ActionsPlacement, string> = {
	bottom:
		"inset-x-1 bottom-1 @min-[11rem]/card:inset-x-2 @min-[11rem]/card:bottom-2",
	raised: "inset-x-1 bottom-14 @min-[11rem]/card:inset-x-2",
}

const STATUS_ICON: Record<WatchStatus, typeof PlayIcon> = {
	watching: PlayIcon,
	on_hold: PauseIcon,
	dropped: XMarkIcon,
	seen: EyeIcon,
}

export default function CardActions({
	media,
	href,
	cardKey,
	frame,
	placement,
	touch,
	revealed,
	open,
	setOpen,
	tile,
	setTile,
}: {
	media: ScoredMedia
	/** The title page. */
	href: string
	/** The card's key for the one card showing its tap actions. */
	cardKey: string
	frame: RefObject<HTMLDivElement>
	placement: ActionsPlacement
	touch: boolean
	revealed: boolean
	open: OpenActions
	setOpen: (open: OpenActions) => void
	tile: boolean
	setTile: (tile: boolean) => void
}) {
	const a = useTitleActions(media)
	const navigate = useNavigate()
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
		setRevealed(null)
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

	// Touch: a tap anywhere else, or Escape, puts the art back. A press in what the actions opened doesn't.
	useEffect(() => {
		if (!revealed) return
		const away = (event: PointerEvent) => {
			const target = event.target as Element
			if (
				frame.current?.contains(target) ||
				target.closest?.(
					"[data-score-dialog], [data-card-popout], [role=dialog]",
				)
			)
				return
			if (getRevealed() === cardKey) setRevealed(null)
		}
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || open || statusAt) return
			setRevealed(null)
			frame.current
				?.querySelector<HTMLElement>("a")
				?.focus({ preventScroll: true })
		}
		document.addEventListener("pointerdown", away, true)
		window.addEventListener("keydown", onKey)
		return () => {
			document.removeEventListener("pointerdown", away, true)
			window.removeEventListener("keydown", onKey)
		}
	}, [revealed, frame, cardKey, open, statusAt])

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

	const seenFace = faceOf(isShow, status, a.seen)
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
					className={`absolute z-20 hidden transition-opacity can-hover:block ${PANEL_AT[placement]} ${
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
							className={`${PANEL_BTN} col-span-3 text-xs tabular-nums ${a.score ? "font-bold text-white" : OFF}`}
							style={a.score ? selectedScoreStyle(a.score) : undefined}
						>
							{a.score ? (
								<>
									<span className="truncate px-1 @min-[6.5rem]/card:hidden">
										{a.score}
									</span>
									<span className="hidden truncate px-1 @min-[6.5rem]/card:inline">
										{getScoreLabelText(a.score)}
									</span>
								</>
							) : (
								<>
									<StarIcon className="text-yellow-300" aria-hidden />
									<span className="hidden @min-[6.5rem]/card:inline">
										Score
									</span>
								</>
							)}
						</button>
					</div>
				</div>
			)}

			{touch && revealed && (
				<TapTiles
					title={media.details.title}
					href={href}
					onArt={() => {
						// The second tap on the art opens the title, as the Open bar does.
						setRevealed(null)
						navigate(href)
					}}
					onSheet={(event) => {
						opener.current = event.currentTarget
						setOpen("sheet")
					}}
				>
					<UserAction instructions={SEEN_INSTRUCTIONS}>
						<button
							type="button"
							{...seenProps}
							className={`${TILE} ${seenFace.on ? seenFace.cls : DARK}`}
						>
							<seenFace.Icon
								className={`shrink-0 ${seenFace.on ? "" : seenFace.tint}`}
								aria-hidden
							/>
							<span className="inline-flex items-center">
								{isShow
									? status
										? STATUS_LOOK[status].word
										: "Not seen"
									: a.seen
										? "Seen"
										: "Seen?"}
								{tracked && (
									<ChevronDownIcon
										className="!size-3 hidden opacity-70 @min-[9rem]/card:inline"
										aria-hidden
									/>
								)}
							</span>
						</button>
					</UserAction>
					<button
						type="button"
						aria-haspopup="dialog"
						aria-label={
							a.score
								? `Your score: ${a.score}, ${scoreLabels[a.score]}. Change it`
								: "Score it"
						}
						onClick={(event) => openScore(event.currentTarget)}
						className={`${TILE} tabular-nums ${a.score ? "text-white" : DARK}`}
						style={a.score ? selectedScoreStyle(a.score) : undefined}
					>
						{a.score ? (
							<span className="shrink-0 text-base font-black leading-none @min-[9rem]/card:text-xl">
								{a.score}
							</span>
						) : (
							<StarIcon className="shrink-0 text-yellow-300" aria-hidden />
						)}
						<span>Score</span>
					</button>
					<button
						type="button"
						aria-pressed={a.want}
						aria-label={wantName}
						disabled={a.wantPending}
						onClick={a.toggleWant}
						className={`${TILE} ${a.want ? "bg-amber-500 text-black" : DARK}`}
					>
						<BookmarkIcon
							className={`shrink-0 ${a.want ? "" : "text-amber-300"}`}
							aria-hidden
						/>
						<span>{a.seen ? "Rewatch" : "Want"}</span>
					</button>
					<button
						type="button"
						aria-pressed={a.hidden}
						aria-label={hideName}
						disabled={(!a.canHide && !a.hidden) || a.hidePending}
						onClick={pressHide}
						className={`${TILE} ${a.hidden ? "bg-pink-500 text-black" : DARK}`}
					>
						<NoSymbolIcon
							className={`shrink-0 ${a.hidden ? "" : "text-pink-300"}`}
							aria-hidden
						/>
						<span>Not for me</span>
					</button>
				</TapTiles>
			)}

			{open !== null && (
				<TitleScoreDialog
					media={media}
					open
					onClose={closeDialog}
					opener={opener}
					onRated={() => {
						// A first score on a show that isn't started asks how far, as on the title page.
						if (tracked && !status && a.score === null && open !== "sheet") {
							void loadShowStatus().catch(() => {})
							setTrackingUsed(true)
							setHowFar(true)
						} else if (open !== "sheet") closeDialog()
					}}
					step={
						howFar ? (
							<Suspense fallback={null}>
								<HowFar media={media} score={a.score} onDone={closeDialog} />
							</Suspense>
						) : undefined
					}
					footer={
						open === "sheet" ? (
							<>
								<TitleActionSet
									media={media}
									scoring={false}
									onHide={onHide}
									onOpenLog={closeDialog}
								/>
								<Link
									to={href}
									onClick={() => {
										closeDialog()
										setRevealed(null)
									}}
									className={`mt-2 flex h-11 w-full items-center justify-center gap-1 rounded-lg bg-white/5 text-sm font-semibold text-amber-300 hover:bg-white/10 ${FOCUS}`}
								>
									Open details
									<ChevronRightIcon className="h-4 w-4" aria-hidden />
								</Link>
							</>
						) : open === "seen-score" ? (
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

const PANEL_BTN = `inline-flex h-7 min-w-0 cursor-pointer items-center justify-center gap-1 rounded-md font-semibold transition-colors @min-[6.5rem]/card:h-8 [&_svg]:size-4 [&_svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`

const TILE = `inline-flex h-11 min-w-0 cursor-pointer flex-col items-center justify-center gap-1 whitespace-nowrap rounded-md text-[9px] font-semibold leading-none tracking-tight @min-[7.5rem]/card:text-[10.5px] [&_svg]:size-4 @min-[9rem]/card:h-[52px] @min-[9rem]/card:text-xs @min-[9rem]/card:[&_svg]:size-5 disabled:opacity-40 ${FOCUS}`

/** Seen's face: a show's status (or not started), else Seen. */
function faceOf(isShow: boolean, status: WatchStatus | null, seen: boolean) {
	if (isShow && status)
		return {
			Icon: STATUS_ICON[status],
			tint: "",
			on: true,
			cls: STATUS_LOOK[status].pill,
		}
	if (isShow)
		return { Icon: EyeSlashIcon, tint: "text-gray-400", on: false, cls: "" }
	return {
		Icon: EyeIcon,
		tint: "text-green-300",
		on: seen,
		cls: STATUS_LOOK.seen.pill,
	}
}

/** Rises a few px and fades in; transform and opacity only. */
function useRise<T extends HTMLElement>() {
	const ref = useRef<T>(null)
	useLayoutEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
		ref.current?.animate(
			[
				{ transform: "translateY(10px)", opacity: 0 },
				{ transform: "none", opacity: 1 },
			],
			{ duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" },
		)
	}, [])
	return ref
}

/**
 * The tap actions over the art: from a 7.5rem card the four tiles and an Open bar, the top of the art and the pill
 * left bare; a narrower card has Open and Actions (the phone sheet), each 44 px high. A tap on the bare art opens
 * the title too; a tap outside the card closes them.
 */
function TapTiles({
	title,
	href,
	onArt,
	onSheet,
	children,
}: {
	title: string
	href: string
	/** A tap on the bare art above the tiles. */
	onArt: () => void
	onSheet: (event: { currentTarget: HTMLElement }) => void
	/** The four tiles: Seen, Score, Want, Not for me. */
	children: ReactNode
}) {
	const rise = useRise<HTMLDivElement>()
	const open = (
		<Link
			to={href}
			onClick={() => setRevealed(null)}
			aria-label={`Open ${title}`}
			className={`flex w-full shrink-0 items-center justify-center gap-0.5 rounded-md bg-amber-400 font-black text-gray-950 ${FOCUS}`}
		>
			Open
			<ChevronRightIcon className="-mr-0.5 size-4" aria-hidden />
		</Link>
	)
	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: the bare art is the poster's second tap; the Open bar is the keyboard's way.
		<div
			data-tap-overlay=""
			onClick={(event) => {
				const target = event.target as HTMLElement
				if (
					target === event.currentTarget ||
					target.dataset.backdrop !== undefined
				)
					onArt()
			}}
			className="absolute inset-0 z-20 flex flex-col justify-end overflow-hidden rounded-lg bg-linear-to-t from-gray-950/90 via-gray-950/60 to-gray-950/10 p-0.5"
		>
			<div
				ref={rise}
				data-backdrop=""
				className="hidden min-h-0 flex-1 flex-col justify-end gap-1 @min-[7.5rem]/card:flex"
			>
				<div className="grid grid-cols-2 gap-1">{children}</div>
				<div className="h-6 text-[11px] @min-[9rem]/card:h-11 @min-[9rem]/card:text-sm [&>a]:h-full">
					{open}
				</div>
			</div>
			<div className="mt-auto flex flex-col gap-1 @min-[7.5rem]/card:hidden">
				<div className="h-11 text-xs [&>a]:h-full">{open}</div>
				<button
					type="button"
					aria-haspopup="dialog"
					aria-label={`Actions for ${title}`}
					onClick={onSheet}
					className={`inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-md text-xs font-semibold ${DARK} ${FOCUS}`}
				>
					Actions
				</button>
			</div>
		</div>
	)
}

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
