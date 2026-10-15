import type { ClientRequest, IncomingMessage } from "node:http"
import { setTimeout as delay } from "node:timers/promises"
import { BackendTimeoutError, withBackendTimeout } from "./backend-timeout.ts"
import crate from "node-crate"
import pc from "picocolors"

// node-crate has no request timeout: a request whose response never arrives awaits forever. Every call is capped at
// CRATE_TIMEOUT_MS (default 10 s; webapp queries finish in well under 2 s). Timeout closes the HTTP request.
// On production CrateDB 5.10.9 (October 7, 2026), a statement on sys tables still ran to its end after closing
// the request. A write may still land after timeout, so `upsert` reads its row back to find out.
const DEFAULT_TIMEOUT_MS = 10_000

const getTimeoutMs = () => {
	const configured = Number.parseInt(process.env.CRATE_TIMEOUT_MS || "", 10)
	return configured > 0 ? configured : DEFAULT_TIMEOUT_MS
}

export class CrateTimeoutError extends BackendTimeoutError {
	constructor(timeoutMs: number) {
		super("CrateDB", timeoutMs)
		this.name = "CrateTimeoutError"
	}
}

// node-crate rejects a statement that Crate refused with the response's `error` object ({ message, code }), which is
// not an Error. Callers test `instanceof Error`, and Remix sends a thrown value that isn't an Error to the browser as
// it is. Every failure that leaves the client is therefore an Error: this one for a refused statement, with Crate's
// message (it starts with the exception name, such as ColumnUnknownException) and Crate's error code (4043 for it).
export class CrateError extends Error {
	code?: number

	constructor(message: string, code?: number) {
		super(message)
		this.name = "CrateError"
		this.code = code
	}
}

export const toCrateError = (error: unknown): Error => {
	if (error instanceof Error) return error
	const refused = (error ?? {}) as { message?: unknown; code?: unknown }
	return new CrateError(
		typeof refused.message === "string" ? refused.message : capLog(error),
		typeof refused.code === "number" ? refused.code : undefined,
	)
}

// Crate's type ids of the two timestamp types (node-crate/lib/types.js).
const TIMESTAMP_TYPES: unknown[] = [11, 15]

// node-crate builds `json` with `new Date(value)` for every timestamp column (node-crate/lib/index.js), and
// `new Date(null)` is 1 January 1970: a NULL timestamp arrived as that date, and the tracking writer stored it back
// as the day a rate prompt was dismissed. `json` is therefore built here, from the same answer: a NULL timestamp
// is null, a stored one a Date as before.
const withNullTimestamps = <R extends { cols: string[]; rows: unknown[][]; col_types?: unknown[]; json: unknown[] }>(
	result: R,
): R => {
	let json: Record<string, unknown>[] | undefined
	return Object.defineProperty(result, "json", {
		configurable: true,
		enumerable: true,
		get: () =>
			(json ??= result.rows.map((row) =>
				Object.fromEntries(
					result.cols.map((column, i) => [
						column,
						row[i] !== null && TIMESTAMP_TYPES.includes(result.col_types?.[i])
							? new Date(row[i] as number)
							: row[i],
					]),
				),
			)),
	})
}

let captureRequest: ((request: ClientRequest) => void) | undefined

type NodeCrate = typeof crate & {
	getNewInstance(): NodeCrate
	connectionPool: {
		getSqlRequest(callback: (response: IncomingMessage) => void): ClientRequest
		httpOptions: { httpOpt: { auth: string | null } }[]
	}
}

const HOST_COOLDOWN_MS = 5_000
const UNAVAILABLE_STATUSES = [502, 503, 504]

const isConnectionError = (error: unknown): boolean =>
	error instanceof Error && ["ECONNREFUSED", "ECONNRESET", "EPIPE", "ETIMEDOUT", "EHOSTUNREACH", "ENETUNREACH", "ENOTFOUND", "EAI_AGAIN"]
		.includes((error as NodeJS.ErrnoException).code ?? "")

const isAvailabilityError = (error: unknown): boolean =>
	isConnectionError(error) || error instanceof CrateTimeoutError ||
	(error instanceof Error && UNAVAILABLE_STATUSES.includes((error as Error & { statusCode?: number }).statusCode ?? 0))

