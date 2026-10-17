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
import { createToolServer } from "./tools.server.ts"

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
		.filter((tool: { _meta?: unknown }) => tool._meta)
		.map((tool: { name: string }) => tool.name)
	assert.deepEqual(withUi, ["search_titles", "get_tonight", "get_library"])
	for (const tool of tools.filter((t: { _meta?: unknown }) => t._meta))
		assert.deepEqual(tool._meta, {
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
		Buffer.byteLength(html) < 20_000,
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
	assert.equal(matrix.match, 91)
	assert.equal(matrix.link, items[0].link)
	assert.equal(thrones.poster_url, null)
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
			({ poster_url: _, ...rest }: Record<string, unknown>) => rest,
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

test("The grid view covers search, library, Watch next, errors and empty answers", () => {
	const search = posterView(
		{
			items: [
				{
					...items[0],
					poster_url: poster,
					match: 91,
					match_label: "91% taste match",
				},
				{ ...items[1], poster_url: "https://evil.example/p.jpg", match: null },
				{ name: "Bad link", year: 2000, url: "javascript:alert(1)" },
			],
			ranked: false,
			page_url: `${origin}/discover?q=dark`,
		},
		origin,
	)
	assert.equal(search.heading, "Search results")
	assert.equal(search.pick, false)
	assert.equal(search.pageUrl, `${origin}/discover?q=dark`)
	assert.deepEqual(
		search.cards.map((card) => [
			card.name,
			card.poster,
			card.poster2x,
			card.matchLabel,
		]),
		[
			[
				"The Matrix",
				poster,
				poster.replace("/w185/", "/w342/"),
				"91% taste match",
			],
			["Game of Thrones", null, null, null],
		],
	)
	assert.equal(
		posterView({ items: [], sort: "match" }, origin).heading,
		"My library",
	)
	const next = posterView(
		{
			pick: {
				title: { ...items[1], poster_url: null },
				reason: "nextEpisode",
				episode: { code: "S2 E3", name: "What Is Dead May Never Die" },
				match: 88,
			},
			page_url: `${origin}/my-shows`,
		},
		origin,
	)
	assert.equal(next.heading, "Watch next")
	assert.equal(next.pick, true)
	assert.equal(next.cards[0].episode, "S2 E3 · What Is Dead May Never Die")
	assert.equal(next.cards[0].match, 88)
	assert.equal(
		posterView({ pick: null }, origin).message,
		"There is nothing to pick right now.",
	)
	assert.equal(
		posterView({ status: "quota_exceeded", message: "Used up." }, origin)
			.message,
		"Used up.",
	)
	assert.equal(posterView(null, origin).message, "No titles to show.")
	assert.equal(posterView({ items: [] }, origin).cards.length, 0)
})

test("The generated widget matches its sources (run node scripts/build-mcp-poster-grid.mjs)", async () => {
	const hash = createHash("sha256")
	for (const name of ["cards.ts", "widget.ts", "widget.css", "template.html"])
		hash.update(await readFile(new URL(`poster-grid/${name}`, import.meta.url)))
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
