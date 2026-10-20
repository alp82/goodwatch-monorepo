// Persistent new-episode announcements, independent of My shows visits.
import {
	type NewCandidate,
	type Since,
	newShowsOf,
	sinceOf,
} from "~/domain/new-episodes"
import { utcDay } from "~/domain/tracking/machine"
import {
	readNextEpisodes,
	readShows,
	readWatchedEpisodes,
} from "~/server/my-shows.server"
import { MY_SHOWS_VISIT_QUERY, airedSinceQuery } from "~/server/tracking-sql"
import { getUserData } from "~/server/userData.server"
import { type MediaKey, parseMediaKey } from "~/types/user-data"
import { query, upsert } from "~/utils/crate"
import {
	type AnnouncedShow,
	type Release,
	acknowledgeRelease,
	acknowledgedReleases,
	announcementBaseline,
	readReleases,
	releaseKey,
	rememberRelease,
	sequence,
} from "./show-announcements.server"

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

/** Record a visit for streaming-service news. It never acknowledges episode announcements. */
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
	shows: AnnouncedShow[]
}

/** Pending releases, retained until explicit dismissal or the first watch of their batch. */
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

	const since = sinceOf(await announcementBaseline(userId, now), now)
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
	const previous = await readReleases(userId)
	const pendingIds = new Set(previous.map((release) => release.id))
	const shows = tracked.filter(
		(show) => hit.has(show.tmdbId) || pendingIds.has(show.tmdbId),
	)
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
			next:
				entry.state === "watching" &&
				found?.next?.airDate &&
				(!entry.lastActivityAt ||
					found.next.airDate <=
						utcDay(new Date(entry.lastActivityAt).getTime()))
					? null
					: (found?.next ?? null),
			unwatched: Math.max(0, (found?.aired ?? 0) - entry.episodesWatched),
		}
	})
	const releases: Release[] = [...previous]
	for (const fresh of newShowsOf(candidates, since.day)) {
		const entry = userData.watchState[`show-${fresh.id}`]
		const history = previous.filter(
			(release) => release.id === fresh.id && release.pass === entry.pass,
		)
		// Acknowledgment covers the entire observed batch, not just its first episode.
		if (history.some((release) => sequence(fresh) <= release.through)) continue
		const released = next.get(fresh.id)?.released ?? []
		const release: Release = {
			id: fresh.id,
			pass: entry.pass,
			season: fresh.season,
			number: fresh.number,
			airDate: fresh.airDate,
			episodes: fresh.episodes,
			through: Math.max(sequence(fresh), ...released.map(sequence)),
			aired: released
				.filter((episode) => sequence(episode) >= sequence(fresh))
				.map(sequence),
		}
		releases.push(await rememberRelease(userId, release))
	}
	const eligible = releases.filter((release) => {
		const entry = userData.watchState[`show-${release.id}`]
		return (
			entry &&
			["seen", "watching"].includes(entry.state) &&
			entry.pass === release.pass
		)
	})
	const acknowledged = await acknowledgedReleases(userId, eligible)
	const outstanding = eligible.filter(
		(release) => !acknowledged.has(releaseKey(release)),
	)
	const watched = outstanding.length
		? await readWatchedEpisodes(userId, [
				...new Set(outstanding.map((release) => release.id)),
			])
		: new Map()
	const pending: Release[] = []
	for (const release of outstanding) {
		const started = (watched.get(release.id) ?? []).some(
			(watch: { pass: number; season: number; number: number }) =>
				watch.pass === release.pass && release.aired.includes(sequence(watch)),
		)
		if (started) {
			await acknowledgeRelease(userId, releaseKey(release))
			continue
		}
		// A removed/undated catalog episode must not keep an obsolete announcement alive.
		if (
			!next
				.get(release.id)
				?.released.some((episode) => sequence(episode) === sequence(release))
		)
			continue
		pending.push(release)
	}
	const catalog = pending.length
		? await readShows(pending.map((show) => show.id))
		: new Map()
	const fresh: AnnouncedShow[] = pending
		.map((release) => ({
			id: release.id,
			title: catalog.get(release.id)?.title ?? "Unknown show",
			season: release.season,
			number: release.number,
			airDate: release.airDate,
			episodes: release.episodes,
			token: releaseKey(release),
			...(() => {
				const episode = next.get(release.id)?.next
				return episode?.displaySeason === undefined
					? {}
					: {
							displaySeason: episode.displaySeason,
							displayNumber: episode.displayNumber,
						}
			})(),
		}))
		.sort(
			(a, b) =>
				b.airDate.localeCompare(a.airDate) ||
				a.title.localeCompare(b.title) ||
				a.id - b.id,
		)
	return { since, shows: fresh }
}
