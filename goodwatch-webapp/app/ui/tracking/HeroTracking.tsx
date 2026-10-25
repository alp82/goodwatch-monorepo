import { PauseIcon } from "@heroicons/react/20/solid"
// The hero's "your show" block on a show page for a member who tracks episodes (#369, #384). Started: one line with
// the progress and the Next episode as a chip that leads to its row in the episode list, and the question after a
// first score when it is due; every other action is in the status menu. Not started: Want to See beside "Already
// watching?", which leads to the episode list. The status, with its menu, and the score are one control in the
// hero's ratings (ui/title-actions/SeenScore.tsx). When a score is due, the score half says so (RATE_DUE_EVENT).
// Loaded after the page is up; until its data is there, and for a show without an episode list, it shows what the
// first paint showed.
import {
	CheckIcon,
	ClockIcon,
	EyeSlashIcon,
	NoSymbolIcon,
	PlayIcon,
} from "@heroicons/react/24/solid"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { episodeLabel } from "~/domain/tracking/machine"
import type { ShowView } from "~/domain/tracking/show-page"
import type { MenuEntry, MenuEntryId } from "~/domain/tracking/status-menu"
import { EPISODE_GRID_ANCHOR } from "~/ui/details/episode-grid/scale"
import { RATE_DUE_EVENT, SCORE_SAVED_EVENT } from "~/ui/title-actions/SeenScore"
import { HALF_FOCUS } from "~/ui/details/hero/seen-score-faces"
import { ActionButton } from "~/ui/title-actions/ActionButton"
import { useTitleActions } from "~/ui/title-actions/useTitleActions"
import {
	ConfirmPanel,
	POPOVER,
	TAKE_BACK_LOOK,
	TrackingToastHost,
	useDismiss,
} from "./TrackingToast"
import { type TrackingActions, useTrackingActions } from "./actions"
import { HERO_ACTIONS, STATUS_LINE, type TrackedMedia } from "./gate"
import { FOCUS, type ShowTracking, plural, useShowTracking } from "./store"

