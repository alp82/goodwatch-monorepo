import type { ProfileTitle } from "../../domain/profile.ts"
import type { MediaKey, UserData } from "../../types/user-data.ts"
import { isSeen } from "../../types/user-data.ts"
import { htmlToText } from "./trope-text.ts"
import {
	type TropeLength,
	type TropePool,
	type TropeSight,
	type TropeTitle,
	buildTropePool,
	qualifyingTropes,
	seesTropes,
	trimExample,
} from "./tropes-model.ts"

const BATCH = 400
const MAX_TITLES = 4_000
const TROPE_PAGE = 10_000
const placeholders = (n: number) =>
	Array.from({ length: n }, () => "?").join(",")
const batches = <T>(items: T[]) => {
	const out: T[][] = []
	for (let i = 0; i < items.length; i += BATCH)
		out.push(items.slice(i, i + BATCH))
	return out
}
export type CatalogRead = <T extends {}>(
	sql: string,
	params: (string | number | Date)[],
) => Promise<T[]>
interface DetailRow {
	tmdb_id: number
	title: string | null
	release_year: number | null
	poster_path: string | null
	backdrop_path: string | null
	gw: number | null
	genres: string[] | null
	tropes: string[] | null
}
interface LengthRow {
	media_tmdb_id: number
	name: string
	url: string | null
	length: number | null
}

export interface TropesDependencies {
	read: CatalogRead
	userData: (userId: string) => Promise<UserData>
	readCache: (userId: string) => Promise<TropePool | null>
	writeCache: (
		userId: string,
		pool: TropePool,
		readFrom: number,
	) => Promise<void>
	titlePath: (mediaType: "movie" | "show", id: number, title: string) => string
	descriptions: Record<string, { text: string; url: string }>
}

export interface ProfileTropes extends TropePool {
	/** Viewer state is computed per request and never stored in the owner's pool cache. */
	seen: string[]
}

