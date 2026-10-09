import { PauseIcon } from "@heroicons/react/20/solid"
// The hero's "your show" block on a show page for a member who tracks episodes (#369, #384): one line with the
// status pill and its menu, the progress, and the Next episode as a chip that leads to its row in the episode
// list; the prompt to rate and the question after a first score, when they are due; and the actions in one row.
// The score itself is in the hero's ratings (ui/details/hero/OwnScore.tsx), and the prompt opens its picker.
// Loaded after the page is up; until its data is there, and for a show without an episode list, it shows what the
// first paint showed.
import {
	CheckIcon,
	ChevronDownIcon,
	ClockIcon,
	EyeIcon,
	NoSymbolIcon,
	PlayIcon,
} from "@heroicons/react/24/solid"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { episodeLabel } from "~/domain/tracking/machine"
import type { ShowView } from "~/domain/tracking/show-page"
import type { MenuEntry, MenuEntryId } from "~/domain/tracking/status-menu"
import { EPISODE_GRID_ANCHOR } from "~/ui/details/episode-grid/scale"
import { SCORE_SAVED_EVENT, openScorePicker } from "~/ui/details/hero/OwnScore"
import { ActionButton } from "~/ui/title-actions/ActionButton"
import { useTitleActions } from "~/ui/title-actions/useTitleActions"
import { useUndoToast, warmUndoToast } from "~/ui/title-actions/useUndoToast"
import {
	ConfirmPanel,
	POPOVER,
	TAKE_BACK_LOOK,
	TrackingToastHost,
	useDismiss,
} from "./TrackingToast"
import { type TrackingActions, useTrackingActions } from "./actions"
import {
	HERO_ACTIONS,
	STATUS_LINE,
	STATUS_LOOK,
	type TrackedMedia,
} from "./gate"
import { FOCUS, type ShowTracking, plural, useShowTracking } from "./store"