// A healthy coordinator can briefly retain shard routes to a node that just
// disappeared. These SQL failures do not make that coordinator unhealthy.
const isNodeLossError = (error: unknown): boolean => error instanceof CrateError && (
	/^(NodeNotConnectedException|NoSuchNodeException)\[/.test(error.message) ||
	/^JobKilledException\[Job killed\. Participating node .+ disconnected\]$/.test(error.message)
)

const isRecoverableError = (error: unknown): boolean => isAvailabilityError(error) || isNodeLossError(error)

// Conservative recognition only: never infer replay safety for a write from its
// ON CONFLICT text. Helpers below own the keys and values that make replay safe.
const isRead = (sql: string): boolean => {
	const tokens = sql.replace(/--[^\r\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"/g, " ").trim()
	return /^(SELECT|WITH)\b/i.test(tokens) &&
		!/\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|COPY|REFRESH|SET|RESET|GRANT|REVOKE|KILL)\b/i.test(tokens) &&
		!/;\s*\S/.test(tokens)
}

// Queries, parameters and filters can be megabytes, and one production log line reached 108 MB. Nothing printed here exceeds this.
// The clock time on every log line. One formatter for the process: toLocaleTimeString builds a new one per call.
const LOG_TIME = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false })

const MAX_LOG_CHARS = 2000

const capLog = (value: unknown, indent?: number): string => {
	let text: string
	try {
		text = typeof value === 'string' ? value : (JSON.stringify(value, null, indent) ?? String(value))
	} catch {
		text = String(value)
	}
	return text.length > MAX_LOG_CHARS
		? `${text.slice(0, MAX_LOG_CHARS)}... (${text.length - MAX_LOG_CHARS} more characters cut)`
		: text
}

export interface CrateReadOptions {
	timeoutMs?: number
	signal?: AbortSignal
}

class CrateClient {
	private readonly hosts: { driver: NodeCrate; unavailableUntil: number }[]
	private nextHost = 0

	// `auth` is "user:password" for a Basic header, or null for none. node-crate would take it from a URL, but sends it
	// percent-encoded there, and a password with "#", "/" or "?" is no valid URL (#562).
	constructor(hosts: string[], auth: string | null = null) {
		this.hosts = hosts.map((host) => {
			const driver = (crate as NodeCrate).getNewInstance()
			driver.connect(host)
			const pool = driver.connectionPool
			for (const options of pool.httpOptions) options.httpOpt.auth = auth
			const getSqlRequest = pool.getSqlRequest
			pool.getSqlRequest = function(this: typeof pool, callback: (response: IncomingMessage) => void) {
				const request = getSqlRequest.call(this, callback)
				captureRequest?.(request)
				return request
			}
			return { driver, unavailableUntil: 0 }
		})
	}

	private takeHost(tried: Set<number>): number | undefined {
		const remaining = this.hosts.map((_, i) => (this.nextHost + i) % this.hosts.length)
			.filter((i) => !tried.has(i))
		// When all hosts are cooling down, probe the earliest due once. Each round
		// visits a host at most once, and one-node installations can recover.
		const index = remaining.find((i) => this.hosts[i].unavailableUntil <= Date.now())
			?? remaining.sort((a, b) => this.hosts[a].unavailableUntil - this.hosts[b].unavailableUntil)[0]
		if (index !== undefined) this.nextHost = (index + 1) % this.hosts.length
		return index
	}

	private executeOnHost(
		driver: NodeCrate,
		query: string,
		params: (string | number | Date)[] | undefined,
		timeoutMs: number,
		callerSignal?: AbortSignal,
	) {
		return withBackendTimeout("CrateDB", timeoutMs, async (signal) => {
			let request: ClientRequest | undefined
			let responseError: Error | undefined
			let statusCode: number | undefined
			const previousCapture = captureRequest
			let pending: ReturnType<typeof crate.execute>
			// node-crate creates the request synchronously, before another statement can run.
			captureRequest = (created) => { request = created }
			try {
				pending = driver.execute(query, params)
			} finally {
				captureRequest = previousCapture
			}
			// node-crate wraps response stream errors in a new Error and loses their
			// connection code. Retain the original so interrupted bodies can fail over.
			request?.once("response", (response) => {
				statusCode = response.statusCode
				response.once("error", (error) => { responseError = error })
			})
			const destroy = () => { request?.destroy(signal.reason) }
			signal.addEventListener("abort", destroy, { once: true })
			try {
				const result = await pending
				if (UNAVAILABLE_STATUSES.includes(statusCode ?? 0)) throw new CrateError(`CrateDB HTTP ${statusCode}`)
				return withNullTimestamps(result)
			} catch (error) {
				throw responseError ?? Object.assign(toCrateError(error), { statusCode })
			} finally {
				signal.removeEventListener("abort", destroy)
			}
		}, { error: () => new CrateTimeoutError(timeoutMs), signal: callerSignal })
	}

