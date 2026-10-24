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
	undoneEntry,
} from "~/domain/import-result"
import {
	type ImportTitleRef,
	importPosters,
	resultApi,
} from "../imports/result-catalog.server.ts"
import { MAX_ROWS } from "./file.server"
import {
	getImportRow,
	listItems,
	questionOptions,
	select,
} from "./store.server"

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
	apply_state:
		| "added"
		| "updated"
		| "kept"
		| "failed"
		| "undone"
		| "waiting:conflict"
		| "approved:conflict"
		| null
	prior_score: number | null
	applied_score: number | null
	undo_outcome: StoredUndoOutcome | null
	/** 'episode_rating' for an episode row (#759); NULL for a title rating. */
	kind: string | null
	season_number: number | null
	episode_number: number | null
}

const SKIPPED: ImdbImportOutcome[] = ["unmatched", "unsupported", "invalid"]
const number = (value: number | null) => (value === null ? null : Number(value))

function entryOf(
	operation: ImportResultOperation,
	keepConflicts: boolean,
	row: ResultRow,
): ImportResultEntry | null {
	if (
		row.apply_state === "waiting:conflict" ||
		row.apply_state === "approved:conflict"
	)
		return null
	const label = exportLabel(row.title ?? row.imdb_id ?? "", row.year)
	const episode = row.kind === "episode_rating"
	const kind = episode ? "episode_rating" : "rating"
	if (SKIPPED.includes(row.outcome) || row.apply_state === "failed")
		return operation === "import"
			? skippedEntry(
					Number(row.row_index),
					kind,
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
	if (written && applied !== null && episode) {
		const part = `S${number(row.season_number)} E${number(row.episode_number)}`
		const prior = number(row.prior_score)
		if (operation === "import")
			return {
				key,
				title,
				change: {
					type: "episode-rating-added",
					part,
					score: applied,
					from: prior,
				},
			}
		return (
			undoneEntry(key, title, "episode_rating", row.undo_outcome) ?? {
				key,
				title,
				change: {
					type: "episode-rating-removed",
					part,
					score: applied,
					restored: prior,
				},
			}
		)
	}
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
		keepConflicts:
			keepConflicts || row.reason === "You chose to keep what GoodWatch has.",
		kind,
		current: number(row.current_score),
	})
	return reason ? { key, title, change: { type: "kept", kind, reason } } : null
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
				`SELECT row_index, imdb_id, title, year, outcome, reason, tmdb_id, media_type, current_score, apply_state, prior_score, applied_score, undo_outcome, kind, season_number, episode_number FROM doc.user_import_item WHERE import_id = ? AND user_id = ? ORDER BY row_index LIMIT ${MAX_ROWS}`,
				[id, userId],
			)
			return groupImportResult(
				operation,
				rows.flatMap((row) => {
					const entry = entryOf(
						operation,
						!questionOptions(importRow).ask &&
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

/** The outcomes whose titles the poster rows show, in the order they are filled. */
const POSTER_OUTCOMES: ImdbImportOutcome[] = [
	"new",
	"update",
	"conflict",
	"unchanged",
]
/** Rows read per outcome to find the titles for a poster row. */
const POSTER_ROWS = 200

/** Posters of the titles an IMDb import brings: new ones first, then changed, differing, and the same. */
export async function imdbImportPosters(
	userId: string,
	id: string,
	outcome: ImdbImportOutcome | undefined,
	limit: number,
) {
	const refs: ImportTitleRef[] = []
	for (const each of outcome ? [outcome] : POSTER_OUTCOMES) {
		if (
			new Set(refs.map((ref) => `${ref.mediaType}:${ref.tmdbId}`)).size >=
			limit * 2
		)
			break
		const { items } = await listItems(userId, id, each, 0, POSTER_ROWS)
		for (const item of items)
			if (item.tmdbId !== null && item.mediaType)
				refs.push({
					mediaType: item.mediaType,
					tmdbId: item.tmdbId,
					title: item.title,
				})
	}
	return { posters: await importPosters(select, refs, limit) }
}
