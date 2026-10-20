import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { createMcpHandler } from "@modelcontextprotocol/server"
import {
	MCP_APP_MIME_TYPE,
	POSTER_GRID_URI,
	posterGridHtml,
} from "./poster-grid.server.ts"
import { posterView, safePageUrl, safePosterUrl } from "./poster-grid/cards.ts"
import { POSTER_GRID_SOURCE_HASH } from "./poster-grid/html.generated.ts"
import { enrichTitleResults } from "./title-results.server.ts"
const { createToolServer } = await import("./tools.server.ts")

const origin = "https://goodwatch.app"
const resource = `${origin}/mcp`
const poster = "https://image.tmdb.org/t/p/w185/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg"

// A ranked search stands in for the catalog, and fake readers for taste and display fields: no database.
const items = [
	{
		id: "movie:603",
		name: "The Matrix",
		year: 1999,
		url: `${origin}/movie/603-the-matrix`,
		link: `[The Matrix (1999)](${origin}/movie/603-the-matrix)`,
	},
	{
		id: "show:1399",
		name: "Game of Thrones",
		year: 2011,
		url: `${origin}/tv/1399-game-of-thrones`,
		link: `[Game of Thrones (2011)](${origin}/tv/1399-game-of-thrones)`,
	},
]
const sources = {
	async loadTaste() {
		return {
			signal: "some",
			liked: 12,
			match: (keys: number[]) => keys.map((_, i) => (i === 0 ? 91 : null)),
		}
	},
	async getDisplayFields(keys: number[]) {
		return new Map(
			keys.map((key, i) => [
				key,
				{
					runtime: i === 0 ? 136 : 57,
					poster_path: i === 0 ? "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg" : null,
					backdrop_path: i === 0 ? "/ncEsesgOJDNrTUED89hYbA117wo.jpg" : null,
					tagline: i === 0 ? "Welcome to the Real World." : null,
					goodwatch_overall_score_normalized_percent: i === 0 ? 85.6 : null,
				},
			]),
		)
	},
}
const server = () =>
	createToolServer(
		"member-A",
		origin,
		false,
		async () => ({ items, ranked: true, next_cursor: null }),
		(userId, data, options) =>
			enrichTitleResults(userId, data, { ...options, sources }),
	)

const call = async (
	method: string,
	params: Record<string, unknown>,
	clientCapabilities: Record<string, unknown> = {},
) => {
	const handler = createMcpHandler(server, { legacy: "stateless" })
	try {
		const response = await handler.fetch(
			new Request(resource, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json, text/event-stream",
					"MCP-Protocol-Version": "2026-07-28",
					"Mcp-Method": method,
					...(typeof (params.name ?? params.uri) === "string"
						? { "Mcp-Name": String(params.name ?? params.uri) }
						: {}),
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 1,
					method,
					params: {
						...params,
						_meta: {
							"io.modelcontextprotocol/protocolVersion": "2026-07-28",
							"io.modelcontextprotocol/clientCapabilities": clientCapabilities,
						},
					},
				}),
			}),
		)
		const text = await response.text()
		return JSON.parse(
			text.startsWith("event:") ? text.split("data: ")[1].split("\n")[0] : text,
		)
	} finally {
		await handler.close()
	}
}

test("Search, My library and Watch next point at the versioned poster grid; other tools don't", async () => {
	const { tools } = (await call("tools/list", {})).result
	const withUi = tools
		.filter((tool: { _meta?: { ui?: unknown } }) => tool._meta?.ui)
		.map((tool: { name: string }) => tool.name)
	assert.deepEqual(withUi, [
		"search_titles",
		"discover_titles",
		"get_similar_titles",
		"get_tonight",
		"get_library",
		"search_people",
		"get_person",
		"get_list",
	])
	for (const tool of tools.filter(
		(t: { _meta?: { ui?: unknown } }) => t._meta?.ui,
	))
		assert.deepEqual(tool._meta, {
			securitySchemes: [{ type: "oauth2", scopes: ["mcp:read"] }],
			ui: { resourceUri: POSTER_GRID_URI },
			"ui/resourceUri": POSTER_GRID_URI,
			"openai/outputTemplate": POSTER_GRID_URI,
		})
})

