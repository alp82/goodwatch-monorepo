import crate from "node-crate"
import pc from "picocolors"

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
			const result = await crate.execute(query, params)
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

	// Execute the query
	const client = getCrateClient()
	if (rows.length === 1) {
		return await client.execute(sql, rows[0])
	} else {
		// For multiple rows, we need to execute them individually
		// CrateDB doesn't support executemany like PostgreSQL
		let totalRowcount = 0
		for (const row of rows) {
			const result = await client.execute(sql, row)
			totalRowcount += result.rowcount || 0
		}
		return { rowcount: totalRowcount }
	}
}
