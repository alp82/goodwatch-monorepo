import { after, before } from "node:test"
import {
	authModelTable,
	authModels,
	localCrateTransport,
	migrateAuthTables,
} from "./crate-adapter.server.ts"
import { authTestCrateOrigins } from "./store-fixtures.integration.ts"

/** Each serial maintenance suite owns a fresh set of rows in runner's owned loopback cluster. */
export function maintenanceDatabase() {
	const sql = localCrateTransport(authTestCrateOrigins)
	async function reset() {
		for (const model of [...authModels, "capacity", "user_email"]) {
			const name = authModelTable(model)
			await sql(`REFRESH TABLE ${name}`)
			await sql(`DELETE FROM ${name}`)
		}
	}
	before(async () => {
		await migrateAuthTables(sql)
		await reset()
	})
	after(reset)
	return sql
}
