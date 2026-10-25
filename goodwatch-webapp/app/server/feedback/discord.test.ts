import assert from "node:assert/strict"
import { mock, test } from "node:test"
import {
	type Component,
	componentCount,
	IS_COMPONENTS_V2,
	textLength,
} from "../discord/cards.ts"
import { postDiscord } from "./discord.server.ts"
import {
	type PostReport,
	detailsMessage,
	SUPPRESS_NOTIFICATIONS,
	duplicateComponents,
	deviceName,
	memberText,
	reportComponents,
	threadName,
} from "./discord-post.ts"

const id = "ab".repeat(32)
const createdAt = 1800000000000
const base: PostReport = {
	id,
	kind: "bug",
	message: "The search box loses focus after typing.",
	metadata: {
		url: "/support?tab=1",
		routeId: "routes/support",
		locale: "en-US",
		colorScheme: "dark",
		userAgent:
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
		country: "DE",
		buildCommit: "726dea582abc",
		viewport: { width: 1440, height: 900 },
		dpr: 2,
		sentryReplayId: "0123456789abcdef0123456789abcdef",
	},
	memberId: null,
	createdAt,
	dedupeKey: null,
}
const theBear: PostReport = {
	...base,
	kind: "data",
	message: "Hulu has The Bear in the US but it's not listed.",
	data: {
		entityKind: "show",
		entityName: "The Bear",
		ids: { tmdb_id: 136315, imdb_id: "tt14452776" },
		field: "providers",
		currentValue: "Disney+",
		suggestedValue: "Disney+, Hulu",
		country: "US",
		sourceLink: "https://www.justwatch.com/us/tv-show/the-bear",
	},
	metadata: { ...base.metadata, url: "/show/136315-the-bear" },
	dedupeKey: "cd".repeat(32),
}
const webhookEnv = {
	APP_ORIGIN: "https://goodwatch.app",
	DISCORD_FEEDBACK_WEBHOOK_URL: "https://discord.com/api/webhooks/1/token",
	DISCORD_FEEDBACK_TAG_IDS: '{"bug":"11","data":"22"}',
}
const botEnv = {
	...webhookEnv,
	DISCORD_BOT_TOKEN: "bot-token",
	DISCORD_FEEDBACK_FORUM_CHANNEL_ID: "123456789012345678",
}
const ok = (body: unknown) =>
	mock.fn(
		async (_url: string | URL | Request, _init?: RequestInit) =>
			new Response(JSON.stringify(body)),
	)
const all = (components: Component[]): Component[] =>
	components.flatMap((c) => [
		c,
		...all(c.components ?? []),
		...(c.accessory ? all([c.accessory]) : []),
	])
const texts = (components: Component[]) =>
	all(components)
		.filter((c) => c.type === 10)
		.map((c) => String(c.content))
		.join("\n")
const buttons = (components: Component[]) =>
	all(components).filter((c) => c.type === 2)