test("The poster grid resource is listed and read as an MCP App with a tight CSP", async () => {
	const { resources } = (await call("resources/list", {})).result
	const listed = resources.find(
		(entry: { uri: string }) => entry.uri === POSTER_GRID_URI,
	)
	assert.equal(listed.mimeType, MCP_APP_MIME_TYPE)
	const read = (await call("resources/read", { uri: POSTER_GRID_URI })).result
	const [content] = read.contents
	assert.equal(content.uri, POSTER_GRID_URI)
	assert.equal(content.mimeType, "text/html;profile=mcp-app")
	assert.equal(Object.hasOwn(content._meta.ui, "domain"), false)
	assert.equal(Object.hasOwn(listed._meta.ui, "domain"), false)
	assert.equal(content._meta["openai/widgetDomain"], "https://goodwatch.app")
	assert.deepEqual(content._meta.ui.csp, {
		resourceDomains: ["https://image.tmdb.org", "https://goodwatch.app"],
		connectDomains: [],
	})
	assert.deepEqual(content._meta["openai/widgetCSP"], {
		connect_domains: [],
		resource_domains: ["https://image.tmdb.org", "https://goodwatch.app"],
	})
	const html: string = content.text
	assert.match(html, /^<!doctype html>/)
	assert.equal(html.includes("__GW_ORIGIN__"), false)
	assert.match(html, /data-origin="https:\/\/goodwatch\.app"/)
	// Self-contained: no external scripts or style sheets, no frames, nothing written as HTML from data.
	assert.doesNotMatch(html, /<script[^>]+src=/i)
	assert.doesNotMatch(html, /<link[^>]+stylesheet/i)
	assert.doesNotMatch(html, /<iframe/i)
	assert.doesNotMatch(
		html,
		/innerHTML|outerHTML|insertAdjacentHTML|document\.write/,
	)
	assert.ok(
		Buffer.byteLength(html) < 30_000,
		`${Buffer.byteLength(html)} bytes`,
	)
})

test("Poster tools add a nullable poster_url; the answer is the same with and without UI support", async () => {
	const args = {
		name: "search_titles",
		arguments: { query: "dark", ranked: true },
	}
	const plain = (await call("tools/call", args)).result
	const ui = (
		await call("tools/call", args, {
			extensions: {
				"io.modelcontextprotocol/ui": { mimeTypes: [MCP_APP_MIME_TYPE] },
			},
		})
	).result
	assert.deepEqual(ui, plain)
	assert.equal(plain.isError, false)
	assert.deepEqual(JSON.parse(plain.content[0].text), plain.structuredContent)
	const [matrix, thrones] = plain.structuredContent.items
	assert.equal(matrix.poster_url, poster)
	assert.equal(
		matrix.backdrop_url,
		"https://image.tmdb.org/t/p/w780/ncEsesgOJDNrTUED89hYbA117wo.jpg",
	)
	assert.equal(matrix.match, 91)
	assert.equal(matrix.link, items[0].link)
	assert.equal(thrones.poster_url, null)
	assert.equal(thrones.backdrop_url, null)
	assert.equal(matrix.goodwatch_score, 85, "floored, as the site shows it")
	assert.equal(thrones.goodwatch_score, null)
	assert.equal("tagline" in matrix, false)
	assert.ok(plain.structuredContent.page_url.startsWith(`${origin}/discover?`))
	// Apart from poster_url, the result is what enrichment returned before posters existed.
	const before = await enrichTitleResults(
		"member-A",
		{ items, ranked: true, next_cursor: null },
		{ sources },
	)
	const withoutPosters = {
		...plain.structuredContent,
		items: plain.structuredContent.items.map(
			({
				poster_url: _,
				backdrop_url: _backdrop,
				goodwatch_score: _score,
				...rest
			}: Record<string, unknown>) => rest,
		),
	}
	const { page_url: _page, page_note: _note, ...rest } = withoutPosters
	assert.deepEqual(rest, before)
})

