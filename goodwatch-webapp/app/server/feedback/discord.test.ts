// The staff Discord post: both delivery paths (bot with the Details button, webhook with the spoilered details
// line), data report layout, Discord limits, and the staff-only Details answer. Discord is a fake throughout.
import assert from "node:assert/strict"
import { mock, test } from "node:test"
import {
	type Component,
	componentCount,
	EPHEMERAL,
	IS_COMPONENTS_V2,
	textLength,
} from "../discord/cards.ts"
import { routeInteraction } from "../discord/router.server.ts"
import { feedbackDetailsReply, postDiscord } from "./discord.server.ts"
import {
	type PostReport,
	type StoredDetails,
	detailsMessage,
	detailsLine,
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

test("the bot path opens a forum thread with the Details button and no inline technical details", async () => {
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
	assert.equal(details?.custom_id, `gw1:feedback-details:${id}`)
	assert.equal(details?.style, 2)
	const text = texts(components)
	assert.match(text, /### 🐞 Bug/)
	assert.match(
		text,
		/Guest · 🇩🇪 · `\/support\?tab=1` · en-US · dark · <t:1800000000:R>/,
	)
	// Technical details stay behind the button.
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
})

test("when the bot is refused, the webhook posts with only non-interactive components and a spoilered details line", async (t) => {
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
	assert.equal(send.mock.callCount(), 2)
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
	const details = text
		.split("\n")
		.find((line) => line.startsWith("-# Details ||"))
	assert.ok(details?.endsWith("||"))
	for (const shown of [
		id,
		"routes/support",
		"Chrome 141 on macOS, 1440×900 @2x",
		"build `726dea5`",
		"replay `0123456789abcdef0123456789abcdef`",
		"dedupe `cdcdcdcdcdcd`",
		"<t:1800000000:f>",
	])
		assert.ok(details!.includes(shown), shown)
	assert.ok(!text.includes("{"), "no raw JSON")
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
	for (const interactive of [true, false]) {
		const components = reportComponents(long, {
			origin: "https://goodwatch.app",
			interactive,
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
	}
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
				interactive: true,
				screenshotInline: false,
				memberHandle: "film_fan",
			},
		),
	)
	assert.match(text, /Member @​film_fan ·/)
	assert.ok(!text.includes("user-1"))
	assert.ok(!text.includes("a@b.co"))
})

const stored: StoredDetails = {
	id,
	kind: "bug",
	status: "new",
	memberId: "user-1",
	metadata: base.metadata,
	dedupeKey: null,
	duplicateCount: 1,
	hasScreenshot: true,
	createdAt,
}
test("Details answers staff only, ephemerally, and denies by default before reading storage", async () => {
	const load = mock.fn(async (_id: string) => stored)
	const press = (user: string, roles?: string[], guild = "1") => ({
		guild_id: guild,
		member: { user: { id: user }, roles },
	})
	const denied = await feedbackDetailsReply(press("111111111111111111"), id, {
		load,
		env: {},
	})
	assert.equal(denied.outcome, "forbidden")
	assert.equal(denied.data.flags & EPHEMERAL, EPHEMERAL)
	assert.equal(load.mock.callCount(), 0)

	const byUser = await feedbackDetailsReply(press("111111111111111111"), id, {
		load,
		env: {
			DISCORD_FEEDBACK_STAFF_USER_IDS: "222222222222222222, 111111111111111111",
		},
	})
	assert.equal(byUser.outcome, "ok")
	assert.equal(byUser.data.flags, IS_COMPONENTS_V2 | EPHEMERAL)
	const text = texts(byUser.data.components)
	for (const shown of [
		id,
		"`user-1`",
		"routes/support",
		"Chrome 141 on macOS",
		"Mozilla/5.0",
		"726dea582abc",
		"0123456789abcdef",
	])
		assert.ok(text.includes(shown), shown)
	assert.equal(
		buttons(byUser.data.components).find((b) => b.label === "Screenshot")?.url,
		`https://goodwatch.app/api/feedback/${id}/screenshot`,
	)

	const roleEnv = { DISCORD_FEEDBACK_STAFF_ROLE_IDS: "333333333333333333" }
	assert.equal(
		(
			await feedbackDetailsReply(press("4", ["333333333333333333"]), id, {
				load,
				env: roleEnv,
			})
		).outcome,
		"ok",
	)
	// A role claim outside a server, or a role that isn't listed, is refused.
	assert.equal(
		(
			await feedbackDetailsReply(
				{ user: { id: "4" }, member: { roles: ["333333333333333333"] } },
				id,
				{ load, env: roleEnv },
			)
		).outcome,
		"forbidden",
	)
	assert.equal(
		(await feedbackDetailsReply(press("4", ["5"]), id, { load, env: roleEnv }))
			.outcome,
		"forbidden",
	)
	const staff = { DISCORD_FEEDBACK_STAFF_USER_IDS: "111111111111111111" }
	assert.equal(
		(
			await feedbackDetailsReply(press("111111111111111111"), id, {
				load: async () => null,
				env: staff,
			})
		).outcome,
		"missing",
	)
	t_quiet()
	assert.equal(
		(
			await feedbackDetailsReply(press("111111111111111111"), id, {
				load: async () => {
					throw new Error("RelationUnknown")
				},
				env: staff,
			})
		).outcome,
		"error",
	)
})
let restoreConsole: (() => void) | undefined
function t_quiet() {
	const original = console.error
	console.error = () => {}
	restoreConsole = () => {
		console.error = original
	}
}
test.afterEach(() => restoreConsole?.())

test("the interactions endpoint routes Details presses before the member rate limit", async () => {
	const take = mock.fn(async () => ({ allowed: true }))
	const answer = await routeInteraction(
		{
			type: 3,
			guild_id: "1",
			member: { user: { id: "111111111111111111" } },
			data: { custom_id: `gw1:feedback-details:${id}` },
		},
		{
			take: take as never,
			log: () => {},
			feedbackDetails: async () => stored,
			env: { DISCORD_FEEDBACK_STAFF_USER_IDS: "111111111111111111" },
		},
	)
	assert.equal(answer.type, 4)
	const data = answer.data as { flags: number; components: Component[] }
	assert.equal(data.flags, IS_COMPONENTS_V2 | EPHEMERAL)
	assert.match(texts(data.components), /Report details/)
	assert.equal(take.mock.callCount(), 0)
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
	for (const interactive of [true, false]) {
		const options = {
			origin: "https://goodwatch.app",
			interactive,
			screenshotInline: false,
		}
		for (const components of [
			reportComponents(report, options),
			duplicateComponents(report, 5, options),
		]) {
			assert.ok(textLength(components) <= 4000)
			assert.ok(componentCount(components) <= 40)
		}
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
		interactive: false,
		screenshotInline: false,
	})
	const detail = detailsMessage(
		{ ...stored, metadata: report.metadata },
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
	assert.equal(detailsLine(report).split("||").length, 3)
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
				interactive: false,
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
			interactive: false,
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
					interactive: false,
					screenshotInline: false,
				},
			),
		)
	}
})
