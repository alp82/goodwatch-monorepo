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
import { prepareImportTrackingPlan } from "./tracking.server.ts"

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
		if (source === "letterboxd")
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
	// An episode is accepted only when it belongs to the matched show. TMDB ID wins; season/number is a fallback
	// only when it identifies exactly one current catalog episode.
	const shows = [
		...new Set(
			rows
				.map((row, index) => ({ row, index }))
				.filter(
					(x) =>
						found.get(x.index)?.mediaType === "show" &&
						(x.row.episodeTmdbId != null ||
							x.row.season != null ||
							x.row.episode != null),
				)
				.flatMap((x) => {
					const match = found.get(x.index)
					return match ? [match.tmdbId] : []
				}),
		),
	]
	for (const showId of shows) {
		const episodes = await select<{
			tmdb_id: number
			season_number: number
			episode_number: number
		}>(
			"SELECT tmdb_id, season_number, episode_number FROM episode WHERE show_id = ? AND removed_at IS NULL LIMIT 50001",
			[showId],
		)
		for (const [index, title] of found) {
			const row = rows[index]
			if (
				title.mediaType !== "show" ||
				title.tmdbId !== showId ||
				(row.episodeTmdbId == null && row.season == null && row.episode == null)
			)
				continue
			const candidates =
				row.episodeTmdbId != null
					? episodes.filter(
							(episode) => Number(episode.tmdb_id) === row.episodeTmdbId,
						)
					: episodes.filter(
							(episode) =>
								Number(episode.season_number) === row.season &&
								Number(episode.episode_number) === row.episode,
						)
			if (candidates.length !== 1) found.delete(index)
			else {
				row.episodeTmdbId = Number(candidates[0].tmdb_id)
				row.season = Number(candidates[0].season_number)
				row.episode = Number(candidates[0].episode_number)
			}
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
				item.reason = "This watch is already in your GoodWatch watch log."
			}
	}
}

function classify(
	rows: ImportObservation[],
	matched: Map<number, { tmdbId: number; mediaType: "movie" | "show" }>,
	current: Awaited<ReturnType<typeof currentValues>>,
): ImportItem[] {
	return rows.map((row, index): ImportItem => {
		const base = { ...row, index, reason: null, currentScore: null }
		if (row.problem)
			return {
				...base,
				outcome: row.problem.outcome,
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
): Promise<ImportSummary> {
	const parsed: ParsedImport = await parseImportFile(source, bytes)
	const [matched, current] = await Promise.all([
		matchCatalog(source, parsed.observations),
		currentValues(userId),
	])
	const items = classify(parsed.observations, matched, current)
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
	const hash = createHash("sha256").update(bytes).digest("hex")
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
