import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"
import { hash } from "bcryptjs"
import Redis from "ioredis"
import { Client } from "pg"
import { createGoodwatchAuth } from "./auth.server.ts"
import { AuthMailQueue } from "./mail.server.ts"
import { maintenanceDatabase } from "./maintenance-fixtures.integration.ts"
import { runAuthMaintenancePass } from "./maintenance-worker.server.ts"
import { ValkeyAuthStorage } from "./secondary-storage.server.ts"
import { authTestValkeyPort } from "./store-fixtures.integration.ts"
import { importSupabaseAuth } from "./supabase-importer.server.ts"

const sql = maintenanceDatabase()
const encryptionSecret = "disposable-local-auth-integration-key-548"
const redis = new Redis.Cluster(
	[{ host: "127.0.0.1", port: authTestValkeyPort }],
	{
		natMap: JSON.parse(process.env.AUTH_TEST_VALKEY_NAT ?? "{}"),
		redisOptions: { maxRetriesPerRequest: 0, commandTimeout: 3000 },
	},
)
after(() => redis.disconnect())
const origin = "http://127.0.0.1:3360"
const deliveries: string[] = []
const mail = new AuthMailQueue({
	sendMail: async (message) => {
		deliveries.push(String(message.text))
	},
})
const auth = createGoodwatchAuth({
	sql,
	storage: new ValkeyAuthStorage(() => redis),
	mail,
	baseURL: origin,
	secret: "local-signup-maintenance-secret-at-least-32",
	google: { clientId: "local", clientSecret: "local" },
	rateLimit: { enabled: false },
})

const post = (path: string, body: unknown) =>
	auth.handler(
		new Request(`${origin}/api/auth${path}`, {
			method: "POST",
			headers: { "content-type": "application/json", origin },
			body: JSON.stringify(body),
		}),
	)
const pass = (now = new Date()) =>
	runAuthMaintenancePass({ sql, encryptionSecret, now })

test("the real Supabase importer preserves an old unconfirmed member, credential, claim and data through maintenance", async () => {
	const adapter = (await auth.$context).adapter
	const source = new Client({
		host: "127.0.0.1",
		port: 15652,
		user: "importer",
		password: "local-fake-only",
		database: "auth_copy",
	})
	await source.connect()
	try {
		await source.query("CREATE SCHEMA IF NOT EXISTS auth")
		await source.query(
			"CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY,email TEXT,encrypted_password TEXT,email_confirmed_at TIMESTAMPTZ,created_at TIMESTAMPTZ,updated_at TIMESTAMPTZ)",
		)
		await source.query(
			"CREATE TABLE IF NOT EXISTS auth.identities (id UUID PRIMARY KEY,user_id UUID,provider TEXT,identity_data JSONB,created_at TIMESTAMPTZ,updated_at TIMESTAMPTZ)",
		)
		await source.query("TRUNCATE auth.identities,auth.users")
		const id = randomUUID()
		const email = `${id}@example.test`
		const oldDate = "2023-03-01T00:00:00.000Z"
		const passwordHash = await hash("local imported password", 4)
		await source.query("INSERT INTO auth.users VALUES ($1,$2,$3,NULL,$4,$4)", [
			id,
			email,
			passwordHash,
			oldDate,
		])
		await source.query(
			"INSERT INTO auth.identities VALUES ($1,$2,'email',$3,$4,$4)",
			[randomUUID(), id, JSON.stringify({ sub: id }), oldDate],
		)
		await sql(
			"CREATE TABLE IF NOT EXISTS doc.maintenance_import_member (user_id TEXT PRIMARY KEY,wishlist_title TEXT) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas=0)",
		)
		await sql("INSERT INTO doc.maintenance_import_member VALUES (?,?)", [
			id,
			"Existing Wishlist title",
		])
		const imported = await importSupabaseAuth({
			source,
			sql,
			encryptionSecret,
			apply: true,
		})
		assert.deepEqual(imported.created, { users: 1, accounts: 1 })
		await pass()
		const member = await adapter.findOne<{
			id: string
			emailVerified: boolean
			createdAt: Date
		}>({ model: "user", where: [{ field: "id", value: id }] })
		assert.equal(member?.id, id)
		assert.equal(member.emailVerified, false)
		assert.equal(member.createdAt.toISOString(), oldDate)
		const rerun = await importSupabaseAuth({
			source,
			sql,
			encryptionSecret,
			apply: true,
		})
		assert.deepEqual(rerun.created, { users: 0, accounts: 0 })
		// Asking the new system for a confirmation must not opt an import into GC.
		assert.equal(
			(await post("/send-verification-email", { email })).status,
			200,
		)
		await mail.drain()
		await pass(new Date(Date.now() + 60 * 86400000))
		const accounts = await adapter.findMany<{
			password: string
			userId: string
		}>({ model: "account", where: [{ field: "userId", value: id }] })
		assert.equal(accounts.length, 1)
		assert.equal(accounts[0].password, passwordHash)
		assert.equal(accounts[0].userId, id)
		assert.equal(
			(
				await adapter.findOne<{ id: string }>({
					model: "user",
					where: [{ field: "email", value: email }],
				})
			)?.id,
			id,
		)
		assert.deepEqual(
			(
				await sql(
					"SELECT wishlist_title FROM doc.maintenance_import_member WHERE user_id=?",
					[id],
				)
			).rows,
			[["Existing Wishlist title"]],
		)
	} finally {
		await source.end()
	}
})