export default function HeroTracking({
	media,
	first,
}: {
	media: TrackedMedia
	/** What the first paint showed: today's action set, under the status box for a show with a state. */
	first: ReactNode
}) {
	const tracking = useShowTracking(media.details.tmdb_id)
	const actions = useTrackingActions(tracking.store, media.details.title)
	const { view, page } = tracking
	// A show without an episode list is tracked as today: Seen for the whole show, and the status.
	if (!tracking.ready || !view || !page) return <>{first}</>
	return (
		<div data-tracking-hero={view.derived.state} className={HERO_ACTIONS}>
			{view.derived.state !== "not_started" ? (
				<StatusLine
					media={media}
					tracking={tracking}
					view={view}
					actions={actions}
				/>
			) : (
				<StartLine tracking={tracking} view={view} />
			)}
			<Prompts
				media={media}
				tracking={tracking}
				view={view}
				actions={actions}
			/>
			<Buttons media={media} view={view} actions={actions} />
			<TrackingToastHost tracking={tracking} actions={actions} />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The line: status, progress, Next episode
// ---------------------------------------------------------------------------------------------------------

// The icons only tracking draws (Heroicons 24 solid, MIT), written out here: imported from the icon package, or kept
// in a small module of their own, they would be added to a chunk that every page loads.
const icon = (paths: string[]) =>
	function TrackingIcon({ className }: { className?: string }) {
		return (
			<svg
				viewBox="0 0 24 24"
				fill="currentColor"
				aria-hidden="true"
				className={className}
			>
				{paths.map((d) => (
					<path key={d} fillRule="evenodd" clipRule="evenodd" d={d} />
				))}
			</svg>
		)
	}

const ArrowDownIcon = icon([
	"M12 2.25a.75.75 0 0 1 .75.75v16.19l6.22-6.22a.75.75 0 1 1 1.06 1.06l-7.5 7.5a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 1 1 1.06-1.06l6.22 6.22V3a.75.75 0 0 1 .75-.75Z",
])
const ArrowPathIcon = icon([
	"M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.903 1.903h-3.183a.75.75 0 1 0 0 1.5h4.992a.75.75 0 0 0 .75-.75V4.356a.75.75 0 0 0-1.5 0v3.18l-1.9-1.9A9 9 0 0 0 3.306 9.67a.75.75 0 1 0 1.45.388Zm15.408 3.352a.75.75 0 0 0-.919.53 7.5 7.5 0 0 1-12.548 3.364l-1.902-1.903h3.183a.75.75 0 0 0 0-1.5H2.984a.75.75 0 0 0-.75.75v4.992a.75.75 0 0 0 1.5 0v-3.18l1.9 1.9a9 9 0 0 0 15.059-4.035.75.75 0 0 0-.53-.918Z",
])
const ArrowUturnLeftIcon = icon([
	"M9.53 2.47a.75.75 0 0 1 0 1.06L4.81 8.25H15a6.75 6.75 0 0 1 0 13.5h-3a.75.75 0 0 1 0-1.5h3a5.25 5.25 0 1 0 0-10.5H4.81l4.72 4.72a.75.75 0 1 1-1.06 1.06l-6-6a.75.75 0 0 1 0-1.06l6-6a.75.75 0 0 1 1.06 0Z",
])
const BookmarkIcon = icon([
	"M6.32 2.577a49.255 49.255 0 0 1 11.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 0 1-1.085.67L12 18.089l-7.165 3.583A.75.75 0 0 1 3.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93Z",
])

/** How each entry of the menu looks. What it says and whether it is offered is the machine's (status-menu.ts). */
const MENU_LOOK: Record<
	MenuEntryId,
	{ Icon: (props: { className?: string }) => React.ReactNode; tint: string }
> = {
	markNew: { Icon: CheckIcon, tint: "text-green-300" },
	markAll: { Icon: CheckIcon, tint: "text-green-300" },
	wantToSee: { Icon: BookmarkIcon, tint: "text-amber-300" },
	resume: { Icon: PlayIcon, tint: "text-sky-300" },
	hold: { Icon: PauseIcon, tint: "text-violet-300" },
	watchAgain: { Icon: ArrowPathIcon, tint: "text-sky-300" },
	rewatch: { Icon: BookmarkIcon, tint: "text-amber-300" },
	takeBack: { Icon: ArrowUturnLeftIcon, tint: "text-gray-400" },
	setDate: { Icon: ClockIcon, tint: "text-gray-300" },
	drop: { Icon: NoSymbolIcon, tint: "text-pink-300/80" },
}

function StatusPill({
	view,
	actions,
	onRewatch,
}: {
	view: ShowView
	actions: TrackingActions
	/** Want to rewatch, on or off: the Wishlist's own writer, as the Want to See button uses it. */
	onRewatch: () => void
}) {
	const [open, setOpen] = useState(false)
	/** The entry the menu asks about before it goes on. */
	const [confirming, setConfirming] = useState<MenuEntry | null>(null)
	const root = useRef<HTMLDivElement>(null)
	const pillButton = useRef<HTMLButtonElement>(null)
	const close = () => {
		setOpen(false)
		setConfirming(null)
	}
	const menuBox = useRef<HTMLDivElement>(null)
	// The menu takes the focus when it opens, so that the arrow keys and a screen reader are in it.
	useEffect(() => {
		if (open && !confirming)
			menuBox.current
				?.querySelector<HTMLElement>("[role=menuitem]")
				?.focus({ preventScroll: true })
	}, [open, confirming])
	useDismiss(open, root, (byKey) => {
		close()
		if (byKey) pillButton.current?.focus()
	})
	const { derived, menu, press } = view
	if (derived.state === "not_started") return null
	const pill = `inline-flex h-9 shrink-0 items-center whitespace-nowrap gap-1.5 rounded-lg px-2.5 text-xs font-semibold ${STATUS_LOOK[derived.state].pill}`
	if (!menu.length)
		return (
			<span data-status-pill className={pill}>
				{derived.label}
			</span>
		)
	const run = (entry: MenuEntry, confirmed = false) => {
		if (entry.confirm && !confirmed) return setConfirming(entry)
		close()
		switch (entry.id) {
			case "markNew":
			case "markAll":
				return actions.pressSeen()
			case "takeBack":
				return actions.undoSeen()
			case "setDate":
				return press && actions.askGroupDate(press.group, press.count)
			case "wantToSee":
				return void actions.wantToSee()
			case "rewatch":
				return onRewatch()
			default:
				return actions[entry.id]()
		}
	}
	/** Up and down move through the entries, as in any menu. */
	const onMenuKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
		const by = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0
		if (!by) return
		event.preventDefault()
		const items = [
			...event.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]"),
		]
		const at = items.indexOf(document.activeElement as HTMLElement)
		items[(at + by + items.length) % items.length]?.focus()
	}
	return (
		<div ref={root} className="relative">
			<button
				ref={pillButton}
				type="button"
				data-status-pill
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => (open ? close() : setOpen(true))}
				className={`${pill} cursor-pointer ${FOCUS}`}
			>
				{derived.label}
				<ChevronDownIcon className="h-3.5 w-3.5" />
			</button>
			{open && (
				<div
					ref={menuBox}
					role={confirming ? "alertdialog" : "menu"}
					aria-label={confirming ? confirming.label : "Change the status"}
					onKeyDown={confirming ? undefined : onMenuKey}
					className={`absolute left-0 top-full z-40 mt-1 w-80 max-w-[calc(100vw-4rem)] ${POPOVER}`}
				>
					{confirming?.id === "takeBack" ? (
						// The words are the menu entry's own: what the press marked, and where the show goes.
						<ConfirmPanel
							name="takeBack"
							title="Take back Seen?"
							text={confirming.note}
							action="Take back"
							look={TAKE_BACK_LOOK}
							onCancel={close}
							onConfirm={() => run(confirming, true)}
						/>
					) : confirming ? (
						<ConfirmPanel
							name="watchAgain"
							title={`Start pass ${derived.pass + 1}?`}
							text="The ticks start empty. The watches of this pass stay in each episode's log. This can't be undone."
							action="Watch again"
							look="bg-sky-500 text-black hover:bg-sky-400"
							onCancel={close}
							onConfirm={() => run(confirming, true)}
						/>
					) : (
						menu.map((entry) => {
							const look = MENU_LOOK[entry.id]
							return (
								<button
									key={entry.id}
									type="button"
									role="menuitem"
									data-status-action={entry.id}
									data-quiet={entry.quiet || undefined}
									onClick={() => run(entry)}
									className={`flex min-h-11 w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/10 ${FOCUS}`}
								>
									<look.Icon
										className={`mt-0.5 h-4 w-4 shrink-0 ${look.tint}`}
									/>
									<span className="min-w-0 flex-1">
										<span
											className={`block text-sm ${entry.quiet ? "font-medium text-gray-300" : "font-semibold text-white"}`}
										>
											{entry.label}
										</span>
										<span
											className={`block text-xs ${entry.quiet ? "text-gray-500" : "text-gray-400"}`}
										>
											{entry.note}
										</span>
									</span>
								</button>
							)
						})
					)}
				</div>
			)}
		</div>
	)
}

