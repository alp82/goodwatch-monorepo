import { PauseIcon } from "@heroicons/react/20/solid"
// The hero's title actions on a show page for a member who tracks episodes (#369, #384): the box with the status
// pill and its menu, the progress and the Next episode as a link to its row in the episode list; the page's one
// score control, which carries the prompt to rate and the question after a first score; and Want to See, Seen and
// Not interested or Drop.
// Loaded after the page is up; until its data is there, and for a show without an episode list, it shows what the
// first paint showed.
import {
	ArrowDownIcon,
	ArrowPathIcon,
	ArrowUturnLeftIcon,
	BookmarkIcon,
	CalendarDaysIcon,
	CheckIcon,
	ChevronDownIcon,
	EyeIcon,
	NoSymbolIcon,
	PlayIcon,
} from "@heroicons/react/24/solid"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { episodeLabel } from "~/domain/tracking/machine"
import type { ShowView } from "~/domain/tracking/show-page"
import type { MenuEntry, MenuEntryId } from "~/domain/tracking/status-menu"
import { useUserScore } from "~/hooks/useUserDataAccessors"
import { EPISODE_GRID_ANCHOR } from "~/ui/details/episode-grid/scale"
import { ActionButton } from "~/ui/title-actions/ActionButton"
import { ScoreControl } from "~/ui/title-actions/ScoreControl"
import {
	SEEN_SO_NOT_HIDEABLE,
	useTitleActions,
} from "~/ui/title-actions/useTitleActions"
import { useUndoToast, warmUndoToast } from "~/ui/title-actions/useUndoToast"
import { useScoreAction } from "~/ui/user/actions/ScoreAction"
import { TrackingToastHost } from "./TrackingToast"
import { type TrackingActions, useTrackingActions } from "./actions"
import { STATUS_LOOK, StatusBoxFrame, type TrackedMedia } from "./gate"
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
		<div data-tracking-hero={view.derived.state}>
			{view.derived.state !== "not_started" && (
				<StatusBox tracking={tracking} view={view} actions={actions} />
			)}
			<div className="@container">
				<Score
					media={media}
					tracking={tracking}
					view={view}
					actions={actions}
				/>
				<Buttons media={media} view={view} actions={actions} />
			</div>
			<TrackingToastHost tracking={tracking} actions={actions} />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The box: status, progress, Next episode
// ---------------------------------------------------------------------------------------------------------

/** How each entry of the menu looks. What it says and whether it is offered is the machine's (status-menu.ts). */
const MENU_LOOK: Record<MenuEntryId, { Icon: typeof PlayIcon; tint: string }> =
	{
		markNew: { Icon: CheckIcon, tint: "text-green-300" },
		markAll: { Icon: CheckIcon, tint: "text-green-300" },
		wantToSee: { Icon: BookmarkIcon, tint: "text-amber-300" },
		resume: { Icon: PlayIcon, tint: "text-sky-300" },
		hold: { Icon: PauseIcon, tint: "text-violet-300" },
		watchAgain: { Icon: ArrowPathIcon, tint: "text-sky-300" },
		takeBack: { Icon: ArrowUturnLeftIcon, tint: "text-gray-400" },
		setDate: { Icon: CalendarDaysIcon, tint: "text-gray-300" },
		drop: { Icon: NoSymbolIcon, tint: "text-pink-300/80" },
	}

