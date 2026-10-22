import assert from "node:assert/strict"
import { generateKeyPairSync, sign } from "node:crypto"
import { test } from "node:test"
import { handleInteraction } from "./endpoint.server.ts"
import { verifySignature } from "./verify.server.ts"
import {
	componentCount,
	EPHEMERAL,
	IS_COMPONENTS_V2,
	message,
	titleCard,
	type GuestTitle,
} from "./cards.ts"
import { formatCustomId, parseCustomId } from "./custom-id.ts"
import { localeCountry } from "./country.ts"
import { discordRest } from "./rest.server.ts"
import type { Dependencies, Interaction } from "./router.server.ts"
const keys = generateKeyPairSync("ed25519")
const publicKey = keys.publicKey
	.export({ format: "der", type: "spki" })
	.subarray(-32)
	.toString("hex")
const title: GuestTitle = {
	id: "movie:42",
	name: "A title",
	year: 2024,
	goodwatch_score: 95.9,
	runtime_minutes: 120,
	genres: ["Drama"],
	synopsis: "A story. ".repeat(80),
	poster_url: "https://image.tmdb.org/t/p/w342/poster.jpg",
	availability: {
		state: "watchable",
		offers: [
			{
				name: "Provider",
				stream_link: "[Provider](https://example.com/watch)",
				offer_type: "flatrate",
			},
		],
	},
}
function signed(
	value: unknown,
	corrupt = false,
	timestamp = String(Math.floor(Date.now() / 1000)),
) {
	const body = JSON.stringify(value)
	const signature = sign(
		null,
		Buffer.from(timestamp + body),
		keys.privateKey,
	).toString("hex")
	return new Request("https://goodwatch.app/api/discord/interactions", {
		method: "POST",
		headers: {
			"X-Signature-Timestamp": timestamp,
			"X-Signature-Ed25519": corrupt ? "00".repeat(64) : signature,
		},
		body,
	})
}
const interaction = (
	type: number,
	data: Interaction["data"] = {},
): Interaction => ({
	type,
	data,
	user: { id: "test-user" },
	application_id: "test-app",
	token: "test-token",
	locale: "de",
	context: 0,
})
function fixture(overrides: Partial<Dependencies> = {}) {
	const logs: string[] = [],
		reads: unknown[] = [],
		edits: unknown[] = []
	const dependencies: Dependencies = {
		read: async (viewer, origin, name, args) => {
			reads.push({ viewer, origin, name, args })
			return name === "search_titles"
				? { items: Array.from({ length: 30 }, () => title) }
				: { title }
		},
		take: async () => ({ allowed: true, store: "memory" }),
		edit: async (...args) => {
			edits.push(args)
		},
		log: (line) => {
			logs.push(line)
		},
		...overrides,
	}
	return {
		logs,
		reads,
		edits,
		dependencies,
		run: (value: unknown) =>
			handleInteraction(signed(value), { publicKey, dependencies }),
	}
}
test("Ed25519 verifies exact timestamp and raw body with a generated key", async () => {
	const request = signed({ type: 1 }),
		body = await request.text()
	assert.equal(
		verifySignature(
			publicKey,
			request.headers.get("X-Signature-Ed25519"),
			request.headers.get("X-Signature-Timestamp"),
			body,
		),
		true,
	)
	assert.equal(
		verifySignature(
			publicKey,
			request.headers.get("X-Signature-Ed25519"),
			"changed",
			body,
		),
		false,
	)
	assert.equal(
		verifySignature(
			publicKey,
			request.headers.get("X-Signature-Ed25519"),
			request.headers.get("X-Signature-Timestamp"),
			`${body} `,
		),
		false,
	)
	assert.equal(verifySignature("invalid", "invalid", "1", body), false)
})
test("signed PING, bad and absent signatures, unset key and methods", async () => {
	const f = fixture()
	assert.deepEqual(await (await f.run({ type: 1 })).json(), { type: 1 })
	assert.equal(f.logs.length, 1)
	assert.equal(
		(await handleInteraction(signed({ type: 1 }, true), { publicKey })).status,
		401,
	)
	assert.equal(
		(
			await handleInteraction(
				new Request("https://example.com", { method: "POST" }),
				{ publicKey },
			)
		).status,
		401,
	)
	assert.equal(
		(await handleInteraction(signed({ type: 1 }), { publicKey: "" })).status,
		503,
	)
	assert.equal(
		(await handleInteraction(new Request("https://example.com"), { publicKey }))
			.status,
		405,
	)
})
test("autocomplete caps choices, uses plain guest reads and logs no query", async () => {
	const f = fixture()
	const body = await (
		await f.run(
			interaction(4, {
				name: "search",
				options: [{ name: "title", value: "private query", focused: true }],
			}),
		)
	).json()
	assert.equal(body.type, 8)
	assert.equal(body.data.choices.length, 25)
	assert.equal(body.data.choices[0].value, "movie:42")
	assert.match(JSON.stringify(f.reads), /search_titles/)
	assert.doesNotMatch(f.logs[0], /private query|test-user|A title/)
})
test("autocomplete timeout returns an empty list within the deadline", async () => {
	const f = fixture({ read: () => new Promise(() => {}) })
	const start = Date.now()
	const body = await (
		await f.run(
			interaction(4, {
				name: "search",
				options: [{ name: "title", value: "title", focused: true }],
			}),
		)
	).json()
	assert.deepEqual(body, { type: 8, data: { choices: [] } })
	assert.ok(Date.now() - start < 2800)
})
for (const value of ["movie:42", "A title"])
	test(`search defers then patches an ephemeral card: ${value}`, async () => {
		let done!: () => void
		const finished = new Promise<void>((resolve) => {
			done = resolve
		})
		const f = fixture({ log: () => done() })
		const body = await (
			await f.run(
				interaction(2, { name: "search", options: [{ name: "title", value }] }),
			)
		).json()
		assert.deepEqual(body, { type: 5, data: { flags: EPHEMERAL } })
		await finished
		assert.equal(
			(f.edits[0] as [string, string, { flags: number }])[2].flags,
			IS_COMPONENTS_V2 | EPHEMERAL,
		)
		assert.equal(f.reads.length, value === "movie:42" ? 1 : 2)
	})