	async execute(
		query: string,
		params?: (string | number | Date)[],
		options: CrateReadOptions = {},
	) {
		const startTime = performance.now()
		try {
			const timeoutMs = options.timeoutMs ?? getTimeoutMs()
			const deadline = performance.now() + timeoutMs
			const read = isRead(query)
			const tried = new Set<number>()
			let nodeLoss = false
			let round = 0
			let result: Awaited<ReturnType<typeof crate.execute>> | undefined
			while (result === undefined) {
				const index = this.takeHost(tried)
				if (index === undefined) throw new Error("No CrateDB host available")
				tried.add(index)
				const host = this.hosts[index]
				// Reserve time for the other coordinators rather than spending the entire
				// caller budget waiting for the first dead socket.
				const remaining = deadline - performance.now()
				if (remaining <= 0) throw new CrateTimeoutError(timeoutMs)
				const attemptTimeoutMs = read && (this.hosts.length > 1 || round > 0)
					? Math.max(1, Math.ceil(remaining / (this.hosts.length - tried.size + 1)))
					: timeoutMs
				try {
					result = await this.executeOnHost(host.driver, query, params, attemptTimeoutMs, options.signal)
				} catch (error) {
					if (options.signal?.aborted || !isRecoverableError(error)) throw error
					if (isAvailabilityError(error)) host.unavailableUntil = Date.now() + HOST_COOLDOWN_MS
					if (!read) throw error
					nodeLoss ||= isNodeLossError(error)
					if (tried.size === this.hosts.length) {
						if (!nodeLoss || ++round >= 10) throw error
						const waitMs = Math.min(100 * round, 500)
						if (performance.now() + waitMs >= deadline) throw new CrateTimeoutError(timeoutMs)
						try { await delay(waitMs, undefined, { signal: options.signal }) }
						catch (error) { options.signal?.throwIfAborted(); throw error }
						tried.clear()
						nodeLoss = false
					}
				}
			}
			const duration = performance.now() - startTime
			const querySummary = this.getQuerySummary(query)
			const formattedLog = this.formatLog(querySummary, duration)
			console.log(formattedLog)
			
			if (duration >= 300) {
				this.logSlowQueryDetails(query, params, duration, result)
			}
			
			return result
		} catch (error) {
			const duration = performance.now() - startTime
			const querySummary = this.getQuerySummary(query)
			const formattedLog = this.formatLog(querySummary, duration, true)
			console.error('====================')
			console.error(formattedLog)
			console.error('Query:', capLog(query))
			console.error('Params:', capLog(params))
			console.error('Error:', error)
			console.error('Stack trace:')
			console.trace()
			throw toCrateError(error)
		}
	}

	private formatLog(querySummary: string, duration: number, failed = false): string {
		const timestamp = LOG_TIME.format(new Date())
		const coloredDuration = this.colorDuration(duration, failed)
		const label = pc.dim(`[${pc.cyan('CrateDB')}]`)
		const status = failed ? pc.red('FAILED') : ''
		return `${pc.dim(timestamp)} ${label} ${querySummary} ${status} ${coloredDuration}`
	}

	private logSlowQueryDetails(query: string, params: (string | number | Date)[] | undefined, duration: number, result: any): void {
		console.warn(pc.yellow('  ⚠ Slow query details:'))
		console.warn(pc.dim('  Query:'), query.trim().replace(/\s+/g, ' ').substring(0, 200) + (query.length > 200 ? '...' : ''))
		
		if (params && params.length > 0) {
			console.warn(pc.dim('  Params:'), capLog(params.length > 5 ? `${params.slice(0, 5).join(', ')}... (${params.length} total)` : params.join(', ')))
		}
		
		if (result.rowcount !== undefined) {
			console.warn(pc.dim('  Rows affected:'), result.rowcount)
		}
		
		if (result.duration !== undefined) {
			console.warn(pc.dim('  Server duration:'), `${result.duration}ms`)
		}
	}

	private colorDuration(duration: number, failed = false): string {
		const formatted = `${duration.toFixed(2)}ms`
		
		if (failed) {
			return pc.red(formatted)
		}
		
		if (duration < 50) {
			return pc.green(pc.bold(formatted))
		}
		if (duration < 100) {
			return pc.green(formatted)
		}
		if (duration < 300) {
			return pc.yellow(formatted)
		}
		if (duration < 1000) {
			return pc.red(formatted)
		}
		return pc.red(pc.bold(formatted))
	}