/** The server adapters supply cache, catalog and member reads; tests supply fakes. */
export function createTropesLoader(deps: TropesDependencies) {
	const computing = new Map<string, Promise<TropePool>>()
	async function compute(ownerId: string): Promise<TropePool> {
		const data = await deps.userData(ownerId)
		const scored = (
			Object.entries(data.scores) as [MediaKey, UserData["scores"][MediaKey]][]
		)
			.filter(
				([key, t]) =>
					/^(movie|show)-[1-9]\d*$/.test(key) &&
					Number(t.score) >= 1 &&
					Number(t.score) <= 10,
			)
			.sort(
				(a, b) =>
					new Date(b[1].updatedAt).getTime() -
					new Date(a[1].updatedAt).getTime(),
			)
			.slice(0, MAX_TITLES)
		const scores = new Map(scored)
		const titles: TropeTitle[] = []
		await Promise.all(
			(["movie", "show"] as const).flatMap((mediaType) =>
				batches(
					scored
						.filter(([k]) => k.startsWith(`${mediaType}-`))
						.map(([k]) => Number(k.split("-")[1])),
				).map(async (ids) => {
					const rows = await deps.read<DetailRow>(
						`SELECT tmdb_id, title, release_year, poster_path, backdrop_path, genres, tropes,
						 goodwatch_overall_score_normalized_percent AS gw FROM ${mediaType}
						 WHERE tmdb_id IN (${placeholders(ids.length)}) LIMIT ${ids.length}`,
						ids,
					)
					for (const row of rows) {
						const key: MediaKey = `${mediaType}-${Number(row.tmdb_id)}`
						const score = scores.get(key)
						if (!score) continue
						const title: ProfileTitle = {
							key,
							mediaType,
							tmdbId: Number(row.tmdb_id),
							title: row.title ?? "",
							year: row.release_year ?? null,
							poster: row.poster_path ?? null,
							backdrop: row.backdrop_path ?? null,
							score: Number(score.score),
							gw: row.gw == null ? null : Math.round(Number(row.gw)),
							href: deps.titlePath(
								mediaType,
								Number(row.tmdb_id),
								row.title ?? "",
							),
							date: score.updatedAt
								? new Date(score.updatedAt).toISOString()
								: null,
						}
						titles.push({
							title,
							genres: row.genres ?? [],
							names: [...new Set(row.tropes ?? [])],
						})
					}
				}),
			),
		)
		// Query completion order must not change the payload or its indexes.
		titles.sort((a, b) => a.title.key.localeCompare(b.title.key))
		const names = qualifyingTropes(titles)
		const lengths: TropeLength[] = []
		if (names.size)
			await Promise.all(
				(["movie", "show"] as const).flatMap((mediaType) =>
					batches(
						titles
							.filter((t) => t.title.mediaType === mediaType)
							.map((t) => t.title.tmdbId),
					).map(async (ids) => {
						// Strip tags in SQL; paginate all names once per ID batch.
						for (let offset = 0; ; offset += TROPE_PAGE) {
							const rows = await deps.read<LengthRow>(
								`SELECT media_tmdb_id, name, url,
						 char_length(regexp_replace(content, '<[^>]*>', '', 'g')) AS length
						 FROM trope WHERE media_type = ? AND media_tmdb_id IN (${placeholders(ids.length)})
						 ORDER BY media_tmdb_id, name, url, length
						 LIMIT ${TROPE_PAGE} OFFSET ${offset}`,
								[mediaType, ...ids],
							)
							for (const row of rows)
								if (names.has(row.name))
									lengths.push({
										key: `${mediaType}-${Number(row.media_tmdb_id)}`,
										name: row.name,
										url: row.url,
										length: row.length,
									})
							if (rows.length < TROPE_PAGE) break
						}
					}),
				),
			)
		return buildTropePool(titles, lengths, deps.descriptions)
	}
	async function ownerPool(ownerId: string) {
		const cached = await deps.readCache(ownerId)
		if (cached) return cached
		const pending = computing.get(ownerId)
		if (pending) return pending
		const work = (async () => {
			const readFrom = Date.now()
			const pool = await compute(ownerId)
			await deps.writeCache(ownerId, pool, readFrom)
			return pool
		})().finally(() => computing.delete(ownerId))
		computing.set(ownerId, work)
		return work
	}
	return {
		async loadProfileTropes(
			ownerId: string,
			shell: TropeSight,
			viewerId: string | null = null,
		): Promise<ProfileTropes | null> {
			if (!seesTropes(shell)) return null
			const pool = await ownerPool(ownerId)
			const keys = pool.pool.map((t) => t.k)
			const viewer =
				shell.viewer === "member" && viewerId
					? await deps.userData(viewerId)
					: undefined
			const seen =
				shell.viewer === "owner"
					? keys
					: viewer
						? keys.filter((k) => isSeen(viewer, k as MediaKey))
						: []
			return { ...pool, seen }
		},
		async loadProfileTropeExcerpts(
			ownerId: string,
			shell: TropeSight,
			trope: string,
			keys: string[],
		): Promise<{ key: string; text: string }[]> {
			if (!seesTropes(shell)) return []
			if (keys.length > 16) throw new RangeError("At most 16 title keys")
			const pool = await ownerPool(ownerId)
			const index = pool.tropes.indexOf(trope)
			if (index < 0) return []
			const allowed = new Set(
				pool.pool.filter((t) => t.r.includes(index)).map((t) => t.k),
			)
			const visible = [...new Set(keys)].filter((k) => allowed.has(k))
			const examples = new Map<string, string>()
			await Promise.all(
				(["movie", "show"] as const).map(async (mediaType) => {
					const ids = visible
						.filter((k) => k.startsWith(`${mediaType}-`))
						.map((k) => Number(k.split("-")[1]))
					if (!ids.length) return
					// Duplicate (title, name) rows must not crowd out other titles.
					for (let offset = 0; ; offset += TROPE_PAGE) {
						// `name` has a full-text index, where `=` never matches: match() finds the candidates
						// and the exact name is checked here.
						const rows = await deps.read<{
							media_tmdb_id: number
							name: string
							content: string | null
						}>(
							`SELECT media_tmdb_id, name, content FROM trope WHERE media_type = ? AND match(name, ?)
					 AND media_tmdb_id IN (${placeholders(ids.length)})
					 ORDER BY media_tmdb_id LIMIT ${TROPE_PAGE} OFFSET ${offset}`,
							[mediaType, trope, ...ids],
						)
						for (const row of rows) {
							const key = `${mediaType}-${Number(row.media_tmdb_id)}`
							if (
								row.name !== trope ||
								!allowed.has(key) ||
								!visible.includes(key) ||
								examples.has(key)
							)
								continue
							const text = trimExample(htmlToText(row.content ?? ""))
							if (text) examples.set(key, text)
						}
						if (rows.length < TROPE_PAGE) break
					}
				}),
			)
			return visible.flatMap((key) =>
				examples.has(key) ? [{ key, text: examples.get(key) ?? "" }] : [],
			)
		},
	}
}