test("failed deferred work replaces thinking with an error card", async () => {
	let done!: () => void
	const finished = new Promise<void>((r) => {
		done = r
	})
	const f = fixture({
		read: async () => {
			throw new Error("private data")
		},
		log: () => done(),
	})
	await f.run(
		interaction(2, {
			name: "search",
			options: [{ name: "title", value: "movie:42" }],
		}),
	)
	await finished
	assert.match(JSON.stringify(f.edits), /Something went wrong/)
	assert.doesNotMatch(JSON.stringify(f.edits), /private data/)
})
test("Where to watch defers the update then patches country offers", async () => {
	let done!: () => void
	const finished = new Promise<void>((resolve) => {
		done = resolve
	})
	const f = fixture({ log: () => done() })
	const body = await (
		await f.run(
			interaction(3, { custom_id: formatCustomId("watch", "movie:42") }),
		)
	).json()
	assert.deepEqual(body, { type: 6 })
	await finished
	assert.equal(
		(f.edits[0] as [string, string, { flags: number }])[2].flags,
		IS_COMPONENTS_V2,
	)
	assert.match(JSON.stringify(f.edits), /https:\/\/example.com\/watch/)
	assert.match(JSON.stringify(f.edits), /DE/)
})
test("Share defers publicly then patches a guest card without Share", async () => {
	let done!: () => void
	const finished = new Promise<void>((resolve) => {
		done = resolve
	})
	const f = fixture({ log: () => done() })
	const body = await (
		await f.run(
			interaction(3, { custom_id: formatCustomId("share", "movie:42") }),
		)
	).json()
	assert.deepEqual(body, { type: 5, data: { flags: 0 } })
	await finished
	assert.equal(
		(f.edits[0] as [string, string, { flags: number }])[2].flags,
		IS_COMPONENTS_V2,
	)
	assert.doesNotMatch(JSON.stringify(f.edits), /Share to channel|member|match/)
	assert.deepEqual(f.reads, [
		{
			viewer: { country: "DE" },
			origin: "https://goodwatch.app",
			name: "get_title",
			args: { title_id: "movie:42" },
		},
	])
})
test("rate limits produce a retry card; autocomplete stays type 8", async () => {
	const f = fixture({
		take: async () => ({
			allowed: false,
			store: "memory",
			retryAfterSeconds: 60,
		}),
	})
	assert.match(
		JSON.stringify(await (await f.run(interaction(2))).json()),
		/Slow down.*60/,
	)
	assert.deepEqual(await (await f.run(interaction(4))).json(), {
		type: 8,
		data: { choices: [] },
	})
	assert.equal(f.reads.length, 0)
})
test("unsupported modal and malformed component return ephemeral errors", async () => {
	const f = fixture()
	for (const value of [
		interaction(5),
		interaction(3, { custom_id: "gw2:watch:movie:42" }),
	]) {
		const body = await (await f.run(value)).json()
		assert.equal(body.type, 4)
		assert.equal(body.data.flags, IS_COMPONENTS_V2 | EPHEMERAL)
	}
})
test("cards have thumbnail, score label, two overview lines, rows and safe mentions", () => {
	const card = titleCard(title, "DE")
	assert.equal(card.flags, IS_COMPONENTS_V2 | EPHEMERAL)
	assert.equal(card.components[0].type, 9)
	assert.match(JSON.stringify(card), /95\/100 · Masterpiece/)
	assert.equal(String(card.components[1].content).split("\n").length, 2)
	assert.equal(card.components.at(-1)?.type, 1)
	assert.ok(componentCount(card.components) <= 40)
	assert.doesNotMatch(JSON.stringify(card), /"embeds"|"Similar"/)
	assert.deepEqual(card.allowed_mentions, { parse: [] })
	assert.match(
		JSON.stringify(titleCard({ ...title, availability: undefined }, "US")),
		/Availability unknown/,
	)
})
test("40 component cap counts nested components and accessories", () => {
	assert.doesNotThrow(() =>
		message(Array.from({ length: 40 }, () => ({ type: 10, content: "a" }))),
	)
	assert.throws(
		() =>
			message([
				{
					type: 9,
					components: Array.from({ length: 39 }, () => ({ type: 10 })),
					accessory: { type: 11 },
				},
			]),
		/limit/,
	)
})
test("custom IDs are versioned, bounded, and reject invalid titles", () => {
	assert.deepEqual(parseCustomId(formatCustomId("share", "show:123")), {
		action: "share",
		titleId: "show:123",
	})
	for (const id of [
		"gw2:share:show:123",
		"gw1:unknown:show:123",
		"gw1:share:movie:0",
		"x".repeat(101),
	])
		assert.equal(parseCustomId(id), null)
	assert.throws(() => formatCustomId("watch", "movie:1" + "0".repeat(100)))
})
test("locale country mapping and fallback", () => {
	for (const [locale, country] of Object.entries({
		"en-US": "US",
		"en-GB": "GB",
		de: "DE",
		fr: "FR",
		"es-ES": "ES",
		"es-419": "MX",
		"pt-BR": "BR",
		"sv-SE": "SE",
		ja: "JP",
		ko: "KR",
		"zh-CN": "CN",
		"zh-TW": "TW",
		unknown: "US",
	}))
		assert.equal(localeCountry(locale), country)
	assert.equal(localeCountry(), "US")
})
test("REST retries twice on 429, respects delay and keeps webhook auth separate", async () => {
	const calls: { url: string; init?: RequestInit }[] = [],
		delays: number[] = []
	const rest = discordRest({
		botToken: "test-token",
		fetch: async (url, init) => {
			calls.push({ url: String(url), init })
			return calls.length < 3
				? Response.json({ retry_after: 0.1 }, { status: 429 })
				: new Response(null, { status: 204 })
		},
		sleep: async (ms) => {
			delays.push(ms)
		},
	})
	await rest.editOriginal("app", "token", { flags: IS_COMPONENTS_V2 })
	assert.deepEqual(delays, [100, 100])
	assert.equal(
		calls[0].url,
		"https://discord.com/api/v10/webhooks/app/token/messages/@original",
	)
	assert.equal(new Headers(calls[0].init?.headers).has("Authorization"), false)
	await rest.request("PUT", "/applications/app/commands", [], true)
	assert.equal(
		new Headers(calls[3].init?.headers).get("Authorization"),
		"Bot test-token",
	)
	await rest.followup("app", "token", {})
	assert.equal(calls[4].init?.method, "POST")
})
test("REST stops after two retries and surfaces errors", async () => {
	let count = 0
	const rest = discordRest({
		fetch: async () => {
			count++
			return Response.json({ retry_after: 0 }, { status: 429 })
		},
		sleep: async () => {},
	})
	await assert.rejects(rest.editOriginal("app", "token", {}), /429/)
	assert.equal(count, 3)
})

