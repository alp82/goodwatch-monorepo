import type { ImdbImportOutcome } from "~/domain/imdb-import"
// The result of an IMDb ratings import and of its Undo, from the columns its rows keep: the rating before
// (prior_score), the one it wrote (applied_score), and what Undo did (undo_outcome).
import {
	FAILED_REASON,
	type ImportResult,
	type ImportResultEntry,
	type ImportResultOperation,
	type StoredUndoOutcome,
	exportLabel,
	groupImportResult,
	keptReason,
	ratingEntry,
	resultTitleKey,
	skippedEntry,
} from "~/domain/import-result"
import { resultApi } from "../imports/result-catalog.server.ts"
import { MAX_ROWS } from "./file.server"
import { getImportRow, select } from "./store.server"

interface ResultRow {
	row_index: number
	imdb_id: string | null
	title: string | null
	year: number | null
	outcome: ImdbImportOutcome
	reason: string | null
	tmdb_id: number | null
	media_type: "movie" | "show" | null
	current_score: number | null
	apply_state: "added" | "updated" | "kept" | "failed" | "undone" | null
	prior_score: number | null
	applied_score: number | null
	undo_outcome: StoredUndoOutcome | null
}

const SKIPPED: ImdbImportOutcome[] = ["unmatched", "unsupported", "invalid"]
const number = (value: number | null) => (value === null ? null : Number(value))

function entryOf(
	operation: ImportResultOperation,
	keepConflicts: boolean,
	row: ResultRow,
): ImportResultEntry | null {
	const label = exportLabel(row.title ?? row.imdb_id ?? "", row.year)
	if (SKIPPED.includes(row.outcome) || row.apply_state === "failed")
		return operation === "import"
			? skippedEntry(
					Number(row.row_index),
					"rating",
					label,
					row.apply_state === "failed"
						? FAILED_REASON
						: (row.reason ?? "GoodWatch can't import this row."),
				)
			: null
	if (row.tmdb_id === null || !row.media_type) return null
	const title = {
		tmdbId: Number(row.tmdb_id),
		mediaType: row.media_type,
		title: row.title ?? row.imdb_id ?? "",
		year: number(row.year),
		posterPath: null,
	}
	const key = resultTitleKey(title)
	const applied = number(row.applied_score)
	const written =
		row.apply_state === "added" ||
		row.apply_state === "updated" ||
		row.apply_state === "undone"
	if (written && applied !== null)
		return ratingEntry(
			operation,
			key,
			title,
			number(row.prior_score),
			applied,
			row.undo_outcome,
		)
	if (operation === "undo") return null
	const reason = keptReason({
		outcome: row.outcome,
		applyState: row.apply_state,
		keepConflicts,
		kind: "rating",
		current: number(row.current_score),
	})
	return reason
		? { key, title, change: { type: "kept", kind: "rating", reason } }
		: null
}

const api = resultApi(select, async (userId, id) => {
	const importRow = await getImportRow(userId, id)
	const operation = importRow.status === "undone" ? "undo" : "import"
	return {
		version: ["done", "undone"].includes(importRow.status)
			? `${importRow.status}:${new Date(importRow.updated_at).getTime()}`
			: null,
		build: async (): Promise<ImportResult> => {
			const rows = await select<ResultRow>(
				`SELECT row_index, imdb_id, title, year, outcome, reason, tmdb_id, media_type, current_score, apply_state, prior_score, applied_score, undo_outcome FROM doc.user_import_item WHERE import_id = ? AND user_id = ? ORDER BY row_index LIMIT ${MAX_ROWS}`,
				[id, userId],
			)
			return groupImportResult(
				operation,
				rows.flatMap((row) => {
					const entry = entryOf(
						operation,
						importRow.conflict_choice === "keep",
						row,
					)
					return entry ? [entry] : []
				}),
			)
		},
	}
})

/** The result with the first titles of each section. */
export const imdbImportResult = api.first
/** More titles of one section. */
export const imdbImportResultPage = api.page
