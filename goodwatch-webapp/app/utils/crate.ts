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