test("Where to watch on a shared card keeps its public flags and omits Share", async () => {
	let done!: () => void
	const finished = new Promise<void>((resolve) => {
		done = resolve
	})
	const f = fixture({ log: () => done() })
	const value = {
		...interaction(3, { custom_id: formatCustomId("watch", "movie:42") }),
		message: { flags: IS_COMPONENTS_V2 },
	}
	const body = await (await f.run(value)).json()
	assert.deepEqual(body, { type: 6 })
	await finished
	assert.equal(
		(f.edits[0] as [string, string, { flags: number }])[2].flags,
		IS_COMPONENTS_V2,
	)
	assert.doesNotMatch(JSON.stringify(f.edits), /Share to channel/)
})
test("interaction responses work with Remix's Response without static json", async () => {
	const json = Response.json
	try {
		Object.defineProperty(Response, "json", {
			configurable: true,
			writable: true,
			value: undefined,
		})
		assert.deepEqual(await (await fixture().run({ type: 1 })).json(), {
			type: 1,
		})
	} finally {
		Object.defineProperty(Response, "json", {
			configurable: true,
			writable: true,
			value: json,
		})
	}
})

for (const query of ["", " ", "a", " a "])
	test(`short autocomplete skips catalog reads: ${JSON.stringify(query)}`, async () => {
		const f = fixture()
		const body = await (
			await f.run(
				interaction(4, {
					name: "search",
					options: [{ name: "title", value: query, focused: true }],
				}),
			)
		).json()
		assert.deepEqual(body, { type: 8, data: { choices: [] } })
		assert.equal(f.reads.length, 0)
	})
