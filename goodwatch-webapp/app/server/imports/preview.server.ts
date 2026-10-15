import { createHash, randomUUID } from "node:crypto"
import type {
	ImportItem,
	ImportKind,
	ImportObservation,
	ImportOutcome,
	ImportSource,
	ImportSummary,
	ParsedImport,
} from "~/domain/imports"
import { canonicalTitleId } from "~/utils/title-identity"
import { createCatalogEpisodeResolver } from "./episode-resolver-data.server.ts"
import { parseImportFile } from "./files.server.ts"
import {
	type Param,
	chunks,
	getImportRow,
	marks,
	refreshImports,
	refreshItems,
	run,
	select,
	summarize,
} from "./store.server.ts"

const key = (type: "movie" | "show", id: number) => `${type}:${id}`
type CatalogRow = {
	tmdb_id: number
	imdb_id: string | null
	title: string
	release_year: number | null
}

async function matchCatalog(source: ImportSource, rows: ImportObservation[]) {
	const found = new Map<
		number,
		{ tmdbId: number; mediaType: "movie" | "show" }
	>()
	for (const type of ["movie", "show"] as const) {
		const typed = rows
			.map((row, index) => ({ row, index }))
			.filter((x) => x.row.mediaType === type && !x.row.problem)
		const tmdbIds = [
			...new Set(
				typed.flatMap((x) =>
					x.row.tmdbId ? [canonicalTitleId(type, x.row.tmdbId)] : [],
				),
			),
		]
		for (const batch of chunks(tmdbIds, 800)) {
			const result = await select<CatalogRow>(
				`SELECT tmdb_id, imdb_id, title, release_year FROM ${type} WHERE tmdb_id IN (${marks(batch.length)})`,
				batch,
			)
			const ids = new Set(result.map((r) => Number(r.tmdb_id)))
			for (const x of typed)
				if (x.row.tmdbId && ids.has(canonicalTitleId(type, x.row.tmdbId)))
					found.set(x.index, {
						tmdbId: canonicalTitleId(type, x.row.tmdbId),
						mediaType: type,
					})
		}
		const imdbIds = [
			...new Set(
				typed
					.filter((x) => !found.has(x.index) && x.row.imdbId)
					.flatMap((x) =>
						typeof x.row.imdbId === "string" ? [x.row.imdbId] : [],
					),
			),
		]
		for (const batch of chunks(imdbIds, 800)) {
			const result = await select<CatalogRow>(
				`SELECT tmdb_id, imdb_id, title, release_year FROM ${type} WHERE imdb_id IN (${marks(batch.length)})`,
				batch,
			)
			for (const x of typed) {
				if (found.has(x.index) || !x.row.imdbId) continue
				const matches = result.filter((r) => r.imdb_id === x.row.imdbId)
				if (matches.length === 1)
					found.set(x.index, {
						tmdbId: canonicalTitleId(type, Number(matches[0].tmdb_id)),
						mediaType: type,
					})
			}
		}
		// Letterboxd has no stable ID in some CSVs. Exact title and year is the sole safe fallback.
		const titleMatches = new Map<string, CatalogRow[]>()
		if (source === "letterboxd" || source === "csv")
			for (const x of typed) {
				if (found.has(x.index) || x.row.year === null || !x.row.title.trim())
					continue
				const lookup = `${x.row.title.trim().toLocaleLowerCase()}:${x.row.year}`
				let result = titleMatches.get(lookup)
				if (!result) {
					result = await select<CatalogRow>(
						`SELECT tmdb_id, imdb_id, title, release_year FROM ${type} WHERE lower(title) = lower(?) AND release_year = ? LIMIT 2`,
						[x.row.title.trim(), x.row.year],
					)
					titleMatches.set(lookup, result)
				}
				if (result.length === 1)
					found.set(x.index, {
						tmdbId: canonicalTitleId(type, Number(result[0].tmdb_id)),
						mediaType: type,
					})
			}
	}
	const resolveEpisode = createCatalogEpisodeResolver()
	for (const [index, title] of found) {
		const row = rows[index]
		if (
			title.mediaType !== "show" ||
			(row.episodeTmdbId == null &&
				row.episodeTvdbId == null &&
				!row.episodeGroup &&
				!row.episodeName &&
				row.season == null &&
				row.episode == null)
		)
			continue
		const result = await resolveEpisode({
			...row,
			showId: title.tmdbId,
			numbering: row.episodeNumbering,
		})
		if (result.status === "unmatched") {
			found.delete(index)
			row.problem = { outcome: "unmatched", reason: result.reason }
		} else {
			row.episodeTmdbId = result.episodeTmdbId
			row.season = result.season
			row.episode = result.episode
			if (result.special) row.episodeSpecial = true
		}
	}

	return found
}

