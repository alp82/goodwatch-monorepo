import { libraryKeys } from "~/domain/my-library"
// What a profile shows of a member's library: their scored titles with the catalog's fields, the titles they've seen,
// their wishlist, and how long they've watched. Built from the member data map (getUserData) and catalog reads.
// Scored titles and their backdrops bypass the display cache and read Crate in batches of 500 on each rebuild.
// Other title displays use their existing caches. The built library is kept in process memory under a signature of
// the member data, so a new score, watch or wishlist title shows on the next view.
import type { ProfileTitle } from "~/domain/profile"
import { movieRuntimes } from "~/server/movie-runtimes.server"
import { getMyScores } from "~/server/my-scores.server"
import { titleDisplays } from "~/server/taste-portrait/display.server"
import { getUserData } from "~/server/userData.server"
import {
	type MediaKey,
	type UserData,
	parseMediaKey,
	watchStateSignature,
} from "~/types/user-data"
import { query } from "~/utils/crate"
import { titlePath } from "~/utils/helpers"
import { titleKey } from "~/utils/title-key"

/** An episode's length when the catalog has none: a common hour-long show's episode without ads. */
const DEFAULT_EPISODE_MINUTES = 40
const KEEP_MS = 10 * 60_000
// A library holds the member's whole data map (thousands of entries for a heavy member), so few are kept: the profiles
// being looked at right now. A member's older library goes as soon as their data changes.
const MAX_KEPT = 60

export interface ProfileLibrary {
	data: UserData
	/** Every scored title the catalog still has, with its card fields. */
	scored: Map<MediaKey, ProfileTitle & { genres: string[] }>
	/** Seen titles (My library's Seen: the state Seen, or a rated show without a state). */
	seenKeys: MediaKey[]
	seenMovies: number
	hours: number
	episodes: number
	/** "2019-03": the month of the earliest score or watch; null for an empty library. */
	since: string | null
}

const kept = new Map<string, { at: number; library: Promise<ProfileLibrary> }>()

const iso = (value: Date | string | number | null | undefined) =>
	value == null ? null : new Date(value).toISOString()

/** Changes whenever a score, a watch or a wishlist title changes. */
export function librarySignature(data: UserData): string {
	let latest = 0
	for (const entry of Object.values(data.scores))
		latest = Math.max(latest, new Date(entry.updatedAt).getTime())
	for (const entry of Object.values(data.wishlist))
		latest = Math.max(latest, new Date(entry.updatedAt).getTime())
	return [
		Object.keys(data.scores).length,
		Object.keys(data.wishlist).length,
		latest,
		watchStateSignature(data.watchState),
	].join("/")
}

export async function getProfileLibrary(
	userId: string,
): Promise<ProfileLibrary> {
	const data = await getUserData({ user_id: userId })
	const id = `${userId}:${librarySignature(data)}`
	const hit = kept.get(id)
	if (hit && Date.now() - hit.at < KEEP_MS) return hit.library
	const library = buildLibrary(userId, data)
	for (const key of kept.keys())
		if (key.startsWith(`${userId}:`)) kept.delete(key)
	kept.set(id, { at: Date.now(), library })
	library.catch(() => kept.delete(id))
	for (const key of kept.keys()) {
		if (kept.size <= MAX_KEPT) break
		kept.delete(key)
	}
	return library
}

export function profileTitleOf(
	key: MediaKey,
	fields: {
		title: string
		year: number | null
		poster: string | null
		backdrop?: string | null
		gw?: number | null
	},
	extra: { score?: number | null; date?: string | null } = {},
): ProfileTitle {
	const { mediaType, tmdbId } = parseMediaKey(key)
	return {
		key,
		mediaType,
		tmdbId,
		title: fields.title,
		year: fields.year,
		poster: fields.poster,
		backdrop: fields.backdrop ?? null,
		href: titlePath(mediaType, tmdbId, fields.title),
		score: extra.score ?? null,
		gw: fields.gw ?? null,
		date: extra.date ?? null,
	}
}

async function buildLibrary(
	userId: string,
	data: UserData,
): Promise<ProfileLibrary> {
	const seenKeys = libraryKeys(data, "seen")
	// These reads are independent. Fetch backdrops with scores instead of reading every scored title twice.
	const [scoredTitles, { hours, episodes }, firsts] = await Promise.all([
		getMyScores(userId, { backdrops: true }),
		watchTime(data, seenKeys),
		firstDates(userId),
	])
	const scored = new Map<MediaKey, ProfileTitle & { genres: string[] }>()
	for (const t of scoredTitles) {
		scored.set(t.key, {
			...profileTitleOf(
				t.key,
				{
					title: t.title,
					year: t.release_year,
					poster: t.poster_path,
					backdrop: t.backdrop_path,
					gw: t.gw,
				},
				{ score: t.score, date: t.watchedAt ?? t.ratedAt },
			),
			genres: t.genres,
		})
	}
	return {
		data,
		scored,
		seenKeys,
		seenMovies: seenKeys.filter((key) => key.startsWith("movie-")).length,
		hours,
		episodes,
		since: sinceOf(data, firsts),
	}
}

/** When the member first rated a title and first logged a dated watch, from Crate; nulls when unknown or unreadable. */
async function firstDates(
	userId: string,
): Promise<{ rated: number | null; watched: number | null }> {
	const first = async (sql: string) => {
		try {
			const [row] = await query<{ first: number | string | null }>(sql, [
				userId,
			])
			const t = row?.first == null ? 0 : new Date(row.first).getTime()
			return t > 0 ? t : null
		} catch (error) {
			console.warn("[profile] first date read failed", error)
			return null
		}
	}
	const [rated, watched] = await Promise.all([
		first("SELECT MIN(created_at) AS first FROM user_score WHERE user_id = ?"),
		first(
			"SELECT MIN(watched_at) AS first FROM user_watch_log WHERE user_id = ? AND watched_at IS NOT NULL AND watched_at_precision <> 'unknown'",
		),
	])
	return { rated, watched }
}

