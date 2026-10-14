import { localizeTitlePayload } from "./media-payload.server.ts"
import { overlayEpisodeTextGroups } from "./episode-text-overlay.server.ts"
import type { PresentedMedia } from "~/utils/media-presentation"
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
import {
	type UpcomingEpisode,
	firstUpcoming,
	soonestFirst,
} from "~/domain/new-episodes"
import { getEpisodePresentation } from "~/server/episode-presentation.server"
import { utcDay } from "~/domain/tracking/machine"
import { servicesFor } from "~/server/availability-index.server"
import type { Taste } from "~/server/taste/index.server"
import { getServiceList } from "~/server/title-cards.server"
import { upcomingEpisodesQuery } from "~/server/tracking-sql"
import { type EpisodeListRow, getEpisodeList } from "~/server/tracking.server"
import { getUserData } from "~/server/userData.server"
import { type MediaKey, type UserData, parseMediaKey } from "~/types/user-data"
import { query } from "~/utils/crate"
import { titleKey } from "~/utils/title-key"

/** What a row shows of its show: the catalog's display fields. */
export interface ShowCard extends PresentedMedia {
	id: number
	title: string
	poster_path: string | null
	backdrop_path: string | null
}

export interface NextEpisode {
	id?: number
	textPresentation?: import("./episode-text-overlay.server").EpisodeTextPresentation
	displaySeason?: number
	displayNumber?: number
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
	/** A waiting show's next episode with a date; null when the catalog has none, and in every other group. */
	upcoming: UpcomingEpisode | null
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
	/** Watching with a Next episode and no activity in the last 90 days. */
	pickUp: MyShowsRow[]
	waiting: MyShowsRow[]
	onHold: MyShowsRow[]
	dropped: MyShowsRow[]
	total: number
}

export interface MyShowsViewer {
	language?: string
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
export async function readShows(
	ids: number[],
): Promise<Map<number, CatalogRow>> {
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
	const presentations = await Promise.all(
		[...rows.keys()].map(
			async (id) => [id, await getEpisodePresentation(id)] as const,
		),
	)
	for (const [id, presentation] of presentations)
		if (presentation) {
			const row = rows.get(id)
			if (row)
				row.number_of_seasons = presentation.seasons.filter(
					(s) => s.number > 0,
				).length
		}
	return rows
}

/** The regular episodes some shows' log rows name, per show and pass: for the Next episode of a show with a gap. */
async function readWatchedEpisodes(
	userId: string,
	ids: number[],
): Promise<Map<number, { season: number; number: number; pass: number }[]>> {
	const found = new Map<
		number,
		{ season: number; number: number; pass: number }[]
	>()
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
			...(row.tmdb_id ? { id: row.tmdb_id } : {}),
			season: row.season_number,
			number: row.episode_number,
			pass: row.pass,
		})
		found.set(Number(row.tmdb_id), list)
	}
	return found
}

/**
 * Q8. When some shows return: of each, the dated episode that airs first after `today`. Public data. The days are
 * an addition to the page: when the read fails, the shows still wait, without a day.
 */
async function readUpcoming(
	ids: number[],
	today: string,
): Promise<Map<number, UpcomingEpisode>> {
	try {
		return await readUpcomingEpisodes(ids, today)
	} catch (error) {
		console.error(
			"My shows: reading when the waiting shows return failed:",
			error,
		)
		return new Map()
	}
}

async function readUpcomingEpisodes(
	ids: number[],
	today: string,
): Promise<Map<number, UpcomingEpisode>> {
	const listed = new Map<number, UpcomingEpisode[]>()
	if (!ids.length) return new Map()
	const rows = await query<{
		show_id: number
		tmdb_id: number
		season_number: number
		episode_number: number
		name: string | null
		air_date: number
	}>(upcomingEpisodesQuery(ids.length), [
		...ids,
		Date.parse(`${today}T00:00:00Z`),
	])
	for (const row of rows) {
		const list = listed.get(Number(row.show_id)) ?? []
		list.push({
			...(row.tmdb_id ? { id: row.tmdb_id } : {}),
			season: row.season_number,
			number: row.episode_number,
			name: row.name,
			airDate: utcDay(row.air_date),
		})
		listed.set(Number(row.show_id), list)
	}
	const first = new Map<number, UpcomingEpisode>()
	for (const [id, list] of listed) {
		const episode = firstUpcoming(list)
		if (episode) {
			const presentation = await getEpisodePresentation(id)
			const shown = presentation?.episodes.find(
				(e) => e.season === episode.season && e.number === episode.number,
			)
			first.set(id, {
				...episode,
				...(shown
					? {
							displaySeason: shown.displaySeason,
							displayNumber: shown.displayNumber,
						}
					: presentation?.active
						? { displaySeason: -1, displayNumber: episode.number }
						: {}),
			})
		}
	}
	return first
}

const showIds = (entries: Record<string, unknown>) =>
	(Object.keys(entries) as MediaKey[])
		.map(parseMediaKey)
		.filter((key) => key.mediaType === "show")
		.map((key) => key.tmdbId)