async function currentValues(userId: string) {
	await run(
		"REFRESH TABLE user_score, user_wishlist, user_favorite, user_watch_log, user_watch_state",
	)
	const [scores, wants, favorites, watched] = await Promise.all([
		select<{
			tmdb_id: number
			media_type: "movie" | "show"
			score: number | null
			review: string | null
			updated_at: Date | string
			_seq_no: number
			_primary_term: number
		}>(
			"SELECT tmdb_id, media_type, score, review, updated_at, _seq_no, _primary_term FROM user_score WHERE user_id = ? LIMIT 100000",
			[userId],
		),
		select<{ tmdb_id: number; media_type: "movie" | "show" }>(
			"SELECT tmdb_id, media_type FROM user_wishlist WHERE user_id = ? LIMIT 100000",
			[userId],
		),
		select<{ tmdb_id: number; media_type: "movie" | "show" }>(
			"SELECT tmdb_id, media_type FROM user_favorite WHERE user_id = ? LIMIT 100000",
			[userId],
		),
		select<{ tmdb_id: number; media_type: "movie" | "show" }>(
			"SELECT DISTINCT tmdb_id, media_type FROM user_watch_log WHERE user_id = ? LIMIT 100000",
			[userId],
		),
	])
	return {
		scores: new Map(
			scores.map((x) => [
				key(x.media_type, Number(x.tmdb_id)),
				{
					score: x.score === null ? null : Number(x.score),
					review: x.review,
					updatedAt: new Date(x.updated_at).toISOString(),
					seq: Number(x._seq_no),
					term: Number(x._primary_term),
				},
			]),
		),
		wants: new Set(wants.map((x) => key(x.media_type, Number(x.tmdb_id)))),
		favorites: new Set(
			favorites.map((x) => key(x.media_type, Number(x.tmdb_id))),
		),
		watched: new Set(watched.map((x) => key(x.media_type, Number(x.tmdb_id)))),
	}
}

async function classifyWatchDuplicates(
	userId: string,
	source: ImportSource,
	id: string,
	items: ImportItem[],
) {
	const groups = new Map<string, ImportItem[]>()
	for (const item of items.filter(
		(x) => x.kind === "watch" && x.outcome === "new" && x.tmdbId !== null,
	)) {
		const ref = `${item.mediaType}:${item.tmdbId}`
		groups.set(ref, [...(groups.get(ref) ?? []), item])
	}
	if (!groups.size) return
	const { prepareImportTrackingPlan } = await import("./tracking.server.ts")
	for (const group of groups.values()) {
		const first = group[0]
		if (!first || first.tmdbId === null) continue
		const plan = await prepareImportTrackingPlan({
			userId,
			importId: id,
			source,
			tmdbId: first.tmdbId,
			mediaType: first.mediaType,
			items: group,
			watchDates: "preserve",
			now: Date.now(),
		})
		const kept = new Set(plan.keptKeys)
		for (const item of group)
			if (kept.has(item.key)) {
				item.outcome = "unchanged"
				item.reason = [
					item.reason,
					"This watch is already in your GoodWatch watch log.",
				]
					.filter(Boolean)
					.join(" ")
			}
	}
}

function classify(
	rows: ImportObservation[],
	matched: Map<number, { tmdbId: number; mediaType: "movie" | "show" }>,
	current: Awaited<ReturnType<typeof currentValues>>,
): ImportItem[] {
	return rows.map((row, index): ImportItem => {
		const base = {
			...row,
			index,
			reason: row.episodeSpecial
				? "This episode maps to a TMDB special. It is imported but does not count toward regular show progress."
				: null,
			currentScore: null,
		}
		if (row.problem)
			return {
				...base,
				outcome: row.problem.outcome,
				...(row.problem.outcome === "unmatched" ? { tmdbId: null } : {}),
				reason: row.problem.reason,
			}
		const title = matched.get(index)
		if (!title)
			return {
				...base,
				tmdbId: null,
				outcome: "unmatched",
				reason:
					"This title could not be matched uniquely in the GoodWatch catalog.",
			}
		const ref = key(title.mediaType, title.tmdbId)
		const known = current.scores.get(ref)
		if (row.kind === "rating") {
			if (row.score === null || row.score === undefined)
				return {
					...base,
					...title,
					outcome: "invalid",
					reason: "This rating has no value.",
				}
			if (known?.score === row.score)
				return {
					...base,
					...title,
					currentScore: known.score,
					outcome: "unchanged",
					_preview: known,
				} as ImportItem
			return {
				...base,
				...title,
				currentScore: known?.score ?? null,
				outcome: known?.score == null ? "new" : "conflict",
				reason:
					known?.score == null
						? null
						: `You rated this ${known.score} in GoodWatch.`,
				_preview: known ?? null,
			} as ImportItem
		}
		if (row.kind === "review") {
			if (!row.review?.trim())
				return {
					...base,
					...title,
					outcome: "invalid",
					reason: "This review is empty.",
				}
			if (known?.review === row.review)
				return {
					...base,
					...title,
					outcome: "unchanged",
					_preview: known,
				} as ImportItem
			return {
				...base,
				...title,
				outcome: known?.review ? "conflict" : "new",
				reason: known?.review
					? "You already have a different review in GoodWatch."
					: null,
				_preview: known ?? null,
			} as ImportItem
		}
		if (row.kind === "want")
			return {
				...base,
				...title,
				outcome:
					current.wants.has(ref) || current.watched.has(ref)
						? "unchanged"
						: "new",
				reason: current.watched.has(ref)
					? "This title is already in your watch log."
					: null,
			}
		if (row.kind === "favorite")
			return {
				...base,
				...title,
				outcome: current.favorites.has(ref) ? "unchanged" : "new",
			}
		return { ...base, ...title, outcome: "new" }
	})
}

