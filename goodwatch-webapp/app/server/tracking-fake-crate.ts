// For the tests of tracking only: an in-memory Crate that knows the statements the tracking writer and its reads
// issue, and nothing more. Pass it to `setCrateClientForTest`.
//
// It keeps what matters about Crate for this writer:
// - A statement that names a row by its whole primary key works on the row as it is now. Every other statement sees
//   a table as it was at its last `REFRESH TABLE`.
// - Every row has `_seq_no` and `_primary_term`, and `_seq_no` changes with every write to the row.
// - `INSERT ... ON CONFLICT DO NOTHING` skips a stored key, and `rowcount` is the number of rows written.
// - The columns, NOT NULL and CHECK constraints of the two tracking tables, as crate_schemas.py defines them.
// It ignores ORDER BY and LIMIT. A statement it does not know fails the test.
import { groupedQuery } from "../domain/tracking/test-support.ts"
import type { LogRow } from "../domain/tracking/storage.ts"

type Row = Record<string, unknown>

interface Table {
	key: string[]
	columns: string[]
	notNull?: string[]
	checks?: Record<string, string[]>
}

const USER_TITLE = ["user_id", "tmdb_id", "media_type"]

const TABLES: Record<string, Table> = {
	user_watch_log: {
		key: ["user_id", "watch_id"],
		columns: [
			"user_id",
			"watch_id",
			"media_type",
			"tmdb_id",
			"episode_tmdb_id",
			"season_number",
			"episode_number",
			"watched_at",
			"watched_at_precision",
			"origin",
			"group_id",
			"import_id",
			"pass",
			"created_at",
			"updated_at",
		],
		notNull: [
			"media_type",
			"tmdb_id",
			"watched_at_precision",
			"origin",
			"pass",
			"created_at",
			"updated_at",
		],
		checks: {
			media_type: ["movie", "show"],
			watched_at_precision: ["moment", "day", "unknown"],
			origin: ["single", "upto", "season", "seen", "score", "import"],
		},
	},
	user_watch_state: {
		key: USER_TITLE,
		columns: [
			"user_id",
			"tmdb_id",
			"media_type",
			"state",
			"state_changed_at",
			"pass",
			"seen_press_group",
			"seen_press_from",
			"rate_prompt_dismissed_at",
			"seen_question",
			"created_at",
			"updated_at",
		],
		notNull: ["state", "state_changed_at", "pass", "created_at", "updated_at"],
		checks: {
			media_type: ["movie", "show"],
			state: ["not_started", "watching", "on_hold", "dropped", "seen"],
		},
	},
	episode: {
		key: ["show_id", "tmdb_id"],
		columns: [
			"show_id",
			"tmdb_id",
			"season_number",
			"episode_number",
			"name",
			"air_date",
			"runtime",
			"still_path",
			"episode_type",
			"removed_at",
		],
	},
	user_score: {
		key: USER_TITLE,
		columns: [...USER_TITLE, "score", "review", "created_at", "updated_at"],
	},
	user_wishlist: {
		key: USER_TITLE,
		columns: [...USER_TITLE, "created_at", "updated_at"],
	},
	user_not_interested: {
		key: USER_TITLE,
		columns: [...USER_TITLE, "created_at", "updated_at"],
	},
	// Refreshed by resetUserDataCache; nothing here reads them.
	user_watch_history: { key: USER_TITLE, columns: USER_TITLE },
	user_favorite: { key: USER_TITLE, columns: USER_TITLE },
	user_skipped: { key: USER_TITLE, columns: USER_TITLE },
}

const SYSTEM = ["_seq_no", "_primary_term"]

interface Condition {
	column: string
	test: (value: unknown) => boolean
	/** The condition pins the column to given values, which is what makes a statement a read by key. */
	pins: boolean
}

export interface Statement {
	sql: string
	params: unknown[]
}

export class FakeTrackingCrate {
	/** The rows as they are now. Tests seed and read them directly. */
	rows = new Map<string, Row[]>()
	/** The rows as they were at the table's last refresh. */
	private refreshed = new Map<string, Row[]>()
	statements: Statement[] = []
	/**
	 * Called before every statement, with how many statements arrived before it. Throwing here is a crash or a
	 * timeout at that statement.
	 */
	before:
		| ((statement: Statement, index: number) => void | Promise<void>)
		| undefined
	/** How many statements have arrived, also those that `before` stopped. */
	arrived = 0
	private writes = 0

	table(name: string): Row[] {
		let rows = this.rows.get(name)
		if (!rows) {
			rows = []
			this.rows.set(name, rows)
		}
		return rows
	}