/** The chip that says where the line's link leads: down to the episode list. */
const GO =
	"inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-white/10 px-3 text-xs font-semibold text-white ring-1 ring-white/15 hover:bg-white/20 group-hover:bg-white/20"

/** A show nobody has started yet: no status and no progress, only the way down to its seasons and episodes. */
function StartLine({
	tracking,
	view,
}: {
	tracking: ShowTracking
	view: ShowView
}) {
	const aired = (tracking.page?.episodes ?? []).filter(
		(episode) =>
			episode.season > 0 &&
			episode.airDate !== null &&
			episode.airDate <= tracking.today,
	)
	if (!aired.length) return null
	const first = aired.reduce((a, b) =>
		a.season < b.season || (a.season === b.season && a.number <= b.number)
			? a
			: b,
	)
	const seasons = new Set(aired.map((episode) => episode.season)).size
	return (
		<a
			href={`#${EPISODE_GRID_ANCHOR}`}
			data-tracking-box
			data-start-episodes
			aria-label={`${plural(seasons, "season")}, ${plural(view.derived.aired, "episode")}. Go to the episode list to mark what you've watched`}
			onClick={(event) => {
				event.preventDefault()
				tracking.store.openEpisode(first.id)
			}}
			className={`group rounded-lg ${STATUS_LINE} ${FOCUS}`}
		>
			<span className="min-w-0 flex-1 truncate text-sm text-gray-300">
				<span className="font-semibold text-white">Already watching?</span>{" "}
				<span className="max-sm:hidden">
					{plural(seasons, "season")} · {plural(view.derived.aired, "episode")}
				</span>
			</span>
			<span data-go-episodes className={GO}>
				Episodes
				<ArrowDownIcon className="h-3.5 w-3.5" />
			</span>
		</a>
	)
}

