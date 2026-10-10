import type {
	ImportItem,
	ImportKind,
	ImportOutcome,
	ImportSource,
	ImportSummary,
} from "~/domain/imports"
import { execute, query } from "~/utils/crate"
import { csvLine } from "../import-csv.ts"

export type Param = string | number | Date | null
type Result = { rowcount?: number }
interface ImportDb {
	run(sql: string, params: Param[]): Promise<Result>
	select<T extends {}>(sql: string, params: Param[]): Promise<T[]>
}
const liveDb: ImportDb = {
	run: (sql, params) => execute(sql, params as (string | number | Date)[]),
	select: (sql, params) => query(sql, params as (string | number | Date)[]),
}
let db = liveDb
/** Test-only database boundary. Passing no value restores the live Crate adapter. */
export const setImportDbForTest = (replacement?: ImportDb) => {
	db = replacement ?? liveDb
}
export const run = (sql: string, params: Param[] = []) => db.run(sql, params)
export const select = <T extends {}>(sql: string, params: Param[] = []) =>
	db.select<T>(sql, params)
export const marks = (n: number) => Array(n).fill("?").join(",")
export const chunks = <T>(xs: T[], n: number) =>
	Array.from({ length: Math.ceil(xs.length / n) }, (_, i) =>
		xs.slice(i * n, (i + 1) * n),
	)

export const HEARTBEAT_MS = 10_000
export const STALL_MS = 60_000
export const activeRuns = new Set<string>()

export class NativeImportError extends Error {
	status: number
	constructor(status: number, message: string) {
		super(message)
		this.status = status
		this.name = "NativeImportError"
	}
}

export interface ImportRow {
	id: string
	user_id: string
	source: ImportSource
	status: ImportSummary["status"]
	file_name: string | null
	counts: string
	processed: number
	total: number
	added: number
	updated: number
	kept: number
	failed: number
	error: string | null
	created_at: Date | string | number
	updated_at: Date | string | number
	confirmed_at: Date | string | number | null
	finished_at: Date | string | number | null
	options: string | null
	warnings: string | null
	kinds: string | null
	read_at: Date | string | number
	_seq_no: number
	_primary_term: number
}

const COLUMNS =
	"id, user_id, source, status, file_name, counts, processed, total, added, updated, kept, failed, error, created_at, updated_at, confirmed_at, finished_at, options, warnings, kinds, CURRENT_TIMESTAMP AS read_at, _seq_no, _primary_term"
const native = (source: string): source is ImportSource =>
	source === "letterboxd" || source === "trakt"
const parse = <T>(value: string | null, fallback: T): T => {
	try {
		return value ? (JSON.parse(value) as T) : fallback
	} catch {
		return fallback
	}
}
const ms = (value: Date | string | number) => new Date(value).getTime()
export const isStalled = (row: ImportRow) =>
	row.status === "running" &&
	!activeRuns.has(row.id) &&
	ms(row.read_at) - ms(row.updated_at) > STALL_MS

export function summarize(row: ImportRow): ImportSummary {
	const emptyKinds = { rating: 0, watch: 0, want: 0, favorite: 0, review: 0 }
	const storedOptions = parse<
		| ({ direction?: "apply" | "undo" } & NonNullable<ImportSummary["options"]>)
		| null
	>(row.options, null)
	return {
		id: row.id,
		source: row.source,
		fileName: row.file_name ?? "",
		status: row.status,
		createdAt: new Date(row.created_at).toISOString(),
		finishedAt:
			row.finished_at === null ? null : new Date(row.finished_at).toISOString(),
		counts: parse(row.counts, {
			rows: 0,
			new: 0,
			unchanged: 0,
			conflict: 0,
			unmatched: 0,
			unsupported: 0,
			invalid: 0,
		}),
		kinds: parse(row.kinds, emptyKinds),
		warnings: parse(row.warnings, []),
		options: storedOptions
			? {
					kinds: storedOptions.kinds,
					conflictChoice: storedOptions.conflictChoice,
					watchDates: storedOptions.watchDates,
				}
			: null,
		processed: Number(row.processed),
		total: Number(row.total),
		applied: {
			added: Number(row.added),
			updated: Number(row.updated),
			kept: Number(row.kept),
			failed: Number(row.failed),
		},
		stalled: isStalled(row),
		canUndo:
			row.status === "done" && Number(row.added) + Number(row.updated) > 0,
		error:
			row.status === "failed"
				? (row.error ??
					"The import stopped before it finished. Try again to finish it.")
				: null,
		operation: storedOptions?.direction,
	}
}

