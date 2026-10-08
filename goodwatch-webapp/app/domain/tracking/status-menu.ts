// What the status pill's menu offers on the show page: every action the machine allows in the current state, in
// member words, the most likely first and the ones that take something away quieter.
//
// Nothing here decides what is allowed. Each entry is an event that is tried against the machine (`offer`, `step`,
// `seenButton`), and it is in the menu exactly when the machine takes it; the row it takes picks the words. So a
// row added to the table for one of these events shows up here without a change, and an event added to the table
// has to be given a place in `MENU_PLACE` (status-menu.test.ts fails until it is).
import {
	STATE_LABEL,
	type Step,
	type TableEvent,
	type TrackingEvent,
	type World,
	derive,
	offer,
	seenButton,
	stateLabel,
	step,
} from "./machine.ts"
import type { DateWords } from "./seen-press.ts"

/**
 * Where a member finds each event of the table on the show page: in the pill's menu, or the place that has it
 * instead.
 */
export const MENU_PLACE: Record<TableEvent, "menu" | (string & {})> = {
	pressSeen: "menu",
	undoSeen: "menu",
	restoreSeen: "The Undo in the toast that follows Take back Seen.",
	hold: "menu",
	drop: "menu",
	resume: "menu",
	watchAgain: "menu",
	// Row 24 only. Row 23 starts from Not started, which has no pill: the Want to See button.
	wantToSee: "menu",
	watch: "The episode list: a tick, a date, Mark season, Watched up to here.",
	unwatch: "The episode list: a tick, Remove watch.",
	rate: "The score control under the box.",
	notInterested: "The button beside Seen, for a show that is Not started.",
	catalog: "Not a member's action: the catalog is an argument, never an event.",
}

export type MenuEntryId =
	| "markNew"
	| "wantToSee"
	| "resume"
	| "markAll"
	| "hold"
	| "watchAgain"
	| "takeBack"
	| "setDate"
	| "drop"

export interface MenuEntry {
	id: MenuEntryId
	label: string
	/** One line under the label. */
	note: string
	/** It takes something away: shown last or quieter. */
	quiet: boolean
	/** It starts a pass or removes watches, so the page asks first. */
	confirm: boolean
	/** The machine's event; null for "Set a date", which edits dates and is no event of the table. */
	event: TrackingEvent | null
	/** The row of the table the event takes from here. */
	row: string | null
}

/** What the menu needs of the standing Seen press (see seen-press.ts). */
export interface MenuPress {
	at: number | null
	/** The press's rows in the log. */
	count: number
}

const plural = (count: number, word: string) =>
	`${count} ${word}${count === 1 ? "" : "s"}`

/** The menu's entries, in order. Empty while the show is Not started: the box with the pill is not shown then. */
export function statusMenu(
	world: World,
	press: MenuPress | null,
	words: DateWords,
): MenuEntry[] {
	const { show, record } = world
	if (record.state === "not_started") return []
	const view = derive(world)
	const button = seenButton(world)
	const entries: MenuEntry[] = []
	/** Adds the entry when the page offers the event and the machine takes it. */
	const add = (
		id: MenuEntryId,
		event: TrackingEvent,
		text: (done: Step) => { label: string; note: string } | null,
		look: { quiet?: boolean; confirm?: boolean } = {},
	) => {
		if (!offer(world, event).ok) return
		const done = step(world, event, "menu")
		const said = done.row && text(done)
		if (!said) return
		entries.push({
			id,
			...said,
			quiet: look.quiet === true,
			confirm: look.confirm === true,
			event,
			row: done.row?.id ?? null,
		})
	}
	/** The label of the state the show is in afterwards, as the pill would read with nothing new. */
	const then = (done: Step) =>
		done.to === "seen"
			? stateLabel("seen", show.running, 0)
			: STATE_LABEL[done.to]

	if (button.event === "pressSeen" && button.newEpisodes > 0)
		add("markNew", { type: "pressSeen" }, (done) => ({
			label: `Mark ${plural(button.newEpisodes, "new episode")} watched`,
			note: `As one group without dates. The show stays ${then(done)}.`,
		}))
	// Row 24: the way back for a Dropped show with nothing watched.
	add("wantToSee", { type: "wantToSee", on: true }, (done) =>
		done.to === record.state
			? null
			: {
					label: "Want to see it after all",
					note: "No longer dropped, and on your Wishlist.",
				},
	)
	add("resume", { type: "resume" }, (done) => ({
		label: "Resume",
		note:
			done.to === "not_started"
				? "Nothing is watched, so it is Not started again."
				: `Back to ${then(done)}.`,
	}))
	if (button.event === "pressSeen" && button.newEpisodes === 0)
		add("markAll", { type: "pressSeen" }, (done) => {
			const left = view.aired - view.watched
			return {
				label: "Mark all aired episodes watched",
				note: left
					? `Marks the ${left} you haven't ticked, without dates. The show is then ${then(done)}.`
					: `No episode has aired. The show is then ${then(done)}.`,
			}
		})
	add("hold", { type: "hold" }, () => ({
		label: "Put on hold",
		note: "Set aside for now. Watching an episode brings it back.",
	}))
	add(
		"watchAgain",
		{ type: "watchAgain" },
		() => ({
			label: "Watch again",
			note: "Start a new pass from the first episode.",
		}),
		{ confirm: true },
	)
	if (press) {
		add(
			"takeBack",
			{ type: "undoSeen" },
			(done) => {
				const removes = !press.count
					? "It marked no episode."
					: `Removes the ${plural(press.count, "episode")} ${press.at === null ? "it marked" : `marked on ${words.moment(press.at)}`}.`
				const after =
					done.to !== "seen"
						? `The show is then ${then(done)}.`
						: press.count
							? `${press.count === 1 ? "It is" : "They are"} new again, and the show stays ${then(done)}.`
							: `The show stays ${then(done)}.`
				return { label: "Take back Seen", note: `${removes} ${after}` }
			},
			{ quiet: true, confirm: true },
		)
		// Not an event of the table: a date for the press's watches. Offered while the press stands and has rows.
		if (press.count && entries.some((entry) => entry.id === "takeBack"))
			entries.push({
				id: "setDate",
				label: `Set a date for ${press.count === 1 ? "that watch" : `those ${press.count} watches`}`,
				note: "One day for all of them.",
				quiet: false,
				confirm: false,
				event: null,
				row: null,
			})
	}
	add(
		"drop",
		{ type: "drop" },
		() => ({
			label: "Drop",
			note: "Not continuing. Your watches stay, and it is hidden from your recommendations.",
		}),
		{ quiet: true },
	)
	return entries
}
