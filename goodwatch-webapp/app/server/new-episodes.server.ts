// New episodes for the shows a member tracks (#442): which shows are new since the member last opened My shows, and
// the one stored fact that takes, the time of that visit. A show is new when its Next episode aired after the day of
// the visit (domain/new-episodes.ts). What has aired goes by the UTC date and the episode table, not by
// `show.aired_episode_count`, which is up to a day behind the calendar.
//
// Reads, for a member with Watching or Seen shows: the member data (cached), the visit by key, and one statement
// that names the shows with an episode aired since. Only those shows get their cached episode list, and only the
// shows that turn out new are read from the catalog, for their names
// (docs/implementation/tracking/data-model.md, "New episodes").
import {
	type NewCandidate,
	type NewShow,
	type Since,
	newShowsOf,
	sinceOf,
} from "~/domain/new-episodes"
import { utcDay } from "~/domain/tracking/machine"
import { readNextEpisodes, readShows } from "~/server/my-shows.server"
import { MY_SHOWS_VISIT_QUERY, airedSinceQuery } from "~/server/tracking-sql"
import { getUserData } from "~/server/userData.server"
import { type MediaKey, parseMediaKey } from "~/types/user-data"
import { query, upsert } from "~/utils/crate"

/** The member's row of `user_setting` that holds when they last opened My shows, as an ISO time. */
export const MY_SHOWS_VISIT_KEY = "my_shows_visited_at"

const midnight = (day: string) => Date.parse(`${day}T00:00:00Z`)

/** When the member last opened My shows, in milliseconds; null when they never did. A read by key. */
export async function readMyShowsVisit(userId: string): Promise<number | null> {
	const [row] = await query<{ value: string }>(MY_SHOWS_VISIT_QUERY, [
		userId,
		MY_SHOWS_VISIT_KEY,
	])
	const at = row ? Date.parse(row.value) : Number.NaN
	return Number.isNaN(at) ? null : at
}

/** The member has opened My shows: what aired up to today is no longer new. */
export async function recordMyShowsVisit(
	userId: string,
	now = Date.now(),
): Promise<void> {
	await upsert({
		table: "user_setting",
		data: [
			{
				user_id: userId,
				key: MY_SHOWS_VISIT_KEY,
				value: new Date(now).toISOString(),
			},
		],
		conflictColumns: ["user_id", "key"],
	})
}

export interface NewShows {
	since: Since
	/** The latest to air first. */
	shows: NewShow[]
}

/** The member's shows whose Next episode aired after they last opened My shows. */
export async function getNewShows(
	userId: string,
	options: { now?: number } = {},
): Promise<NewShows> {
	const now = options.now ?? Date.now()
	const userData = await getUserData({ user_id: userId })
	// On hold and Dropped shows are never new, so nothing is asked about them.
	const tracked = (Object.keys(userData.watchState) as MediaKey[])
		.map((key) => ({ ...parseMediaKey(key), entry: userData.watchState[key] }))
		.filter(
			({ mediaType, entry }) =>
				mediaType === "show" &&
				(entry.state === "watching" || entry.state === "seen"),
		)
	if (!tracked.length) return { since: sinceOf(null, now), shows: [] }

	const since = sinceOf(await readMyShowsVisit(userId), now)
	const today = utcDay(now)
	if (since.day >= today) return { since, shows: [] }
	const aired = await query<{ show_id: number }>(
		airedSinceQuery(tracked.length),
		[
			...tracked.map((show) => show.tmdbId),
			midnight(since.day),
			midnight(today),
		],
	)
	const hit = new Set(aired.map((row) => Number(row.show_id)))
	const shows = tracked.filter((show) => hit.has(show.tmdbId))
	if (!shows.length) return { since, shows: [] }

	const next = await readNextEpisodes(
		userId,
		userData,
		shows.map((show) => ({ id: show.tmdbId, furthest: show.entry.furthest })),
		today,
	)
	const candidates: NewCandidate[] = shows.map(({ tmdbId, entry }) => {
		const found = next.get(tmdbId)
		return {
			id: tmdbId,
			title: "",
			state: entry.state,
			next: found?.next ?? null,
			unwatched: Math.max(0, (found?.aired ?? 0) - entry.episodesWatched),
		}
	})
	const fresh = newShowsOf(candidates, since.day)
	if (!fresh.length) return { since, shows: [] }
	const catalog = await readShows(fresh.map((show) => show.id))
	return {
		since,
		// The names decide the order of shows that aired on one day.
		shows: newShowsOf(
			candidates.map((candidate) => ({
				...candidate,
				title: catalog.get(candidate.id)?.title ?? "Unknown show",
			})),
			since.day,
		),
	}
}