test("autocomplete trims and caps the query at 120 characters", async () => {
	const f = fixture()
	await f.run(
		interaction(4, {
			name: "search",
			options: [{ name: "title", value: " " + "x".repeat(200), focused: true }],
		}),
	)
	assert.deepEqual((f.reads[0] as { args: unknown }).args, {
		query: "x".repeat(120),
		limit: 25,
	})
})
test("rate limiter timeout allows the request and logs limit_timeout", async () => {
	const f = fixture({ take: () => new Promise(() => {}) })
	const body = await (
		await f.run(
			interaction(4, {
				name: "search",
				options: [{ name: "title", value: "title", focused: true }],
			}),
		)
	).json()
	assert.equal(body.data.choices.length, 25)
	assert.equal(f.reads.length, 1)
	assert.equal(f.logs.length, 1)
	assert.match(f.logs[0], /"outcome":"limit_timeout"/)
})
for (const action of ["watch", "share"] as const) {
	test(`${action} acknowledges before a cold title read finishes`, async () => {
		let release!: (value: Record<string, unknown>) => void
		let done!: () => void
		const finished = new Promise<void>((resolve) => {
			done = resolve
		})
		const result = new Promise<Record<string, unknown>>((resolve) => {
			release = resolve
		})
		const f = fixture({ read: () => result, log: () => done() })
		const body = await (
			await f.run(
				interaction(3, { custom_id: formatCustomId(action, "movie:42") }),
			)
		).json()
		assert.deepEqual(
			body,
			action === "watch" ? { type: 6 } : { type: 5, data: { flags: 0 } },
		)
		assert.equal(f.edits.length, 0)
		release({ title })
		await finished
		assert.equal(f.edits.length, 1)
	})
	test(`${action} deferred failures patch a safe error without EPHEMERAL`, async () => {
		let done!: () => void
		const finished = new Promise<void>((resolve) => {
			done = resolve
		})
		const f = fixture({
			read: async () => {
				throw new Error("private data")
			},
			log: () => done(),
		})
		await f.run(
			interaction(3, { custom_id: formatCustomId(action, "movie:42") }),
		)
		await finished
		assert.match(JSON.stringify(f.edits), /Something went wrong/)
		assert.doesNotMatch(JSON.stringify(f.edits), /private data/)
		assert.equal(
			(f.edits[0] as [string, string, { flags: number }])[2].flags,
			IS_COMPONENTS_V2,
		)
	})
}
test("signature timestamp window accepts boundaries and rejects stale, future and malformed timestamps", async () => {
	const seconds = 1_800_000_000
	for (const [timestamp, expected] of [
		[String(seconds), true],
		[String(seconds - 300), true],
		[String(seconds - 301), false],
		[String(seconds + 60), true],
		[String(seconds + 61), false],
		["NaN", false],
		["1e9", false],
		["9".repeat(400), false],
	] as const) {
		const request = signed({ type: 1 }, false, timestamp)
		assert.equal(
			verifySignature(
				publicKey,
				request.headers.get("X-Signature-Ed25519"),
				timestamp,
				await request.text(),
				() => seconds * 1000,
			),
			expected,
			timestamp,
		)
	}
})
test("endpoint rejects correctly signed stale and future requests", async () => {
	for (const offset of [-301, 62]) {
		const request = signed(
			{ type: 1 },
			false,
			String(Math.floor(Date.now() / 1000) + offset),
		)
		assert.equal((await handleInteraction(request, { publicKey })).status, 401)
	}
})
