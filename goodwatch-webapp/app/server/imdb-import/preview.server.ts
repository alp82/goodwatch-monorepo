// The preview: reads the file, matches it against the catalog and the member's ratings, and stores the result.
// It writes nothing to user_score. The member confirms it afterwards (apply.server.ts).
import { randomUUID } from "node:crypto"
import type { ImdbImportSummary } from "~/domain/imdb-import"
import { canonicalTitleId } from "~/utils/title-identity"
import { catalogRef, type ClassifiedRow, classifyRows, countOutcomes, titleRef } from "./classify.server"
import { type FileRow, type ImportMediaType, readRatingsFile } from "./file.server"
import {
	chunks,
	getImportRow,
	listImportRows,
	marks,
	type Param,
	refreshItems,
	run,
	select,
	summarize,
} from "./store.server"

const LOOKUP_BATCH = 1000
const INSERT_BATCH = 500
const INSERT_CONCURRENCY = 4
// Far above what one member holds; a guard against an unbounded read, as in the Taste rebuild.
const MAX_SCORES = 100_000
const MAX_APPLIED = 200_000

/** Exact IMDb ID matches only, each in the table its title type belongs to. Title names are never compared. */
async function lookupCatalog(rows: FileRow[]): Promise<Map<string, number[]>> {
	const catalog = new Map<string, number[]>()
	await Promise.all(
		(["movie", "show"] as const).map(async (type) => {
			const ids = [...new Set(rows.filter((row) => row.mediaType === type).map((row) => row.imdbId))]
			for (const batch of chunks(ids, LOOKUP_BATCH)) {
				const found = await select<{ tmdb_id: number; imdb_id: string }>(
					`SELECT tmdb_id, imdb_id FROM ${type} WHERE imdb_id IN (${marks(batch.length)})`,
					batch,
				)
				for (const title of found) {
					const ref = catalogRef(type, title.imdb_id)
					const tmdbId = canonicalTitleId(type, Number(title.tmdb_id))
					const known = catalog.get(ref) ?? []
					if (!known.includes(tmdbId)) catalog.set(ref, [...known, tmdbId])
				}
			}
		}),
	)
	return catalog
}

async function readScores(userId: string): Promise<Map<string, number>> {
	// A rating saved a moment ago is only visible to this read after a refresh.
	await run("REFRESH TABLE user_score")
	const rows = await select<{ tmdb_id: number; media_type: ImportMediaType; score: number | null }>(
		`SELECT tmdb_id, media_type, score FROM user_score WHERE user_id = ? LIMIT ${MAX_SCORES}`,
		[userId],
	)
	const scores = new Map<string, number>()
	for (const row of rows) if (row.score !== null) scores.set(titleRef(row.media_type, Number(row.tmdb_id)), Number(row.score))
	return scores
}

/** What the member's earlier imports wrote, the latest write per title. An undone import's rows are `undone`. */
async function readLastApplied(userId: string): Promise<Map<string, number>> {
	const rows = await select<{ tmdb_id: number; media_type: ImportMediaType; applied_score: number }>(
		`SELECT tmdb_id, media_type, applied_score FROM doc.user_import_item
		 WHERE user_id = ? AND apply_state IN ('added', 'updated')
		 ORDER BY applied_at ASC LIMIT ${MAX_APPLIED}`,
		[userId],
	)
	const applied = new Map<string, number>()
	for (const row of rows) applied.set(titleRef(row.media_type, Number(row.tmdb_id)), Number(row.applied_score))
	return applied
}

const ITEM_COLUMNS = [
	"import_id",
	"row_index",
	"user_id",
	"imdb_id",
	"title",
	"year",
	"title_type",
	"raw_rating",
	"imdb_score",
	"date_rated",
	"outcome",
	"reason",
	"tmdb_id",
	"media_type",
	"current_score",
]

async function insertItems(importId: string, userId: string, rows: ClassifiedRow[]) {
	const batches = chunks(rows, INSERT_BATCH)
	const insert = (batch: ClassifiedRow[]) =>
		run(
			`INSERT INTO doc.user_import_item (${ITEM_COLUMNS.join(", ")}) VALUES ${batch.map(() => `(${marks(ITEM_COLUMNS.length)})`).join(", ")}`,
			batch.flatMap((row): Param[] => [
				importId,
				row.index,
				userId,
				row.imdbId,
				row.title,
				row.year,
				row.titleType,
				row.rawRating,
				row.score,
				row.dateRated,
				row.outcome,
				row.reason,
				row.tmdbId,
				row.tmdbId === null ? null : row.mediaType,
				row.currentScore,
			]),
		)
	let next = 0
	await Promise.all(
		Array.from({ length: INSERT_CONCURRENCY }, async () => {
			while (next < batches.length) await insert(batches[next++])
		}),
	)
}

const deleteImport = async (id: string) => {
	await run("DELETE FROM doc.user_import_item WHERE import_id = ?", [id])
	await run("DELETE FROM doc.user_import WHERE id = ?", [id])
}

/** A new upload replaces the member's earlier previews: they were never confirmed and wrote nothing. */
async function discardPreviews(userId: string) {
	try {
		for (const preview of await listImportRows(userId, "preview")) await deleteImport(preview.id)
	} catch (error) {
		console.error("IMDb import: discarding earlier previews failed:", error)
	}
}

export async function createPreview(userId: string, fileName: string, csv: string): Promise<ImdbImportSummary> {
	const rows = readRatingsFile(csv)
	// First, so missing import tables are reported before any other work.
	const lastApplied = await readLastApplied(userId)
	const [catalog, scores] = await Promise.all([lookupCatalog(rows), readScores(userId)])
	const classified = classifyRows(rows, { catalog, scores, lastApplied })
	const counts = countOutcomes(classified)

	await discardPreviews(userId)
	const id = randomUUID()
	const now = new Date()
	try {
		await insertItems(id, userId, classified)
		await refreshItems()
		// Last, so a preview that can be fetched always has all its rows.
		await run(
			`INSERT INTO doc.user_import (id, user_id, source, status, file_name, counts, processed, total, added, updated, kept, failed, created_at, updated_at)
			 VALUES (?, ?, 'imdb', 'preview', ?, ?, 0, 0, 0, 0, 0, 0, ?, ?)`,
			[id, userId, fileName, JSON.stringify(counts), now, now],
		)
	} catch (error) {
		await deleteImport(id).catch(() => null)
		throw error
	}
	return summarize(await getImportRow(userId, id))
}
