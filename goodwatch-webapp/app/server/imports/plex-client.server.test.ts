import assert from "node:assert/strict"
import { test } from "node:test"
import { createPlexClient } from "./plex-client.server.ts"
import type { PlexHttp } from "./plex-http.server.ts"

function fixture() {
	const calls: { url: URL; token?: string }[] = []
	const history = [1, 2].map((id) => ({
		historyKey: `/status/sessions/history/${id}`,
		ratingKey: "10",
		title: "Toy Story",
		type: "movie",
		accountID: 1,
		viewedAt: 1600000000 + id,
	}))
	const http: PlexHttp = async (input, options) => {
		const url = new URL(input)
		calls.push({ url, token: options?.headers?.["X-Plex-Token"] })
		let data: unknown
		if (url.pathname === "/api/v2/resources")
			data = [
				{
					owned: true,
					provides: "server",
					clientIdentifier: "server-1",
					accessToken: "server-secret",
					connections: [
						{
							uri: "https://member.plex.direct:32400",
							local: false,
							relay: false,
						},
					],
				},
			]
		else if (url.pathname === "/identity")
			data = { MediaContainer: { machineIdentifier: "server-1" } }
		else if (url.pathname === "/status/sessions/history/all") {
			assert.equal(url.searchParams.get("accountID"), "1")
			data = {
				MediaContainer: { size: 2, totalSize: 2, offset: 0, Metadata: history },
			}
		} else if (url.pathname === "/library/metadata/10")
			data = {
				MediaContainer: {
					Metadata: [
						{
							type: "movie",
							title: "Toy Story",
							year: 1995,
							Guid: [{ id: "tmdb://862" }, { id: "imdb://tt0114709" }],
						},
					],
				},
			}
		else throw new Error(`Unexpected request ${url.pathname}`)
		return { text: JSON.stringify(data), headers: {} }
	}
	return { client: createPlexClient({ http }), calls, history, http }
}
test("Plex reads the member's own server as separate exact-time watches with stable identities", async () => {
	const f = fixture()
	const parsed = await f.client.readImport("account-secret", "client-id")
	assert.equal(parsed.source, "plex")
	assert.deepEqual(
		parsed.observations.map((r) => [
			r.key,
			r.tmdbId,
			r.imdbId,
			r.watchedAt,
			r.precision,
		]),
		[
			[
				"plex:watch:server-1:/status/sessions/history/1",
				862,
				"tt0114709",
				"2020-09-13T12:26:41.000Z",
				"moment",
			],
			[
				"plex:watch:server-1:/status/sessions/history/2",
				862,
				"tt0114709",
				"2020-09-13T12:26:42.000Z",
				"moment",
			],
		],
	)
	assert.doesNotMatch(
		JSON.stringify(parsed),
		/account-secret|server-secret|member.plex.direct/,
	)
	assert.ok(
		f.calls
			.filter(
				(c) =>
					c.url.hostname === "member.plex.direct" &&
					c.url.pathname !== "/identity",
			)
			.every((c) => c.token === "server-secret"),
	)
})

test("episodes carry parent show IDs and episode evidence, never trust Plex numbering as TMDB numbering", async () => {
	const f = fixture()
	f.history[0] = { ...f.history[0], type: "episode", ratingKey: "20" }
	const client = createPlexClient({
		http: async (input, options) => {
			const url = new URL(input)
			if (url.pathname === "/api/v2/resources")
				return reply([
					{
						owned: true,
						provides: "server",
						clientIdentifier: "server-1",
						accessToken: "secret",
						connections: [
							{ uri: "https://member.plex.direct", local: false, relay: false },
						],
					},
				])
			if (url.pathname === "/identity")
				return reply({ MediaContainer: { machineIdentifier: "server-1" } })
			if (url.pathname === "/status/sessions/history/all")
				return reply({ MediaContainer: { size: 1, Metadata: [f.history[0]] } })
			if (url.pathname === "/library/metadata/20")
				return reply({
					MediaContainer: {
						Metadata: [
							{
								type: "episode",
								title: "The One with Ross's Wedding",
								grandparentRatingKey: "30",
								parentIndex: 4,
								index: 24,
								Guid: [{ id: "tmdb://101" }, { id: "tvdb://900" }],
							},
						],
					},
				})
			if (url.pathname === "/library/metadata/30")
				return reply({
					MediaContainer: {
						Metadata: [
							{
								type: "show",
								title: "Friends",
								year: 1994,
								Guid: [{ id: "tmdb://1668" }],
							},
						],
					},
				})
			throw new Error("Unexpected route")
		},
	})
	const [row] = (await client.readImport("token", "client")).observations
	assert.equal(row.tmdbId, 1668)
	assert.equal(row.episodeTmdbId, 101)
	assert.equal(row.episodeTvdbId, 900)
	assert.equal(row.episodeNumbering, "unknown")
	assert.equal(row.episode, 24)
	assert.equal(row.title, "Friends")
	assert.equal(row.kind, "watch")
})
const reply = (data: unknown) => ({ text: JSON.stringify(data), headers: {} })