export default function HeroTracking({
	media,
	first,
	bare,
}: {
	media: TrackedMedia
	/** What the first paint showed: today's action set, under the status box for a show with a state. */
	first: ReactNode
	/** Today's action set alone. */
	bare: ReactNode
}) {
	const tracking = useShowTracking(media.details.tmdb_id)
	const actions = useTrackingActions(tracking.store, media.details.title)
	const { view, page } = tracking
	// A show without an episode list is tracked as today: Seen for the whole show, and the status.
	// Once read, a show without an episode list (or one whose tracking failed) keeps today's actions without the room
	// the first paint kept for the status line.
	if (!tracking.ready || !view || !page)
		return <>{page || tracking.failed ? bare : first}</>
	return (
		<div data-tracking-hero={view.derived.state} className={HERO_ACTIONS}>
			{view.derived.state !== "not_started" ? (
				<div className="flex min-w-0 items-center gap-2">
					{view.derived.state === "seen" && <WantButton media={media} rewatch />}
					<StatusLine
						media={media}
						tracking={tracking}
						view={view}
						actions={actions}
					/>
				</div>
			) : (
				<div className="flex min-w-0 items-center gap-2">
					<WantButton media={media} />
					<StartLine tracking={tracking} view={view} />
				</div>
			)}
			<Prompts tracking={tracking} view={view} actions={actions} />
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
type EntryId = MenuEntryId | "notStarted"
/** A menu entry, with the page's own "Not started" beside the machine's (status-menu.ts). */
type Entry = Omit<MenuEntry, "id"> & { id: EntryId }

const MENU_LOOK: Record<
	EntryId,
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
	notStarted: { Icon: EyeSlashIcon, tint: "text-gray-400" },
}

/**
 * Not started, as a menu entry: it removes every watch of this pass. Offered while the pass has a watch, before Drop.
 */
function withNotStarted(menu: MenuEntry[], view: ShowView): Entry[] {
	if (!view.derived.watched) return menu
	const entry: Entry = {
		id: "notStarted",
		label: "Not started",
		note: `Unticks all ${plural(view.derived.watched, "episode")} you've watched${view.derived.pass > 1 ? " in this pass" : ""}.`,
		quiet: true,
		confirm: true,
		event: null,
		row: null,
	}
	const drop = menu.findIndex((each) => each.id === "drop")
	return drop < 0
		? [...menu, entry]
		: [...menu.slice(0, drop), entry, ...menu.slice(drop)]
}

/**
 * The status and its menu. It is drawn as the status half of the Seen and score control in the hero's ratings
 * (HeroStatus.tsx), whose face it is given.
 */
export function StatusPill({
	view,
	actions,
	onRewatch,
	face,
}: {
	view: ShowView
	actions: TrackingActions
	/** Want to rewatch, on or off: the Wishlist's own writer, as the Want to See button uses it. */
	onRewatch: () => void
	/** The status half's face: the button shows it. */
	face: ReactNode
}) {
	const [open, setOpen] = useState(false)
	/** The entry the menu asks about before it goes on. */
	const [confirming, setConfirming] = useState<Entry | null>(null)
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
	const { derived, press } = view
	const menu = withNotStarted(view.menu, view)
	if (derived.state === "not_started") return null
	if (!menu.length)
		return (
			<span data-status-pill className="flex h-full rounded-l-xl">
				{face}
			</span>
		)
	const run = (entry: Entry, confirmed = false) => {
		if (entry.confirm && !confirmed) return setConfirming(entry)
		close()
		switch (entry.id) {
			case "markNew":
			case "markAll":
				return actions.pressSeen()
			case "takeBack":
				return actions.undoSeen()
			case "notStarted":
				return actions.notStarted()
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
		<div ref={root} className="relative flex h-full">
			<button
				ref={pillButton}
				type="button"
				data-status-pill
				aria-haspopup="menu"
				aria-expanded={open}
				aria-label={`Status: ${derived.label}. Change it`}
				onClick={() => (open ? close() : setOpen(true))}
				className={`flex h-full cursor-pointer rounded-l-xl hover:brightness-110 ${HALF_FOCUS}`}
			>
				{face}
			</button>
			{open && (
				<div
					ref={menuBox}
					role={confirming ? "alertdialog" : "menu"}
					aria-label={confirming ? confirming.label : "Change the status"}
					onKeyDown={confirming ? undefined : onMenuKey}
					className={`absolute left-0 top-full z-40 mt-1.5 w-80 max-w-[calc(100vw-2.5rem)] ${POPOVER}`}
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
					) : confirming?.id === "notStarted" ? (
						<ConfirmPanel
							name="notStarted"
							title="Mark as not started?"
							text={`${confirming.note} The toast that follows can undo it.`}
							action="Not started"
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
/** The look of a progress line that is itself the link to the episode list. */
const LINE_LINK = `group flex h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg bg-white/10 px-3 ring-1 ring-white/15 transition-colors hover:bg-white/20 ${FOCUS}`

/** Watched of aired as a count and a bar that takes the room left. */
function WideProgress({ watched, aired }: { watched: number; aired: number }) {
	return (
		<>
			<span className="shrink-0 text-xs font-semibold tabular-nums text-white">
				{watched}/{aired}
			</span>
			<span
				className="block h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/15"
				aria-hidden="true"
			>
				<span
					className="block h-full rounded-full bg-green-500 transition-[width]"
					style={{ width: `${aired ? (watched / aired) * 100 : 0}%` }}
				/>
			</span>
			<ArrowDownIcon className="h-3.5 w-3.5 shrink-0 text-gray-300 transition group-hover:translate-y-0.5 group-hover:text-white" />
		</>
	)
}

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
	const seasons = new Set(
		aired.map((episode) => episode.displaySeason ?? episode.season),
	).size
	// An empty progress bar: the way to the episode list, where the episodes already seen are marked.
	const words = `Already watching? ${plural(seasons, "season")} · ${plural(view.derived.aired, "episode")}. Mark what you've seen in the episode list.`
	return (
		<a
			href={`#${EPISODE_GRID_ANCHOR}`}
			data-tracking-box
			data-start-episodes
			aria-label={words}
			title={words}
			onClick={(event) => {
				event.preventDefault()
				tracking.store.openEpisode(first.id)
			}}
			className={LINE_LINK}
		>
			<WideProgress watched={0} aired={view.derived.aired} />
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
	const progress = (
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
				className={`block h-1.5 w-10 overflow-hidden rounded-full bg-white/10 sm:w-20 ${narrow}`}
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
	)
	// Without a Next episode the whole line leads to the episode list.
	if (!next)
		return (
			<a
				href={`#${EPISODE_GRID_ANCHOR}`}
				data-tracking-box
				data-go-episodes
				aria-label={`${extras.join(", ")}. ${noNext} Go to episodes`}
				title={`${extras.join(" · ")}. ${noNext}`}
				onClick={(event) => {
					event.preventDefault()
					tracking.store.openEpisode(null)
				}}
				className={LINE_LINK}
			>
				<WideProgress watched={derived.watched} aired={derived.aired} />
			</a>
		)
	return (
		<div data-tracking-box className={`${STATUS_LINE} flex-1`}>
			{progress}
			{/* Navigation, not an action: the chip leads to the episode's row, where it is marked. */}
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
						<span className={derived.newEpisodes ? "hidden" : "max-sm:hidden"}>
							{derived.newEpisodes ? " since you saw it" : " episode"}
						</span>
					</span>
					<span data-go-episodes className={GO}>
						{episodeLabel(next)}
						<ArrowDownIcon className="h-3.5 w-3.5" />
					</span>
				</a>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The prompt to rate, and "Have you seen all of it?"
// ---------------------------------------------------------------------------------------------------------

function Prompts({
	tracking,
	view,
	actions,
}: {
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
	// A score that is due shows in the score half itself, not as a banner here.
	const due = view.ratePrompt
	useEffect(() => {
		window.dispatchEvent(new CustomEvent(RATE_DUE_EVENT, { detail: due }))
	}, [due])
	useEffect(
		() => () =>
			void window.dispatchEvent(
				new CustomEvent(RATE_DUE_EVENT, { detail: null }),
			),
		[],
	)
	return (
		<>
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
// Want to See
// ---------------------------------------------------------------------------------------------------------

/**
 * Want to See, beside "Already watching?" on a show that isn't started, and Rewatch beside the progress of a Seen
 * show. Everything else is in the status menus.
 */
function WantButton({
	media,
	rewatch = false,
}: { media: TrackedMedia; rewatch?: boolean }) {
	const a = useTitleActions(media)
	return (
		<ActionButton
			kind="want"
			label={rewatch ? "short" : "long"}
			size="sm"
			rewatch={rewatch}
			title={
				rewatch
					? a.want
						? "On your Wishlist to watch again. Press to take it off."
						: "Puts it on your Wishlist to watch again some day. Your episodes stay ticked; Watch again, in the status menu, starts a new pass now."
					: undefined
			}
			className="!w-auto shrink-0 px-3"
			active={a.want}
			disabled={a.wantPending}
			onClick={a.toggleWant}
		/>
	)
}
