// My library's hub: one tile per page under it, each showing what is inside now. The counts and the order come from
// the member data map (domain/my-library.ts); the catalog is read for a few posters per tile only.
import {
	type LibraryStatus,
	libraryCounts,
	libraryOrder,
} from "~/domain/my-library"
import { scoreSpread } from "~/domain/my-scores"
import { getUserData } from "~/server/userData.server"
import { type MediaKey, parseMediaKey } from "~/types/user-data"
import { query } from "~/utils/crate"

export interface HubPoster {
	key: MediaKey
	title: string
	poster_path: string | null
}

export interface LibraryHub {
	counts: ReturnType<typeof libraryCounts>
	/** Titles with a score, and how many have each score from 1 to 10. */
	scored: number
	spread: number[]
	/** A few posters per tile: each list's first titles in its default order; Scores: the last rated. */
	posters: Record<LibraryStatus | "scores", HubPoster[]>
}

const BATCH = 500

/** The keys the catalog has a title for. */
async function knownKeys(keys: readonly MediaKey[]): Promise<Set<MediaKey>> {
	const ids = { movie: [] as number[], show: [] as number[] }
	for (const key of keys) {
		const { mediaType, tmdbId } = parseMediaKey(key)
		ids[mediaType].push(tmdbId)
	}
	const known = new Set<MediaKey>()
	await Promise.all(
		(["movie", "show"] as const).map(async (type) => {
			for (let i = 0; i < ids[type].length; i += BATCH) {
				const batch = ids[type].slice(i, i + BATCH)
				const rows = await query<{ tmdb_id: number }>(
					`SELECT tmdb_id FROM ${type} WHERE tmdb_id IN (${batch.map(() => "?").join(", ")})`,
					batch,
				)
				for (const row of rows) known.add(`${type}-${Number(row.tmdb_id)}`)
			}
		}),
	)
	return known
}

const STATUSES: LibraryStatus[] = ["want", "seen", "watching", "on_hold", "dropped", "unrated"]
const PER_TILE = 6

export async function getLibraryHub(userId: string): Promise<LibraryHub> {
	const data = await getUserData({ user_id: userId })
	const scoredKeys = Object.keys(data.scores) as MediaKey[]
	const keysBy = Object.fromEntries([
		...STATUSES.map((status) => [
			status,
			libraryOrder(data, { status, sort: null, kind: "all", q: "" }).keys.slice(0, PER_TILE),
		]),
		[
			"scores",
			[...scoredKeys]
				.sort(
					(a, b) =>
						new Date(data.scores[b].updatedAt).getTime() -
						new Date(data.scores[a].updatedAt).getTime(),
				)
				.slice(0, PER_TILE),
		],
	]) as Record<LibraryStatus | "scores", MediaKey[]>
	const ids = { movie: [] as number[], show: [] as number[] }
	for (const key of new Set(Object.values(keysBy).flat())) {
		const { mediaType, tmdbId } = parseMediaKey(key)
		ids[mediaType].push(tmdbId)
	}
	const cards = new Map<MediaKey, HubPoster>()
	await Promise.all(
		(["movie", "show"] as const).map(async (type) => {
			if (!ids[type].length) return
			const rows = await query<{ tmdb_id: number; title: string | null; poster_path: string | null }>(
				`SELECT tmdb_id, title, poster_path FROM ${type} WHERE tmdb_id IN (${ids[type].map(() => "?").join(", ")})`,
				ids[type],
			)
			for (const row of rows) {
				const key: MediaKey = `${type}-${Number(row.tmdb_id)}`
				cards.set(key, { key, title: row.title ?? "", poster_path: row.poster_path })
			}
		}),
	)
	// Your scores lists only the titles the catalog still has (one deleted on TMDB has nothing to show): so does the
	// tile's count and spread.
	const known = await knownKeys(scoredKeys)
	const shown = scoredKeys.filter((key) => known.has(key))
	const posters = Object.fromEntries(
		Object.entries(keysBy).map(([tile, keys]) => [tile, keys.flatMap((key) => cards.get(key) ?? [])]),
	) as LibraryHub["posters"]
	return {
		counts: libraryCounts(data),
		scored: shown.length,
		spread: scoreSpread(shown.map((key) => Number(data.scores[key].score))),
		posters,
	}
}
