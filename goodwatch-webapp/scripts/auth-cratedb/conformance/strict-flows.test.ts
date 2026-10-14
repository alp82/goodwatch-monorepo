import { isolatedCrateAuthAdapter as crateAuthAdapter } from "./adapter-factory.ts"
import { testAdapter, authFlowTestSuite } from "@better-auth/test-utils/adapter"
import { localCrateTransport, migrateAuthTables } from "../../../app/server/auth/crate-adapter.server.ts"

const sql = localCrateTransport(["http://127.0.0.1:15748"])
const suite = await testAdapter({
	adapter: () => options => {
		const strict = crateAuthAdapter({ sql })(options)
		return {
			...strict,
			// The upstream harness empties tables between tests with an unfiltered
			// deleteMany. That operation remains forbidden in the real adapter.
			deleteMany: async args => {
				if (!args.where?.length) {
					if (!["user", "account", "session", "verification"].includes(args.model)) throw new Error("Unknown test cleanup model")
					const result = await sql(`DELETE FROM doc.auth_${args.model}`)
					await sql(`REFRESH TABLE doc.auth_${args.model}`)
					return result.rowcount
				}
				return strict.deleteMany(args)
			},
		}
	},
	runMigrations: () => migrateAuthTables(sql),
	additionalCleanups: async () => { await sql("DELETE FROM doc.auth_user_email"); await sql("REFRESH TABLE doc.auth_user_email") },
	tests: [authFlowTestSuite()],
	prefixTests: "strict launch shapes",
})
suite.execute()