test("documented watchlist RSS imports Want to See and reports its limited coverage", async () => {
	const client = createPlexClient({
		http: async (input, options) => {
			const url = new URL(input)
			if (url.hostname === "rss.plex.tv") {
				assert.equal(options?.headers?.["X-Plex-Token"], undefined)
				return {
					text: `<rss version="2.0"><channel><title>Watchlist</title><item><title>Toy Story</title><category>movie</category><guid>imdb://tt0114709</guid><guid>tmdb://862</guid><pubDate>Sat, 10 Oct 2026 00:00:00 GMT</pubDate></item><item><title>Friends</title><category>show</category><guid>tmdb://1668</guid></item><item><title>Unknown show</title><category>show</category><guid>tvdb://123</guid></item></channel></rss>`,
					headers: {},
				}
			}
			if (url.pathname === "/api/v2/resources") return reply([])
			throw new Error("Unexpected route")
		},
	})
	const parsed = await client.readImport(
		"secret",
		"client",
		"https://rss.plex.tv/watchlist/private-feed",
	)
	assert.deepEqual(
		parsed.observations.map((r) => [r.kind, r.mediaType, r.tmdbId, r.imdbId]),
		[
			["want", "movie", 862, "tt0114709"],
			["want", "show", 1668, null],
			["want", "show", null, null],
		],
	)
	assert.equal(parsed.observations[0].watchedAt, undefined)
	assert.equal(parsed.observations[0].addedAt, undefined)
	assert.match(parsed.observations[2].problem?.reason ?? "", /TMDB or IMDb/)
	assert.match(
		parsed.warnings.map((w) => w.message).join(" "),
		/feed.*complete/i,
	)
	assert.match(
		parsed.warnings.map((w) => w.message).join(" "),
		/Sign in.*owns.*Plex Media Server/,
	)
	assert.doesNotMatch(JSON.stringify(parsed), /private-feed|secret/)
})

test("unreachable server history becomes an actionable receipt and still permits the watchlist", async () => {
	const client = createPlexClient({
		http: async (input) => {
			const url = new URL(input)
			if (url.pathname === "/api/v2/resources")
				return reply([
					{
						owned: true,
						provides: "server",
						clientIdentifier: "server",
						accessToken: "secret",
						connections: [
							{ uri: "https://member.plex.direct", local: false, relay: false },
						],
					},
				])
			if (url.pathname === "/identity")
				return reply({ MediaContainer: { machineIdentifier: "server" } })
			if (url.hostname === "rss.plex.tv")
				return {
					text: "<rss><channel><item><title>Toy Story</title><category>movie</category><guid>tmdb://862</guid></item></channel></rss>",
					headers: {},
				}
			throw new Error("socket failed with secret")
		},
	})
	const parsed = await client.readImport(
		"account-secret",
		"client",
		"https://rss.plex.tv/watchlist/feed",
	)
	assert.equal(parsed.observations.length, 1)
	assert.match(
		parsed.warnings.map((w) => w.message).join(" "),
		/GoodWatch could not reach.*Remote Access/,
	)
	assert.doesNotMatch(JSON.stringify(parsed), /secret/)
})

