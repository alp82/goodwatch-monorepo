import type {
	WishlistMatchGroup,
	WishlistSuggestion,
	WishlistSuggestions,
} from "../../domain/imports.ts"
import { withBackendTimeout } from "../../utils/backend-timeout.ts"
import { canonicalTitleId } from "../../utils/title-identity.ts"
import { searchQuery } from "../combined-search/catalog.server.ts"
import { chunks, marks } from "./store.server.ts"
import {
	WishlistMatchError,
	matchingGroups,
} from "./wishlist-resolution.server.ts"

type MediaType = "movie" | "show"
type Identity = { mediaType: MediaType; tmdbId: number }
type CatalogRow = {
	tmdb_id: number
	title: string
	release_year: number | null
	poster_path: string | null
	adult: boolean | null
}
const identityKey = (value: Identity) => `${value.mediaType}:${value.tmdbId}`

function trustedUrl(value: unknown): URL | null {
	if (
		typeof value !== "string" ||
		value.length > 4096 ||
		value.includes("\\") ||
		[...value].some(
			(char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127,
		) ||
		/(?:^|\/)(?:\.|%2e){1,2}(?:\/|%2f)/iu.test(value)
	)
		return null
	try {
		const url = new URL(value)
		return url.protocol === "https:" &&
			!url.username &&
			!url.password &&
			!url.port &&
			!url.hash &&
			[...url.searchParams].length <= 32
			? url
			: null
	} catch {
		return null
	}
}
function netflixContext(value: string): boolean {
	try {
		if (!/^[A-Za-z0-9_-]+={0,2}$/.test(value) || value.length > 4096)
			return false
		const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
			Buffer.from(value, "base64url"),
		)
		const envelope = JSON.parse(decoded)
		if (
			envelope?.schema !==
				"iglu:com.snowplowanalytics.snowplow/contexts/jsonschema/1-0-0" ||
			!Array.isArray(envelope.data) ||
			envelope.data.length > 16
		)
			return false
		const contexts = envelope.data.filter(
			(entry: { schema?: unknown }) =>
				typeof entry?.schema === "string" &&
				entry.schema.startsWith(
					"iglu:com.justwatch/clickout_context/jsonschema/",
				),
		)
		return (
			contexts.length === 1 &&
			/^iglu:com\.justwatch\/clickout_context\/jsonschema\/1-\d+-\d+$/.test(
				contexts[0].schema,
			) &&
			["netflix", "netflix standard with ads", "netflix with ads"].includes(
				String(contexts[0].data?.provider).trim().toLowerCase(),
			) &&
			Number.isSafeInteger(contexts[0].data?.providerId) &&
			contexts[0].data.providerId > 0
		)
	} catch {
		return false
	}
}
function nativeId(value: unknown): string | null {
	let url = trustedUrl(value)
	if (!url) return null
	if (url.hostname === "click.justwatch.com" && url.pathname === "/a") {
		const params = url.searchParams
		if (
			[...params.keys()].some(
				(key) =>
					!["r", "cx", "uct_country"].includes(key) ||
					params.getAll(key).length !== 1,
			) ||
			url.searchParams.getAll("r").length !== 1
		)
			return null
		const context = url.searchParams.get("cx")
		if (context !== null && !netflixContext(context)) return null
		const country = url.searchParams.get("uct_country")
		if (country !== null && !/^[a-z]{2}$/i.test(country)) return null
		url = trustedUrl(url.searchParams.get("r"))
	}
	if (!url || !["www.netflix.com", "netflix.com"].includes(url.hostname))
		return null
	return (
		/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?title\/([1-9]\d{0,19})\/?$/.exec(
			url.pathname,
		)?.[1] ?? null
	)
}

