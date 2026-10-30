import type { ProfileTitle } from "../../domain/profile.ts"
import type { MediaKey, UserData } from "../../types/user-data.ts"
import { isSeen } from "../../types/user-data.ts"
import {
	type ProfileTropeDescriptions,
	descriptionIds,
} from "../../utils/profile-trope-descriptions.ts"
import {
	type TropeDescriptions,
	catalogVersion,
	pageDescriptions,
	withTropeDescriptions,
} from "./trope-catalog-data.ts"
import {
	type TropePageReferences,
	mainTropeUrl,
	tropePageUrl,
} from "./trope-pages.ts"
import { htmlToText } from "./trope-text.ts"
import { buildUriTropePool, tropeTarget } from "./trope-uri-pool.ts"
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
	readCache: (
		userId: string,
	) => Promise<{ pool: TropePool; fresh: boolean; version?: number } | null>
	writeCache: (
		userId: string,
		pool: TropePool,
		readFrom: number,
	) => Promise<void>
	titlePath: (mediaType: "movie" | "show", id: number, title: string) => string
	readDescriptions: (
		names: string[],
		options?: { strict?: boolean; openings?: boolean },
	) => Promise<TropeDescriptions>
	/** Omitted only by legacy dependency adapters. Production always groups by resolved URI. */
	resolveReferences?: (urls: string[]) => Promise<TropePageReferences>
}