test("history filters other accounts even when the server ignores accountID", async () => {
	const f = fixture()
	f.history[0].accountID = 99
	const parsed = await f.client.readImport("token", "client")
	assert.equal(parsed.observations.length, 1)
	assert.match(parsed.observations[0].key, /history\/2$/)
})

test("private server URLs are blocked by the real Plex network boundary and explain reachability in the receipt", async () => {
	const { createPlexHttp } = await import("./plex-http.server.ts")
	const guarded = createPlexHttp({
		resolve: async () => [{ address: "10.0.0.8", family: 4 }],
	})
	const client = createPlexClient({
		http: async (input, options) => {
			const url = new URL(input)
			if (url.pathname === "/api/v2/resources")
				return reply([
					{
						owned: true,
						provides: "server",
						clientIdentifier: "server",
						accessToken: "server-secret",
						connections: [
							{
								uri: "https://internal.plex.direct:32400",
								local: false,
								relay: false,
							},
						],
					},
				])
			return guarded(input, options)
		},
	})
	const parsed = await client.readImport("account-secret", "client")
	assert.equal(parsed.observations.length, 0)
	assert.match(
		parsed.warnings.map((w) => w.message).join(" "),
		/GoodWatch could not reach.*public HTTPS/,
	)
	assert.doesNotMatch(JSON.stringify(parsed), /secret|internal.plex.direct/)
})

test("Plex accepts only the generated RSS host and never follows external metadata links", async () => {
	const f = fixture()
	for (const url of [
		"http://rss.plex.tv/feed",
		"https://evil.test/feed",
		"https://rss.plex.tv.evil.test/feed",
		"https://rss.plex.tv@127.0.0.1/feed",
		"https://rss.plex.tv/feed?url=http://internal",
		"https://rss.plex.tv:32400/feed",
	]) {
		await assert.rejects(
			f.client.readImport("token", "client", url),
			/personal Watchlist RSS/,
		)
	}
	assert.equal(f.calls.length, 0)
})

test("Plex finishes all history pages and rejects duplicate, changing, oversized or incomplete pages", async () => {
	for (const mode of [
		"normal",
		"duplicate",
		"shrunk",
		"empty",
		"oversized",
	] as const) {
		const f = fixture()
		const client = createPlexClient({
			http: async (input, options) => {
				if (!input.includes("/status/sessions/history/all"))
					return f.http(input, options)
				const offset = Number(options?.headers?.["X-Plex-Container-Start"])
				return reply({
					MediaContainer: {
						offset,
						totalSize:
							mode === "oversized"
								? 50001
								: mode === "shrunk" && offset
									? 1
									: 2,
						size: mode === "empty" && offset ? 0 : 1,
						Metadata:
							mode === "empty" && offset
								? []
								: [f.history[mode === "duplicate" ? 0 : offset]],
					},
				})
			},
		})
		if (mode === "normal")
			assert.equal(
				(await client.readImport("secret", "client")).observations.length,
				2,
			)
		else
			await assert.rejects(
				client.readImport("secret", "client"),
				/history|page/,
			)
	}
})

test("Plex stops an import before the credential lease expires", async () => {
	let now = 0
	const f = fixture()
	const client = createPlexClient({
		now: () => now,
		http: async (input, options) => {
			const response = await f.http(input, options)
			if (input.includes("/status/sessions/history/all")) now = 6 * 60_000
			return response
		},
	})
	await assert.rejects(client.readImport("secret", "client"), /too long/)
})

test("only owned servers are read; unrelated resources need no server credentials", async () => {
	const f = fixture()
	const client = createPlexClient({
		http: async (input, options) => {
			const response = await f.http(input, options)
			if (!input.includes("/api/v2/resources")) return response
			return reply([
				...JSON.parse(response.text),
				{ owned: false, provides: "server", clientIdentifier: "shared" },
				{ owned: true, provides: "player", clientIdentifier: "phone" },
			])
		},
	})
	assert.equal(
		(await client.readImport("token", "client")).observations.length,
		2,
	)
})