test("Tools without the grid don't get poster_url", async () => {
	const data = await enrichTitleResults(
		"member-A",
		{ title: items[0] },
		{ sources },
	)
	assert.equal("poster_url" in (data.title as object), false)
	assert.equal("backdrop_url" in (data.title as object), false)
	const pick = await enrichTitleResults(
		"member-A",
		{ pick: { title: items[0] } },
		{ posters: true, taglines: true, sources },
	)
	assert.equal(
		(pick.pick as { title: { tagline: string } }).title.tagline,
		"Welcome to the Real World.",
	)
})

test("The grid keeps GoodWatch links and TMDB posters only", () => {
	assert.equal(
		safePageUrl(`${origin}/movie/603`, origin),
		`${origin}/movie/603`,
	)
	for (const bad of [
		"javascript:alert(1)",
		"http://goodwatch.app/movie/603",
		"https://goodwatch.app.evil.example/movie/603",
		"https://evil.example/?u=https://goodwatch.app",
		"//goodwatch.app/movie/603",
		42,
	])
		assert.equal(safePageUrl(bad, origin), null, String(bad))
	assert.equal(safePosterUrl(poster), poster)
	for (const bad of [
		"https://image.tmdb.org/t/p/original/x.jpg",
		"https://image.tmdb.org/t/p/w185/x.jpg?track=1",
		"https://image.tmdb.org/t/p/w185/../x.jpg",
		"https://images.tmdb.org/t/p/w185/x.jpg",
		"http://image.tmdb.org/t/p/w185/x.jpg",
		"data:image/png;base64,AAAA",
	])
		assert.equal(safePosterUrl(bad), null, bad)
})

test("The card view covers search, library, Watch next, errors and empty answers", () => {
	const backdrop =
		"https://image.tmdb.org/t/p/w780/ncEsesgOJDNrTUED89hYbA117wo.jpg"
	const search = posterView(
		{
			items: [
				{
					...items[0],
					poster_url: poster,
					backdrop_url: backdrop,
					goodwatch_score: 86,
					match: 91,
					match_label: "91% taste match",
				},
				{
					...items[1],
					poster_url: "https://evil.example/p.jpg",
					backdrop_url: "https://image.tmdb.org/t/p/original/x.jpg",
					match: null,
				},
				{ name: "Bad link", year: 2000, url: "javascript:alert(1)" },
			],
			ranked: false,
			page_url: `${origin}/discover?q=dark`,
		},
		origin,
		{ query: "matrix" },
	)
	assert.equal(search.layout, "grid")
	assert.equal(search.eyebrow, "Top result for “matrix”")
	assert.equal(search.pageUrl, `${origin}/discover?q=dark`)
	assert.deepEqual(
		search.cards.map((card) => [
			card.name,
			card.kind,
			card.poster,
			card.poster2x,
			card.backdrop,
			card.backdrop2x,
			card.match,
			card.score,
		]),
		[
			[
				"The Matrix",
				"Movie",
				poster,
				poster.replace("/w185/", "/w342/"),
				backdrop,
				backdrop.replace("/w780/", "/w1280/"),
				91,
				86,
			],
			["Game of Thrones", "Show", null, null, null, null, null, null],
		],
	)
	assert.equal(
		posterView({ items: [items[0]], sort: "match" }, origin, {
			filter: "want_to_see",
		}).eyebrow,
		"Best match on your Wishlist",
	)
	assert.equal(
		posterView({ items: [items[0]], sort: "runtime" }, origin).eyebrow,
		"Longest in My library",
	)
	const next = posterView(
		{
			pick: {
				title: {
					...items[1],
					poster_url: null,
					tagline: "Winter is coming.",
					availability: {
						offers: [
							{
								name: "Netflix",
								url: "javascript:alert(1)",
								link_kind: "provider",
							},
							{
								name: "Max",
								url: "https://play.max.com/show/1",
								link_kind: "provider",
								logo_url: "https://image.tmdb.org/t/p/w92/max.jpg",
							},
						],
					},
				},
				reason: "nextEpisode",
				episode: { code: "S2 E3", name: "What Is Dead May Never Die" },
				match: 88,
			},
			page_url: `${origin}/my-shows`,
		},
		origin,
	)
	assert.equal(next.layout, "pick")
	assert.equal(next.eyebrow, "Next episode · S2 E3")
	assert.equal(next.eyebrowDetail, "What Is Dead May Never Die")
	assert.equal(next.cards[0].match, 88)
	assert.equal(next.cards[0].tagline, "Winter is coming.")
	assert.deepEqual(next.watch, {
		label: "Watch on Max",
		url: "https://play.max.com/show/1",
		logo: "https://image.tmdb.org/t/p/w92/max.jpg",
	})
	const fallback = posterView(
		{
			pick: {
				title: {
					...items[0],
					availability: {
						offers: [
							{
								name: "Netflix",
								url: "https://www.themoviedb.org/movie/603/watch?locale=DE",
								link_kind: "where_to_watch",
								logo_url: "https://evil.example/logo.png",
							},
						],
					},
				},
				reason: "suggestion",
			},
		},
		origin,
	)
	assert.equal(fallback.eyebrow, "A pick for you")
	assert.equal(fallback.watch?.label, "Where to watch")
	assert.equal(fallback.watch?.logo, null)
	assert.equal(
		posterView({ pick: null }, origin).message,
		"There is nothing to pick right now.",
	)
	assert.equal(
		posterView({ status: "quota_exceeded", message: "Used up." }, origin)
			.message,
		"Used up.",
	)
	assert.equal(posterView(null, origin).layout, "message")
	assert.equal(posterView({ items: [] }, origin).message, "No titles to show.")
})

