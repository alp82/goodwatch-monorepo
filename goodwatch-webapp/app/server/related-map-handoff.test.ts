import assert from "node:assert/strict"
import { type IncomingMessage, createServer, request as httpRequest } from "node:http"
import type { AddressInfo } from "node:net"
import { type TestContext, test } from "node:test"
import { brotliDecompressSync } from "node:zlib"
import { createRequestHandler } from "@remix-run/node"
import { Outlet, RemixServer, Scripts, useLoaderData } from "@remix-run/react"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { SHARED_PAGE_CACHE_CONTROL, applyCachePolicy } from "./cache-identity.server.ts"
import { createPageCache, putPageCacheFirst } from "./page-cache.server.ts"
import { withoutRelatedMapMarkup } from "./related-map-handoff.ts"

// A real Remix document render behind the real page cache. The title route's loader answers as the title pages' do:
// its data carries the related map's markup for every request (relatedMapData in related-map.server.ts). The entry
// does what entry.server.tsx does with the page data.

// Large enough that a copy in the page data shows in the size, with characters that the inline script escapes.
const MARKUP = `<div class="pl-stage" data-s="aaaaaaaaaaaaaaaaaaaa">${'<a href="/movie/1-a">A &amp; B</a>'.repeat(600)}</div>`
const CHROME =
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
const CLIENTS: Record<string, Record<string, string>> = {
	curl: { "user-agent": "curl/8.10.1", accept: "*/*" },
	// A link preview or a script with a browser's user agent and no navigation headers.
	fetchWithBrowserAgent: { "user-agent": CHROME, accept: "*/*", "accept-language": "en-US,en;q=0.9" },
	browser: {
		"user-agent": CHROME,
		accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
		"accept-language": "en-US,en;q=0.9",
		"sec-fetch-dest": "document",
		"sec-fetch-mode": "navigate",
		"sec-fetch-site": "none",
		"sec-ch-ua-mobile": "?0",
	},
	googlebot: {
		"user-agent":
			"Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
		accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
	},
}

function Root() {
	return createElement(
		"html",
		null,
		createElement("head"),
		createElement("body", null, createElement(Outlet), createElement(Scripts)),
	)
}
function Title() {
	const data = useLoaderData<{ relatedMap: { html?: string } }>()
	return createElement("section", {
		"data-related-map": "",
		"data-pl-root": "m1",
		dangerouslySetInnerHTML: { __html: data.relatedMap.html ?? "" },
	})
}

const route = (id: string, parentId: string | undefined, path: string, module: object) => ({
	id,
	parentId,
	path,
	module,
})
const asset = (id: string, parentId: string | undefined, path: string, hasLoader: boolean) => ({
	id,
	parentId,
	path,
	module: `/assets/${id}.js`,
	imports: [],
	hasLoader,
	hasAction: false,
	hasClientLoader: false,
	hasClientAction: false,
	hasErrorBoundary: false,
})

async function site(t: TestContext) {
	const cache = createPageCache()
	let renders = 0
	function handleRequest(
		request: Request,
		status: number,
		headers: Headers,
		remixContext: Parameters<typeof withoutRelatedMapMarkup>[0],
	) {
		renders++
		const context = withoutRelatedMapMarkup(remixContext)
		const html = `<!DOCTYPE html>${renderToString(
			createElement(RemixServer, { context: context as never, url: request.url }),
		)}`
		headers.set("Content-Type", "text/html")
		headers.set("Cache-Control", SHARED_PAGE_CACHE_CONTROL)
		const decision = applyCachePolicy(request, status, headers)
		cache.wants(request, status, headers, decision, SHARED_PAGE_CACHE_CONTROL)?.(Buffer.from(html))
		return new Response(html, { status, headers })
	}
	const build = {
		mode: "production",
		basename: "/",
		publicPath: "/",
		assetsBuildDirectory: "build/client",
		isSpaMode: false,
		future: {},
		entry: { module: { default: handleRequest } },
		routes: {
			root: route("root", undefined, "", { default: Root }),
			"routes/title": route("routes/title", "root", "movie/:key", {
				default: Title,
				loader: () => ({ relatedMap: { script: null, html: MARKUP } }),
			}),
		},
		assets: {
			url: "/assets/manifest.js",
			version: "test",
			entry: { module: "/assets/entry.client.js", imports: [] },
			routes: {
				root: asset("root", undefined, "", false),
				"routes/title": asset("routes/title", "root", "movie/:key", true),
			},
		},
	}
	const remix = createRequestHandler(build as never, "production")
	const server = createServer(async (incoming: IncomingMessage, outgoing) => {
		const headers = new Headers()
		for (const [name, value] of Object.entries(incoming.headers))
			if (typeof value === "string") headers.set(name, value)
		const response = await remix(new Request(`http://${incoming.headers.host}${incoming.url}`, { headers }))
		outgoing.writeHead(response.status, Object.fromEntries(response.headers))
		outgoing.end(Buffer.from(await response.arrayBuffer()))
	})
	putPageCacheFirst(server, cache)
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
	t.after(() => {
		cache.stop()
		server.closeAllConnections()
		server.close()
	})
	const port = (server.address() as AddressInfo).port
	const get = (client: string, path = "/movie/1-a") =>
		new Promise<{ cache: string; html: string }>((resolve, reject) => {
			const req = httpRequest(
				{
					hostname: "127.0.0.1",
					port,
					path,
					headers: { host: "example.test", "accept-encoding": "br", ...CLIENTS[client] },
				},
				(res) => {
					const parts: Buffer[] = []
					res.on("data", (chunk) => parts.push(chunk))
					res.on("end", () => {
						const body = Buffer.concat(parts)
						resolve({
							cache: String(res.headers["gw-page-cache"] ?? ""),
							html: (res.headers["content-encoding"] === "br" ? brotliDecompressSync(body) : body).toString(),
						})
					})
				},
			)
			req.on("error", reject)
			req.end()
		})
	// The page cache compresses a stored page after the response: wait until it is stored.
	const settle = async () => {
		for (let i = 0; i < 200 && cache.stats().flights > 0; i++) await new Promise((r) => setTimeout(r, 5))
	}
	const visit = async (client: string) => {
		const answer = await get(client)
		await settle()
		return answer
	}
	return { visit, get, cache, renders: () => renders }
}