const listed = (
	rows: readonly Pick<
		EpisodeListRow,
		| "tmdb_id"
		| "season_number"
		| "episode_number"
		| "name"
		| "air_date"
		| "runtime"
	>[],
	presentation: Awaited<ReturnType<typeof getEpisodePresentation>>,
) =>
	rows.map((row) => ({
		...(() => {
			const e = presentation?.episodes.find((e) => e.id === row.tmdb_id)
			return e
				? { displaySeason: e.displaySeason, displayNumber: e.displayNumber }
				: {}
		})(),
		id: row.tmdb_id,
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

/** A show's Next episode, and how many of its regular episodes have aired by the UTC date. */
export interface NextOfShow {
	next: NextEpisode | null
	aired: number
}

/**
 * The Next episode of some of a member's shows, each from the show's cached episode list. A Seen show's new
 * episodes are the ones after the furthest watched, as a Watching show's are. Only a show with a gap (nothing aired
 * after the furthest episode, and fewer watched than aired) needs its log rows, read for all such shows together.
 */
export async function readNextEpisodes(
	userId: string,
	userData: UserData,
	shows: readonly { id: number; furthest: [number, number] | null }[],
	today: string,
): Promise<Map<number, NextOfShow>> {
	const lists = new Map(
		await Promise.all(
			shows.map(async (show) => {
				const presentation = await getEpisodePresentation(show.id)
				const episodes = presentation
					? presentation.episodes.map((e) => ({
							tmdb_id: e.id,
							season_number: e.season,
							episode_number: e.number,
							name: e.name,
							air_date: e.airDate ?? null,
							runtime: e.runtime ?? null,
						}))
					: await getEpisodeList(show.id)
				return [show.id, listed(episodes, presentation)] as const
			}),
		),
	)
	const found = new Map<number, NextOfShow>()
	const gaps: number[] = []
	for (const show of shows) {
		const list = lists.get(show.id) ?? []
		const aired = list.filter(
			(e) => e.season > 0 && e.airDate !== null && e.airDate <= today,
		).length
		const after = nextEpisodeAfter(list, show.furthest, today)
		found.set(show.id, { next: after, aired })
		const watched = userData.watchState[`show-${show.id}`]?.episodesWatched ?? 0
		if (!after && list.length && watched < aired) gaps.push(show.id)
	}
	if (gaps.length) {
		const watched = await readWatchedEpisodes(userId, gaps)
		for (const id of gaps) {
			const pass = userData.watchState[`show-${id}`]?.pass ?? 1
			const keys = new Set(
				(watched.get(id) ?? [])
					.filter((watch) => watch.pass === pass)
					.map((watch) => episodeKey(watch.season, watch.number)),
			)
			const inGap = nextEpisodeInGap(lists.get(id) ?? [], keys, today)
			if (inGap)
				found.set(id, { next: inGap, aired: found.get(id)?.aired ?? 0 })
		}
	}
	return found
}

const cardOf = (id: number, row: CatalogRow | undefined) => ({
	id,
	title: row?.title ?? "Unknown show",
	poster_path: row?.poster_path ?? null,
	backdrop_path: row?.backdrop_path ?? null,
})

/**
 * A member's shows for tonight, in the page's groups. `episodeLists` bounds how many rows get their Next episode
 * from the show's cached episode list, Continue first and then Pick up: the page reads them for the rows it draws
 * first, home's Continue door for one. `upcoming: false` leaves out when the waiting shows return, which only the
 * page shows.
 */
export async function getMyShows(
	viewer: MyShowsViewer,
	options: { episodeLists?: number; now?: number; upcoming?: boolean } = {},
): Promise<MyShows> {
	const now = options.now ?? Date.now()
	const userData = await getUserData({ user_id: viewer.userId })
	const { shows, catalog, matchOf } = await plan(viewer, userData, now)
	const today = utcDay(now)

	// The Next episode of the Continue and Pick up rows, and beside them when the waiting shows return.
	const named = [...shows.continue, ...shows.pickUp].slice(
		0,
		options.episodeLists ?? 30,
	)
	const [next, upcoming] = await Promise.all([
		readNextEpisodes(viewer.userId, userData, named, today),
		options.upcoming === false
			? new Map<number, UpcomingEpisode>()
			: readUpcoming(
					shows.waiting.map((row) => row.id),
					today,
				),
	])

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
			next: next.get(row.id)?.next ?? null,
			upcoming: null,
		}))
	const page: MyShows = {
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
		pickUp: rows(shows.pickUp),
		waiting: soonestFirst(
			rows(shows.waiting).map((row) => ({
				...row,
				upcoming: upcoming.get(row.id) ?? null,
			})),
		),
		onHold: rows(shows.onHold),
		dropped: rows(shows.dropped),
		total: shows.total,
	}
	if (!viewer.language) return page
	const localized = await localizeTitlePayload(page, viewer.language, "show")
	const items = [...localized.continue, ...localized.pickUp, ...localized.waiting, ...localized.onHold, ...localized.dropped]
	const nextGroups = await overlayEpisodeTextGroups("episode", items.map(show => ({ showId: show.id, rows: [show.next, show.upcoming].filter((episode): episode is NextEpisode => episode !== null) })), viewer.language)
	const byShow = new Map(nextGroups.map(group => [group.showId, new Map(group.rows.filter(episode => episode.id).map(episode => [episode.id, episode]))]))
	const textFor = <T extends { id?: number; name: string | null }>(row: T | null, showId: number) => {
		const text = row?.id ? byShow.get(showId)?.get(row.id) : null
		return row && text ? { ...row, name: text.name ?? row.name, textPresentation: text.textPresentation } : row
	}
	const copy = (rows: MyShowsRow[]) => rows.map(show => ({ ...show, next: textFor(show.next, show.id), upcoming: textFor(show.upcoming, show.id) }))
	return { ...localized, continue: copy(localized.continue), pickUp: copy(localized.pickUp), waiting: copy(localized.waiting), onHold: copy(localized.onHold), dropped: copy(localized.dropped) }
}

export type { MyShowsPlan }