test("The generated widget matches its sources (run node scripts/build-mcp-poster-grid.mjs)", async () => {
	const hash = createHash("sha256")
	for (const name of [
		"poster-grid/cards.ts",
		"poster-grid/widget.ts",
		"poster-grid/widget.css",
		"poster-grid/template.html",
		"../../ui/brand/GoodWatchWordmark.tsx",
	])
		hash.update(await readFile(new URL(name, import.meta.url)))
	assert.equal(POSTER_GRID_SOURCE_HASH, hash.digest("hex").slice(0, 16))
	assert.match(
		posterGridHtml("https://staging.example/mcp"),
		/data-origin="https:\/\/staging\.example"/,
	)
})

test("A client on the older stateless protocol reads the same resource", async () => {
	const handler = createMcpHandler(server, { legacy: "stateless" })
	try {
		const response = await handler.fetch(
			new Request(resource, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json, text/event-stream",
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 1,
					method: "resources/read",
					params: { uri: POSTER_GRID_URI },
				}),
			}),
		)
		assert.equal(response.status, 200)
		const text = await response.text()
		const body = JSON.parse(
			text.startsWith("event:") ? text.split("data: ")[1].split("\n")[0] : text,
		)
		assert.equal(body.result.contents[0].mimeType, MCP_APP_MIME_TYPE)
	} finally {
		await handler.close()
	}
})

test("The MCP rpc log names the member id, methods and UI support, never arguments, email or tokens", async () => {
	const { describeRpc } = await import("./rpc-log.ts")
	const tools = new Set(["search_titles"])
	assert.equal(
		describeRpc(
			{
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {
					protocolVersion: "2025-06-18",
					capabilities: {
						extensions: {
							"io.modelcontextprotocol/ui": { mimeTypes: [MCP_APP_MIME_TYPE] },
						},
					},
					clientInfo: { name: "claude-ai\nforged line", version: "0.1.0" },
				},
			},
			tools,
			null,
			"user_123",
		),
		"MCP rpc: user=user_123 method=initialize protocol=2025-06-18 client=claude-ai?forged line/0.1.0 ui=text/html;profile=mcp-app",
	)
	const call = describeRpc(
		{
			method: "tools/call",
			params: { name: "search_titles", arguments: { query: "secret query" } },
		},
		tools,
		"2025-06-18",
		"user_123",
	)
	assert.equal(
		call,
		"MCP rpc: user=user_123 method=tools/call tool=search_titles protocol=2025-06-18",
	)
	assert.equal(
		describeRpc(
			{ method: "tools/call", params: { name: "member-A" } },
			tools,
			null,
			"user_123",
		),
		"MCP rpc: user=user_123 method=tools/call tool=other protocol=-",
	)
	assert.equal(
		describeRpc(
			{ method: "resources/read", params: { uri: POSTER_GRID_URI } },
			tools,
			null,
		),
		`MCP rpc: user=- method=resources/read uri=${POSTER_GRID_URI} protocol=-`,
	)
	assert.equal(
		describeRpc(
			{
				method: "tools/list",
				params: {
					_meta: {
						"io.modelcontextprotocol/protocolVersion": "2026-07-28",
						"io.modelcontextprotocol/clientCapabilities": {},
					},
				},
			},
			tools,
			"2026-07-28",
			"user_123",
		),
		"MCP rpc: user=user_123 method=tools/list protocol=2026-07-28 ui=none",
	)
	assert.equal(
		describeRpc(
			{ method: "tools/call", params: { name: "search_titles" } },
			tools,
			null,
			"user_1\nforged=1",
		),
		"MCP rpc: user=user_1?forged=1 method=tools/call tool=search_titles protocol=-",
	)
	assert.doesNotMatch(
		call ?? "",
		/secret|@|token/i,
		"arguments, email and tokens never reach the line",
	)
	assert.equal(describeRpc({ id: 1, result: {} }, tools, null), null)
})