test("Plex paginated history without a total continues until an empty page", async () => {
	const f = fixture()
	const client = createPlexClient({
		http: async (input, options) => {
			if (!input.includes("/status/sessions/history/all"))
				return f.http(input, options)
			const offset = Number(options?.headers?.["X-Plex-Container-Start"])
			return {
				text: JSON.stringify({
					MediaContainer: {
						size: offset < 2 ? 1 : 0,
						Metadata: offset < 2 ? [f.history[offset]] : [],
					},
				}),
				headers: { "x-plex-container-start": String(offset) },
			}
		},
	})
	assert.equal(
		(await client.readImport("secret", "client")).observations.length,
		2,
	)
})

test("malformed and entity-bearing RSS is not imported or fetched as external data", async () => {
	for (const xml of [
		"<rss><channel><item>",
		'<!DOCTYPE rss [<!ENTITY x SYSTEM "http://169.254.169.254/latest/meta-data">]><rss><channel><item><title>&x;</title></item></channel></rss>',
		"<html>not RSS</html>",
	]) {
		const f = fixture()
		const client = createPlexClient({
			http: async (input, options) =>
				input.startsWith("https://rss.plex.tv/")
					? { text: xml, headers: {} }
					: f.http(input, options),
		})
		const parsed = await client.readImport(
			"secret",
			"client",
			"https://rss.plex.tv/watchlist/feed",
		)
		assert.equal(parsed.observations.filter((r) => r.kind === "want").length, 0)
		assert.match(
			parsed.warnings.map((w) => w.message).join(" "),
			/RSS feed could not be read/,
		)
	}
})

test("Plex PIN uses the documented forwarding endpoints and keeps the access token on the server", async () => {
	const calls: string[] = []
	const client = createPlexClient({
		http: async (input, options) => {
			calls.push(input)
			assert.equal(options?.headers?.["X-Plex-Client-Identifier"], "one-import")
			assert.equal(options?.headers?.Accept, "application/json")
			assert.equal(options?.headers?.["X-Plex-Token"], undefined)
			if (options?.method === "POST")
				return reply({ id: 123, code: "approval" })
			return reply({ authToken: "server-only-secret" })
		},
	})
	assert.deepEqual(await client.createPin("one-import"), {
		id: "123",
		code: "approval",
	})
	assert.equal(await client.claimPin("123", "one-import"), "server-only-secret")
	assert.deepEqual(calls, [
		"https://plex.tv/api/v2/pins?strong=true",
		"https://plex.tv/api/v2/pins/123",
	])
})

test("a growing Plex history imports only the initial snapshot, including when a page crosses its end", async () => {
	const f = fixture()
	const offsets: number[] = []
	const client = createPlexClient({
		http: async (input, options) => {
			if (!input.includes("/status/sessions/history/all"))
				return f.http(input, options)
			const offset = Number(options?.headers?.["X-Plex-Container-Start"])
			offsets.push(offset)
			assert.ok(offset < 2, "must stop at the first total")
			return reply({
				MediaContainer: {
					offset,
					totalSize: offset ? 3 : 2,
					size: offset ? 2 : 1,
					Metadata: offset
						? [
								f.history[1],
								{ ...f.history[1], historyKey: "/status/sessions/history/3" },
							]
						: [f.history[0]],
				},
			})
		},
	})
	const parsed = await client.readImport("secret", "client")
	assert.equal(parsed.observations.length, 2)
	assert.deepEqual(offsets, [0, 1])
})

