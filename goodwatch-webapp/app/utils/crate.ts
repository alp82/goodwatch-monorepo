import crate from "node-crate"
import pc from "picocolors"

// node-crate has no request timeout: a request whose response never arrives awaits forever. Every call is capped at
// CRATE_TIMEOUT_MS (default 10 s; webapp queries finish in well under 2 s). The timeout only stops waiting: the HTTP
// request is not cancelled, so a write may still land after it fires. `upsert` reads its row back to find out.
const DEFAULT_TIMEOUT_MS = 10_000

const getTimeoutMs = () => {
	const configured = Number.parseInt(process.env.CRATE_TIMEOUT_MS || "", 10)
	return configured > 0 ? configured : DEFAULT_TIMEOUT_MS
}

export class CrateTimeoutError extends Error {
	constructor(timeoutMs: number) {
		super(`CrateDB did not respond within ${timeoutMs} ms`)
		this.name = "CrateTimeoutError"
	}
}

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
	let timer: ReturnType<typeof setTimeout> | undefined
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new CrateTimeoutError(timeoutMs)), timeoutMs)
	})
	try {
		return await Promise.race([promise, timeout])
	} finally {
		clearTimeout(timer)
	}
}

class CrateClient {
	constructor(hosts: string[]) {
		crate.connect(hosts.join(" "))
	}

	async execute(
		query: string,
		params?: (string | number | Date)[],
	) {
		const startTime = performance.now()
		try {
			const result = await withTimeout(crate.execute(query, params), getTimeoutMs())
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
			console.error('Query:', query)
			console.error('Params:', params)
			console.error('Error:', error)
			console.error('Stack trace:')
			console.trace()
			throw error
		}
	}

	private formatLog(querySummary: string, duration: number, failed = false): string {
		const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false })
		const coloredDuration = this.colorDuration(duration, failed)
		const label = pc.dim(`[${pc.cyan('CrateDB')}]`)
		const status = failed ? pc.red('FAILED') : ''
		return `${pc.dim(timestamp)} ${label} ${querySummary} ${status} ${coloredDuration}`
	}

	private logSlowQueryDetails(query: string, params: (string | number | Date)[] | undefined, duration: number, result: any): void {
		console.warn(pc.yellow('  ⚠ Slow query details:'))
		console.warn(pc.dim('  Query:'), query.trim().replace(/\s+/g, ' ').substring(0, 200) + (query.length > 200 ? '...' : ''))
		
		if (params && params.length > 0) {
			console.warn(pc.dim('  Params:'), params.length > 5 ? `${params.slice(0, 5).join(', ')}... (${params.length} total)` : params.join(', '))
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
	) {
		const { json, duration, rowcount, rows, cols } = await this.execute(
			query,
			params,
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

export const getCrateClient = () => {
	if (!client) {
		const hosts = (process.env.CRATE_HOSTS || "").split(",")
		const port = Number.parseInt(process.env.CRATE_PORT || "4200")
		const user = process.env.CRATE_USER || ""
		const pass = process.env.CRATE_PASS || ""
		const urls = hosts.map((host) => `http://${user}:${pass}@${host}:${port}`)
		client = new CrateClient(urls)
	}
	return client
}

export const query = async <T extends {}>(
	query: string,
	params?: (string | number | Date)[],
): Promise<T[]> => {
	const client = getCrateClient()
	const response = await client.select<T>(query, params)
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
		const readBackParams = [
			...conflictColumns.map(col => record[col]),
			...(updateClause === "NOTHING" ? [] : [now]),
		]
		for (let attempt = 1; attempt <= 2; attempt++) {
			try {
				return await client.execute(sql, row)
			} catch (error) {
				if (!(error instanceof CrateTimeoutError)) throw error
			}
			// The write timed out but may still have landed. Primary key lookups are real-time in CrateDB.
			const [{ n }] = await query<{ n: number }>(readBackSql, readBackParams)
			if (n > 0) return { rowcount: 1 }
		}
		throw new Error(`Saving to ${table} timed out twice and the row is not stored. Please try again.`)
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