test("the bot path opens a forum thread without Details controls and posts a quiet first reply", async () => {
	const send = ok({
		id: "999999999999999999",
		message: { id: "888888888888888888" },
	})
	const receipt = await postDiscord(
		base,
		botEnv,
		send as unknown as typeof fetch,
	)
	assert.deepEqual(receipt, {
		id: "888888888888888888",
		channel_id: "999999999999999999",
	})
	const [url, init] = send.mock.calls[0].arguments
	assert.equal(
		String(url),
		"https://discord.com/api/v10/channels/123456789012345678/threads",
	)
	assert.equal(
		(init!.headers as Record<string, string>).Authorization,
		"Bot bot-token",
	)
	const payload = JSON.parse(init!.body as string)
	assert.equal(payload.name, "Bug: The search box loses focus after typing.")
	assert.deepEqual(payload.applied_tags, ["11"])
	assert.equal(payload.message.flags, undefined)
	const edit = send.mock.calls[1].arguments[1]!
	assert.equal(edit.method, "PATCH")
	const edited = JSON.parse(edit.body as string)
	assert.equal(edited.content, null)
	assert.equal(edited.flags, IS_COMPONENTS_V2)
	assert.deepEqual(payload.message.allowed_mentions, { parse: [] })
	const components = edited.components as Component[]
	const details = buttons(components).find((b) => b.label === "Details")
	assert.equal(details, undefined)
	assert.doesNotMatch(texts(components), /-# Details|\|\|/)
	assert.equal(send.mock.callCount(), 3)
	const follow = send.mock.calls[2].arguments
	assert.equal(
		follow[0],
		"https://discord.com/api/v10/channels/999999999999999999/messages",
	)
	assert.deepEqual(
		JSON.parse(follow[1]!.body as string),
		detailsMessage(base, "https://goodwatch.app"),
	)
	const text = texts(components)
	assert.match(text, /### 🐞 Bug/)
	assert.match(
		text,
		/Guest · 🇩🇪 · `\/support\?tab=1` · en-US · dark · <t:1800000000:R>/,
	)
	// Technical details appear in the reply only.
	for (const hidden of [
		id,
		"routes/support",
		"726dea5",
		"Chrome",
		"0123456789abcdef",
	])
		assert.ok(!text.includes(hidden), hidden)
	assert.equal(
		buttons(components).find((b) => b.label === "Open page")?.url,
		"https://goodwatch.app/support?tab=1",
	)
})

test("the bot path puts a screenshot in a media gallery and a duplicate replies in its thread", async () => {
	const send = ok({ id: "999999999999999999" })
	await postDiscord(
		{ ...base, screenshot: Buffer.from("webp").toString("base64") },
		botEnv,
		send as unknown as typeof fetch,
	)
	const form = send.mock.calls[1].arguments[1]!.body as unknown as {
		get(name: string): unknown
	}
	const payload = JSON.parse(form.get("payload_json") as string)
	assert.deepEqual(payload.attachments, [
		{ id: 0, filename: "screenshot.webp" },
	])
	assert.ok(form.get("files[0]"))
	const gallery = all(payload.components).find((c) => c.type === 12)
	assert.deepEqual((gallery?.items as { media: unknown }[])[0].media, {
		url: "attachment://screenshot.webp",
	})

	const reply = ok({
		id: "777777777777777777",
		channel_id: "666666666666666666",
	})
	await postDiscord(theBear, botEnv, reply as unknown as typeof fetch, {
		count: 3,
		threadId: "666666666666666666",
	})
	const [url, init] = reply.mock.calls[0].arguments
	assert.equal(
		String(url),
		"https://discord.com/api/v10/channels/666666666666666666/messages",
	)
	const body = JSON.parse(init!.body as string)
	assert.equal(body.flags, IS_COMPONENTS_V2)
	const text = texts(body.components)
	assert.match(text, /\*\*\+1 duplicate\*\* \(3 total\)/)
	assert.match(text, /they see Disney\+/)
	assert.match(text, /source justwatch\.com/)
	assert.ok(text.includes(`-# Report \`${theBear.id}\``))
	assert.equal(reply.mock.callCount(), 1)
})

test("when the bot is refused, the webhook posts the starter then the details in the same thread", async (t) => {
	t.mock.method(console, "error", () => {})
	const send = mock.fn(
		async (url: string | URL | Request, _init?: RequestInit) =>
			String(url).includes("/channels/")
				? new Response("Missing Access", { status: 403 })
				: new Response(JSON.stringify({ id: "1", channel_id: "2" })),
	)
	const receipt = await postDiscord(
		theBear,
		botEnv,
		send as unknown as typeof fetch,
	)
	assert.deepEqual(receipt, { id: "1", channel_id: "2" })
	assert.equal(send.mock.callCount(), 3)
	const [url, init] = send.mock.calls[1].arguments
	const query = new URL(String(url)).searchParams
	assert.equal(query.get("wait"), "true")
	assert.equal(query.get("with_components"), "true")
	const payload = JSON.parse(init!.body as string)
	assert.equal(payload.thread_name, "Data fix: The Bear · Where to watch")
	assert.deepEqual(payload.applied_tags, ["22"])
	assert.equal(payload.flags, IS_COMPONENTS_V2)
	const components = payload.components as Component[]
	// Only link buttons: a webhook the bot doesn't own may not send interactive components.
	assert.ok(buttons(components).every((b) => b.style === 5 && !b.custom_id))
	assert.deepEqual(
		buttons(components).map((b) => [b.label, b.url]),
		[
			["Open page", "https://goodwatch.app/show/136315-the-bear"],
			["TMDB", "https://www.themoviedb.org/tv/136315"],
			["IMDb", "https://www.imdb.com/title/tt14452776/"],
			[
				"Source · justwatch.com",
				"https://www.justwatch.com/us/tv-show/the-bear",
			],
		],
	)
	const text = texts(components)
	assert.match(text, /### 🛠️ Data fix · The Bear/)
	assert.match(text, /\*\*Where to watch\*\* in the United States 🇺🇸\n/)
	assert.match(text, /> Was: Disney\+\n> Now: \*\*Disney\+, Hulu\*\*/)
	assert.doesNotMatch(text, /-# Details|\|\|/)
	assert.ok(!text.includes(id))
	const follow = send.mock.calls[2].arguments
	assert.equal(new URL(String(follow[0])).searchParams.get("thread_id"), "2")
	assert.deepEqual(
		JSON.parse(follow[1]!.body as string),
		detailsMessage(theBear, "https://goodwatch.app"),
	)
})

test("everything stays within Discord's limits, and member text can't link, mention or format", () => {
	const long: PostReport = {
		...theBear,
		message: `**bold** @everyone <@123> <t:1:R> https://evil.test me@example.com # head\n\n\n\n${"x".repeat(12000)}`,
		data: {
			...theBear.data!,
			entityName: "N".repeat(200),
			currentValue: "v".repeat(4000),
			suggestedValue: "w".repeat(4000),
			sourceLink: `https://example.com/${"a".repeat(1000)}`,
		},
		metadata: { ...theBear.metadata, url: `/${"p".repeat(3000)}` },
	}
	const components = reportComponents(long, {
		origin: "https://goodwatch.app",
		screenshotInline: false,
	})
	assert.ok(textLength(components) <= 4000)
	assert.ok(componentCount(components) <= 40)
	for (const b of buttons(components)) {
		assert.ok(String(b.label).length <= 80)
		if (b.url) assert.ok(String(b.url).length <= 512)
	}
	// The 1000-character source is too long for a button and is left out.
	assert.ok(
		!buttons(components).some((b) => String(b.label).startsWith("Source")),
	)
	assert.ok(threadName(long).length <= 100)
	assert.ok(
		threadName({ ...base, message: "y".repeat(500) }, "Design test: ").length <=
			100,
	)
	const text = memberText(long.message)
	for (const forbidden of [
		"**",
		"@everyone",
		"<@123",
		"evil.test",
		"me@example.com",
		"\n\n\n",
	])
		assert.ok(!text.includes(forbidden), forbidden)
	// Every angle bracket is escaped, so mention and timestamp syntax shows as typed.
	assert.doesNotMatch(text, /(?<!\\)</)
	assert.ok(text.endsWith("…"))
	assert.equal(
		deviceName(
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
		),
		"Safari 17 on iOS",
	)
	assert.equal(deviceName("curl/8"), null)
})

test("a signed-in member shows by public handle only, never by id or email", () => {
	const text = texts(
		reportComponents(
			{ ...base, memberId: "user-1", email: "a@b.co" } as PostReport,
			{
				origin: "https://goodwatch.app",
				screenshotInline: false,
				memberHandle: "film_fan",
			},
		),
	)
	assert.match(text, /Member @​film_fan ·/)
	assert.ok(!text.includes("user-1"))
	assert.ok(!text.includes("a@b.co"))
})

test("details reply uses compact V2 with code values, a staff screenshot link, and no notifications", () => {
	const report = { ...theBear, memberId: "user-1", screenshot: "webp" }
	const reply = detailsMessage(report, "https://goodwatch.app")
	assert.equal(reply.flags, IS_COMPONENTS_V2 | SUPPRESS_NOTIFICATIONS)
	assert.equal(reply.flags & 64, 0, "not ephemeral")
	assert.deepEqual(reply.allowed_mentions, { parse: [] })
	const text = texts(reply.components)
	for (const value of [
		id,
		"user-1",
		"/show/136315-the-bear",
		"routes/support",
		"Chrome 141 on macOS · 1440×900 2x",
		"en-US",
		"dark",
		"DE",
		"726dea582abc",
		"2027-01-15T08:00:00.000Z",
		"0123456789abcdef0123456789abcdef",
		"cd".repeat(32),
	]) {
		assert.ok(text.includes(`\`${value}\``), value)
	}
	assert.ok(!text.includes("{"), "no raw JSON")
	assert.equal(
		buttons(reply.components).find((b) => b.label === "Screenshot")?.url,
		`https://goodwatch.app/api/feedback/${id}/screenshot`,
	)
	assert.ok(
		!buttons(detailsMessage(base, "https://goodwatch.app").components).some(
			(b) => b.label === "Screenshot",
		),
	)
})

test("escaped text and quote prefixes fit the V2 budget for maximal reports", () => {
	const report: PostReport = {
		...theBear,
		message: "*\n".repeat(5000),
		memberId: "m".repeat(64),
		data: {
			...theBear.data!,
			entityName: "*".repeat(200),
			field: "*".repeat(200),
			currentValue: "*".repeat(4000),
			suggestedValue: "*".repeat(4000),
			providerIds: Array.from({ length: 50 }, (_, i) => i + 1),
		},
		metadata: {
			...base.metadata,
			routeId: "*".repeat(200),
			url: "/" + "*".repeat(4000),
		},
	}
	const options = {
		origin: "https://goodwatch.app",
		screenshotInline: false,
	}
	for (const components of [
		reportComponents(report, options),
		duplicateComponents(report, 5, options),
		detailsMessage(report, options.origin).components,
	]) {
		assert.ok(textLength(components) <= 4000)
		assert.ok(componentCount(components) <= 40)
	}
	assert.ok(memberText("*".repeat(2400)).length <= 2400)
	assert.doesNotMatch(memberText("*".repeat(2400)), /(?<!\\)\\…$/)
})

test("untrusted fields and technical details cannot expose emails, secrets or spoiler delimiters", () => {
	const attack =
		"|| [click](https://evil/path) @everyone private@example.com token=secret-value \\`"
	const report = {
		...theBear,
		data: { ...theBear.data!, field: attack },
		metadata: {
			...base.metadata,
			routeId: attack,
			userAgent: attack,
			locale: attack,
		},
	}
	const components = reportComponents(report, {
		origin: "https://goodwatch.app",
		screenshotInline: false,
	})
	const detail = detailsMessage(
		{ ...base, metadata: report.metadata },
		"https://goodwatch.app",
	)
	const output = JSON.stringify([components, detail, threadName(report)])
	for (const forbidden of [
		"private@example.com",
		"secret-value",
		"https://evil",
		"@everyone",
		"[click](",
	])
		assert.ok(!output.includes(forbidden), forbidden)
	assert.ok(!JSON.stringify(detail).includes("||"))
})

test("link buttons validate URLs and remove secret queries and credentials", () => {
	for (const sourceLink of [
		"javascript:alert(1)",
		"https://",
		"https://example.com/?email=private%40example.com",
	]) {
		const components = reportComponents(
			{ ...theBear, data: { ...theBear.data!, sourceLink } },
			{
				origin: "https://goodwatch.app",
				screenshotInline: false,
			},
		)
		assert.ok(
			!buttons(components).some((b) => String(b.label).startsWith("Source")),
		)
	}
	const components = reportComponents(
		{
			...theBear,
			data: {
				...theBear.data!,
				sourceLink:
					"https://user:secret@example.com/page?token=private&ok=1#secret",
			},
		},
		{
			origin: "https://goodwatch.app",
			screenshotInline: false,
		},
	)
	assert.equal(
		buttons(components).find((b) => String(b.label).startsWith("Source"))?.url,
		"https://example.com/page?ok=1",
	)
})

test("data fields that match Object prototype keys remain ordinary member text", () => {
	for (const field of ["constructor", "toString", "__proto__"]) {
		assert.doesNotThrow(() =>
			reportComponents(
				{ ...theBear, data: { ...theBear.data!, field } },
				{
					origin: "https://goodwatch.app",
					screenshotInline: false,
				},
			),
		)
	}
})

test("technical values are individually capped and ignore unrequested metadata and email", () => {
	const long = "x".repeat(10000)
	const reply = detailsMessage(
		{
			...base,
			memberId: long,
			dedupeKey: long,
			metadata: Object.fromEntries(
				[
					"url",
					"routeId",
					"userAgent",
					"locale",
					"colorScheme",
					"country",
					"buildCommit",
					"sentryReplayId",
					"email",
					"cookies",
				].map((key) => [key, key === "url" ? "/" + long : long]),
			),
			email: "member@example.com",
		} as PostReport,
		"https://goodwatch.app",
	)
	const text = texts(reply.components)
	assert.ok(textLength(reply.components) <= 4000)
	assert.ok(componentCount(reply.components) <= 40)
	assert.ok(text.includes(`**Member id** \`${"x".repeat(63)}…\``))
	assert.ok(text.includes(`**User agent** \`${"x".repeat(299)}…\``))
	assert.ok(!text.includes("email"))
	assert.ok(!text.includes("cookies"))
	assert.ok(!text.includes("member@example.com"))
})