function StatusPill({
	view,
	actions,
}: {
	view: ShowView
	actions: TrackingActions
}) {
	const [open, setOpen] = useState(false)
	const [confirming, setConfirming] = useState(false)
	const root = useRef<HTMLDivElement>(null)
	const pillButton = useRef<HTMLButtonElement>(null)
	const close = () => {
		setOpen(false)
		setConfirming(false)
	}
	const menuBox = useRef<HTMLDivElement>(null)
	// The menu takes the focus when it opens, so that the arrow keys and a screen reader are in it.
	useEffect(() => {
		if (open && !confirming)
			menuBox.current
				?.querySelector<HTMLElement>("[role=menuitem]")
				?.focus({ preventScroll: true })
	}, [open, confirming])
	useEffect(() => {
		if (!open) return
		const onPress = (event: PointerEvent) => {
			if (!root.current?.contains(event.target as Node)) close()
		}
		window.addEventListener("pointerdown", onPress)
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return
			close()
			pillButton.current?.focus()
		}
		window.addEventListener("keydown", onKey)
		return () => {
			window.removeEventListener("pointerdown", onPress)
			window.removeEventListener("keydown", onKey)
		}
	}, [open])
	const { derived, menu, press } = view
	if (derived.state === "not_started") return null
	const pill = `inline-flex h-9 shrink-0 items-center whitespace-nowrap gap-1.5 rounded-lg px-2.5 text-xs font-semibold ${STATUS_LOOK[derived.state].pill}`
	if (!menu.length)
		return (
			<span data-status-pill className={pill}>
				{derived.label}
			</span>
		)
	const run = (entry: MenuEntry) => {
		if (entry.confirm) return setConfirming(true)
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
					role="menu"
					aria-label="Change the status"
					onKeyDown={onMenuKey}
					className="absolute left-0 top-full z-40 mt-1 w-80 max-w-[calc(100vw-4rem)] rounded-xl border border-white/10 bg-gray-900 p-1 shadow-2xl"
				>
					{confirming ? (
						<div className="p-3">
							<p className="text-sm font-semibold text-white">
								Start pass {derived.pass + 1}?
							</p>
							<p className="mt-1 text-xs text-gray-400">
								The ticks start empty. The watches of this pass stay in each
								episode's log. This can't be undone.
							</p>
							<div className="mt-3 flex justify-end gap-2">
								<button
									type="button"
									onClick={close}
									className={`h-10 cursor-pointer rounded-lg bg-white/10 px-3 text-sm font-semibold text-gray-100 hover:bg-white/20 ${FOCUS}`}
								>
									Cancel
								</button>
								<button
									type="button"
									data-confirm-watch-again
									onClick={() => {
										close()
										actions.watchAgain()
									}}
									className={`h-10 cursor-pointer rounded-lg bg-sky-500 px-3 text-sm font-semibold text-black hover:bg-sky-400 ${FOCUS}`}
								>
									Watch again
								</button>
							</div>
						</div>
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

/** The chip that says where the box's link leads: down to the episode list. */
const GO =
	"inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-white/10 px-3 text-sm font-semibold text-white ring-1 ring-white/15 hover:bg-white/20 group-hover:bg-white/20"

function StatusBox({
	tracking,
	view,
	actions,
}: {
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
		view.unaired ? `${view.unaired} not aired yet` : "",
		view.specialsWatched
			? `${plural(view.specialsWatched, "special")} watched, not counted`
			: "",
	].filter(Boolean)
	return (
		<StatusBoxFrame>
			<div className="flex items-center justify-between gap-3">
				<StatusPill view={view} actions={actions} />
				<p
					data-progress
					title={extras.join(" · ") || undefined}
					className="min-w-0 truncate text-sm font-semibold text-white"
				>
					{derived.pass > 1 && (
						<span className="font-normal text-gray-400">
							Pass {derived.pass} ·{" "}
						</span>
					)}
					{derived.watched} of {derived.aired}
					<span className="hidden font-normal text-gray-400 sm:inline">
						{" "}
						episodes
					</span>
				</p>
			</div>
			<span
				className="mt-3 block h-1.5 overflow-hidden rounded-full bg-white/10"
				aria-hidden="true"
			>
				<span
					className="block h-full rounded-full bg-green-500 transition-[width]"
					style={{
						width: `${derived.aired ? (derived.watched / derived.aired) * 100 : 0}%`,
					}}
				/>
			</span>
			<div className="mt-3 flex h-11 items-center gap-3">
				{next ? (
					// Navigation, not an action: the whole line leads to the episode's row, where it is marked.
					<a
						href={`#${EPISODE_GRID_ANCHOR}`}
						data-next-episode
						aria-label={`${derived.newEpisodes ? "New since you saw it" : "Next episode"}: ${episodeLabel(next)}${next.name ? `, ${next.name}` : ""}. Go to it in the episode list`}
						onClick={(event) => {
							event.preventDefault()
							tracking.store.openEpisode(next.id)
						}}
						className={`group flex min-w-0 flex-1 items-center gap-3 rounded-lg ${FOCUS}`}
					>
						<span className="min-w-0 flex-1">
							<span className="block text-xs font-semibold uppercase tracking-wide text-gray-400">
								{derived.newEpisodes ? "New since you saw it" : "Next episode"}
							</span>
							<span className="block truncate text-sm font-semibold text-white">
								{episodeLabel(next)}
								{next.name ? ` · ${next.name}` : ""}
							</span>
						</span>
						<span data-go-episodes className={GO}>
							{episodeLabel(next)}
							<ArrowDownIcon className="h-3.5 w-3.5" />
						</span>
					</a>
				) : (
					<>
						<p
							data-no-next
							className="min-w-0 flex-1 text-xs leading-snug text-gray-300 sm:text-sm"
						>
							{derived.state === "dropped" ? (
								// Short: the line shares its row with the link, and the title is above.
								"You dropped it. Resume brings it back."
							) : derived.aired === 0 ? (
								"No episode has aired yet."
							) : derived.watched < derived.aired ? (
								`${plural(derived.aired - derived.watched, "episode")} left.`
							) : (
								<>
									<span className="font-semibold text-white">
										You've watched every episode.
									</span>
									{upcoming?.airDate
										? ` ${episodeLabel(upcoming)} airs ${upcoming.airDate === tracking.today ? "today" : upcoming.airDate}.`
										: ""}
								</>
							)}
						</p>
						<a
							href={`#${EPISODE_GRID_ANCHOR}`}
							data-go-episodes
							aria-label="Go to episodes"
							onClick={(event) => {
								event.preventDefault()
								tracking.store.openEpisode(null)
							}}
							className={`${GO} ${FOCUS}`}
						>
							Episodes
							<ArrowDownIcon className="h-3.5 w-3.5" />
						</a>
					</>
				)}
			</div>
		</StatusBoxFrame>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The score control, the prompt to rate, and "Have you seen all of it?"
// ---------------------------------------------------------------------------------------------------------

const LINK = `shrink-0 cursor-pointer text-xs underline underline-offset-2 hover:text-white ${FOCUS}`

function Score({
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
	const { rate, isPending } = useScoreAction(media)
	const score = useUserScore("show", media.details.tmdb_id)?.score ?? null
	// The server decides after a first score by hand whether to ask if the show was seen: read once it is stored.
	const wasPending = useRef(false)
	useEffect(() => {
		if (wasPending.current && !isPending) tracking.store.refetch()
		wasPending.current = isPending
	}, [isPending, tracking.store])
	const prompt = view.ratePrompt
	return (
		<>
			{prompt ? (
				<div
					data-rate-prompt={prompt}
					className="-mx-2 rounded-xl bg-amber-300/[0.09] p-2 ring-1 ring-amber-300/50"
				>
					<div className="mb-2 flex min-h-5 items-baseline justify-between gap-3">
						<p className="text-sm font-semibold text-white">
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
							data-rate-not-now
							onClick={actions.dismissRatePrompt}
							className={`${LINK} text-gray-300 decoration-white/30`}
						>
							Not now
						</button>
					</div>
					<ScoreControl
						value={score}
						busy={isPending}
						onRate={(value) => rate(value)}
					/>
				</div>
			) : (
				// The same control as today, on this component's own request, so that the read above follows the score.
				<ScoreControl
					value={score}
					busy={isPending}
					onRate={(value) => rate(value)}
					onClear={() => rate(null)}
				/>
			)}
			{view.derived.seenQuestion && (
				<div
					data-seen-question
					className="mt-3 rounded-xl bg-white/[0.06] p-3 ring-1 ring-white/10"
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
								className={`h-10 cursor-pointer rounded-lg bg-white/10 px-3 text-sm font-semibold text-gray-100 hover:bg-white/20 ${FOCUS}`}
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

const BUTTON = `inline-flex h-11 w-full min-w-0 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${FOCUS}`
const OFF = "bg-white/10 text-gray-100 hover:bg-white/20"

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
	const notStarted = state === "not_started"
	const third = "col-span-2 @lg:col-span-1"
	return (
		<div
			className="mt-3 grid grid-cols-2 gap-2 @lg:grid-cols-3"
			onPointerEnter={warmUndoToast}
			onPointerDown={warmUndoToast}
			onFocus={warmUndoToast}
		>
			<ActionButton
				kind="want"
				label="long"
				active={a.want}
				disabled={a.wantPending || (!a.want && !view.wantToSee.ok)}
				title={!a.want && !view.wantToSee.ok ? view.wantToSee.why : undefined}
				onClick={() =>
					!notStarted && !a.want ? actions.wantToSee() : a.toggleWant()
				}
			/>
			<button
				type="button"
				data-seen-button={seen.mode}
				aria-pressed={state === "seen" && seen.mode !== "markNew"}
				aria-disabled={seen.mode === "off"}
				title={
					seen.mode === "off"
						? "It is Seen because every aired episode is ticked. Untick one to change that."
						: seen.mode === "takeBack"
							? "Seen. Press to take it back."
							: undefined
				}
				onClick={() => {
					if (seen.mode === "takeBack") actions.undoSeen()
					else if (seen.mode !== "off") actions.pressSeen()
				}}
				className={`${BUTTON} ${
					state === "seen" && seen.mode !== "markNew"
						? `bg-green-500 text-black ${seen.mode === "off" ? "cursor-default opacity-70" : ""}`
						: OFF
				}`}
			>
				<EyeIcon
					className={`h-4 w-4 shrink-0 ${state === "seen" && seen.mode !== "markNew" ? "" : "text-green-300"}`}
				/>
				<span className="truncate">
					{seen.mode === "markNew"
						? `Mark ${seen.newEpisodes} new`
						: state === "seen"
							? "Seen"
							: "Mark as Seen"}
				</span>
			</button>
			{state === "watching" || state === "on_hold" ? (
				<button
					type="button"
					data-drop
					title="Give it up. It is hidden from your recommendations."
					onClick={actions.drop}
					className={`${BUTTON} ${OFF} ${third}`}
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
					className={`${BUTTON} bg-pink-500 text-black ${third}`}
				>
					<NoSymbolIcon className="h-4 w-4 shrink-0" />
					<span className="truncate">Dropped</span>
				</button>
			) : (
				<ActionButton
					kind="hide"
					label="long"
					className={third}
					active={a.hidden}
					disabled={!a.canHide || a.hidePending}
					title={
						a.hidden
							? "Hidden from your recommendations. Press to bring it back."
							: a.canHide
								? "Hide it from your recommendations"
								: SEEN_SO_NOT_HIDEABLE
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
			)}
			{seen.mode === "off" && (
				<p data-seen-off className="col-span-full text-xs text-gray-400">
					Seen because every aired episode is ticked. Untick one to change that.
				</p>
			)}
			{toast.node}
		</div>
	)
}
