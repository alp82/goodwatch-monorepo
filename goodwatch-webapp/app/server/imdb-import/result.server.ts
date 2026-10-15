import type { ImdbImportOutcome } from "~/domain/imdb-import"
// The result of an IMDb ratings import and of its Undo, from the columns its rows keep: the rating before
// (prior_score), the one it wrote (applied_score), and what Undo did (undo_outcome).
import {
	type ImportResult,
	type ImportResultEntry,
	type ImportResultSectionKey,
	groupImportResult,
} from "~/domain/import-result"
import { firstRows, sectionPage } from "../imports/result-catalog.server.ts"
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
	undo_outcome: "reverted" | "left" | null
}

const SKIPPED: ImdbImportOutcome[] = ["unmatched", "unsupported", "invalid"]
const number = (value: number | null) => (value === null ? null : Number(value))

function entryOf(
	operation: ImportResult["operation"],
	conflictChoice: string | null,
	row: ResultRow,
): ImportResultEntry | null {
	const label = row.year
		? `${row.title ?? row.imdb_id ?? ""} (${row.year})`
		: (row.title ?? row.imdb_id ?? "")
	if (SKIPPED.includes(row.outcome))
		return operation === "import"
			? {
					key: `row:${row.row_index}`,
					title: null,
					change: {
						type: "skipped",
						kind: "rating",
						label,
						row: Number(row.row_index) + 1,
						reason: row.reason ?? "GoodWatch can't import this row.",
					},
				}
			: null
	if (row.tmdb_id === null || !row.media_type) return null
	const title = {
		tmdbId: Number(row.tmdb_id),
		mediaType: row.media_type,
		title: row.title ?? row.imdb_id ?? "",
		year: number(row.year),
		posterPath: null,
	}
	const key = `${title.mediaType}:${title.tmdbId}`
	const prior = number(row.prior_score)
	const applied = number(row.applied_score)
	const written =
		row.apply_state === "added" ||
		row.apply_state === "updated" ||
		row.apply_state === "undone"
	if (written && applied !== null) {
		if (operation === "import")
			return {
				key,
				title,
				change:
					prior === null
						? { type: "rating-added", score: applied }
						: { type: "rating-replaced", from: prior, to: applied },
			}
		// Imports undone before Undo recorded its outcomes count as taken back.
		if (row.undo_outcome === "left")
			return { key, title, change: { type: "left", kind: "rating" } }
		return {
			key,
			title,
			change:
				prior === null
					? { type: "rating-removed", score: applied }
					: { type: "rating-restored", from: applied, to: prior },
		}
	}
	if (operation === "undo") return null
	const current = number(row.current_score)
	const reason =
		row.outcome === "unchanged"
			? "Already the same in GoodWatch."
			: row.outcome === "conflict" && conflictChoice === "keep"
				? `You chose to keep your GoodWatch rating${current === null ? "" : ` of ${current}`}.`
				: row.apply_state === "kept"
					? "You changed it in GoodWatch after the preview."
					: null
	return reason
		? { key, title, change: { type: "kept", kind: "rating", reason } }
		: null
}

async function groupedResult(
	userId: string,
	id: string,
): Promise<ImportResult> {
	const importRow = await getImportRow(userId, id)
	const operation = importRow.status === "undone" ? "undo" : "import"
	const rows = await select<ResultRow>(
		`SELECT row_index, imdb_id, title, year, outcome, reason, tmdb_id, media_type, current_score, apply_state, prior_score, applied_score, undo_outcome FROM doc.user_import_item WHERE import_id = ? AND user_id = ? ORDER BY row_index LIMIT ${MAX_ROWS}`,
		[id, userId],
	)
	return groupImportResult(
		operation,
		rows.flatMap((row) => {
			const entry = entryOf(operation, importRow.conflict_choice, row)
			return entry ? [entry] : []
		}),
	)
}

/** The result with the first titles of each section. */
export const imdbImportResult = async (userId: string, id: string) =>
	firstRows(select, await groupedResult(userId, id))

/** More titles of one section. */
export const imdbImportResultPage = async (
	userId: string,
	id: string,
	section: ImportResultSectionKey,
	offset: number,
	limit: number,
) =>
	sectionPage(select, await groupedResult(userId, id), section, offset, limit)
