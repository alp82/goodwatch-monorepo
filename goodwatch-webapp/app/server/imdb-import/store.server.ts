// IMDb imports in Crate (doc.user_import, doc.user_import_item): reading them back for the member who owns them.
// An import is fetched by its primary key, which Crate reads in real time, and checked against the member here.
// Items are read by import, which only sees rows after a refresh; the writers refresh the table when they finish.
import type {
	ImdbConflictChoice,
	ImdbImportCounts,
	ImdbImportItem,
	ImdbImportOutcome,
	ImdbImportStatus,
	ImdbImportSummary,
} from "~/domain/imdb-import"
import { execute, query } from "~/utils/crate"
import { csvLine, ImdbImportError, type ImportMediaType, MAX_ROWS } from "./file.server"

// Crate's client types its parameters narrowly; null is a valid argument.
export type Param = string | number | Date | null
export const run = (sql: string, params: Param[] = []) => execute(sql, params as (string | number | Date)[])
export const select = <T extends {}>(sql: string, params: Param[] = []) => query<T>(sql, params as (string | number | Date)[])

export const marks = (count: number) => Array(count).fill("?").join(",")

export function chunks<T>(list: T[], size: number): T[][] {
	const out: T[][] = []
	for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
	return out
}

// Whether a running import is alive is read from its row, because the process that applies it may be the other
// webapp instance. The apply sets updated_at every HEARTBEAT_MS, also in the middle of a slow batch, and every reader
// compares it with Crate's clock from the same read, so the clocks of the webapp hosts don't matter.

/** How often a running import reports that it's alive. */
export const HEARTBEAT_MS = 10_000

/**
 * A running import that hasn't reported for this long has stopped, most likely with its process, and can be resumed.
 * Six heartbeats, so a live import survives a few reports in a row that time out against Crate (10 s each).
 */
export const STALL_MS = 60_000

/**
 * The imports this process is applying right now. It knows these are alive without asking Crate, also while Crate
 * is too slow to take the heartbeat.
 */
export const activeRuns = new Set<string>()

export interface ImportRow {
	id: string
	source: string
	user_id: string
	status: ImdbImportStatus
	file_name: string | null
	conflict_choice: ImdbConflictChoice | null
	counts: string
	processed: number
	total: number
	added: number
	updated: number
	kept: number
	failed: number
	without_fingerprint: number | null
	error: string | null
	created_at: number | string | Date
	updated_at: number | string | Date
	confirmed_at: number | string | Date | null
	finished_at: number | string | Date | null
	/** Crate's clock when the row was read. */
	read_at: number | string | Date
	/**
	 * Crate's version of the row, which every write to it changes. A write that names both only lands while the row
	 * is still the one that was read (`claimImport`).
	 */
	_seq_no: number
	_primary_term: number
}
const IMPORT_COLUMNS =
	"id, user_id, source, status, file_name, conflict_choice, counts, processed, total, added, updated, kept, failed, without_fingerprint, error, created_at, updated_at, confirmed_at, finished_at, CURRENT_TIMESTAMP AS read_at, _seq_no, _primary_term"

export const toMs = (value: number | string | Date) => new Date(value).getTime()

export const isStalled = (row: ImportRow) =>
	row.status === "running" && !activeRuns.has(row.id) && toMs(row.read_at) - toMs(row.updated_at) > STALL_MS

export function summarize(row: ImportRow): ImdbImportSummary {
	return {
		id: row.id,
		status: row.status,
		fileName: row.file_name ?? "",
		createdAt: new Date(row.created_at).toISOString(),
		finishedAt: row.finished_at === null ? null : new Date(row.finished_at).toISOString(),
		counts: JSON.parse(row.counts) as ImdbImportCounts,
		conflictChoice: row.conflict_choice,
		processed: Number(row.processed),
		total: Number(row.total),
		applied: {
			added: Number(row.added),
			updated: Number(row.updated),
			kept: Number(row.kept),
			failed: Number(row.failed),
		},
		withoutFingerprint: row.without_fingerprint === null ? null : Number(row.without_fingerprint),
		stalled: isStalled(row),
		canUndo: row.status === "done" && Number(row.added) + Number(row.updated) > 0,
		error: row.status === "failed" ? (row.error ?? "The import stopped before it finished. Try again to finish it.") : null,
	}
}

/** The member's own import. Someone else's import doesn't exist as far as they can tell. */
export async function getImportRow(userId: string, id: string): Promise<ImportRow> {
	const rows = await select<ImportRow>(`SELECT ${IMPORT_COLUMNS} FROM doc.user_import WHERE id = ?`, [id])
	const row = rows[0]
	if (!row || row.user_id !== userId || (row.source !== undefined && row.source !== "imdb"))
		throw new ImdbImportError(404, "We couldn't find that import. Upload the file again.")
	return row
}