function StatusLine({
	media,
	tracking,
	view,
	actions,
}: {
	media: TrackedMedia
	tracking: ShowTracking
	view: ShowView
	actions: TrackingActions
}) {
	const { toggleWant } = useTitleActions(media)
	const { derived } = view
	const next =
		derived.next &&
		tracking.page?.episodes.find((episode) => episode.id === derived.next?.id)
	const upcoming = tracking.page?.episodes
		.filter(
			(episode) =>
				episode.season > 0 &&
				episode.airDate !== null &&
				episode.airDate > tracking.today,
		)
		.sort((a, b) => (a.airDate ?? "").localeCompare(b.airDate ?? ""))[0]
	const extras = [
		`${derived.pass > 1 ? `Pass ${derived.pass} · ` : ""}${derived.watched} of ${derived.aired} episodes`,
		view.unaired ? `${view.unaired} not aired yet` : "",
		view.specialsWatched
			? `${plural(view.specialsWatched, "special")} watched, not counted`
			: "",
	].filter(Boolean)
	// With new episodes the pill says how many, and a phone has no room for the bar and the word beside it.
	const narrow = derived.newEpisodes > 0 ? "max-sm:hidden" : ""
	// What the line says when there is no Next episode.
	const noNext =
		derived.state === "dropped"
			? "You dropped it. Resume brings it back."
			: derived.aired === 0
				? "No episode has aired yet."
				: derived.watched < derived.aired
					? `${plural(derived.aired - derived.watched, "episode")} left.`
					: `You've watched every episode.${
							upcoming?.airDate
								? ` ${episodeLabel(upcoming)} airs ${upcoming.airDate === tracking.today ? "today" : upcoming.airDate}.`
								: ""
						}`
	return (
		<div data-tracking-box className={STATUS_LINE}>
			<StatusPill view={view} actions={actions} onRewatch={toggleWant} />
			<p
				data-progress
				title={extras.join(" · ")}
				aria-label={extras.join(", ")}
				className="flex shrink-0 items-center gap-2 text-xs font-semibold tabular-nums text-white"
			>
				{derived.pass > 1 && (
					<span className="font-normal text-gray-400 max-sm:hidden">
						Pass {derived.pass}
					</span>
				)}
				<span>
					{derived.watched}/{derived.aired}
				</span>
				<span
					className={`block h-1.5 w-10 overflow-hidden rounded-full bg-white/10 sm:w-20 xl:w-28 ${narrow}`}
					aria-hidden="true"
				>
					<span
						className="block h-full rounded-full bg-green-500 transition-[width]"
						style={{
							width: `${derived.aired ? (derived.watched / derived.aired) * 100 : 0}%`,
						}}
					/>
				</span>
			</p>
			{next ? (
				// Navigation, not an action: the chip leads to the episode's row, where it is marked.
				<a
					href={`#${EPISODE_GRID_ANCHOR}`}
					data-next-episode
					aria-label={`${derived.newEpisodes ? "New since you saw it" : "Next episode"}: ${episodeLabel(next)}${next.name ? `, ${next.name}` : ""}. Go to it in the episode list`}
					title={`${derived.newEpisodes ? "New since you saw it" : "Next episode"}: ${episodeLabel(next)}${next.name ? ` · ${next.name}` : ""}`}
					onClick={(event) => {
						event.preventDefault()
						tracking.store.openEpisode(next.id)
					}}
					className={`group ml-auto flex min-w-0 items-center gap-2 rounded-lg ${FOCUS}`}
				>
					<span className={`shrink-0 text-xs text-gray-400 ${narrow}`}>
						{derived.newEpisodes ? "New" : "Next"}
						<span className="max-xl:hidden">
							{derived.newEpisodes ? " since you saw it" : " episode"}
						</span>
					</span>
					{next.name && (
						<span className="min-w-0 truncate text-xs font-medium text-gray-200 max-xl:hidden">
							{next.name}
						</span>
					)}
					<span data-go-episodes className={GO}>
						{episodeLabel(next)}
						<ArrowDownIcon className="h-3.5 w-3.5" />
					</span>
				</a>
			) : (
				<>
					<p
						data-no-next
						className="ml-auto min-w-0 truncate text-right text-xs text-gray-300 max-sm:sr-only"
					>
						{noNext}
					</p>
					<a
						href={`#${EPISODE_GRID_ANCHOR}`}
						data-go-episodes
						aria-label="Go to episodes"
						title={noNext}
						onClick={(event) => {
							event.preventDefault()
							tracking.store.openEpisode(null)
						}}
						className={`max-sm:ml-auto ${GO} ${FOCUS}`}
					>
						Episodes
						<ArrowDownIcon className="h-3.5 w-3.5" />
					</a>
				</>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The prompt to rate, and "Have you seen all of it?"
// ---------------------------------------------------------------------------------------------------------

const LINK = `shrink-0 cursor-pointer text-xs underline underline-offset-2 hover:text-white ${FOCUS}`

function Prompts({
	media,
	tracking,
	view,
	actions,
}: {
	media: TrackedMedia
	tracking: ShowTracking
	view: ShowView
	actions: TrackingActions
}) {
	// The server decides after a first score by hand whether to ask if the show was seen: read once it is stored.
	useEffect(() => {
		const saved = () => tracking.store.refetch()
		window.addEventListener(SCORE_SAVED_EVENT, saved)
		return () => window.removeEventListener(SCORE_SAVED_EVENT, saved)
	}, [tracking.store])
	const prompt = view.ratePrompt
	return (
		<>
			{prompt && (
				// The picker is the score rectangle's, in the hero's ratings: the prompt opens it.
				<div
					data-rate-prompt={prompt}
					className="flex items-center gap-2 rounded-xl bg-amber-300/[0.09] py-1.5 pl-3 pr-2 ring-1 ring-amber-300/50"
				>
					<p className="min-w-0 flex-1 text-sm font-semibold text-white">
						{prompt === "all" ? (
							<>
								You've watched all of {media.details.title}.{" "}
								<span className="text-amber-200">How was it?</span>
							</>
						) : (
							<>
								{view.derived.watched > 3 ? "A few" : "Three"} episodes in.{" "}
								<span className="text-amber-200">
									How is {media.details.title} so far?
								</span>
							</>
						)}
					</p>
					<button
						type="button"
						data-rate-open
						aria-haspopup="dialog"
						onClick={openScorePicker}
						className={`h-8 shrink-0 cursor-pointer rounded-lg bg-amber-400 px-3 text-xs font-bold text-black hover:bg-amber-300 ${FOCUS}`}
					>
						Rate
					</button>
					<button
						type="button"
						data-rate-not-now
						onClick={actions.dismissRatePrompt}
						className={`${LINK} text-gray-300 decoration-white/30`}
					>
						Not now
					</button>
				</div>
			)}
			{view.derived.seenQuestion && (
				<div
					data-seen-question
					className="rounded-xl bg-white/[0.06] p-3 ring-1 ring-white/10"
				>
					<p className="text-sm font-semibold text-white">
						Have you seen all of it?
					</p>
					<div className="mt-2 flex flex-wrap gap-2">
						{(
							[
								["yes", "Yes, all of it", actions.pressSeen],
								[
									"partway",
									"I'm partway",
									() => {
										actions.answerSeenQuestion("partway")
										tracking.store.openEpisode(null)
									},
								],
								[
									"just_rating",
									"Just rating",
									() => actions.answerSeenQuestion("just_rating"),
								],
							] as const
						).map(([key, label, run]) => (
							<button
								key={key}
								type="button"
								data-seen-answer={key}
								onClick={run}
								className={`h-9 cursor-pointer rounded-lg bg-white/10 px-3 text-xs font-semibold text-gray-100 hover:bg-white/20 ${FOCUS}`}
							>
								{label}
							</button>
						))}
					</div>
				</div>
			)}
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------
// Want to See, Seen, and Not interested or Drop
// ---------------------------------------------------------------------------------------------------------

const BUTTON = `inline-flex h-9 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-2 text-xs font-semibold transition-colors ${FOCUS}`
const OFF = "bg-white/10 text-gray-100 hover:bg-white/20"

/**
 * The actions of the state, in one row that they fill. A Seen show says so in its status pill, so it has no Seen
 * button: taking Seen back is in the pill's menu, and the row has Want to rewatch, and the press that marks
 * episodes that are new.
 */
function Buttons({
	media,
	view,
	actions,
}: {
	media: TrackedMedia
	view: ShowView
	actions: TrackingActions
}) {
	const a = useTitleActions(media)
	const toast = useUndoToast()
	const { state } = view.derived
	const { seen } = view
	const isSeen = state === "seen"
	return (
		<div
			data-title-actions
			className="flex min-w-0 gap-2"
			onPointerEnter={warmUndoToast}
			onPointerDown={warmUndoToast}
			onFocus={warmUndoToast}
		>
			{(state === "not_started" || isSeen) && (
				<ActionButton
					kind="want"
					label="long"
					size="sm"
					className="flex-1"
					rewatch={isSeen}
					active={a.want}
					disabled={a.wantPending}
					title={
						isSeen
							? a.want
								? "On your Wishlist to watch again. Press to take it off."
								: "Puts it on your Wishlist to watch again some day. Your episodes stay ticked; Watch again, in the status menu, starts a new pass now."
							: undefined
					}
					onClick={a.toggleWant}
				/>
			)}
			{(!isSeen || seen.mode === "markNew") && (
				<button
					type="button"
					data-seen-button={seen.mode}
					onClick={actions.pressSeen}
					className={`${BUTTON} ${OFF}`}
				>
					<EyeIcon className="h-4 w-4 shrink-0 text-green-300" />
					<span className="truncate">
						{seen.mode === "markNew"
							? `Mark ${seen.newEpisodes} new`
							: "Mark as Seen"}
					</span>
				</button>
			)}
			{state === "watching" || state === "on_hold" ? (
				<button
					type="button"
					data-drop
					title="Give it up. It is hidden from your recommendations."
					onClick={actions.drop}
					className={`${BUTTON} ${OFF}`}
				>
					<NoSymbolIcon className="h-4 w-4 shrink-0 text-pink-300" />
					<span className="truncate">Drop</span>
				</button>
			) : state === "dropped" ? (
				<button
					type="button"
					data-drop="on"
					aria-pressed
					title="Dropped. Press to resume it."
					onClick={actions.resume}
					className={`${BUTTON} bg-pink-500 text-black`}
				>
					<NoSymbolIcon className="h-4 w-4 shrink-0" />
					<span className="truncate">Dropped</span>
				</button>
			) : (
				state === "not_started" &&
				(a.canHide || a.hidden) && (
					<ActionButton
						kind="hide"
						label="wide"
						size="sm"
						className="max-sm:w-9 max-sm:flex-none sm:flex-1"
						active={a.hidden}
						disabled={a.hidePending}
						title={
							a.hidden
								? "Hidden from your recommendations. Press to bring it back."
								: "Hide it from your recommendations"
						}
						onClick={() => {
							if (a.hidden) a.unhide()
							else
								toast.say(
									`${media.details.title} is hidden from your recommendations`,
									a.hide(),
								)
						}}
					/>
				)
			)}
			{toast.node}
		</div>
	)
}
