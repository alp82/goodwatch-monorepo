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
		linkedUser: async () => null,
		storeLinkMessage: async () => "a".repeat(24),
		getGuild: async () => null,
		unlink: async () => {},
		memberRead: async () => {
			throw new Error("Unexpected member read")
		},
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
	assert.match(
		JSON.stringify(f.edits),
		/Where to watch on every service in Germany/,
	)
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
		/### Slow down.*30 commands a minute.*Try again <t:\d+:R>/,
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
test("cards without a backdrop keep the poster thumbnail, score label, short overview, rows and safe mentions", () => {
	const card = titleCard(title, "DE")
	assert.equal(card.flags, IS_COMPONENTS_V2 | EPHEMERAL)
	assert.equal(card.components.length, 1)
	const [section, , , row] = card.components[0].components!
	assert.equal(card.components[0].type, 17)
	assert.equal(card.components[0].accent_color, 0x15803d)
	assert.equal(section.type, 9)
	assert.equal(section.accessory?.type, 11)
	assert.match(JSON.stringify(card), /\*\*95 · Masterpiece\*\*/)
	const overview = String(section.components![1].content)
	assert.equal(overview.split("\n").length, 1)
	assert.ok(overview.length <= 161 && overview.endsWith("…"))
	assert.equal(row.type, 1)
	assert.ok(componentCount(card.components) <= 40)
	assert.doesNotMatch(JSON.stringify(card), /"embeds"/)
	assert.match(JSON.stringify(card), /"Similar"/)
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

test("Where to watch on a shared card creates a private response", async () => {
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
	assert.deepEqual(body, { type: 5, data: { flags: EPHEMERAL } })
	await finished
	assert.equal(
		(f.edits[0] as [string, string, { flags: number }])[2].flags,
		IS_COMPONENTS_V2 | EPHEMERAL,
	)
	assert.match(JSON.stringify(f.edits), /Share to channel/)
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
	test(`short autocomplete skips catalog reads: ${JSON.stringify(
		query,
	)}`, async () => {
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

test("member search: the top block is exactly the shared card, the member's own place sits in the member block", async () => {
	const memberCalls: unknown[] = []
	// Member settings (France, service 8), server settings (UK, service 337) and locale (Germany) all differ.
	const f = fixture({
		linkedUser: async () => "member-id",
		getGuild: async (id) => ({
			guild_id: id,
			country: "GB",
			service_ids: [337],
			digest_channel_id: null,
			updated_by: "admin",
			updated_at: 0,
		}),
		read: async (viewer, origin, name, args) => {
			f.reads.push({ viewer, origin, name, args })
			const { country } = viewer as { country: string }
			return {
				title: {
					...title,
					availability: {
						state: "watchable",
						offers: [
							{
								name: `${country} provider`,
								stream_link: `[${country}](https://example.com/${country})`,
							},
						],
					},
				},
			}
		},
		memberRead: async (id, name, args) => {
			memberCalls.push({ id, name, args })
			return name === "get_settings"
				? { country: "FR", service_ids: [8] }
				: {
						title: {
							...title,
							match: 93,
							match_label: "93% taste match",
							availability: {
								state: "watchable",
								offers: [
									{
										name: "Member provider",
										stream_link: "[M](https://example.com/m)",
									},
								],
							},
						},
						member: {
							score: 9,
							status: "seen",
							watch_count: 1,
							want_to_see: true,
						},
					}
		},
	})
	const guildInteraction = (type: number, data: Interaction["data"]) => ({
		...interaction(type, data),
		guild_id: "guild-1",
	})
	const response = await f.run(
		guildInteraction(2, {
			name: "search",
			options: [{ name: "title", value: "movie:42" }],
		}),
	)
	assert.equal((await response.json()).data.flags, EPHEMERAL)
	for (let i = 0; !f.edits.length && i < 100; i++)
		await new Promise((resolve) => setTimeout(resolve, 5))
	const personal = JSON.stringify(f.edits[0])
	assert.match(personal, /93% taste match/)
	assert.doesNotMatch(personal, /93% · 93%/)
	assert.match(personal, /You rated it \*\*9 · Excellent\*\*/)
	assert.match(personal, /In your Wishlist/)
	const [top, member] = JSON.parse(personal)[2].components
	assert.doesNotMatch(
		JSON.stringify(top),
		/93%|You rated|Wishlist|France|Member provider/,
	)
	assert.match(JSON.stringify(top), /Where to watch in the United Kingdom/)
	assert.match(JSON.stringify(top), /GB provider/)
	assert.equal(member.type, 17)
	assert.equal(member.accent_color, 0xfbbf24)
	assert.match(JSON.stringify(member), /### 93% taste match/)
	assert.match(
		JSON.stringify(member),
		/On your services in France\\n\*\*Member provider\*\*/,
	)
	assert.match(f.logs[0], /"viewer":"member"/)
	assert.deepEqual(memberCalls, [
		{ id: "member-id", name: "get_settings", args: {} },
		{ id: "member-id", name: "get_title", args: { title_id: "movie:42" } },
	])
	const callsBefore = memberCalls.length
	f.reads.length = 0
	await f.run(
		guildInteraction(3, { custom_id: formatCustomId("share", "movie:42") }),
	)
	for (let i = 0; f.edits.length < 2 && i < 100; i++)
		await new Promise((resolve) => setTimeout(resolve, 5))
	assert.equal(memberCalls.length, callsBefore)
	assert.deepEqual(f.reads, [
		{
			viewer: { country: "GB", services: [337] },
			origin: "https://goodwatch.app",
			name: "get_title",
			args: { title_id: "movie:42" },
		},
	])
	const shared = JSON.parse(JSON.stringify(f.edits[1]))[2]
	assert.doesNotMatch(
		JSON.stringify(shared),
		/93%|Excellent taste fit|You rated|Wishlist|Seen|member-id|match_label|want_to_see|France/,
	)
	assert.equal(shared.components.length, 1)
	// Everything but the Share to channel button, which a shared copy never carries.
	const withoutShare = JSON.parse(JSON.stringify(top))
	const row = withoutShare.components.at(-1)
	row.components = row.components.filter(
		(c: { label?: string }) => c.label !== "Share to channel",
	)
	assert.deepEqual(
		shared.components[0],
		withoutShare,
		"the shared card is the personal card's complete top block",
	)
})

test("/link gives guests a link and members an unlink button; /unlink requires confirmation", async () => {
	for (const linked of [false, true]) {
		const removed: unknown[] = []
		const f = fixture({
			storeLinkMessage: async (app, token) => {
				assert.equal(app, "test-app")
				assert.equal(token, "test-token")
				return "a".repeat(24)
			},
			memberHandle: async () => "gwtester",
			linkedUser: async () => (linked ? "member-id" : null),
			unlink: async (target) => {
				removed.push(target)
			},
		})
		const run = async (type: number, data: Interaction["data"]) => {
			const previous = f.edits.length
			const response = await f.run(interaction(type, data))
			const acknowledgement = await response.json()
			if (type === 3) assert.deepEqual(acknowledgement, { type: 6 })
			else assert.equal(acknowledgement.data.flags, EPHEMERAL)
			for (let i = 0; f.edits.length === previous && i < 100; i++)
				await new Promise((resolve) => setTimeout(resolve, 5))
			return JSON.stringify(f.edits[previous])
		}
		const link = await run(2, { name: "link" })
		assert.match(
			link,
			linked ? /Linked to GoodWatch/ : /https:\/\/goodwatch.app\/discord\/link/,
		)
		if (!linked) {
			assert.match(link, /\?n=aaaaaaaaaaaaaaaaaaaaaaaa/)
			continue
		}
		assert.match(link, /gwtester/)
		assert.match(link, /gw:unlink:ask/)
		assert.match(
			await run(2, { name: "unlink" }),
			/Unlink your GoodWatch account/,
		)
		assert.match(await run(3, { custom_id: "gw:unlink:keep" }), /stays linked/)
		assert.equal(removed.length, 0)
		assert.match(await run(3, { custom_id: "gw:unlink:ask" }), /gw:unlink:yes/)
		assert.match(await run(3, { custom_id: "gw:unlink:yes" }), /unlinked/)
		assert.deepEqual(removed, [{ byDiscordUserId: "test-user" }])
	}
})

test("a partly watched show is Watching rather than Seen; sharing strips even supplied personal fields", () => {
	const result = titleCard(
		{ ...title, id: "show:42", match: 90, match_label: "Fit" },
		"DE",
		{ member: { status: "watching", watch_count: 2 } },
	)
	assert.match(JSON.stringify(result), /Watching/)
	const member = result.components.at(-1)!
	assert.doesNotMatch(String(member.components?.[0].content), /\bSeen\b/)
	assert.equal(
		member.components?.[1].components?.find((c) => c.label === "Seen")?.style,
		2,
	)
	const shared = titleCard({ ...title, match: 90, match_label: "Fit" }, "DE", {
		share: true,
		member: { score: 8, status: "seen" },
	})
	assert.doesNotMatch(JSON.stringify(shared), /90%|Rated|Seen|Fit/)
})

for (const failure of ["reject", "timeout"])
	for (const data of [
		{
			type: 2,
			data: { name: "search", options: [{ name: "title", value: "movie:42" }] },
		},
		{ type: 3, data: { custom_id: formatCustomId("watch", "movie:42") } },
		{ type: 2, data: { name: "link" } },
	])
		test(`${data.type}:${JSON.stringify(
			data.data,
		)} uses guest results when link lookup ${failure}`, async () => {
			const f = fixture({
				linkedUser: async () => {
					if (failure === "reject") throw new Error("storage unavailable")
					return new Promise(() => {})
				},
			})
			await f.run(interaction(data.type, data.data))
			for (let i = 0; !f.edits.length && i < 150; i++)
				await new Promise((resolve) => setTimeout(resolve, 5))
			assert.equal(f.edits.length, 1)
			const card = JSON.stringify(f.edits[0])
			assert.match(
				card,
				data.data.name === "link" ? /Link GoodWatch/ : /Where to watch/,
			)
			assert.doesNotMatch(card, /Something went wrong/)
			assert.ok(f.logs.some((line) => /"viewer":"guest"/.test(line)))
		})

test("link storage failure logs only the nonce and still renders the prompt", async () => {
	const { storeLinkMessage } = await import("./link-message.server.ts")
	const f = fixture({
		storeLinkMessage: (app, token) =>
			storeLinkMessage(app, token, {
				put: async () => {
					throw new Error(`private storage payload ${token}`)
				},
				take: async () => null,
			}),
	})
	await f.run(interaction(2, { name: "link" }))
	for (let i = 0; !f.edits.length && i < 150; i++)
		await new Promise((resolve) => setTimeout(resolve, 5))
	assert.equal(f.edits.length, 1)
	assert.match(JSON.stringify(f.edits), /Link GoodWatch/)
	const diagnostic = f.logs.find((line) =>
		line.startsWith("discord link message storage failed"),
	)!
	assert.match(
		diagnostic,
		/^discord link message storage failed nonce=[A-Za-z0-9_-]{24}$/,
	)
	assert.doesNotMatch(f.logs.join("\n"), /test-token|private storage payload/)
})
