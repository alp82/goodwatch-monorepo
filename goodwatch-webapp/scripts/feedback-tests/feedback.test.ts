import { feedbackMail } from "../../app/server/feedback/mail.server"
import { it, expect, vi } from "vitest"
import sharp from "sharp"
import {
	handleFeedback,
	feedbackLimits,
	readScreenshot,
	type FeedbackStore,
	type Report,
} from "../../app/server/feedback/handler.server"
import { safePath } from "../../app/server/feedback/schema"
const now = 1800000000000
function fixture(member: string | null = null) {
	const rows = new Map<string, Report>()
	const store: FeedbackStore = {
		insert: vi.fn(async (r) => {
			if (rows.has(r.id)) return false
			rows.set(r.id, r)
			return true
		}),
		discordId: vi.fn(async () => {}),
		screenshot: vi.fn(async (id) => rows.get(id)?.screenshot ?? null),
	}
	const deps = {
		store,
		email: vi.fn(async (_r: Report) => {}),
		send: vi.fn<typeof fetch>(
			async () =>
				new Response(JSON.stringify({ id: "123", channel_id: "456" })),
		),
		memberId: vi.fn(async () => member),
		limits: feedbackLimits(),
		now: () => now,
		env: {
			APP_ORIGIN: "https://goodwatch.app",
			FEEDBACK_DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123/abc",
			FEEDBACK_DISCORD_TAG_IDS: '{"bug":"789"}',
			GIT_COMMIT: "abc123",
		} as Record<string, string | undefined>,
	}
	let sequence = 0
	const submit = (overrides = {}, headers = {}) =>
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
			deps,
		)
	return { rows, deps, submit }
}
it("validates schema, contact email, honeypot and minimum/maximum time", async () => {
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
		expect((await f.submit(input)).status).toBe(400)
	expect(f.rows.size).toBe(0)
	expect(
		(
			await f.submit({
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
		).status,
	).toBe(200)
})
it("checks origin, fetch site, media type, malformed JSON and body cap", async () => {
	const f = fixture()
	expect((await f.submit({}, { origin: "https://evil.test" })).status).toBe(403)
	expect((await f.submit({}, { "sec-fetch-site": "same-site" })).status).toBe(
		403,
	)
	expect((await f.submit({}, { "content-type": "text/plain" })).status).toBe(
		415,
	)
	expect((await f.submit({ screenshot: "a".repeat(2900000) })).status).toBe(413)
	const request = new Request("https://goodwatch.app/api/feedback", {
		method: "POST",
		headers: {
			origin: "https://goodwatch.app",
			"content-type": "application/json",
		},
		body: "{",
	})
	expect((await handleFeedback(request, f.deps)).status).toBe(400)
})
it("limits guests to five and members to twenty by member and address", async () => {
	const f = fixture()
	for (let i = 0; i < 5; i++) expect((await f.submit()).status).toBe(200)
	expect((await f.submit()).status).toBe(429)
	const m = fixture("server-member")
	for (let i = 0; i < 20; i++)
		expect(
			(await m.submit({}, { "x-forwarded-for": `10.0.0.${i}` })).status,
		).toBe(200)
	expect((await m.submit({}, { "x-forwarded-for": "another" })).status).toBe(
		429,
	)
	const a = fixture("member")
	for (let i = 0; i < 20; i++) {
		a.deps.memberId.mockResolvedValue(`member${i}`)
		expect((await a.submit()).status).toBe(200)
	}
	expect((await a.submit()).status).toBe(429)
})
it("strips URL secrets and derives identity, country, agent and commit on server", async () => {
	const f = fixture("server-member")
	await f.submit({
		metadata: {
			url: "https://user:pass@goodwatch.app/movie/1?q=ok&code=private&state=private&access_token=private&mcpKey=private&my-secret=private#private",
		},
	})
	const r = [...f.rows.values()][0]
	expect(r.memberId).toBe("server-member")
	expect(r.metadata).toMatchObject({
		url: "/movie/1?q=ok",
		userAgent: "test",
		country: "DE",
		buildCommit: "abc123",
	})
	expect(safePath("/?api_key=x&password=x&session=x&name=ok")).toBe("/?name=ok")
	const guest = fixture()
	await guest.submit()
	expect([...guest.rows.values()][0].memberId).toBeNull()
})
it("sends a tagged forum payload with mentions disabled and sanitized display text", async () => {
	const f = fixture("member")
	await f.submit({
		message: "**broken** https://evil.test @everyone <@123> me@example.com",
		email: "private@example.com",
	})
	const [url, options] = f.deps.send.mock.calls[0]
	expect(String(url)).toContain("wait=true")
	expect(options?.signal).toBeDefined()
	const payload = JSON.parse(options!.body as string)
	expect(payload).toMatchObject({
		thread_name: expect.any(String),
		applied_tags: ["789"],
		allowed_mentions: { parse: [] },
	})
	for (const forbidden of [
		"https://",
		"@everyone",
		"<@123>",
		"**",
		"private@example.com",
		"me@example.com",
	])
		expect(JSON.stringify(payload)).not.toContain(forbidden)
	expect(f.deps.store.discordId).toHaveBeenCalledWith(
		expect.any(String),
		"123",
		"456",
	)
	expect(f.deps.email).not.toHaveBeenCalled()
})
it("emails on Discord failure/unset webhook, always emails contact and retains rows on delivery failure", async () => {
	const failed = fixture()
	failed.deps.send.mockRejectedValue(new Error("timeout"))
	expect((await failed.submit()).status).toBe(200)
	expect(failed.deps.email).toHaveBeenCalledOnce()
	const unset = fixture()
	delete unset.deps.env.FEEDBACK_DISCORD_WEBHOOK_URL
	expect((await unset.submit()).status).toBe(200)
	expect(unset.deps.email).toHaveBeenCalledOnce()
	expect(unset.deps.send).not.toHaveBeenCalled()
	const contact = fixture()
	await contact.submit({ kind: "contact", email: "sender@example.com" })
	expect(contact.deps.email).toHaveBeenCalledWith(
		expect.objectContaining({ email: "sender@example.com" }),
	)
	const both = fixture()
	both.deps.send.mockRejectedValue(new Error())
	both.deps.email.mockRejectedValue(new Error())
	expect((await both.submit()).status).toBe(200)
	expect(both.rows.size).toBe(1)
})
it("deduplicates concurrent retries before notifying and fails closed on storage failure", async () => {
	const f = fixture()
	const key = { idempotencyKey: "00000000-0000-4000-8000-000000000001" }
	const results = await Promise.all([f.submit(key), f.submit(key)])
	expect(await results[0].json()).toEqual(await results[1].json())
	expect(f.rows.size).toBe(1)
	expect(f.deps.send).toHaveBeenCalledOnce()
	const bad = fixture()
	vi.mocked(bad.deps.store.insert).mockRejectedValue(new Error())
	expect((await bad.submit()).status).toBe(503)
	expect(bad.deps.send).not.toHaveBeenCalled()
})
it("normalizes and attaches screenshots; staff authorization precedes storage access", async () => {
	const f = fixture()
	const jpeg = await sharp({
		create: { width: 8, height: 8, channels: 3, background: "red" },
	})
		.jpeg()
		.toBuffer()
	expect((await f.submit({ screenshot: jpeg.toString("base64") })).status).toBe(
		200,
	)
	const r = [...f.rows.values()][0]
	expect(
		(await sharp(Buffer.from(r.screenshot!, "base64")).metadata()).format,
	).toBe("webp")
	const form = f.deps.send.mock.calls[0][1]!.body as unknown as {
		get(name: string): unknown
	}
	expect(
		JSON.parse(form.get("payload_json") as string).allowed_mentions,
	).toEqual({ parse: [] })
	expect(form.get("files[0]")).toBeTruthy()
	expect((await readScreenshot(r.id, false, f.deps.store)).status).toBe(403)
	expect(f.deps.store.screenshot).not.toHaveBeenCalled()
	const response = await readScreenshot(r.id, true, f.deps.store)
	expect(response.headers.get("cache-control")).toContain("no-store")
	expect(response.headers.get("content-type")).toBe("image/webp")
	expect(
		(await f.submit({ screenshot: Buffer.from("invalid").toString("base64") }))
			.status,
	).toBe(400)
})

it("addresses mail to support with the validated contact sender as Reply-To", async () => {
	const f = fixture()
	await f.submit({ kind: "contact", email: "sender@example.com" })
	const report = f.deps.email.mock.calls[0][0]
	expect(feedbackMail(report)).toMatchObject({
		to: "hello@goodwatch.app",
		from: "GoodWatch <hello@goodwatch.app>",
		replyTo: "sender@example.com",
		text: expect.stringContaining(report.id),
	})
})
