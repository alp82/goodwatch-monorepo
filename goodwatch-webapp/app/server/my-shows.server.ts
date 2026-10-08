// My shows (#385): a member's shows for tonight. Nothing here scans the watch log: the member's side of every show
// is its `watchState` entry in the member data map, the catalog's side is one read of `show` by key (Q5), and the
// Next episode's name comes from the show's cached episode list. Only a show whose Next episode is in a gap (nothing
// aired after the furthest episode watched, and fewer watched than aired) needs its log rows, read for all such
// shows together by key (docs/implementation/tracking/data-model.md, "Reads": My shows).
import {
	type MyShowsPlan,
	type ShowRow,
	episodeKey,
	isRunning,
	nextEpisodeAfter,
	nextEpisodeInGap,
	planMyShows,
} from "~/domain/my-shows"
import { utcDay } from "~/domain/tracking/machine"
import { servicesFor } from "~/server/availability-index.server"
import type { Taste } from "~/server/taste/index.server"
import { getServiceList } from "~/server/title-cards.server"
import { type EpisodeListRow, getEpisodeList } from "~/server/tracking.server"
import { getUserData } from "~/server/userData.server"
import { type MediaKey, type UserData, parseMediaKey } from "~/types/user-data"
import { query } from "~/utils/crate"
import { titleKey } from "~/utils/title-key"

/** What a row shows of its show: the catalog's display fields. */
export interface ShowCard {
	id: number
	title: string
	poster_path: string | null
	backdrop_path: string | null
}

export interface NextEpisode {
	season: number
	number: number
	name: string | null
	/** "YYYY-MM-DD". */
	airDate: string | null
	runtime: number | null
}

/** A show the member has started, in one of the page's groups. */
export interface MyShowsRow extends ShowRow, ShowCard {
	/** The Next episode, for the rows whose episode list was read; null otherwise. */
	next: NextEpisode | null
}

/** A Want to See show the member has not started. */
export interface MyShowsStart extends ShowCard {
	/** Taste match, 50 to 99; null without taste. */
	match: number | null
	seasons: number | null
	episodes: number | null
	/** The usual length of an episode, in minutes. */
	episodeMinutes: number | null
	running: boolean
	/** The first of the member's services that carries it; null when none does or while availability loads. */
	service: string | null
}

export interface MyShows {
	continue: MyShowsRow[]
	start: MyShowsStart[]
	older: MyShowsRow[]
	waiting: MyShowsRow[]
	onHold: MyShowsRow[]
	dropped: MyShowsRow[]
	total: number
}

export interface MyShowsViewer {
	userId: string
	country: string
	services: number[]
	taste: Taste
}

interface CatalogRow {
	tmdb_id: number
	aired_episode_count: number | null
	status: string | null
	title: string | null
	poster_path: string | null
	backdrop_path: string | null
	number_of_seasons: number | null
	number_of_episodes: number | null
	episode_runtime: number[] | null
}

const BATCH = 500

/** Q5. The catalog's side of some shows, by key. Public data. */
async function readShows(ids: number[]): Promise<Map<number, CatalogRow>> {
	const rows = new Map<number, CatalogRow>()
	for (let i = 0; i < ids.length; i += BATCH) {
		const batch = ids.slice(i, i + BATCH)
		const found = await query<CatalogRow>(
			`SELECT tmdb_id, aired_episode_count, status, title, poster_path, backdrop_path, number_of_seasons,
			        number_of_episodes, episode_runtime
			 FROM show WHERE tmdb_id IN (${batch.map(() => "?").join(", ")})`,
			batch,
		)
		for (const row of found) rows.set(Number(row.tmdb_id), row)
	}
	return rows
}

/** The regular episodes some shows' log rows name, per show and pass: for the Next episode of a show with a gap. */
async function readWatchedEpisodes(
	userId: string,
	ids: number[],
): Promise<Map<number, { season: number; number: number; pass: number }[]>> {
	const found = new Map<number, { season: number; number: number; pass: number }[]>()
	if (!ids.length) return found
	const rows = await query<{
		tmdb_id: number
		season_number: number | null
		episode_number: number | null
		pass: number
	}>(
		`SELECT tmdb_id, season_number, episode_number, pass
		 FROM user_watch_log
		 WHERE user_id = ? AND media_type = 'show' AND tmdb_id IN (${ids.map(() => "?").join(", ")})
		 LIMIT 100000`,
		[userId, ...ids],
	)
	for (const row of rows) {
		if (!row.season_number || row.episode_number === null) continue
		const list = found.get(Number(row.tmdb_id)) ?? []
		list.push({
			season: row.season_number,
			number: row.episode_number,
			pass: row.pass,
		})
		found.set(Number(row.tmdb_id), list)
	}
	return found
}

const showIds = (entries: Record<string, unknown>) =>
	(Object.keys(entries) as MediaKey[])
		.map(parseMediaKey)
		.filter((key) => key.mediaType === "show")
		.map((key) => key.tmdbId)

const listed = (rows: readonly EpisodeListRow[]) =>
	rows.map((row) => ({
		season: row.season_number,
		number: row.episode_number,
		name: row.name,
		airDate: row.air_date === null ? null : utcDay(row.air_date),
		runtime: row.runtime,
	}))

