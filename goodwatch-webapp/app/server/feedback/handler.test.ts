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
	type Screenshot,
	type StoredReport,
	dedupeKey,
	handleFeedback,
	readScreenshot,
} from "./handler.server.ts"
import { feedbackMail } from "./mail.server.ts"
import { FEEDBACK_STATUSES, feedbackStatusSchema, safePath } from "./schema.ts"

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
	const screenshots = new Map<string, Screenshot>()
	const store = {
		insert: mock.fn(async (r: Report): Promise<StoredReport> => {
			if (rows.has(r.id)) return { kind: "retry", reportId: r.id }
			rows.set(r.id, r)
			return { kind: "new", reportId: r.id }
		}),
		storeScreenshot: mock.fn(async (id: string, screenshot: Screenshot) => {
			screenshots.set(id, screenshot)
		}),
		discordId: mock.fn(
			async (_id: string, _m: string, _t: string | null) => {},
		),
		screenshot: mock.fn(async (id: string) => screenshots.get(id) ?? null),
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
			DISCORD_FEEDBACK_WEBHOOK_URL: "https://discord.com/api/webhooks/123/abc",
			DISCORD_FEEDBACK_TAG_IDS: '{"bug":"789"}',
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
	return { rows, screenshots, deps, submit }
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
	assert.equal(new URL(String(url)).searchParams.get("wait"), "true")
	assert.equal(new URL(String(url)).searchParams.get("with_components"), "true")
	assert.ok(options?.signal)
	const payload = JSON.parse(options!.body as string)
	assert.deepEqual(payload.applied_tags, ["789"])
	assert.deepEqual(payload.allowed_mentions, { parse: [] })
	assert.equal(payload.flags, 1 << 15)
	assert.equal(payload.embeds, undefined)
	assert.equal(payload.content, undefined)
	assert.equal(typeof payload.thread_name, "string")
	assert.ok(payload.thread_name.length <= 100)
	const text = JSON.stringify(payload)
	assert.match(text, /### 🐞 Bug/)
	assert.match(text, /Member · 🇩🇪/)
	for (const forbidden of [
		"evil.test",
		"@everyone",
		"<@123>",
		"**broken",
		"private@example.com",
		"me@example.com",
		'"member"',
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
	delete unset.deps.env.DISCORD_FEEDBACK_WEBHOOK_URL
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
	assert.equal(f.deps.send.mock.callCount(), 2)
})

test("a failing store (missing table) still delivers the report; 503 only when nothing took it", async (t) => {
	const errors = quiet(t)
	const f = fixture()
	f.deps.store.insert.mock.mockImplementation(async () => {
		throw new Error("RelationUnknown doc.feedback_report")
	})
	const response = await f.submit()
	assert.equal(response.status, 200)
	assert.equal(f.deps.send.mock.callCount(), 2)
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
		(
			await sharp(
				Buffer.from(f.screenshots.get(r.id)!.data, "base64"),
			).metadata()
		).format,
		"webp",
	)
	// The webhook may not send files next to Components V2: the card goes first, the screenshot follows in the thread.
	const card = JSON.parse(
		f.deps.send.mock.calls[0].arguments[1]!.body as string,
	)
	assert.match(JSON.stringify(card), /Screenshot attached in the thread/)
	const [followUrl, follow] = f.deps.send.mock.calls[2].arguments
	assert.equal(new URL(String(followUrl)).searchParams.get("thread_id"), "456")
	assert.equal(
		new URL(String(followUrl)).searchParams.get("with_components"),
		null,
	)
	const form = follow!.body as unknown as {
		get(name: string): unknown
	}
	const followPayload = JSON.parse(form.get("payload_json") as string)
	assert.deepEqual(followPayload.allowed_mentions, { parse: [] })
	assert.equal(followPayload.flags, undefined)
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

test("data keys canonicalize identifier order and suggestion case and whitespace only", async () => {
	const f = fixture()
	const data = {
		entityKind: "movie",
		ids: { tmdb: 1, imdb: "tt1" },
		field: "title",
		suggestedValue: " New title ",
	}
	await f.submit({ kind: "data", data })
	await f.submit({
		kind: "data",
		data: {
			...data,
			ids: { imdb: "tt1", tmdb: 1 },
			suggestedValue: "new TITLE",
			currentValue: "ignored",
			country: "DE",
		},
	})
	const [a, b] = [...f.rows.values()]
	assert.match(a.dedupeKey!, /^[a-f0-9]{64}$/)
	assert.equal(a.dedupeKey, b.dedupeKey)
	assert.equal(a.status, "new")
	assert.equal(a.duplicateCount, 1)
	assert.equal(a.updatedAt, null)
	assert.equal(a.handledBy, null)
	assert.equal(a.correctionId, null)
	await f.submit({
		kind: "data",
		data: { ...data, suggestedValue: "different" },
	})
	assert.notEqual([...f.rows.values()][2].dedupeKey, a.dedupeKey)
	// The schema accepts a number or a string for an identifier; both name the same title.
	await f.submit({
		kind: "data",
		data: { ...data, ids: { tmdb: "1", imdb: "tt1" } },
	})
	assert.equal([...f.rows.values()][3].dedupeKey, a.dedupeKey)
	for (const kind of ["bug", "idea", "contact"] as const) {
		const g = fixture()
		await g.submit({ kind, email: "sender@example.com" })
		assert.equal([...g.rows.values()][0].dedupeKey, null)
	}
	// Numeric/boolean values keep their type; omitted and explicit null differ.
	const input = {
		kind: "data" as const,
		message: "x",
		website: "",
		startedAt: now,
		idempotencyKey: "unused",
		data: { ...data, entityKind: "movie" as const },
	}
	for (const suggestedValue of [1, true, null, undefined])
		assert.notEqual(
			dedupeKey({ ...input, data: { ...input.data, suggestedValue } }),
			a.dedupeKey,
		)
	assert.notEqual(
		dedupeKey({ ...input, data: { ...input.data, suggestedValue: null } }),
		dedupeKey({ ...input, data: { ...input.data, suggestedValue: undefined } }),
	)
})

test("statuses have one validated definition and cannot be submitted by a visitor", async () => {
	assert.deepEqual(FEEDBACK_STATUSES, [
		"new",
		"in_progress",
		"done",
		"wont_fix",
		"duplicate",
	])
	for (const status of FEEDBACK_STATUSES)
		assert.equal(feedbackStatusSchema.parse(status), status)
	assert.equal(feedbackStatusSchema.safeParse("closed").success, false)
	assert.equal(
		(await fixture().submit({ status: "done", handledBy: "staff" })).status,
		400,
	)
})

test("a duplicate replies in the existing thread with the count and keeps the success shape", async () => {
	const f = fixture()
	const reportId = "a".repeat(64)
	f.deps.store.insert.mock.mockImplementation(async () => ({
		kind: "duplicate",
		reportId,
		count: 3,
		threadId: "456",
		retry: false,
	}))
	const response = await f.submit({
		kind: "data",
		data: { entityKind: "movie", ids: { tmdb: 1 }, field: "title" },
	})
	assert.equal(response.status, 200)
	assert.deepEqual(await response.json(), {
		reportId,
		outcome: "pending",
		correctionId: null,
	})
	const [url, init] = f.deps.send.mock.calls[0].arguments
	assert.equal(new URL(String(url)).searchParams.get("thread_id"), "456")
	assert.equal(new URL(String(url)).searchParams.get("wait"), "true")
	assert.ok(init?.signal)
	const payload = JSON.parse(init!.body as string)
	assert.equal(payload.flags, 1 << 15)
	assert.deepEqual(payload.allowed_mentions, { parse: [] })
	assert.equal(payload.thread_name, undefined)
	assert.equal(payload.applied_tags, undefined)
	// The reply carries the new submission's evidence: the key ignores message and source.
	const text = JSON.stringify(payload)
	assert.match(text, /\*\*\+1 duplicate\*\* \(3 total\)/)
	assert.match(text, /> Something broke/)
	assert.equal(f.deps.store.discordId.mock.callCount(), 0)
	assert.equal(f.deps.email.mock.callCount(), 0)
	f.deps.store.insert.mock.mockImplementation(async () => ({
		kind: "duplicate",
		reportId,
		count: 3,
		threadId: "456",
		retry: true,
	}))
	assert.equal((await f.submit()).status, 200)
	assert.equal(f.deps.send.mock.callCount(), 1)
})

test("a duplicate with no thread uses email without opening a new forum post", async (t) => {
	quiet(t)
	const f = fixture()
	f.deps.store.insert.mock.mockImplementation(async () => ({
		kind: "duplicate",
		reportId: "a".repeat(64),
		count: 2,
		threadId: null,
		retry: false,
	}))
	assert.equal((await f.submit()).status, 200)
	assert.equal(f.deps.send.mock.callCount(), 0)
	assert.equal(f.deps.email.mock.callCount(), 1)
})

test("screenshot storage follows the report and fails softly with the attachment intact", async (t) => {
	const errors = quiet(t)
	const f = fixture()
	const png = await sharp({
		create: { width: 8, height: 8, channels: 3, background: "red" },
	})
		.png()
		.toBuffer()
	f.deps.store.storeScreenshot.mock.mockImplementation(
		async (id, screenshot) => {
			assert.ok(f.rows.has(id))
			assert.equal(screenshot.contentType, "image/webp")
			assert.equal(
				screenshot.bytes,
				Buffer.byteLength(screenshot.data, "base64"),
			)
			assert.equal(screenshot.createdAt, now)
			throw new Error("RelationUnknown doc.feedback_screenshot")
		},
	)
	assert.equal(
		(await f.submit({ screenshot: png.toString("base64") })).status,
		200,
	)
	assert.equal(f.deps.store.storeScreenshot.mock.callCount(), 1)
	assert.equal(f.rows.size, 1)
	assert.equal(f.screenshots.size, 0)
	assert.equal([...f.rows.values()][0].hasScreenshot, false)
	const form = f.deps.send.mock.calls[2].arguments[1]!.body as unknown as {
		get(name: string): unknown
	}
	assert.ok(form.get("files[0]"))
	assert.ok(
		errors.mock.calls.some((call) =>
			String(call.arguments[0]).includes("storing the screenshot failed"),
		),
	)
	const report = [...f.rows.values()][0]
	assert.equal(
		(await readScreenshot(report.id, true, f.deps.store)).status,
		404,
	)
})

test("a missing report table during the data lookup also fails softly", async (t) => {
	quiet(t)
	const f = fixture()
	const { createFeedbackStore } = await import("./store.server.ts")
	const store = createFeedbackStore(async (sql) => {
		assert.equal(sql, "REFRESH TABLE doc.feedback_report")
		throw new Error("RelationUnknown doc.feedback_report")
	})
	// Use the actual store's data path, including its lookup before insert.
	f.deps.store.insert.mock.mockImplementation(store.insert)
	assert.equal(
		(
			await f.submit({
				kind: "data",
				data: { entityKind: "movie", ids: { tmdb: 1 }, field: "title" },
			})
		).status,
		200,
	)
	assert.equal(f.rows.size, 0)
	assert.equal(f.deps.send.mock.callCount(), 2)
})

for (const path of ["bot", "webhook"] as const) {
	test(`${path} details reply failure does not email or fail the report`, async (t) => {
		const errors = quiet(t)
		const f = fixture()
		if (path === "bot") {
			f.deps.env.DISCORD_BOT_TOKEN = "bot-token"
			f.deps.env.DISCORD_FEEDBACK_FORUM_CHANNEL_ID = "111111111111111111"
		}
		f.deps.send.mock.mockImplementation(async (_url, init) => {
			const payload = JSON.parse(init!.body as string)
			if (payload.flags & (1 << 12))
				return new Response("Forbidden", { status: 403 })
			return new Response(
				JSON.stringify({
					id: "222222222222222222",
					channel_id: "222222222222222222",
				}),
			)
		})
		assert.equal((await f.submit()).status, 200)
		assert.equal(f.deps.send.mock.callCount(), path === "bot" ? 3 : 2)
		assert.equal(f.deps.email.mock.callCount(), 0)
		assert.equal(f.deps.store.discordId.mock.callCount(), 1)
		assert.ok(
			errors.mock.calls.some((call) =>
				String(call.arguments[0]).includes("posting report details"),
			),
		)
	})
}

test("correction tables can be absent without losing storage or delivery", async (t) => {
	quiet(t)
	const f = fixture("member")
	const deps = f.deps as Dependencies
	deps.isTrusted = async () => true
	deps.corrections = {
		submit: async () => {
			throw new Error("RelationUnknownException")
		},
		response: async (reportId) => ({
			reportId,
			outcome: "pending",
			correctionId: null,
		}),
	}
	const response = await f.submit({
		kind: "data",
		data: {
			entityKind: "movie",
			ids: { tmdbId: 1 },
			field: "release_date",
			area: "details",
			problem: "date",
			suggestedValue: "2025-01-01",
		},
	})
	const body = await response.json()
	assert.equal(response.status, 200)
	assert.equal(body.outcome, "pending")
	assert.equal(body.correctionId, null)
	assert.equal(f.rows.size, 1)
	assert.ok(f.deps.send.mock.calls.length)
})
test("duplicates and accepted retries reuse the original correction without submitting again", async () => {
	const f = fixture("member")
	const deps = f.deps as Dependencies
	let submissions = 0
	deps.corrections = {
		submit: async () => {
			submissions++
			return null
		},
		response: async (reportId) => ({
			reportId,
			outcome: "live",
			correctionId: "c".repeat(64),
		}),
	}
	f.deps.store.insert.mock.mockImplementation(async () => ({
		kind: "duplicate",
		reportId: "a".repeat(64),
		count: 2,
		threadId: "456",
		retry: false,
	}))
	const input = {
		kind: "data",
		data: {
			entityKind: "movie",
			ids: { tmdbId: 1 },
			field: "release_date",
			area: "details",
			problem: "date",
			suggestedValue: "2025-01-01",
		},
	}
	assert.equal((await (await f.submit(input)).json()).outcome, "live")
	f.deps.store.insert.mock.mockImplementation(async () => ({
		kind: "retry",
		reportId: "a".repeat(64),
	}))
	assert.equal(
		(await (await f.submit(input)).json()).correctionId,
		"c".repeat(64),
	)
	assert.equal(submissions, 0)
})
