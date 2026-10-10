// The Seen press that stands for a show, as the member can read it: when it was made and what it covered.
//
// A migrated Seen mark is one press too (data model, section 6): undated watches for every regular episode that
// had aired by that day. A member who comes back to such a show sees some seasons watched and others new; this
// says why. Pure: no clock, no locale. The caller brings the words for dates.
import type { ListedEpisode, State } from "./machine.ts"
import type { LogRow, StateRow } from "./storage.ts"

/** How dates read. The show page gives the member's locale; `PLAIN_DATES` is for tests and the server. */
export interface DateWords {
	/** A moment, in epoch milliseconds, as a day in the reader's zone. */
	moment: (at: number) => string
	/** A calendar day, "YYYY-MM-DD". */
	day: (day: string) => string
}

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ")
const plainDay = (day: string) => {
	const [year, month, date] = day.split("-").map(Number)
	return `${date} ${MONTHS[month - 1]} ${year}`
}
/** "19 Oct 2024", with a moment read in UTC. */
export const PLAIN_DATES: DateWords = {
	moment: (at) => plainDay(new Date(at).toISOString().slice(0, 10)),
	day: plainDay,
}

export interface SeenPress {
	group: string
	/** The state the press was made from. "seen": it marked the episodes that were new then. */
	from: State
	/**
	 * When the press was made, in epoch milliseconds; null when nothing stored says it.
	 *
	 * It is the `created_at` of the press's rows: the writer and the migration give every row of a press the time of
	 * the press, and "Set a date" changes `watched_at` only. `state_changed_at` is the press's time only for a
	 * press that left another state (a press on a Seen show keeps the day the show became Seen), so it is used
	 * only then, and only for a press that has no row.
	 */
	at: number | null
	/** The press's rows in the log: what taking it back removes. */
	count: number
	/** Per regular season it has rows of, in order: how many, and how many episodes the season lists. */
	seasons: { season: number; marked: number; listed: number }[]
	/** How many of its rows have a date, and the day when all of them share one. */
	dated: number
	day: string | null
}

/** The standing Seen press of a show, from the rows the page holds; null when no press stands. */
export function seenPressOf(
	copy: { state: StateRow | null; log: readonly LogRow[] },
	episodes: readonly ListedEpisode[],
): SeenPress | null {
	const { state, log } = copy
	if (
		state?.state !== "seen" ||
		!state.seen_press_group ||
		!state.seen_press_from
	)
		return null
	const group = state.seen_press_group
	const own = log.filter((row) => row.group_id === group)
	const made = own.map((row) => row.created_at).filter((at) => at > 0)
	const marked = new Map<number, Set<number>>()
	for (const row of own) {
		const season = row.season_number ?? 0
		if (season <= 0) continue
		const numbers = marked.get(season) ?? new Set<number>()
		numbers.add(row.episode_number ?? 0)
		marked.set(season, numbers)
	}
	const days = new Set(
		own.map((row) =>
			row.watched_at !== null && row.watched_at_precision === "day"
				? new Date(row.watched_at).toISOString().slice(0, 10)
				: null,
		),
	)
	const [only] = days
	return {
		group,
		from: state.seen_press_from,
		at: made.length
			? Math.min(...made)
			: state.seen_press_from !== "seen"
				? state.state_changed_at
				: null,
		count: own.length,
		seasons: [...marked]
			.sort(([a], [b]) => a - b)
			.map(([season, numbers]) => ({
				season,
				marked: numbers.size,
				listed: episodes.filter((e) => e.season === season).length,
			})),
		dated: own.filter((row) => row.watched_at !== null).length,
		day: days.size === 1 && only ? only : null,
	}
}

const plural = (count: number, word: string) =>
	`${count} ${word}${count === 1 ? "" : "s"}`

/** "season 1", "seasons 1 and 2", "seasons 1 to 3 and 5". */
function seasonWords(numbers: number[]): string {
	const runs: string[] = []
	for (let i = 0; i < numbers.length; ) {
		let end = i
		while (end + 1 < numbers.length && numbers[end + 1] === numbers[end] + 1)
			end++
		if (end - i >= 2) runs.push(`${numbers[i]} to ${numbers[end]}`)
		else for (let k = i; k <= end; k++) runs.push(String(numbers[k]))
		i = end + 1
	}
	const list =
		runs.length > 1
			? `${runs.slice(0, -1).join(", ")} and ${runs[runs.length - 1]}`
			: runs[0]
	return `${numbers.length === 1 ? "season" : "seasons"} ${list}`
}

/** What the press's rows cover: whole seasons by number, a part of a season as "4 of the 10 episodes of season 3". */
export function seenPressCovers(press: SeenPress): string {
	if (!press.count) return "no episode is marked by it"
	// A season the catalog lists fewer episodes of than the press marked (TMDB removed some since) counts as whole.
	const whole = press.seasons.filter((s) => s.marked >= s.listed)
	const parts = press.seasons
		.filter((s) => s.marked < s.listed)
		.map((s) => `${s.marked} of the ${s.listed} episodes of season ${s.season}`)
	const partly = parts.join(" and ")
	const covers = whole.length
		? `${seasonWords(whole.map((s) => s.season))}${partly ? `, and ${partly}` : ""}`
		: partly
	const alone = !whole.length && parts.length === 1
	return alone ? covers : `${covers} (${plural(press.count, "episode")})`
}

/**
 * One line for the member: "Marked Seen on 19 Oct 2024 · seasons 1 and 2 (16 episodes), no dates recorded". It
 * describes the rows the press still has, so it stays true after "Set a date" and when rows of it are gone.
 */
export function seenPressLine(press: SeenPress, words: DateWords): string {
	const what =
		press.from === "seen" ? "New episodes marked watched" : "Marked Seen"
	const when = press.at === null ? "" : ` on ${words.moment(press.at)}`
	const dates = !press.count
		? ""
		: press.dated === 0
			? ", no dates recorded"
			: press.dated < press.count
				? `, ${press.dated} of them dated`
				: press.day
					? `, dated ${words.day(press.day)}`
					: ", dates recorded"
	return `${what}${when} · ${seenPressCovers(press)}${dates}`
}