const itemColumns = [
	"import_id",
	"row_index",
	"user_id",
	"kind",
	"source_key",
	"payload",
	"imdb_id",
	"title",
	"year",
	"outcome",
	"reason",
	"tmdb_id",
	"media_type",
	"current_score",
	"season_number",
	"episode_number",
	"episode_tmdb_id",
	"watched_at",
	"watched_at_precision",
	"pass",
]
async function insertItems(id: string, userId: string, items: ImportItem[]) {
	for (const batch of chunks(items, 300))
		await run(
			`INSERT INTO doc.user_import_item (${itemColumns.join(",")}) VALUES ${batch.map(() => `(${marks(itemColumns.length)})`).join(",")}`,
			batch.flatMap((x): Param[] => [
				id,
				x.index,
				userId,
				x.kind,
				x.key,
				JSON.stringify(x),
				x.imdbId,
				x.title,
				x.year,
				x.outcome,
				x.reason,
				x.tmdbId,
				x.tmdbId === null ? null : x.mediaType,
				x.currentScore ?? null,
				x.season ?? null,
				x.episode ?? null,
				x.episodeTmdbId ?? null,
				x.watchedAt ? new Date(x.watchedAt) : null,
				x.precision ?? null,
				x.pass ?? 1,
			]),
		)
}

export async function createPreview(
	userId: string,
	source: ImportSource,
	fileName: string,
	bytes: Uint8Array,
	wishlist?: Uint8Array,
): Promise<ImportSummary> {
	const parsed: ParsedImport = await parseImportFile(source, bytes, wishlist)
	const [matched, current] = await Promise.all([
		matchCatalog(source, parsed.observations),
		currentValues(userId),
	])
	const items = classify(parsed.observations, matched, current)
	const specials = items.filter((item) => item.episodeSpecial).length
	if (specials)
		parsed.warnings.push(
			`${specials} episode row(s) map to TMDB specials. They are imported but do not count toward regular show progress.`,
		)
	const id = randomUUID()
	await classifyWatchDuplicates(userId, source, id, items)
	const countRecord = {
		rows: items.length,
		new: 0,
		unchanged: 0,
		conflict: 0,
		unmatched: 0,
		unsupported: 0,
		invalid: 0,
	}
	for (const item of items) countRecord[item.outcome]++
	const kinds: Record<ImportKind, number> = {
		rating: 0,
		watch: 0,
		want: 0,
		favorite: 0,
		review: 0,
	}
	for (const item of items) if (item.kind !== "unsupported") kinds[item.kind]++
	const now = new Date()
	const fileHash = createHash("sha256").update(bytes)
	if (wishlist)
		fileHash.update(`\0wishlist:${wishlist.length}:`).update(wishlist)
	const hash = fileHash.digest("hex")
	try {
		await insertItems(id, userId, items)
		await refreshItems()
		await run(
			"INSERT INTO doc.user_import (id,user_id,source,status,file_name,counts,processed,total,added,updated,kept,failed,error,created_at,updated_at,warnings,kinds,file_hash) VALUES (?,?,?,'preview',?,?,0,?,0,0,0,0,NULL,?,?,?,?,?)",
			[
				id,
				userId,
				source,
				fileName,
				JSON.stringify(countRecord),
				items.length,
				now,
				now,
				JSON.stringify(parsed.warnings),
				JSON.stringify(kinds),
				hash,
			],
		)
		await refreshImports()
	} catch (error) {
		await run("DELETE FROM doc.user_import_item WHERE import_id = ?", [
			id,
		]).catch(() => null)
		throw error
	}
	return summarize(await getImportRow(userId, id))
}