async function suggest(
	group: WishlistMatchGroup,
	signal: AbortSignal,
): Promise<WishlistSuggestion> {
	const base = { representativeIndex: group.representativeIndex }
	if (group.item.wishlistResolution)
		return { ...base, state: "already_resolved" }
	const original = group.item.wishlistOriginal
	const evidence = original?.wishlistEvidence
	if (
		!original ||
		evidence?.source !== "netflix" ||
		!/^[1-9]\d{0,19}$/.test(evidence.sourceId ?? "")
	)
		return { ...base, state: "manual", reason: "unsupported_source" }
	if (
		group.hasMoreEvidence ||
		group.evidenceVariants.some(
			(variant) =>
				variant.title !== original.title || variant.year !== original.year,
		)
	)
		return { ...base, state: "manual", reason: "conflicting_source_evidence" }
	const found = await Promise.all(
		(["movie", "show"] as const).map(async (mediaType) => {
			const rows = await searchQuery<{ tmdb_id: number }>(
				`SELECT tmdb_id FROM ${mediaType} WHERE MATCH((title,original_title), ?) ORDER BY _score DESC, popularity DESC, tmdb_id ASC LIMIT 10`,
				[original.title],
				signal,
			)
			return rows.map((row) => ({ mediaType, tmdbId: Number(row.tmdb_id) }))
		}),
	)
	const targets = new Map(
		found.flat().map((value) => [identityKey(value), value]),
	)
	for (const table of ["translation", "alternative_title"]) {
		const rows = await searchQuery<{
			media_type: MediaType
			media_tmdb_id: number
		}>(
			`SELECT media_type,media_tmdb_id FROM ${table} WHERE MATCH(title, ?) USING phrase AND lower(title) = lower(?) LIMIT 101`,
			[original.title, original.title],
			signal,
		)
		if (rows.length > 100) throw new Error("Alias limit")
		for (const row of rows) {
			if (
				!["movie", "show"].includes(row.media_type) ||
				!Number.isSafeInteger(Number(row.media_tmdb_id)) ||
				Number(row.media_tmdb_id) <= 0
			)
				throw new Error("Invalid alias target")
			const target = {
				mediaType: row.media_type,
				tmdbId: Number(row.media_tmdb_id),
			}
			targets.set(identityKey(target), target)
		}
	}
	const catalog = new Map<string, CatalogRow & Identity>()
	for (const mediaType of ["movie", "show"] as const) {
		const ids = [
			...new Set(
				[...targets.values()]
					.filter((target) => target.mediaType === mediaType)
					.map((target) => canonicalTitleId(mediaType, target.tmdbId)),
			),
		]
		for (const batch of chunks(ids, 40)) {
			const rows = await searchQuery<CatalogRow>(
				`SELECT tmdb_id,title,release_year,poster_path,adult FROM ${mediaType} WHERE tmdb_id IN (${marks(batch.length)})`,
				batch,
				signal,
			)
			for (const row of rows)
				if (row.adult !== true)
					catalog.set(`${mediaType}:${row.tmdb_id}`, {
						...row,
						mediaType,
						tmdbId: Number(row.tmdb_id),
					})
		}
	}
	const matched = new Set<string>()
	for (const mediaType of ["movie", "show"] as const) {
		const ids = [
			...new Set(
				[...targets.values()]
					.filter(
						(target) =>
							target.mediaType === mediaType &&
							catalog.has(
								`${mediaType}:${canonicalTitleId(mediaType, target.tmdbId)}`,
							),
					)
					.flatMap((target) => [
						target.tmdbId,
						canonicalTitleId(mediaType, target.tmdbId),
					]),
			),
		]
		for (const batch of chunks(ids, 40)) {
			const rows = await searchQuery<{
				media_tmdb_id: number
				stream_url: string
			}>(
				`SELECT media_tmdb_id,stream_url FROM streaming_availability WHERE streaming_service_id = 8 AND media_type = ? AND media_tmdb_id IN (${marks(batch.length)}) AND stream_url IS NOT NULL LIMIT 5001`,
				[mediaType, ...batch],
				signal,
			)
			if (rows.length > 5000) throw new Error("Offer limit")
			for (const row of rows) {
				const key = `${mediaType}:${canonicalTitleId(mediaType, Number(row.media_tmdb_id))}`
				if (
					batch.includes(Number(row.media_tmdb_id)) &&
					catalog.has(key) &&
					nativeId(row.stream_url) === evidence.sourceId
				)
					matched.add(key)
			}
		}
	}
	if (matched.size !== 1)
		return {
			...base,
			state: "manual",
			reason: matched.size ? "ambiguous_native_id" : "no_native_id_match",
		}
	const row = catalog.get([...matched][0])
	if (!row) throw new Error("Missing catalog target")
	if (original.year !== null && original.year !== row.release_year)
		return { ...base, state: "manual", reason: "source_metadata_conflict" }
	return {
		...base,
		state: "suggested",
		proposal: {
			mediaType: row.mediaType,
			tmdbId: row.tmdbId,
			title: row.title,
			year: row.release_year,
			posterPath: row.poster_path,
		},
	}
}

export async function getWishlistSuggestions(
	userId: string,
	id: string,
	offset = 0,
	signal?: AbortSignal,
): Promise<WishlistSuggestions> {
	if (!Number.isSafeInteger(offset) || offset < 0 || offset > 50_000)
		throw new WishlistMatchError(400, "wishlist_search_invalid")
	const { getImportRow } = await import("./store.server.ts")
	const parent = await getImportRow(userId, id)
	if (parent.source === "tvtime") {
		const cached = await (
			await import("./resolution-runtime.server.ts")
		).resolutionSuggestions(userId, id, offset)
		if (cached) return cached
	}
	const all = await matchingGroups(userId, id)
	const page = all.slice(offset, offset + 10)
	const groups: WishlistSuggestion[] = new Array(page.length)
	const pageSignal = signal
		? AbortSignal.any([signal, AbortSignal.timeout(12_000)])
		: AbortSignal.timeout(12_000)
	let cursor = 0
	await Promise.all(
		Array.from({ length: Math.min(3, page.length) }, async () => {
			while (cursor < page.length) {
				const index = cursor++
				const group = page[index]
				if (group.item.wishlistResolution) {
					groups[index] = {
						representativeIndex: group.representativeIndex,
						state: "already_resolved",
					}
					continue
				}
				const controller = new AbortController()
				try {
					groups[index] = await withBackendTimeout(
						"Wishlist suggestions",
						2500,
						(signal) =>
							suggest(group, AbortSignal.any([signal, controller.signal])),
						{ signal: AbortSignal.any([pageSignal, controller.signal]) },
					)
				} catch {
					groups[index] = {
						representativeIndex: group.representativeIndex,
						state: "unavailable",
						reason: "catalog_unavailable",
					}
				} finally {
					// A failed typed read must cancel its sibling before this worker advances.
					controller.abort()
				}
			}
		}),
	)
	const hasMore = offset + page.length < all.length
	return {
		groups,
		total: all.length,
		offset,
		hasMore,
		nextOffset: hasMore ? offset + page.length : null,
	}
}
