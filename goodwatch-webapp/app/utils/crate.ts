import crate from "node-crate"

class CrateClient {
	constructor(hosts: string[]) {
		crate.connect(hosts.join(" "))
	}

	async select<T extends {}>(
		query: string,
		params?: (string | number | Date)[],
	) {
		const { json, duration, rowcount, rows, cols } = await crate.execute(
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

	async execute(
		query: string,
		params?: (string | number | Date)[],
	) {
		return await crate.execute(query, params)
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

	// Get all unique columns from the data
	const allColumns = Array.from(
		new Set(data.flatMap(row => Object.keys(row)))
	)

	// Build column list and placeholders
	const columnList = allColumns.map(col => `"${col}"`).join(", ")
	const placeholders = allColumns.map(() => "?").join(", ")

	// Build conflict clause
	const conflictList = conflictColumns.map(col => `"${col}"`).join(", ")
	
	// Build update clause (exclude conflict columns)
	const updateColumns = allColumns.filter(col => !conflictColumns.includes(col))
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
	const rows = data.map(row => 
		allColumns.map(col => row[col] ?? null)
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