/** The page's plan and what it was made from, without any episode list: enough for the counts. */
async function plan(viewer: MyShowsViewer, userData: UserData, now: number) {
	const tracked = showIds(userData.watchState)
	const wanted = showIds(userData.wishlist).filter(
		(id) => !(`show-${id}` in userData.watchState),
	)
	const catalog = await readShows([...new Set([...tracked, ...wanted])])
	const keys = wanted.map((id) => titleKey("show", id))
	// Best match orders by where a title falls in the person's own range; the number shown is coarser.
	const percentiles = viewer.taste.percentile(keys)
	const matches = viewer.taste.match(keys)
	const matchOf = new Map(wanted.map((id, i) => [id, matches[i]]))
	const percentileOf = new Map(wanted.map((id, i) => [id, percentiles[i]]))
	const shows = planMyShows({
		shows: tracked.map((id) => {
			const row = catalog.get(id)
			return {
				id,
				entry: userData.watchState[`show-${id}`],
				catalog: row
					? {
							airedEpisodes: row.aired_episode_count,
							running: isRunning(row.status),
						}
					: null,
			}
		}),
		starts: wanted
			// A Wishlist show the catalog no longer has (deleted on TMDB) has nothing to show.
			.filter((id) => catalog.has(id))
			.map((id) => ({
				id,
				match: percentileOf.get(id) ?? null,
				addedAt: new Date(userData.wishlist[`show-${id}`].createdAt).getTime(),
			})),
		now,
	})
	return { shows, catalog, matchOf }
}

const cardOf = (id: number, row: CatalogRow | undefined) => ({
	id,
	title: row?.title ?? "Unknown show",
	poster_path: row?.poster_path ?? null,
	backdrop_path: row?.backdrop_path ?? null,
})

/**
 * A member's shows for tonight, in the page's groups. `episodeLists` bounds how many Continue rows get their Next
 * episode from the show's cached episode list: the page reads them for every Continue row it draws first, home's
 * Continue door for one.
 */
export async function getMyShows(
	viewer: MyShowsViewer,
	options: { episodeLists?: number; now?: number } = {},
): Promise<MyShows> {
	const now = options.now ?? Date.now()
	const userData = await getUserData({ user_id: viewer.userId })
	const { shows, catalog, matchOf } = await plan(viewer, userData, now)
	const today = utcDay(now)

	// The Next episode of the Continue rows.
	const named = shows.continue.slice(0, options.episodeLists ?? 30)
	const lists = new Map(
		await Promise.all(
			named.map(
				async (row) => [row.id, listed(await getEpisodeList(row.id))] as const,
			),
		),
	)
	const next = new Map<number, NextEpisode>()
	const gaps: ShowRow[] = []
	for (const row of named) {
		const list = lists.get(row.id) ?? []
		// A Seen show's new episodes are the ones after the furthest watched, as a Watching show's are.
		const after = nextEpisodeAfter(list, row.furthest, today)
		if (after) next.set(row.id, after)
		else if (list.length) gaps.push(row)
	}
	if (gaps.length) {
		const watched = await readWatchedEpisodes(
			viewer.userId,
			gaps.map((row) => row.id),
		)
		for (const row of gaps) {
			const pass = userData.watchState[`show-${row.id}`]?.pass ?? 1
			const keys = new Set(
				(watched.get(row.id) ?? [])
					.filter((watch) => watch.pass === pass)
					.map((watch) => episodeKey(watch.season, watch.number)),
			)
			const inGap = nextEpisodeInGap(lists.get(row.id) ?? [], keys, today)
			if (inGap) next.set(row.id, inGap)
		}
	}

	// The first of the member's services that carries each show to start.
	const startKeys = shows.start.map((row) => titleKey("show", row.id))
	// Without saved services no show is "on your services", and the availability index is left alone.
	const carried = viewer.services.length
		? servicesFor(viewer.country, startKeys)
		: startKeys.map(() => null)
	const own = new Set(viewer.services)
	const names = new Map(
		(await getServiceList(viewer.services)).map((s) => [s.id, s.name]),
	)
	const serviceOf = (ids: number[] | null) => {
		const id = ids?.find((service) => own.has(service) && names.has(service))
		return id === undefined ? null : (names.get(id) ?? null)
	}

	const rows = (group: ShowRow[]): MyShowsRow[] =>
		group.map((row) => ({
			...row,
			...cardOf(row.id, catalog.get(row.id)),
			next: next.get(row.id) ?? null,
		}))
	return {
		continue: rows(shows.continue),
		start: shows.start.map((row, i) => {
			const show = catalog.get(row.id)
			return {
				...cardOf(row.id, show),
				match: matchOf.get(row.id) ?? null,
				seasons: show?.number_of_seasons ?? null,
				episodes: show?.number_of_episodes ?? null,
				episodeMinutes: show?.episode_runtime?.[0] ?? null,
				running: isRunning(show?.status),
				service: serviceOf(carried[i]),
			}
		}),
		older: rows(shows.older),
		waiting: rows(shows.waiting),
		onHold: rows(shows.onHold),
		dropped: rows(shows.dropped),
		total: shows.total,
	}
}

export type { MyShowsPlan }