export interface ProfileTropes extends TropePool {
	/** Viewer state is computed per request and never stored in the owner's pool cache. */
	seen: string[]
	version?: number
	catalogVersion?: string
	refreshing?: boolean
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
		const names = deps.resolveReferences
			? new Set(titles.flatMap((t) => t.names))
			: qualifyingTropes(titles)
		const lengths: TropeLength[] = []
		if (deps.resolveReferences || names.size)
			await Promise.all(
				(["movie", "show"] as const).flatMap((mediaType) =>
					batches(
						titles
							.filter((t) => t.title.mediaType === mediaType)
							.map((t) => t.title.tmdbId),
					).map(async (ids) => {
						// Read lengths prepared by the trope import; paginate all names once per ID batch.
						for (let offset = 0; ; offset += TROPE_PAGE) {
							const rows = await deps.read<LengthRow>(
								`SELECT media_tmdb_id, name, url,
						 coalesce(content_length, 0) AS length
						 FROM trope WHERE media_type = ? AND media_tmdb_id IN (${placeholders(ids.length)})
						 ORDER BY media_tmdb_id, name, url, length
						 LIMIT ${TROPE_PAGE} OFFSET ${offset}`,
								[mediaType, ...ids],
							)
							for (const row of rows)
								if (deps.resolveReferences || names.has(row.name))
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
		if (deps.resolveReferences) {
			const references = await deps.resolveReferences([
				...new Set(lengths.flatMap((row) => row.url ?? [])),
			])
			return buildUriTropePool(titles, lengths, references)
		}
		return buildTropePool(titles, lengths, {})
	}
	function refreshProfileTropes(
		ownerId: string,
		afterCurrent = false,
	): Promise<TropePool> {
		const pending = computing.get(ownerId)
		if (pending)
			return afterCurrent
				? pending.catch(() => null).then(() => refreshProfileTropes(ownerId))
				: pending
		const work = (async () => {
			const readFrom = Date.now()
			const pool = await compute(ownerId)
			await deps.writeCache(ownerId, pool, readFrom)
			return pool
		})().finally(() => computing.delete(ownerId))
		computing.set(ownerId, work)
		return work
	}
	async function ownerPool(ownerId: string, wait: boolean) {
		const cached = await deps.readCache(ownerId)
		if (cached?.fresh) return { ...cached.pool, version: cached.version }
		const work = refreshProfileTropes(ownerId)
		// Request paths use a stored snapshot, including a stale one, without waiting for catalog work.
		// Attach a handler even when returning early: a failed background job must be retried, not unhandled.
		work.catch((error) =>
			console.error("Profile tropes: rebuilding failed:", error),
		)
		if (cached)
			return { ...cached.pool, version: cached.version, refreshing: true }
		return wait ? work : null
	}
	return {
		refreshProfileTropes,
		async loadProfileTropeDescriptions(
			ownerId: string,
			shell: TropeSight,
			input: unknown,
		): Promise<ProfileTropeDescriptions> {
			const ids = descriptionIds(input)
			if (!ids) throw new RangeError("At most 60 bounded trope IDs")
			if (!seesTropes(shell))
				return {
					entries: {},
					catalogVersion: catalogVersion({}),
					pending: false,
				}
			const pool = await ownerPool(ownerId, false)
			if (!pool)
				return {
					entries: {},
					catalogVersion: catalogVersion({}),
					pending: true,
				}
			const allowed = new Set(pool.tropes)
			const visible = ids.filter((id) => allowed.has(id))
			const current = visible.length
				? await deps.readDescriptions(visible, { strict: true })
				: {}
			const entries = pageDescriptions(
				Object.fromEntries(
					visible.map((id) => [
						id,
						current[id] ?? {
							url: pool.urls[id] ?? "",
							title: null,
							text: null,
						},
					]),
				),
			)
			return {
				entries,
				catalogVersion: catalogVersion(entries),
				pending: false,
			}
		},
		async loadProfileTropes(
			ownerId: string,
			shell: TropeSight,
			viewerId: string | null = null,
			options: { wait: boolean; descriptions?: boolean } = { wait: true },
		): Promise<ProfileTropes | null> {
			if (!seesTropes(shell)) return null
			const pool = await ownerPool(ownerId, options.wait)
			if (!pool) return null
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
			const descriptions =
				options.descriptions === false
					? {}
					: await deps.readDescriptions(pool.tropes, { openings: false })
			return { ...withTropeDescriptions(pool, descriptions), seen }
		},
		async loadProfileTropeExcerpts(
			ownerId: string,
			shell: TropeSight,
			trope: string,
			keys: string[],
		): Promise<
			{ key: string; text: string; label?: string; labels?: string[] }[]
		> {
			if (!seesTropes(shell)) return []
			if (keys.length > 16) throw new RangeError("At most 16 title keys")
			const pool = await ownerPool(ownerId, false)
			if (!pool) return []
			const index = pool.tropes.indexOf(trope)
			if (index < 0) return []
			const allowed = new Set(
				pool.pool.filter((t) => t.r.includes(index)).map((t) => t.k),
			)
			const visible = [...new Set(keys)].filter((k) => allowed.has(k))
			if (pool.schema === 2) {
				const sourceUrls = pool.references?.[trope] ?? []
				const identities: TropePageReferences = Object.fromEntries(
					sourceUrls.flatMap((url) => {
						const reference = tropePageUrl(url)
						return reference &&
							tropePageUrl(trope) &&
							(mainTropeUrl(reference) || reference === trope)
							? [[reference, { url: trope, title: null }]]
							: []
					}),
				)
				const examples = new Map<
					string,
					{ text: string; label: string; labels: Set<string> }
				>()
				await Promise.all(
					(["movie", "show"] as const).map(async (mediaType) => {
						const ids = visible
							.filter((k) => k.startsWith(`${mediaType}-`))
							.map((k) => Number(k.split("-")[1]))
						if (!ids.length) return
						// Raw routes remain separate from normalized identities: SQL must match the actual stored value.
						const routes: (string[] | null)[] = sourceUrls.length
							? batches(sourceUrls)
							: [null]
						for (const routesBatch of routes) {
							const fallback = pool.labels?.[trope]?.[0]
							if (!routesBatch && !fallback) continue
							for (let offset = 0; ; offset += TROPE_PAGE) {
								const rows = await deps.read<{
									media_tmdb_id: number
									name: string
									url: string | null
									content: string | null
								}>(
									`SELECT media_tmdb_id, name, url, content FROM trope WHERE media_type = ? AND media_tmdb_id IN (${placeholders(ids.length)}) AND ${routesBatch ? `url IN (${placeholders(routesBatch.length)})` : "url IS NULL AND match(name, ?)"} ORDER BY media_tmdb_id, name, url LIMIT ${TROPE_PAGE} OFFSET ${offset}`,
									[mediaType, ...ids, ...(routesBatch ?? [fallback ?? ""])],
								)
								for (const row of rows) {
									const key = `${mediaType}-${Number(row.media_tmdb_id)}`
									if (
										!visible.includes(key) ||
										tropeTarget(row.name, row.url, identities) !== trope ||
										(routesBatch && !routesBatch.includes(row.url ?? ""))
									)
										continue
									const text = trimExample(htmlToText(row.content ?? ""))
									if (!text) continue
									const previous = examples.get(key)
									const labels = previous?.labels ?? new Set<string>()
									labels.add(row.name)
									if (
										!previous ||
										text.length > previous.text.length ||
										(text.length === previous.text.length &&
											row.name.localeCompare(previous.label) < 0)
									)
										examples.set(key, { text, label: row.name, labels })
								}
								if (rows.length < TROPE_PAGE) break
							}
						}
					}),
				)
				return visible.flatMap((key) => {
					const example = examples.get(key)
					return example
						? [
								{
									key,
									text: example.text,
									label: example.label,
									labels: [...example.labels].sort(),
								},
							]
						: []
				})
			}
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
