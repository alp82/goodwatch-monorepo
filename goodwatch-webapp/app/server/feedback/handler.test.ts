// POST /api/feedback: validation, origin, rate limits, honeypot, identity from the session, Discord delivery, the
// email fallback, idempotency, soft storage failure and the staff screenshot read. Storage, the limiter, the
// session, Discord and email are all fakes: nothing here reaches Crate, Valkey, Discord or SMTP.
import assert from "node:assert/strict"
import { mock, test } from "node:test"
import sharp from "sharp"
import {
	type Dependencies,
	type FeedbackStore,
	type Limiter,
	type Report,
	handleFeedback,
	readScreenshot,
} from "./handler.server.ts"
import { feedbackMail } from "./mail.server.ts"
import { safePath } from "./schema.ts"

const now = 1800000000000

/** A limiter that counts in memory, like the shared one does without Valkey. */
function memoryLimiter(): Limiter {
	const counts = new Map<string, number>()
	return {
		async take(name, client, windows) {
			const key = `${name}:${client}`
			const count = (counts.get(key) ?? 0) + 1
			if (count > windows[0].limit)
				return { allowed: false, retryAfterSeconds: windows[0].seconds }
			counts.set(key, count)
			return { allowed: true }
		},
	}
}

function fixture(member: string | null = null) {
	const rows = new Map<string, Report>()
	const store = {
		insert: mock.fn(async (r: Report) => {
			if (rows.has(r.id)) return false
			rows.set(r.id, r)
			return true
		}),
		discordId: mock.fn(
			async (_id: string, _m: string, _t: string | null) => {},
		),
		screenshot: mock.fn(async (id: string) => rows.get(id)?.screenshot ?? null),
	} satisfies FeedbackStore
	const deps = {
		store,
		limiter: memoryLimiter(),
		email: mock.fn(async (_r: Report) => {}),
		send: mock.fn(
			async (_url: string | URL | Request, _init?: RequestInit) =>
				new Response(JSON.stringify({ id: "123", channel_id: "456" })),
		),
		memberId: mock.fn(async (_request: Request) => member),
		now: () => now,
		env: {
			APP_ORIGIN: "https://goodwatch.app",
			FEEDBACK_DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/abc",
			FEEDBACK_DISCORD_TAG_IDS: '{"bug":"789"}',
			SOURCE_COMMIT: "abc123",
		} as Record<string, string | undefined>,
	}
	let sequence = 0
	const submit = (
		overrides: Record<string, unknown> = {},
		headers: Record<string, string> = {},
	) =>
		handleFeedback(
			new Request("https://goodwatch.app/api/feedback", {
				method: "POST",
				headers: {
					origin: "https://goodwatch.app",
					"content-type": "application/json",
					"user-agent": "test",
					"cf-ipcountry": "DE",
					"x-forwarded-for": "10.1.1.1",
					...headers,
				},
				body: JSON.stringify({
					kind: "bug",
					message: "Something broke",
					website: "",
					startedAt: now - 3000,
					idempotencyKey: `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
					...overrides,
				}),
			}),
			deps as unknown as Dependencies,
		)
	return { rows, deps, submit }
}
const quiet = (t: { mock: typeof mock }) =>
	t.mock.method(console, "error", () => {})

test("validates schema, contact email, honeypot and minimum/maximum time", async () => {
	const f = fixture()
	for (const input of [
		{ kind: "other" },
		{ message: "" },
		{ kind: "contact" },
		{ kind: "contact", email: "bad" },
		{ memberId: "fake" },
		{ metadata: { cookies: "secret" } },
		{ kind: "data" },
		{ website: "spam" },
		{ startedAt: now },
		{ startedAt: now + 1 },
		{ startedAt: now - 86400001 },
	])
		assert.equal((await f.submit(input)).status, 400, JSON.stringify(input))
	assert.equal(f.rows.size, 0)
	const data = await f.submit({
		kind: "data",
		data: {
			entityKind: "episode",
			ids: { tmdb: 123 },
			field: "title",
			suggestedValue: "new",
			providerIds: [1],
			country: "DE",
		},
	})
	assert.equal(data.status, 200)
})

test("checks origin, fetch site, media type, malformed JSON and body cap", async () => {
	const f = fixture()
	assert.equal(
		(await f.submit({}, { origin: "https://evil.test" })).status,
		403,
	)
	assert.equal(
		(await f.submit({}, { "sec-fetch-site": "same-site" })).status,
		403,
	)
	assert.equal(
		(await f.submit({}, { "content-type": "text/plain" })).status,
		415,
	)
	assert.equal(
		(await f.submit({ screenshot: "a".repeat(2900000) })).status,
		413,
	)
	const request = new Request("https://goodwatch.app/api/feedback", {
		method: "POST",
		headers: {
			origin: "https://goodwatch.app",
			"content-type": "application/json",
		},
		body: "{",
	})
	assert.equal(
		(await handleFeedback(request, f.deps as unknown as Dependencies)).status,
		400,
	)
})

test("limits guests to five an hour by address and members to twenty by member and by address", async () => {
	const f = fixture()
	for (let i = 0; i < 5; i++) assert.equal((await f.submit()).status, 200)
	const refused = await f.submit()
	assert.equal(refused.status, 429)
	assert.equal(refused.headers.get("retry-after"), "3600")

	const m = fixture("server-member")
	for (let i = 0; i < 20; i++)
		assert.equal(
			(await m.submit({}, { "x-forwarded-for": `10.0.0.${i}` })).status,
			200,
		)
	assert.equal(
		(await m.submit({}, { "x-forwarded-for": "another" })).status,
		429,
	)

	const a = fixture("member")
	for (let i = 0; i < 20; i++) {
		a.deps.memberId.mock.mockImplementation(async () => `member${i}`)
		assert.equal((await a.submit()).status, 200)
	}
	assert.equal((await a.submit()).status, 429)
})

test("the limiter never sees an address, only a hash", async () => {
	const f = fixture()
	const clients: string[] = []
	f.deps.limiter = {
		async take(_name, client) {
			clients.push(client)
			return { allowed: true }
		},
	}
	await f.submit()
	assert.equal(clients.length, 1)
	assert.match(clients[0], /^[a-f0-9]{64}$/)
})

test("strips URL secrets and derives identity, country, agent and commit on the server", async () => {
	const f = fixture("server-member")
	await f.submit({
		metadata: {
			url: "https://user:pass@goodwatch.app/movie/1?q=ok&code=private&state=private&access_token=private&mcpKey=private&my-secret=private#private",
		},
	})
	const r = [...f.rows.values()][0]
	assert.equal(r.memberId, "server-member")
	assert.equal(r.metadata.url, "/movie/1?q=ok")
	assert.equal(r.metadata.userAgent, "test")
	assert.equal(r.metadata.country, "DE")
	assert.equal(r.metadata.buildCommit, "abc123")
	assert.equal(
		safePath("/?api_key=x&password=x&session=x&name=ok"),
		"/?name=ok",
	)
	const guest = fixture()
	await guest.submit()
	assert.equal([...guest.rows.values()][0].memberId, null)
})

test("sends a tagged forum payload with mentions disabled and sanitized display text", async () => {
	const f = fixture("member")
	await f.submit({
		message: "**broken** https://evil.test @everyone <@123> me@example.com",
		email: "private@example.com",
	})
	const [url, options] = f.deps.send.mock.calls[0].arguments
	assert.ok(String(url).includes("wait=true"))
	assert.ok(options?.signal)
	const payload = JSON.parse(options!.body as string)
	assert.deepEqual(payload.applied_tags, ["789"])
	assert.deepEqual(payload.allowed_mentions, { parse: [] })
	assert.equal(typeof payload.thread_name, "string")
	assert.ok(payload.thread_name.length <= 100)
	const text = JSON.stringify(payload)
	for (const forbidden of [
		"https://",
		"@everyone",
		"<@123>",
		"**",
		"private@example.com",
		"me@example.com",
	])
		assert.ok(!text.includes(forbidden), forbidden)
	assert.deepEqual(f.deps.store.discordId.mock.calls[0].arguments.slice(1), [
		"123",
		"456",
	])
	assert.equal(f.deps.email.mock.callCount(), 0)
})

test("emails on Discord failure or an unset webhook, always emails contact, and keeps the row on delivery failure", async (t) => {
	quiet(t)
	const failed = fixture()
	failed.deps.send.mock.mockImplementation(async () => {
		throw new Error("timeout")
	})
	assert.equal((await failed.submit()).status, 200)
	assert.equal(failed.deps.email.mock.callCount(), 1)

	const refused = fixture()
	refused.deps.send.mock.mockImplementation(
		async () => new Response("rate limited", { status: 429 }),
	)
	assert.equal((await refused.submit()).status, 200)
	assert.equal(refused.deps.email.mock.callCount(), 1)
	assert.equal(refused.deps.store.discordId.mock.callCount(), 0)

	const unset = fixture()
	delete unset.deps.env.FEEDBACK_DISCORD_WEBHOOK_URL
	assert.equal((await unset.submit()).status, 200)
	assert.equal(unset.deps.email.mock.callCount(), 1)
	assert.equal(unset.deps.send.mock.callCount(), 0)

	const contact = fixture()
	await contact.submit({ kind: "contact", email: "sender@example.com" })
	assert.equal(contact.deps.email.mock.callCount(), 1)
	assert.equal(
		contact.deps.email.mock.calls[0].arguments[0].email,
		"sender@example.com",
	)

	const both = fixture()
	both.deps.send.mock.mockImplementation(async () => {
		throw new Error()
	})
	both.deps.email.mock.mockImplementation(async () => {
		throw new Error()
	})
	assert.equal((await both.submit()).status, 200)
	assert.equal(both.rows.size, 1)
})

test("deduplicates concurrent retries before notifying", async () => {
	const f = fixture()
	const key = { idempotencyKey: "00000000-0000-4000-8000-000000000001" }
	const results = await Promise.all([f.submit(key), f.submit(key)])
	assert.deepEqual(await results[0].json(), await results[1].json())
	assert.equal(f.rows.size, 1)
	assert.equal(f.deps.send.mock.callCount(), 1)
})

test("a failing store (missing table) still delivers the report; 503 only when nothing took it", async (t) => {
	const errors = quiet(t)
	const f = fixture()
	f.deps.store.insert.mock.mockImplementation(async () => {
		throw new Error("RelationUnknown doc.feedback_report")
	})
	const response = await f.submit()
	assert.equal(response.status, 200)
	assert.equal(f.deps.send.mock.callCount(), 1)
	assert.equal(f.deps.store.discordId.mock.callCount(), 0)
	assert.equal(f.deps.email.mock.callCount(), 0)
	assert.ok(
		errors.mock.calls.some((call) =>
			String(call.arguments[0]).includes("storing the report failed"),
		),
	)

	const nothing = fixture()
	nothing.deps.store.insert.mock.mockImplementation(async () => {
		throw new Error()
	})
	nothing.deps.send.mock.mockImplementation(async () => {
		throw new Error()
	})
	nothing.deps.email.mock.mockImplementation(async () => {
		throw new Error()
	})
	assert.equal((await nothing.submit()).status, 503)
})

test("normalizes PNG and JPEG screenshots to WebP and attaches them; staff authorization precedes storage access", async (t) => {
	quiet(t)
	const f = fixture()
	const png = await sharp({
		create: { width: 8, height: 8, channels: 3, background: "red" },
	})
		.png()
		.toBuffer()
	assert.equal(
		(await f.submit({ screenshot: png.toString("base64") })).status,
		200,
	)
	const jpeg = await sharp({
		create: { width: 8, height: 8, channels: 3, background: "blue" },
	})
		.jpeg()
		.toBuffer()
	assert.equal(
		(await f.submit({ screenshot: jpeg.toString("base64") })).status,
		200,
	)
	const r = [...f.rows.values()][0]
	assert.equal(
		(await sharp(Buffer.from(r.screenshot!, "base64")).metadata()).format,
		"webp",
	)
	const form = f.deps.send.mock.calls[0].arguments[1]!.body as unknown as {
		get(name: string): unknown
	}
	assert.deepEqual(
		JSON.parse(form.get("payload_json") as string).allowed_mentions,
		{ parse: [] },
	)
	assert.ok(form.get("files[0]"))
	assert.equal((await readScreenshot(r.id, false, f.deps.store)).status, 403)
	assert.equal(f.deps.store.screenshot.mock.callCount(), 0)
	const response = await readScreenshot(r.id, true, f.deps.store)
	assert.ok(response.headers.get("cache-control")?.includes("no-store"))
	assert.equal(response.headers.get("content-type"), "image/webp")
	assert.equal((await readScreenshot("nope", true, f.deps.store)).status, 404)
	assert.equal(
		(await f.submit({ screenshot: Buffer.from("invalid").toString("base64") }))
			.status,
		400,
	)
	f.deps.store.screenshot.mock.mockImplementation(async () => {
		throw new Error("RelationUnknown")
	})
	assert.equal((await readScreenshot(r.id, true, f.deps.store)).status, 503)
})

test("addresses mail to support with the validated contact sender as Reply-To", async () => {
	const f = fixture()
	await f.submit({ kind: "contact", email: "sender@example.com" })
	const report = f.deps.email.mock.calls[0].arguments[0]
	const mail = feedbackMail(report)
	assert.equal(mail.to, "hello@goodwatch.app")
	assert.equal(mail.from, "GoodWatch <hello@goodwatch.app>")
	assert.equal(mail.replyTo, "sender@example.com")
	assert.ok(String(mail.text).includes(report.id))
})
