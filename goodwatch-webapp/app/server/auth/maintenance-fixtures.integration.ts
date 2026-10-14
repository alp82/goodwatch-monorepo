import { before, after } from "node:test"
import { authModels, authModelTable, localCrateTransport, migrateAuthTables } from "./crate-adapter.server.ts"

/** Each serial maintenance suite owns a fresh set of rows in project #565's loopback cluster. */
export function maintenanceDatabase() {
	const sql = localCrateTransport(["http://127.0.0.1:15548"])
	async function reset() {
		for (const model of [...authModels, "capacity", "user_email"]) {
			const name = authModelTable(model)
			await sql(`REFRESH TABLE ${name}`)
			await sql(`DELETE FROM ${name}`)
		}
	}
	before(async () => { await migrateAuthTables(sql); await reset() })
	after(reset)
	return sql
}