export async function getImportRow(
	userId: string,
	id: string,
): Promise<ImportRow> {
	const row = (
		await select<ImportRow>(
			`SELECT ${COLUMNS} FROM doc.user_import WHERE id = ?`,
			[id],
		)
	)[0]
	if (!row || row.user_id !== userId || !native(row.source))
		throw new NativeImportError(
			404,
			"We couldn't find that import. Upload the file again.",
		)
	return row
}
export const listImportRows = (userId: string) =>
	select<ImportRow>(
		`SELECT ${COLUMNS} FROM doc.user_import WHERE user_id = ? AND source IN ('letterboxd','trakt') AND status <> 'preview' ORDER BY created_at DESC LIMIT 100`,
		[userId],
	)
export async function claim(row: ImportRow, set: string, params: Param[]) {
	const result = await run(
		`UPDATE doc.user_import SET ${set} WHERE id = ? AND _seq_no = ? AND _primary_term = ?`,
		[...params, row.id, Number(row._seq_no), Number(row._primary_term)],
	)
	return result.rowcount === 1
}
export const refreshImports = () => run("REFRESH TABLE doc.user_import")
export const refreshItems = () => run("REFRESH TABLE doc.user_import_item")

interface ItemRow {
	row_index: number
	kind: ImportKind | "unsupported" | "state"
	source_key: string | null
	payload: string | null
	outcome: ImportOutcome
	reason: string | null
	tmdb_id: number | null
	media_type: "movie" | "show" | null
	current_score: number | null
	apply_state: ImportItem["applyState"]
}
export async function itemRows(
	userId: string,
	id: string,
	pendingOnly = false,
): Promise<(ImportItem & { payload: Record<string, unknown> })[]> {
	await getImportRow(userId, id)
	const rows = await select<ItemRow>(
		`SELECT row_index, kind, source_key, payload, outcome, reason, tmdb_id, media_type, current_score, apply_state FROM doc.user_import_item WHERE import_id = ? AND user_id = ? AND kind <> 'state' ${pendingOnly ? "AND (apply_state IS NULL OR apply_state = 'failed')" : ""} ORDER BY row_index LIMIT 100001`,
		[id, userId],
	)
	return rows.map((row) => ({
		...(parse(row.payload, {}) as ImportItem),
		index: Number(row.row_index),
		key: row.source_key ?? `row:${row.row_index}`,
		kind: row.kind === "state" ? "unsupported" : row.kind,
		outcome: row.outcome,
		reason: row.reason,
		tmdbId: row.tmdb_id === null ? null : Number(row.tmdb_id),
		mediaType: row.media_type ?? "movie",
		currentScore: row.current_score === null ? null : Number(row.current_score),
		applyState: row.apply_state,
		payload: parse(row.payload, {}),
	}))
}
export async function listItems(
	userId: string,
	id: string,
	outcome: ImportOutcome | undefined,
	offset: number,
	limit: number,
) {
	const summary = summarize(await getImportRow(userId, id))
	const rows = await select<ItemRow>(
		`SELECT row_index, kind, source_key, payload, outcome, reason, tmdb_id, media_type, current_score, apply_state FROM doc.user_import_item WHERE import_id = ? AND user_id = ? AND kind <> 'state' ${outcome ? "AND outcome = ?" : ""} ORDER BY row_index LIMIT ? OFFSET ?`,
		[id, userId, ...(outcome ? [outcome] : []), limit, offset],
	)
	const items = rows.map((row): ImportItem => {
		const payload = parse<
			ImportItem & { _preview?: unknown; journal?: unknown }
		>(row.payload, {} as ImportItem)
		const {
			_preview: _privatePreview,
			journal: _privateJournal,
			...observation
		} = payload
		return {
			...observation,
			index: Number(row.row_index),
			key: row.source_key ?? `row:${row.row_index}`,
			kind: row.kind === "state" ? "unsupported" : row.kind,
			outcome: row.outcome,
			reason: row.reason,
			tmdbId: row.tmdb_id === null ? null : Number(row.tmdb_id),
			mediaType: row.media_type ?? "movie",
			currentScore:
				row.current_score === null ? null : Number(row.current_score),
			applyState: row.apply_state,
		}
	})
	return {
		items,
		total: outcome ? summary.counts[outcome] : summary.counts.rows,
	}
}
export async function skippedCsv(userId: string, id: string) {
	const items = (await itemRows(userId, id)).filter((x) =>
		["unmatched", "unsupported", "invalid"].includes(x.outcome),
	)
	return `${[
		csvLine(["Kind", "Title", "Year", "TMDB ID", "IMDb ID", "Reason"]),
		...items.map((x) =>
			csvLine([x.kind, x.title, x.year, x.tmdbId, x.imdbId, x.reason]),
		),
	].join("\r\n")}\r\n`
}