	/** Puts rows into a table as if they had been written and refreshed. */
	seed(name: string, rows: Row[]) {
		const table = this.table(name)
		for (const row of rows)
			table.push({ _seq_no: ++this.writes, _primary_term: 1, ...stored(row) })
		this.refresh(name)
	}

	refresh(name: string) {
		this.refreshed.set(name, structuredClone(this.table(name)))
	}

	/** The log rows of a member, in the order they were written, without the system columns. */
	log(userId: string): (LogRow & Row)[] {
		return this.table("user_watch_log")
			.filter((r) => r.user_id === userId)
			.map(({ _seq_no, _primary_term, ...row }) => row as LogRow & Row)
	}

	/** The state row of a member's title, without the system columns. */
	state(userId: string, mediaType: string, tmdbId: number): Row | null {
		const found = this.table("user_watch_state").find(
			(r) =>
				r.user_id === userId &&
				r.media_type === mediaType &&
				r.tmdb_id === tmdbId,
		)
		if (!found) return null
		const { _seq_no, _primary_term, ...row } = found
		return row
	}

	/** The statements sent so far that start with one of these words, as "INSERT user_watch_log" and the like. */
	sent(...kinds: string[]): string[] {
		return this.statements
			.map((s) => summary(s.sql))
			.filter((s) => kinds.some((kind) => s.startsWith(kind)))
	}

	async execute(raw: string, params: unknown[] = []) {
		const sql = raw.trim().replace(/\s+/g, " ")
		const statement = { sql, params }
		const index = this.arrived++
		if (this.before) await this.before(statement, index)
		this.statements.push(statement)
		const values = [...params]
		const take = () => {
			if (!values.length) throw new Error(`Too few parameters: ${sql}`)
			return stored({ v: values.shift() }).v
		}
		const done = (json: Row[], rowcount = json.length) => {
			if (values.length) throw new Error(`Too many parameters: ${sql}`)
			return { json, rowcount }
		}

		if (sql.startsWith("REFRESH TABLE ")) {
			for (const name of sql.slice("REFRESH TABLE ".length).split(", ")) {
				known(name, sql)
				this.refresh(name)
			}
			return done([], 1)
		}

		const insert = sql.match(
			/^INSERT INTO (\w+) \(([^)]+)\) VALUES (.+) ON CONFLICT \(([^)]+)\) DO NOTHING$/,
		)
		if (insert) {
			const [, name, columnList, tuples, conflictList] = insert
			const table = known(name, sql)
			const columns = names(columnList)
			for (const column of columns) column_(table, column, sql, false)
			if (names(conflictList).join() !== table.key.join())
				throw new Error(`ON CONFLICT is not the key of ${name}: ${sql}`)
			const count = tuples.split("), (").length
			let written = 0
			for (let i = 0; i < count; i++) {
				const row: Row = {}
				for (const column of table.columns) row[column] = null
				for (const column of columns) row[column] = take()
				constrain(name, table, row)
				if (
					this.table(name).some((r) => table.key.every((k) => r[k] === row[k]))
				)
					continue
				this.table(name).push({
					...row,
					_seq_no: ++this.writes,
					_primary_term: 1,
				})
				written += 1
			}
			return done([], written)
		}

		const update = sql.match(/^UPDATE (\w+) SET (.+?) WHERE (.+)$/)
		if (update) {
			const [, name, assignments, where] = update
			const table = known(name, sql)
			const changes: Row = {}
			for (const assignment of assignments.split(", ")) {
				const [column, value] = assignment.split(" = ")
				column_(table, column, sql, false)
				changes[column] = value === "?" ? take() : literal(value, sql)
			}
			const matched = this.match(name, table, where, take, sql)
			for (const row of matched) {
				Object.assign(row, changes, { _seq_no: ++this.writes })
				constrain(name, table, row)
			}
			return done([], matched.length)
		}

		const remove = sql.match(/^DELETE FROM (\w+) WHERE (.+)$/)
		if (remove) {
			const [, name, where] = remove
			const table = known(name, sql)
			const matched = new Set(this.match(name, table, where, take, sql))
			this.rows.set(
				name,
				this.table(name).filter((r) => !matched.has(r)),
			)
			return done([], matched.size)
		}

		const select = sql.match(
			/^SELECT (.+?) FROM (\w+) WHERE (.+?)( GROUP BY .+?)?( ORDER BY .+?)?( LIMIT \d+)?$/,
		)
		if (select) {
			const [, columnList, name, where, groupBy] = select
			const table = known(name, sql)
			const matched = this.match(name, table, where, take, sql)
			if (groupBy) {
				if (
					name !== "user_watch_log" ||
					groupBy !== " GROUP BY tmdb_id, media_type, pass"
				)
					throw new Error(`Unknown grouping: ${sql}`)
				return done(
					groupedQuery(matched as unknown as LogRow[]) as unknown as Row[],
				)
			}
			const columns = columnList.split(", ")
			for (const column of columns) column_(table, column, sql, true)
			return done(
				structuredClone(
					matched.map((row) =>
						Object.fromEntries(columns.map((column) => [column, row[column]])),
					),
				),
			)
		}
		throw new Error(`The fake Crate does not know this statement: ${sql}`)
	}

	/** The rows a WHERE clause names: as they are now for a read by key, as of the last refresh otherwise. */
	private match(
		name: string,
		table: Table,
		where: string,
		take: () => unknown,
		sql: string,
	): Row[] {
		const conditions = where
			.split(" AND ")
			.map((text) => condition(table, text, take, sql))
		const byKey = table.key.every((column) =>
			conditions.some((c) => c.column === column && c.pins),
		)
		const fits = (row: Row) => conditions.every((c) => c.test(row[c.column]))
		const live = this.table(name)
		if (byKey) return live.filter(fits)
		const visible = new Set(
			(this.refreshed.get(name) ?? []).map((row) => keyOf(table, row)),
		)
		const seen = (this.refreshed.get(name) ?? []).filter(fits)
		// A write by a condition that is not the key works on the rows the last refresh showed and that still exist.
		if (/^(UPDATE|DELETE)/.test(sql))
			return live.filter((row) => visible.has(keyOf(table, row)) && fits(row))
		return seen
	}
}

