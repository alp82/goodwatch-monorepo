import { execute, query } from "../../utils/crate"
import type { TitleMark, WrittenTitleMark } from "./title-marks.ts"

const tables: Record<TitleMark, string> = {
	score: "user_score",
	want_to_see: "user_wishlist",
	not_interested: "user_not_interested",
}

interface Store {
	query<T extends {}>(
		sql: string,
		params: (string | number | Date)[],
	): Promise<T[]>
	execute(
		sql: string,
		params: (string | number | Date)[],
	): Promise<{ rowcount?: number }>
}

/** Compare the write's own stamp, then use Crate's row version so a write during Undo wins too. */
export async function restoreTitleMark(
	input: {
		user_id: string
		tmdb_id: number
		media_type: "movie" | "show"
		mark: TitleMark
		expected: WrittenTitleMark
		value: number | boolean | null
		addedAt?: string | null
	},
	db: Store = { query, execute },
): Promise<"restored" | "changed" | "already"> {
	const { user_id, tmdb_id, media_type, mark, expected, value } = input
	const table = tables[mark]
	const key = [user_id, tmdb_id, media_type]
	const where = "user_id = ? AND tmdb_id = ? AND media_type = ?"
	const [row] = await db.query<{
		score?: number
		updated_at: string | number | Date
		_seq_no: number
		_primary_term: number
	}>(
		`SELECT ${mark === "score" ? "score, " : ""}updated_at, _seq_no, _primary_term FROM ${table} WHERE ${where}`,
		key,
	)
	const present = (v: unknown) => v !== null && v !== false
	const current = row
		? mark === "score"
			? Number(row.score)
			: true
		: mark === "score"
			? null
			: false
	// A present row must match the batch's stamp even when its value has returned to the original value.
	if (
		current !== expected.value ||
		(row && new Date(row.updated_at).toISOString() !== expected.updatedAt)
	)
		return "changed"
	if (current === value) return "already"
	const now = new Date()
	let result: { rowcount?: number }
	if (!row) {
		// An absent row has no version. DO NOTHING makes a concurrent insert win, without an upsert over it.
		const columns = mark === "score" ? ", score" : ""
		const values = mark === "score" ? ", ?" : ""
		const added = input.addedAt ? new Date(input.addedAt) : now
		result = await db.execute(
			`INSERT INTO ${table} (user_id, tmdb_id, media_type, created_at, updated_at${columns}) VALUES (?, ?, ?, ?, ?${values}) ON CONFLICT (user_id, tmdb_id, media_type) DO NOTHING`,
			[
				...key,
				added.getTime() <= now.getTime() ? added : now,
				now,
				...(mark === "score" ? [value as number] : []),
			],
		)
	} else {
		const version = [Number(row._seq_no), Number(row._primary_term)]
		result = present(value)
			? await db.execute(
					`UPDATE ${table} SET score = ?, updated_at = ? WHERE ${where} AND _seq_no = ? AND _primary_term = ?`,
					[value as number, now, ...key, ...version],
				)
			: await db.execute(
					`DELETE FROM ${table} WHERE ${where} AND _seq_no = ? AND _primary_term = ?`,
					[...key, ...version],
				)
	}
	return result.rowcount ? "restored" : "changed"
}