	private getQuerySummary(query: string): string {
		const normalized = query.trim().replace(/\s+/g, ' ')
		const firstLine = normalized.split('\n')[0]
		const operation = firstLine.match(/^\s*(SELECT|INSERT|UPDATE|DELETE|UPSERT|CREATE|DROP|ALTER|WITH)/i)?.[1]?.toUpperCase() || 'UNKNOWN'
		
		if (operation === 'SELECT') {
			const fromMatch = normalized.match(/FROM\s+([^\s,;(]+)/i)
			const table = fromMatch?.[1] || 'unknown'
			return `SELECT from ${table}`
		}
		
		if (operation === 'INSERT') {
			const intoMatch = normalized.match(/INTO\s+([^\s(]+)/i)
			const table = intoMatch?.[1] || 'unknown'
			return `INSERT into ${table}`
		}
		
		if (operation === 'UPDATE') {
			const tableMatch = normalized.match(/UPDATE\s+([^\s]+)/i)
			const table = tableMatch?.[1] || 'unknown'
			return `UPDATE ${table}`
		}
		
		if (operation === 'DELETE') {
			const fromMatch = normalized.match(/FROM\s+([^\s,;(]+)/i)
			const table = fromMatch?.[1] || 'unknown'
			return `DELETE from ${table}`
		}
		
		return operation
	}

	async select<T extends {}>(
		query: string,
		params?: (string | number | Date)[],
		options: CrateReadOptions = {},
	) {
		const { json, duration, rowcount, rows, cols } = await this.execute(
			query,
			params,
			options,
		)
		const result = json as T[]
		return {
			result,
			duration,
			rowcount,
			rows,
			cols,
		}
	}
}

let client: CrateClient | null = null

export function setCrateClientForTest(
	fake: {
		execute(
			sql: string,
			params?: unknown[],
		): Promise<{ json: unknown[]; rowcount?: number }>
	} | null,
): void {
	// Reuse select's mapping without constructing a client or connecting to Crate.
	client = fake
		? Object.assign(Object.create(CrateClient.prototype), {
				execute: fake.execute.bind(fake),
			})
		: null
}

export const getCrateClient = () => {
	if (!client) {
		const hosts = (process.env.CRATE_HOSTS || "").split(",")
		const port = Number.parseInt(process.env.CRATE_PORT || "4200")
		const user = process.env.CRATE_USER || ""
		const pass = process.env.CRATE_PASS || ""
		const urls = hosts.map((host) => `http://${host}:${port}`)
		// Without CRATE_USER no credentials are sent, as before.
		client = new CrateClient(urls, user ? `${user}:${pass}` : null)
	}
	return client
}

export const query = async <T extends {}>(
	query: string,
	params?: (string | number | Date)[],
	options?: CrateReadOptions,
): Promise<T[]> => {
	const client = getCrateClient()
	const response = await client.select<T>(query, params, options)
	return response.result
}

export const execute = async (
	query: string,
	params?: (string | number | Date)[],
) => {
	const client = getCrateClient()
	return await client.execute(query, params)
}

interface UpsertOptions {
	table: string
	data: Record<string, any>[]
	conflictColumns: string[]
	ignoreUpdate?: boolean
}

export const upsert = async ({
	table,
	data,
	conflictColumns,
	ignoreUpdate = false,
}: UpsertOptions) => {
	if (!data.length) return { rowcount: 0 }

	// Add timestamps to all data rows
	const now = new Date()
	const dataWithTimestamps = data.map(row => ({
		...row,
		// Add created_at if not present (will be used for inserts)
		created_at: row.created_at ?? now,
		// Always set updated_at to now
		updated_at: now,
	}))

	// Get all unique columns from the data (including timestamps)
	const allColumns = Array.from(
		new Set(dataWithTimestamps.flatMap(row => Object.keys(row)))
	)

	// Build column list and placeholders
	const columnList = allColumns.map(col => `"${col}"`).join(", ")
	const placeholders = allColumns.map(() => "?").join(", ")

	// Build conflict clause
	const conflictList = conflictColumns.map(col => `"${col}"`).join(", ")
	
	// Build update clause (exclude conflict columns and created_at)
	const updateColumns = allColumns.filter(col => 
		!conflictColumns.includes(col) && col !== "created_at"
	)
	const updateClause = ignoreUpdate 
		? "NOTHING"
		: updateColumns.length > 0
			? `UPDATE SET ${updateColumns.map(col => `"${col}" = excluded."${col}"`).join(", ")}`
			: "NOTHING"

	// Build the query
	const sql = `
		INSERT INTO ${table} (${columnList}) 
		VALUES (${placeholders})
		ON CONFLICT (${conflictList}) 
		DO ${updateClause}
	`

	// Prepare data rows (ensure all rows have all columns)
	const rows = dataWithTimestamps.map(row => 
		allColumns.map(col => (row as any)[col] ?? null)
	)

	const readBackSql = `
		SELECT count(*) AS n FROM ${table}
		WHERE ${conflictColumns.map(col => `"${col}" = ?`).join(" AND ")}
		${updateClause === "NOTHING" ? "" : `AND "updated_at" = ?`}
	`
	const writeRow = async (row: (typeof rows)[number]) => {
		const record = Object.fromEntries(allColumns.map((col, i) => [col, row[i]]))
		const fixedKey = conflictColumns.length > 0 && conflictColumns.every((col) => record[col] != null)
		const readBackParams = [
			...conflictColumns.map(col => record[col]),
			...(updateClause === "NOTHING" ? [] : [now]),
		]
		for (let attempt = 1; attempt <= 2; attempt++) {
			try {
				return await client.execute(sql, row)
			} catch (error) {
				if (!fixedKey || !isRecoverableError(error)) throw error
			}
			// The response was lost but the write may have landed. Primary key lookups are real-time in CrateDB.
			const [{ n }] = await query<{ n: number }>(readBackSql, readBackParams)
			if (n > 0) return { rowcount: 1 }
		}
		throw new Error(`Saving to ${table} could not be confirmed after two attempts. Please try again.`)
	}

	// Execute the query
	const client = getCrateClient()
	if (rows.length === 1) {
		return await writeRow(rows[0])
	} else {
		// For multiple rows, we need to execute them individually
		// CrateDB doesn't support executemany like PostgreSQL
		let totalRowcount = 0
		for (const row of rows) {
			const result = await writeRow(row)
			totalRowcount += result.rowcount || 0
		}
		return { rowcount: totalRowcount }
	}
}

/**
 * Rows with every timestamp as epoch milliseconds, for a reader that compares or subtracts them: two Dates of the
 * same moment are not `===`. NULL stays null.
 */
export const timestampsAsMillis = <T extends {}>(rows: readonly T[]): T[] =>
	rows.map(
		(row) =>
			Object.fromEntries(
				Object.entries(row).map(([column, value]) => [
					column,
					value instanceof Date ? value.getTime() : value,
				]),
			) as T,
	)

export type CrateValue = string | number | boolean | Date | null

interface InsertRowsOptions {
	/** The key columns. A row whose key is already stored is left as it is. */
	conflict: string[]
	/** Rows per statement. */
	chunk?: number
}

/**
 * Inserts many rows with one multi-row `INSERT ... ON CONFLICT DO NOTHING` per chunk of 500, where `upsert` sends one
 * statement and one read-back per row. Every row has one value per column, in the order of `columns`.
 *
 * It never updates a stored row, so the caller must fix every key before the write. That is also what makes a timeout
 * harmless: the statement may have landed or not, and sending it again inserts only what is missing. It is sent again
 * once; a second timeout reaches the caller, who can call again with the same rows.
 *
 * `rowcount` is the number of rows Crate says it inserted, so rows that were already stored do not count.
 */
export const insertRows = async (
	table: string,
	columns: string[],
	rows: CrateValue[][],
	{ conflict, chunk = 500 }: InsertRowsOptions,
): Promise<{ rowcount: number; statements: number }> => {
	for (const row of rows)
		if (row.length !== columns.length)
			throw new Error(
				`insertRows into ${table}: a row has ${row.length} values for ${columns.length} columns`,
			)
	const quoted = (names: string[]) => names.map((name) => `"${name}"`).join(", ")
	const tuple = `(${columns.map(() => "?").join(", ")})`
	const client = getCrateClient()
	let rowcount = 0
	let statements = 0
	for (let start = 0; start < rows.length; start += chunk) {
		const batch = rows.slice(start, start + chunk)
		const keyIndexes = conflict.map((name) => columns.indexOf(name))
		const fixedKeys = keyIndexes.length > 0 && keyIndexes.every((index) => index >= 0) &&
			batch.every((row) => keyIndexes.every((index) => row[index] != null))
		const sql = `INSERT INTO ${table} (${quoted(columns)}) VALUES ${batch.map(() => tuple).join(", ")} ON CONFLICT (${quoted(conflict)}) DO NOTHING`
		const params = batch.flat() as (string | number | Date)[]
		let result: { rowcount?: number }
		try {
			result = await client.execute(sql, params)
		} catch (error) {
			if (!fixedKeys || !isRecoverableError(error)) throw error
			result = await client.execute(sql, params)
		}
		rowcount += result.rowcount || 0
		statements += 1
	}
	return { rowcount, statements }
}