const keyOf = (table: Table, row: Row) =>
	JSON.stringify(table.key.map((column) => row[column]))

/** Values as Crate stores them: a timestamp is milliseconds. */
function stored<T extends Row>(row: T): T {
	const out: Row = {}
	for (const [column, value] of Object.entries(row))
		out[column] =
			value instanceof Date
				? value.getTime()
				: value === undefined
					? null
					: value
	return out as T
}

const names = (list: string) =>
	list.split(", ").map((name) => name.replace(/"/g, ""))

function known(name: string, sql: string): Table {
	const table = TABLES[name]
	if (!table)
		throw new Error(`RelationUnknown[Relation '${name}' unknown]: ${sql}`)
	return table
}

function column_(table: Table, column: string, sql: string, system: boolean) {
	if (table.columns.includes(column)) return
	if (system && SYSTEM.includes(column)) return
	throw new Error(`ColumnUnknownException[Column ${column} unknown]: ${sql}`)
}

function literal(text: string, sql: string): unknown {
	const quoted = text.match(/^'(.*)'$/)
	if (quoted) return quoted[1]
	if (/^-?\d+$/.test(text)) return Number(text)
	throw new Error(`Unknown value ${text}: ${sql}`)
}

function condition(
	table: Table,
	text: string,
	take: () => unknown,
	sql: string,
): Condition {
	const isNull = text.match(/^(\w+) IS (NOT )?NULL$/)
	if (isNull) {
		column_(table, isNull[1], sql, false)
		const not = !!isNull[2]
		return {
			column: isNull[1],
			pins: false,
			test: (v) => (v === null || v === undefined) !== not,
		}
	}
	const within = text.match(/^(\w+) IN \(([?, ]+)\)$/)
	if (within) {
		column_(table, within[1], sql, false)
		const values = within[2].split(", ").map(() => take())
		return { column: within[1], pins: true, test: (v) => values.includes(v) }
	}
	const compare = text.match(/^(\w+) (=|<>) (\?|'[^']*'|-?\d+)$/)
	if (compare) {
		const [, column, operator, right] = compare
		column_(table, column, sql, true)
		const value = right === "?" ? take() : literal(right, sql)
		return operator === "="
			? { column, pins: true, test: (v) => v === value }
			: {
					column,
					pins: false,
					test: (v) => v !== null && v !== undefined && v !== value,
				}
	}
	throw new Error(`Unknown condition "${text}": ${sql}`)
}

function constrain(name: string, table: Table, row: Row) {
	for (const column of [...table.key, ...(table.notNull ?? [])])
		if (row[column] === null || row[column] === undefined)
			throw new Error(
				`SQLParseException["${column}" must not be null] in ${name}`,
			)
	for (const [column, allowed] of Object.entries(table.checks ?? {}))
		if (row[column] !== null && !allowed.includes(row[column] as string))
			throw new Error(
				`Failed CONSTRAINT CHECK on ${name}.${column}: ${String(row[column])}`,
			)
}

const summary = (sql: string) => {
	const [verb] = sql.split(" ")
	if (verb === "REFRESH") return sql
	const table = sql.match(/(?:FROM|INTO|UPDATE) (\w+)/)?.[1] ?? "?"
	return `${verb} ${table}`
}
