import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import Redis from "ioredis"
import { createGoodwatchAuth } from "../../app/server/auth/auth.server.ts"
import {
	localCrateTransport,
	migrateAuthTables,
} from "../../app/server/auth/crate-adapter.server.ts"
import {
	AuthMailQueue,
	smtpTransport,
} from "../../app/server/auth/mail.server.ts"
import { setAuthForTest } from "../../app/server/auth/runtime.server.ts"
import { ValkeyAuthStorage } from "../../app/server/auth/secondary-storage.server.ts"
import { setRedisClusterForTest } from "../../app/utils/cache.ts"

if (process.env.GOODWATCH_LOCAL_MCP !== "566")
	throw new Error("Disposable #566 launcher required")
const origin = "http://127.0.0.1:3356"
const sql = localCrateTransport(["http://127.0.0.1:15548"])
await migrateAuthTables(sql)
const redis = new Redis.Cluster([{ host: "127.0.0.1", port: 15601 }], {
	natMap: JSON.parse(required("AUTH_TEST_VALKEY_NAT")),
	redisOptions: { maxRetriesPerRequest: 0, commandTimeout: 3000 },
})
setRedisClusterForTest(redis)
const mail = new AuthMailQueue(
	smtpTransport({ host: "127.0.0.1", port: 15525, localCatcher: true }),
)
const auth = createGoodwatchAuth({
	sql,
	storage: new ValkeyAuthStorage(() => redis),
	mail,
	baseURL: origin,
	secret: required("BETTER_AUTH_SECRET"),
	google: { clientId: "local", clientSecret: "local" },
	mcp: { resource: `${origin}/mcp`, accessTokenExpiresIn: 60 },
})
setAuthForTest(auth)
const fixture = JSON.parse(
	readFileSync(required("MCP_LOCAL_CREDENTIAL_FILE"), "utf8"),
)
const email = fixture.email
const context = await auth.$context
let user = await context.adapter.findOne<{
	id: string
	emailVerified: boolean
}>({ model: "user", where: [{ field: "email", value: email }] })
if (!user) {
	await auth.handler(
		new Request(`${origin}/api/auth/sign-up/email`, {
			method: "POST",
			headers: { origin, "content-type": "application/json" },
			body: JSON.stringify({
				email,
				password: fixture.password,
				name: "Local MCP member",
			}),
		}),
	)
	await mail.drain()
	const messages = await (
		await fetch("http://127.0.0.1:15580/api/v1/messages")
	).json()
	const message = messages.messages.find(
		(m: { ID: string; To: { Address: string }[] }) =>
			m.To.some((t: { Address: string }) => t.Address === email),
	)
	const content = await (
		await fetch(`http://127.0.0.1:15580/api/v1/message/${message.ID}`)
	).json()
	const link = content.Text.match(
		/http:\/\/127\.0\.0\.1:3356\/api\/auth\/\S+/,
	)[0]
	const confirmed = await auth.handler(new Request(link))
	if (![200, 302].includes(confirmed.status))
		throw new Error("Local member confirmation failed")
	user = await context.adapter.findOne({
		model: "user",
		where: [{ field: "email", value: email }],
	})
}
if (!user?.emailVerified) throw new Error("Local member not confirmed")
fixture.userId = user.id
writeFileSync(required("MCP_LOCAL_CREDENTIAL_FILE"), JSON.stringify(fixture), {
	mode: 0o600,
})
execFileSync("python", ["scripts/mcp-read/seed-local.py"], {
	env: {
		...process.env,
		MCP_LOCAL_CRATE_PORT: "15548",
		MCP_LOCAL_MEMBER_ID: user.id,
	},
	stdio: "ignore",
})
console.log(JSON.stringify({ event: "local-mcp-ready", origin, durable: true }))

function required(name: string) {
	const value = process.env[name]
	if (!value) throw new Error(`Missing local fixture configuration: ${name}`)
	return value
}