/**
 * The month the member's own record starts: the earliest of when they first rated a title, their first dated watch,
 * and (when those can't be read) the dates the member data map carries — a score's last change, a title's latest watch.
 */
export function sinceOf(
	data: Pick<UserData, "scores" | "watchState">,
	firsts: { rated: number | null; watched: number | null } = {
		rated: null,
		watched: null,
	},
): string | null {
	let earliest = Math.min(
		firsts.rated ?? Number.POSITIVE_INFINITY,
		firsts.watched ?? Number.POSITIVE_INFINITY,
	)
	if (firsts.rated == null)
		for (const entry of Object.values(data.scores)) {
			const t = new Date(entry.updatedAt).getTime()
			if (t > 0) earliest = Math.min(earliest, t)
		}
	if (firsts.watched == null)
		for (const entry of Object.values(data.watchState)) {
			const t = entry.watchedAt ? new Date(entry.watchedAt).getTime() : 0
			if (t > 0) earliest = Math.min(earliest, t)
		}
	return Number.isFinite(earliest)
		? new Date(earliest).toISOString().slice(0, 7)
		: null
}

// Shows' usual episode length, kept 6 hours: public, rarely changes.
const EPISODE_KEEP_MS = 6 * 60 * 60_000
const episodeMinutesKept = new Map<
	number,
	{ at: number; minutes: number | null }
>()

export async function episodeMinutes(
	ids: number[],
): Promise<Map<number, number | null>> {
	const now = Date.now()
	const found = new Map<number, number | null>()
	const toRead: number[] = []
	for (const id of ids) {
		const hit = episodeMinutesKept.get(id)
		if (hit && now - hit.at < EPISODE_KEEP_MS) found.set(id, hit.minutes)
		else toRead.push(id)
	}
	for (let i = 0; i < toRead.length; i += 500) {
		const batch = toRead.slice(i, i + 500)
		const rows = await query<{
			tmdb_id: number
			episode_runtime: number[] | null
		}>(
			`SELECT tmdb_id, episode_runtime FROM show WHERE tmdb_id IN (${batch.map(() => "?").join(", ")})`,
			batch,
		)
		const byId = new Map(
			rows.map((r) => [Number(r.tmdb_id), r.episode_runtime]),
		)
		for (const id of batch) {
			const runtimes = (byId.get(id) ?? []).filter((m) => m > 0)
			const minutes = runtimes.length
				? runtimes.reduce((a, b) => a + b, 0) / runtimes.length
				: null
			episodeMinutesKept.set(id, { at: now, minutes })
			found.set(id, minutes)
		}
	}
	if (episodeMinutesKept.size > 100_000) episodeMinutesKept.clear()
	return found
}

/**
 * Hours watched: every seen movie's runtime once per logged watch, and every show's watched episodes times its usual
 * episode length (40 minutes when the catalog has none). Episodes: the shows' watched episodes in their current pass.
 */
async function watchTime(
	data: UserData,
	seenKeys: MediaKey[],
): Promise<{ hours: number; episodes: number }> {
	const movieKeys = seenKeys.filter((key) => key.startsWith("movie-"))
	const showEntries = Object.entries(data.watchState).filter(
		([key, entry]) => key.startsWith("show-") && entry.episodesWatched > 0,
	) as [MediaKey, UserData["watchState"][MediaKey]][]
	const [runtimes, perEpisode] = await Promise.all([
		movieRuntimes(
			movieKeys.map((key) => titleKey("movie", parseMediaKey(key).tmdbId)),
		),
		episodeMinutes(showEntries.map(([key]) => parseMediaKey(key).tmdbId)),
	])
	let minutes = 0
	for (const key of movieKeys) {
		const runtime = runtimes.get(titleKey("movie", parseMediaKey(key).tmdbId))
		if (runtime)
			minutes += runtime * Math.max(1, data.watchState[key]?.count ?? 1)
	}
	let episodes = 0
	for (const [key, entry] of showEntries) {
		episodes += entry.episodesWatched
		minutes +=
			entry.episodesWatched *
			(perEpisode.get(parseMediaKey(key).tmdbId) ?? DEFAULT_EPISODE_MINUTES)
	}
	return { hours: Math.round(minutes / 60), episodes }
}

/** Display fields for titles that aren't among the scored ones (seen without a score, wishlist). */
export async function titlesOf(
	keys: MediaKey[],
	library: ProfileLibrary,
	dateOf: (key: MediaKey) => string | null,
): Promise<ProfileTitle[]> {
	const missing = keys.filter((key) => !library.scored.has(key))
	const displays = await titleDisplays(
		missing.map((key) =>
			titleKey(parseMediaKey(key).mediaType, parseMediaKey(key).tmdbId),
		),
	)
	return keys.flatMap((key): ProfileTitle[] => {
		const card = library.scored.get(key)
		if (card) {
			const { genres: _genres, ...title } = card
			return [{ ...title, date: dateOf(key) }]
		}
		const { mediaType, tmdbId } = parseMediaKey(key)
		const display = displays.get(titleKey(mediaType, tmdbId))
		return display
			? [
					profileTitleOf(
						key,
						{ ...display, gw: null },
						{
							score: library.data.scores[key]?.score ?? null,
							date: dateOf(key),
						},
					),
				]
			: []
	})
}

export const watchedDate = (data: UserData, key: MediaKey) =>
	iso(data.watchState[key]?.watchedAt) ?? iso(data.scores[key]?.updatedAt)