test("deleted and malformed history rows are unmatched without losing good plays or the RSS feed", async () => {
	const f = fixture()
	const rows = [
		f.history[0],
		{ ...f.history[1], ratingKey: undefined },
		{ ...f.history[1], historyKey: "/status/sessions/history/3", title: 123 },
		{
			...f.history[1],
			historyKey: "/status/sessions/history/4",
			viewedAt: 1e20,
		},
		null,
		{ ...f.history[1], historyKey: "broken", accountID: 99 },
	]
	const client = createPlexClient({
		http: async (input, options) => {
			if (input.includes("/status/sessions/history/all"))
				return reply({ MediaContainer: { size: rows.length, Metadata: rows } })
			if (input.startsWith("https://rss.plex.tv/"))
				return {
					text: "<rss><channel><item><title>Friends</title><category>show</category><guid>tmdb://1668</guid></item></channel></rss>",
					headers: {},
				}
			return f.http(input, options)
		},
	})
	const parsed = await client.readImport(
		"secret",
		"client",
		"https://rss.plex.tv/watchlist/feed",
	)
	assert.equal(parsed.observations.length, 6)
	assert.equal(parsed.observations[0].tmdbId, 862)
	assert.equal(parsed.observations.at(-1)?.kind, "want")
	assert.deepEqual(
		parsed.observations.slice(1, 5).map((row) => row.problem?.outcome),
		["unmatched", "unmatched", "unmatched", "unmatched"],
	)
	assert.equal(
		parsed.observations[1].key,
		"plex:watch:server-1:/status/sessions/history/2",
	)
})

test("metadata requests include GUIDs and legacy agents supply fallback movie identities", async () => {
	for (const [guid, expected] of [
		["com.plexapp.agents.imdb://tt0114709?lang=en", [null, "tt0114709"]],
		["com.plexapp.agents.themoviedb://862?lang=en", [862, null]],
		["com.plexapp.agents.themoviedb://862/1/2?lang=en", [null, null]],
	] as const) {
		const f = fixture()
		const client = createPlexClient({
			http: async (input, options) => {
				const url = new URL(input)
				if (url.pathname === "/library/metadata/10") {
					assert.equal(url.searchParams.get("includeGuids"), "1")
					return reply({
						MediaContainer: {
							Metadata: [{ type: "movie", title: "Toy Story", guid }],
						},
					})
				}
				return f.http(input, options)
			},
		})
		const [row] = (await client.readImport("secret", "client")).observations
		assert.equal(row.problem, undefined)
		assert.deepEqual([row.tmdbId, row.imdbId], expected)
	}
})

test("RSS enforces shared XML complexity bounds and reports an item limit distinctly", async () => {
	for (const [xml, warning] of [
		[`<rss>${"<x/>".repeat(1_000_000)}</rss>`, /XML is too complex/],
		[
			`<rss>${"<x>".repeat(64)}${"</x>".repeat(64)}</rss>`,
			/XML is too complex/,
		],
		[
			`<rss><channel>${"<item><title>X</title><category>movie</category><guid>tmdb://1</guid></item>".repeat(
				50_001,
			)}</channel></rss>`,
			/exceeds 50,000 items/,
		],
	] as const) {
		const client = createPlexClient({
			http: async (input) =>
				input.startsWith("https://rss.plex.tv/")
					? { text: xml, headers: {} }
					: reply([]),
		})
		const parsed = await client.readImport(
			"secret",
			"client",
			"https://rss.plex.tv/watchlist/feed",
		)
		assert.deepEqual(parsed.observations, [])
		assert.match(parsed.warnings.map((w) => w.message).join(" "), warning)
	}
})

test("new plays beyond the import limit do not invalidate an already bounded history snapshot", async () => {
	const f = fixture()
	const client = createPlexClient({
		http: async (input, options) => {
			if (!input.includes("/status/sessions/history/all"))
				return f.http(input, options)
			const offset = Number(options?.headers?.["X-Plex-Container-Start"])
			return reply({
				MediaContainer: {
					offset,
					totalSize: offset ? 50_001 : 2,
					size: offset ? 50_000 : 1,
					Metadata: offset
						? [f.history[1], ...Array(49_999).fill(null)]
						: [f.history[0]],
				},
			})
		},
	})
	const parsed = await client.readImport("secret", "client")
	assert.equal(parsed.observations.length, 2)
})

test("three unreachable servers keep actionable warnings separate from working-feed information", async () => {
	const { threeUnreachableServersWithFeed } = await import(
		"./plex-unreachable-fixture.test-support.ts"
	)
	const parsed = await threeUnreachableServersWithFeed()
	assert.equal(parsed.observations.length, 1)
	assert.deepEqual(
		parsed.warnings.map((warning) => warning.kind),
		["actionable", "actionable", "actionable", "info"],
	)
})
