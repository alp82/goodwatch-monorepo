// What the episode detail's watch menu sends. The menu marks an episode watched the moment it opens (only this
// episode, just now) and then lets the member change which episodes and when; every change takes the previous mark
// back and makes the new one, so the log only ever holds what the menu shows. A mark is one watch, or one group of
// watches up to the episode; its undo is the one action that removes exactly it.
import type { WatchedWhen } from "./machine.ts"
import type { PageAction } from "./show-page.ts"
import type { LogRow } from "./storage.ts"

/** Which episodes and when, as the menu's two questions answer them. */
export interface WatchChoice {
	/** Every unwatched aired episode up to and including this one, rather than this one alone. */
	upTo: boolean
	when: WatchedWhen
}

/** The actions of one mark, in order, and the one that takes it back. */
export interface MarkPlan {
	first: PageAction
	/** The group's date, set after the group is made; null for a single watch or an unknown date. */
	after: PageAction | null
	undo: PageAction
}

/**
 * The plan for marking `episode` with `choice` under the action id `id` (the watch's id, or the group's). A group has
 * no time of day: "just now" gives it today.
 */
export function markPlan(
	episode: { season: number; number: number },
	choice: WatchChoice,
	id: string,
	today: string,
): MarkPlan {
	if (!choice.upTo)
		return {
			first: {
				type: "watch",
				season: episode.season,
				number: episode.number,
				when: choice.when,
			},
			after: null,
			undo: { type: "deleteWatch", watchId: id },
		}
	const day =
		choice.when.precision === "day"
			? choice.when.day
			: choice.when.precision === "moment"
				? today
				: null
	return {
		first: {
			type: "watchUpTo",
			season: episode.season,
			number: episode.number,
			today,
		},
		after: day ? { type: "setGroupDate", group: id, day } : null,
		undo: { type: "undoGroup", group: id },
	}
}

/** The undo of a watch the member already had before the menu opened: its latest watch of the current pass. */
export function existingUndo(
	log: LogRow[],
	episode: { season: number; number: number },
	pass: number,
): PageAction | null {
	const [latest] = log
		.filter(
			(row) =>
				row.pass === pass &&
				row.season_number === episode.season &&
				row.episode_number === episode.number,
		)
		.sort((a, b) => (b.watched_at ?? 0) - (a.watched_at ?? 0))
	return latest ? { type: "deleteWatch", watchId: latest.watch_id } : null
}