test("The other card tools get their own eyebrow, and people get person cards", () => {
	const row = { ...items[0], poster_url: poster }
	assert.equal(
		posterView({ source: { name: "Dark" }, items: [row] }, origin).eyebrow,
		"More like Dark",
	)
	assert.equal(
		posterView({ list_id: "l1", name: "Comfort", items: [row] }, origin)
			.eyebrow,
		"On your list “Comfort”",
	)
	assert.equal(
		posterView({ sort_used: "popular", items: [row] }, origin).eyebrow,
		"Top pick in Discover",
	)
	const villeneuve = {
		person_id: 137427,
		name: "Denis Villeneuve",
		url: `${origin}/person/137427-denis-villeneuve`,
		link: `[Denis Villeneuve](${origin}/person/137427-denis-villeneuve)`,
		known_for_department: "Directing",
		profile_url:
			"https://image.tmdb.org/t/p/w185/zdDx9Xs93UIrJFWYApYR28J8M6b.jpg",
		backdrop_url:
			"https://image.tmdb.org/t/p/w780/jYEW5xZkZk2WTrdbMGAPFuBqbDc.jpg",
		known_for: [
			{ name: "Dune", year: 2021, url: `${origin}/movie/438631-dune` },
			{ name: "Arrival", year: 2016, url: `${origin}/movie/329865-arrival` },
			{ name: "Third", year: 2010, url: `${origin}/movie/1-third` },
		],
	}
	const filmography = posterView(
		{ person: villeneuve, items: [row], sort: "for_you" },
		origin,
	)
	assert.equal(filmography.layout, "grid")
	assert.equal(filmography.eyebrow, "Filmography")
	assert.deepEqual(filmography.person, {
		name: "Denis Villeneuve",
		url: villeneuve.url,
		department: "Directing",
		profile: villeneuve.profile_url,
		profile2x: villeneuve.profile_url.replace("/w185/", "/h632/"),
		backdrop: villeneuve.backdrop_url,
		backdrop2x: villeneuve.backdrop_url.replace("/w780/", "/w1280/"),
		knownFor: ["Dune (2021)", "Arrival (2016)"],
	})
	assert.equal(filmography.cards.length, 1)
	const people = posterView(
		{
			items: [
				villeneuve,
				{
					...villeneuve,
					person_id: 2,
					name: "Bad link",
					url: "https://evil.example/person/2",
				},
				{
					...villeneuve,
					person_id: 3,
					name: "No photo",
					url: `${origin}/person/3-no-photo`,
					profile_url: "https://evil.example/p.jpg",
				},
			],
			page_url: `${origin}/discover?q=villeneuve`,
		},
		origin,
		{ query: "villeneuve" },
	)
	assert.equal(people.layout, "people")
	assert.equal(people.eyebrow, "Top result for “villeneuve”")
	assert.deepEqual(
		people.people.map((person) => [person.name, person.profile]),
		[
			["Denis Villeneuve", villeneuve.profile_url],
			["No photo", null],
		],
	)
	assert.equal(people.cards.length, 0)
})
