import { testAdapter, normalTestSuite, authFlowTestSuite, caseInsensitiveTestSuite, uuidTestSuite } from "@better-auth/test-utils/adapter"
import { crateAuthAdapter, localCrateTransport, migrateAuthTables } from "../../../app/server/auth/crate-adapter.server.ts"
import { getAuthTables } from "better-auth/db"

const sql = localCrateTransport(["http://127.0.0.1:15748"])
const suite = await testAdapter({
	adapter: () => crateAuthAdapter({ sql, testOnlyConformance: true }),
	runMigrations: options => migrateAuthTables(sql, Object.keys(getAuthTables(options))),
	additionalCleanups: async () => { await sql("DELETE FROM doc.auth_user_email"); await sql("REFRESH TABLE doc.auth_user_email") },
	tests: [normalTestSuite(), authFlowTestSuite(), caseInsensitiveTestSuite(), uuidTestSuite()],
})
suite.execute()
