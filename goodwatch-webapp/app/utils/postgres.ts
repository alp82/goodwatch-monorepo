import pg from "pg"
const { Pool } = pg

const pool = new Pool({
	user: process.env.POSTGRES_USER,
	password: process.env.POSTGRES_PASS,
	host: process.env.POSTGRES_HOST,
	port: Number(process.env.POSTGRES_PORT),
	database: process.env.POSTGRES_DB,
})

export async function executeQuery<T extends {}>(
	query: string,
	params?: unknown[],
) {
	const start = Date.now()
	try {
		const res = await pool.query<T>(query, params)
		const duration = Date.now() - start
		console.log("executed query", {
			query,
			params,
			duration,
			rowCount: res.rowCount,
		})
		return res
	} catch (err) {
		console.error("error executing query", { query, params, error: err })
		throw err
	}
}
