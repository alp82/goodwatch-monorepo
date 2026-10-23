import { createGoodwatchAuth } from "../../app/server/auth/auth.server.ts"
import { crateAuthTransport } from "../../app/server/auth/crate-adapter.server.ts"
import { parseAuthEncryptionKeys } from "../../app/server/auth/payload-codec.server.ts"
import { AuthMailQueue } from "../../app/server/auth/mail.server.ts"
import { ValkeyAuthStorage } from "../../app/server/auth/secondary-storage.server.ts"
import { yepwatchOAuthEnvironment } from "../../app/server/auth/yepwatch-oauth-policy.ts"
import { ensureYepWatchClient } from "../../app/server/auth/yepwatch-client.server.ts"
const required = (key: string) => {
	const value = process.env[key]
	if (!value) throw new Error(`Missing ${key}`)
	return value
}
try {
	const command = process.argv[2] ?? "check"
	if (!["check", "apply"].includes(command) || process.argv.length > 3)
		throw new Error("Usage: client.ts [check|apply]")
	const config = yepwatchOAuthEnvironment(process.env)
	if (!config) throw new Error("YepWatch client settings required")
	const transport = crateAuthTransport(
		required("AUTH_CRATEDB_ORIGINS").split(","),
		15000,
		{
			username: required("AUTH_CRATEDB_USERNAME"),
			password: required("AUTH_CRATEDB_PASSWORD"),
		}
	)
	const auth = createGoodwatchAuth({
		sql: async (stmt, args) => {
			if (command === "check" && !/^SELECT\b/i.test(stmt.trim()))
				throw new Error(
					"Check cannot seed or change issuer records; explicit apply required"
				)
			return transport(stmt, args)
		},
		encryptionSecret: required("AUTH_CRATEDB_ENCRYPTION_SECRET"),
		encryptionKeys: parseAuthEncryptionKeys(
			required("AUTH_CRATEDB_ENCRYPTION_KEYS")
		),
		baseURL: required("BETTER_AUTH_URL"),
		secret: required("BETTER_AUTH_SECRET"),
		mcp: { resource: required("MCP_RESOURCE_URL") },
		yepwatch: config,
		// This operation creates no session, sends no mail, and uses no Redis. Unexpected use fails closed.
		storage: new ValkeyAuthStorage(() => null),
		mail: new AuthMailQueue({
			async sendMail() {
				throw new Error("Mail unavailable in client operator")
			},
		}),
		google: { clientId: "operator-unused", clientSecret: "operator-unused" },
	})
	const report = await ensureYepWatchClient(auth, config, command === "apply")
	console.log(JSON.stringify(report)) // public registration metadata only
	if (!report.ready) process.exitCode = 2
} catch {
	console.error(
		"YepWatch client check/provision failed. Check the existing issuer environment and registration; no credentials were logged."
	)
	process.exitCode = 1
}