test("new-system signups expire from insertion provenance, release their account and permit retry", async () => {
	const adapter = (await auth.$context).adapter
	const email = `${randomUUID()}@example.test`
	const response = await post("/sign-up/email", {
		email,
		name: "Pending",
		password: "local secure signup password",
	})
	assert.equal(response.status, 200, await response.clone().text())
	const user = await adapter.findOne<{ id: string }>({
		model: "user",
		where: [{ field: "email", value: email }],
	})
	assert.ok(user)
	// Historical logical dates cannot make a newly inserted signup old.
	await adapter.update({
		model: "user",
		where: [{ field: "id", value: user.id }],
		update: { createdAt: new Date("2023-03-01T00:00:00.000Z") },
	})
	await pass()
	assert.ok(
		await adapter.findOne({
			model: "user",
			where: [{ field: "id", value: user.id }],
		}),
	)
	await pass(new Date(Date.now() + 47 * 3600000))
	assert.ok(
		await adapter.findOne({
			model: "user",
			where: [{ field: "id", value: user.id }],
		}),
	)
	await pass(new Date(Date.now() + 49 * 3600000))
	assert.equal(
		await adapter.findOne({
			model: "user",
			where: [{ field: "id", value: user.id }],
		}),
		null,
	)
	assert.deepEqual(
		await adapter.findMany({
			model: "account",
			where: [{ field: "userId", value: user.id }],
		}),
		[],
	)
	const retry = await post("/sign-up/email", {
		email,
		name: "Retry",
		password: "local secure signup password",
	})
	assert.equal(retry.status, 200, await retry.clone().text())
	assert.notEqual(
		(
			await adapter.findOne<{ id: string }>({
				model: "user",
				where: [{ field: "email", value: email }],
			})
		)?.id,
		user.id,
	)
})

test("a confirmation resent at hour forty-seven remains usable at hour forty-nine", async (t) => {
	const start = Date.now()
	const adapter = (await auth.$context).adapter
	const email = `${randomUUID()}@example.test`
	const signup = await post("/sign-up/email", {
		email,
		name: "Resend",
		password: "local secure signup password",
	})
	assert.equal(signup.status, 200, await signup.clone().text())
	const user = await adapter.findOne<{ id: string }>({
		model: "user",
		where: [{ field: "email", value: email }],
	})
	assert.ok(user)
	await mail.drain()
	t.mock.timers.enable({ apis: ["Date"], now: start + 47 * 3600000 })
	try {
		const resend = await post("/send-verification-email", { email })
		assert.equal(resend.status, 200, await resend.clone().text())
		await mail.drain()
		const link = deliveries
			.at(-1)
			?.match(/http:\/\/127\.0\.0\.1:3360\/api\/auth\/\S+/)?.[0]
		assert.ok(link)
		t.mock.timers.setTime(start + 49 * 3600000)
		await pass()
		assert.ok(
			await adapter.findOne({
				model: "user",
				where: [{ field: "id", value: user.id }],
			}),
		)
		const confirmation = await auth.handler(new Request(link))
		assert.ok(
			[200, 302].includes(confirmation.status),
			await confirmation.clone().text(),
		)
		assert.equal(
			(
				await adapter.findOne<{ emailVerified: boolean }>({
					model: "user",
					where: [{ field: "id", value: user.id }],
				})
			)?.emailVerified,
			true,
		)
	} finally {
		t.mock.timers.reset()
	}
})