/** The member's imports, newest first. With `status`, only those. */
export function listImportRows(userId: string, status?: ImdbImportStatus): Promise<ImportRow[]> {
	return select<ImportRow>(
		`SELECT ${IMPORT_COLUMNS} FROM doc.user_import
		 WHERE user_id = ? AND source = 'imdb' AND status ${status ? "= ?" : "<> 'preview'"}
		 ORDER BY created_at DESC LIMIT 100`,
		status ? [userId, status] : [userId],
	)
}

/**
 * Writes `set` to the import only if nothing has written to it since `row` was read, and tells whether it did.
 * Of several requests that read the same row, in either webapp instance, at most one gets true: none does if
 * something else, like a late heartbeat, wrote in between.
 *
 * Crate compares the version on the live row, which `status = ?` in the filter does not: a filter on anything but
 * the key is answered from the last refresh, and the write then lands on the row whatever it holds by now. On CrateDB
 * 5.10.9 two such claims within the refresh interval both reported one row (issue 313). Crate refuses a filter that
 * names the version together with another column, so whatever the claim depends on is checked on `row` beforehand.
 */
export async function claimImport(row: ImportRow, set: string, params: Param[]): Promise<boolean> {
	const claim = await run(`UPDATE doc.user_import SET ${set} WHERE id = ? AND _seq_no = ? AND _primary_term = ?`, [
		...params,
		row.id,
		Number(row._seq_no),
		Number(row._primary_term),
	])
	return claim.rowcount === 1
}

export const refreshImports = () => run("REFRESH TABLE doc.user_import")
export const refreshItems = () => run("REFRESH TABLE doc.user_import_item")

interface ItemRow {
	imdb_id: string | null
	title: string | null
	year: number | null
	title_type: string | null
	raw_rating: string | null
	imdb_score: number | null
	date_rated: string | null
	outcome: ImdbImportOutcome
	reason: string | null
	tmdb_id: number | null
	media_type: ImportMediaType | null
	current_score: number | null
}
const ITEM_COLUMNS = "imdb_id, title, year, title_type, raw_rating, imdb_score, date_rated, outcome, reason, tmdb_id, media_type, current_score"

/** One page of an import's rows in file order, all of them or those with one outcome. */
export async function listItems(
	userId: string,
	id: string,
	outcome: ImdbImportOutcome | undefined,
	offset: number,
	limit: number,
): Promise<{ items: ImdbImportItem[]; total: number }> {
	const row = await getImportRow(userId, id)
	const counts = JSON.parse(row.counts) as ImdbImportCounts
	const rows = await select<ItemRow>(
		`SELECT ${ITEM_COLUMNS} FROM doc.user_import_item
		 WHERE import_id = ? AND user_id = ? ${outcome ? "AND outcome = ?" : ""}
		 ORDER BY row_index LIMIT ? OFFSET ?`,
		[id, userId, ...(outcome ? [outcome] : []), limit, offset],
	)
	return {
		total: outcome ? counts[outcome] : counts.rows,
		items: rows.map((item) => ({
			imdbId: item.imdb_id ?? "",
			title: item.title ?? "",
			year: item.year === null ? null : Number(item.year),
			titleType: item.title_type ?? "",
			imdbScore: item.imdb_score === null ? null : Number(item.imdb_score),
			dateRated: item.date_rated,
			outcome: item.outcome,
			reason: item.reason,
			tmdbId: item.tmdb_id === null ? null : Number(item.tmdb_id),
			mediaType: item.media_type,
			currentScore: item.current_score === null ? null : Number(item.current_score),
		})),
	}
}

/** The rows the import left out, as a CSV the member can keep: what wasn't matched, isn't supported or can't be read. */
export async function skippedCsv(userId: string, id: string): Promise<string> {
	await getImportRow(userId, id)
	const rows = await select<ItemRow>(
		`SELECT ${ITEM_COLUMNS} FROM doc.user_import_item
		 WHERE import_id = ? AND user_id = ? AND outcome IN ('unmatched', 'unsupported', 'invalid')
		 ORDER BY row_index LIMIT ${MAX_ROWS}`,
		[id, userId],
	)
	const lines = [csvLine(["Const", "Title", "Year", "Title Type", "Your Rating", "Date Rated", "Reason"])]
	for (const item of rows)
		lines.push(
			csvLine([
				item.imdb_id ?? "",
				item.title ?? "",
				item.year === null ? null : Number(item.year),
				item.title_type ?? "",
				item.raw_rating ?? "",
				item.date_rated ?? "",
				item.reason ?? "",
			]),
		)
	return `${lines.join("\r\n")}\r\n`
}