const copies = (html: string, text: string) => html.split(text).length - 1
const pageData = (html: string) => html.match(/window\.__remixContext = (.*?);<\/script>/s)?.[1] ?? ""

/** The page a later browser and Googlebot get after `first` visited twice, which stores the page. */
async function laterPages(t: TestContext, first: string[]) {
	const s = await site(t)
	for (const client of first) await s.visit(client)
	const browser = await s.visit("browser")
	const googlebot = await s.visit("googlebot")
	return { browser, googlebot, s }
}

test("a page stored from a non-browser request is the lean page every later browser and Googlebot get", async (t) => {
	const nonBrowserFirst = await laterPages(t, ["curl", "curl", "fetchWithBrowserAgent", "fetchWithBrowserAgent"])
	const browserFirst = await laterPages(t, ["browser", "browser", "googlebot", "googlebot"])
	for (const order of [nonBrowserFirst, browserFirst])
		for (const page of [order.browser, order.googlebot]) {
			assert.equal(page.cache, "hit")
			// The markup is in the section once, and the page data leaves it out.
			assert.equal(copies(page.html, '<a href="/movie/1-a">'), 600)
			assert.ok(pageData(page.html).includes('"relatedMap":{"script":null}'), pageData(page.html))
		}
	assert.equal(nonBrowserFirst.browser.html, browserFirst.browser.html)
	assert.equal(nonBrowserFirst.googlebot.html, browserFirst.googlebot.html)
	// The stored copies are the ones the first clients got: no client's render differs.
	assert.equal(nonBrowserFirst.s.renders(), 4)
})

test("every document render leaves the markup out of the page data, whatever the request's headers", async (t) => {
	const s = await site(t)
	const pages = await Promise.all(Object.keys(CLIENTS).map((client) => s.get(client, `/movie/1-a?${client}`)))
	for (const page of pages) {
		assert.equal(page.cache, "miss")
		assert.equal(copies(page.html, '<a href="/movie/1-a">'), 600)
		assert.equal(pageData(page.html).includes("pl-stage"), false)
	}
	// The bodies differ only in the address that Remix writes into the page data.
	const strip = (html: string) => html.replace(/\?[A-Za-z]+/g, "")
	for (const page of pages) assert.equal(strip(page.html), strip(pages[0].html))
})

test("a navigation inside the app gets the markup in the loader's data", async (t) => {
	const s = await site(t)
	const answer = await s.get("fetchWithBrowserAgent", "/movie/1-a?_data=routes%2Ftitle")
	assert.equal(JSON.parse(answer.html).relatedMap.html, MARKUP)
})

test("the page data is rewritten the way Remix writes it, and left alone without the markup", () => {
	const loaderData = {
		root: { user: null },
		"routes/title": { relatedMap: { script: "/assets/m.js", html: "<b>a</b>" }, text: "</script>\u2028&" },
	}
	const escape = (json: string) =>
		json.replace(/[&><\u2028\u2029]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`)
	const context = {
		serverHandoffString: escape(JSON.stringify({ basename: "/", state: { loaderData } })),
		staticHandlerContext: { loaderData },
	}
	const out = withoutRelatedMapMarkup(context)
	assert.equal(
		out.serverHandoffString,
		escape(
			JSON.stringify({
				basename: "/",
				state: {
					loaderData: {
						root: { user: null },
						"routes/title": { relatedMap: { script: "/assets/m.js" }, text: "</script>\u2028&" },
					},
				},
			}),
		),
	)
	// The render reads the loader's data with the markup.
	assert.equal(out.staticHandlerContext.loaderData["routes/title"].relatedMap.html, "<b>a</b>")
	const plain = { serverHandoffString: "{}", staticHandlerContext: { loaderData: { root: {} } } }
	assert.equal(withoutRelatedMapMarkup(plain), plain)
})
