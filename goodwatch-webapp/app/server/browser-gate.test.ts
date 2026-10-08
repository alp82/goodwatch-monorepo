// The browser gate: which requests it answers before the app, with what, and that it runs first on a real server.
import assert from "node:assert/strict"
import { type Server, createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { after, before, test } from "node:test"
import {
	gateAnswer,
	putGateFirst,
	startBrowserGate,
	takeGateCounts,
} from "./browser-gate.server.ts"

const CHROME =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
const GOOGLEBOT =
	"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
const FILTERED = "/person/287-brad-pitt?genre=Drama&trait=crime"
const browser = { "user-agent": CHROME }
const withCookie = { ...browser, cookie: "a=b; gw_browser=1; c=d" }

test("a filtered person URL without the cookie gets the check at that URL", () => {
	const answer = gateAnswer("GET", FILTERED, browser)
	assert.equal(answer?.kind, "check")
	assert.equal(answer?.status, 403)
	assert.equal(answer?.headers.Location, undefined)
	assert.equal(answer?.headers["Cache-Control"], "private, no-store")
	assert.equal(answer?.headers["X-Robots-Tag"], "noindex")
	assert.equal(answer?.headers.Vary, "Cookie")
	assert.equal(
		answer?.headers["Content-Length"],
		String(Buffer.byteLength(answer?.body ?? "")),
	)
	assert.match(answer?.body ?? "", /<meta name="robots" content="noindex">/)
	assert.match(answer?.body ?? "", /location\.reload\(\)/)
})

test("the check is the same small response for every URL and echoes nothing", () => {
	const one = gateAnswer("GET", FILTERED, browser)
	const other = gateAnswer(
		"GET",
		'/person/1-x?genre="><script>alert(1)</script>',
		browser,
	)
	assert.equal(one, other)
	assert.ok(Buffer.byteLength(one?.body ?? "") < 700)
	assert.doesNotMatch(one?.body ?? "", /person|genre/)
	// No address that leads a crawler anywhere new.
	assert.deepEqual(
		[...(one?.body ?? "").matchAll(/href="([^"]*)"/g)].map((m) => m[1]),
		["?"],
	)
})

test("a filtered person URL with the cookie goes to the app", () => {
	assert.equal(gateAnswer("GET", FILTERED, withCookie), null)
	assert.equal(
		gateAnswer("GET", FILTERED, { ...browser, cookie: "gw_browser=1" }),
		null,
	)
})

test("a cookie with another name or value doesn't pass", () => {
	for (const cookie of ["xgw_browser=1", "gw_browser=10", "gw_browser=0", ""])
		assert.equal(
			gateAnswer("GET", FILTERED, { ...browser, cookie })?.kind,
			"check",
			cookie,
		)
})

test("an unfiltered person URL goes to the app, with or without the cookie", () => {
	for (const url of ["/person/287-brad-pitt", "/person/287-brad-pitt?"]) {
		assert.equal(gateAnswer("GET", url, browser), null)
		assert.equal(gateAnswer("GET", url, { "user-agent": GOOGLEBOT }), null)
		assert.equal(gateAnswer("GET", url, withCookie), null)
	}
})

test("a crawler that names itself is sent to the unfiltered page for good", () => {
	const answer = gateAnswer("GET", FILTERED, { "user-agent": GOOGLEBOT })
	assert.equal(answer?.kind, "crawler")
	assert.equal(answer?.status, 301)
	assert.equal(answer?.headers.Location, "/person/287-brad-pitt")
	assert.equal(answer?.body, "")
})

test("sign-in and sign-up with a return page are gated, the bare pages aren't", () => {
	for (const page of ["/sign-up", "/sign-in", "/sign-up/"]) {
		const url = `${page}?redirectTo=%2Fperson%2F1-x%3Fgenre%3DDrama`
		assert.equal(gateAnswer("GET", url, browser)?.kind, "check", page)
		assert.equal(gateAnswer("GET", url, withCookie), null, page)
		const crawler = gateAnswer("GET", url, { "user-agent": GOOGLEBOT })
		assert.equal(crawler?.status, 301, page)
		assert.equal(crawler?.headers.Location, page)
		assert.equal(gateAnswer("GET", page, browser), null, page)
		assert.equal(gateAnswer("GET", `${page}?other=1`, browser), null, page)
	}
})

test("other pages, loader data requests and other methods go to the app", () => {
	for (const url of [
		"/",
		"/movie/603-the-matrix?country=DE",
		"/discover/movies?genre=Drama",
		"/person/287-brad-pitt/extra?genre=Drama",
		"/persons/287?genre=Drama",
		`${FILTERED}&_data=routes%2Fperson.%24personKey`,
		"/person/287-brad-pitt?_data=routes%2Fperson.%24personKey",
	])
		assert.equal(gateAnswer("GET", url, browser), null, url)
	assert.equal(gateAnswer("POST", FILTERED, browser), null)
	assert.equal(gateAnswer(undefined, undefined, browser), null)
})

test("the old check page is gone for everyone", () => {
	for (const headers of [browser, withCookie, { "user-agent": GOOGLEBOT }]) {
		const answer = gateAnswer(
			"GET",
			"/browser-check?to=%2Fperson%2F1-x%3Fa%3Db",
			headers,
		)
		assert.equal(answer?.status, 410)
		assert.equal(answer?.headers["Cache-Control"], "private, no-store")
		assert.equal(answer?.headers.Location, undefined)
	}
})

// --- On a real server ---

let server: Server
let origin: string
let reachedApp: string[] = []

before(async () => {
	// The gate finds the server by itself, as it does under remix-serve.
	startBrowserGate()
	server = createServer((request, response) => {
		reachedApp.push(request.url ?? "")
		response.writeHead(200, { "Content-Type": "text/plain" })
		response.end("app")
	})
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
	origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
after(() => server.close())

const get = (
	path: string,
	headers: Record<string, string> = {},
	method = "GET",
) =>
	fetch(origin + path, {
		method,
		redirect: "manual",
		headers: { "user-agent": CHROME, ...headers },
	})

test("the first request to a server is already answered by the gate", async () => {
	reachedApp = []
	takeGateCounts()
	const response = await get(FILTERED)
	assert.equal(response.status, 403)
	assert.equal(response.headers.get("cache-control"), "private, no-store")
	assert.match(await response.text(), /gw_browser=1/)
	assert.deepEqual(reachedApp, [])
})

test("one request per filtered URL: no redirect, and the app never runs", async () => {
	reachedApp = []
	takeGateCounts()
	for (let i = 0; i < 5; i++) {
		const response = await get(`${FILTERED}&decade=${1970 + i * 10}`)
		assert.equal(response.status, 403)
		assert.equal(response.headers.get("location"), null)
		await response.arrayBuffer()
	}
	const head = await get(FILTERED, {}, "HEAD")
	assert.equal(head.status, 403)
	assert.equal(await head.text(), "")
	assert.equal((await get(FILTERED, { "user-agent": GOOGLEBOT })).status, 301)
	assert.equal((await get("/browser-check?to=%2F")).status, 410)
	assert.deepEqual(reachedApp, [])
	assert.deepEqual(takeGateCounts(), { check: 6, crawler: 1, gone: 1 })
	assert.deepEqual(takeGateCounts(), { check: 0, crawler: 0, gone: 0 })
})

test("with the cookie, and for unfiltered pages, the app answers", async () => {
	reachedApp = []
	const filtered = await get(FILTERED, { cookie: "gw_browser=1" })
	assert.equal(await filtered.text(), "app")
	const unfiltered = await get("/person/287-brad-pitt")
	assert.equal(await unfiltered.text(), "app")
	assert.deepEqual(reachedApp, [FILTERED, "/person/287-brad-pitt"])
})

test("putting the gate first keeps the listeners that were there", async () => {
	const seen: string[] = []
	const other = createServer((_, response) => {
		seen.push("first")
		response.end("app")
	})
	other.on("request", () => seen.push("second"))
	putGateFirst(other)
	await new Promise<void>((resolve) => other.listen(0, "127.0.0.1", resolve))
	const at = `http://127.0.0.1:${(other.address() as AddressInfo).port}`
	try {
		const headers = { "user-agent": CHROME }
		assert.equal((await fetch(`${at}${FILTERED}`, { headers })).status, 403)
		assert.deepEqual(seen, [])
		assert.equal(await (await fetch(`${at}/`, { headers })).text(), "app")
		assert.deepEqual(seen, ["first", "second"])
	} finally {
		other.close()
	}
})

test("the static hostname passes a gated URL to the file listener", () => {
	const server = createServer()
	let passed = false
	server.on("request", () => {
		passed = true
	})
	putGateFirst(server, (host) => host?.toLowerCase() === "static.example.com")
	server.emit(
		"request",
		{
			method: "GET",
			url: FILTERED,
			headers: { ...browser, host: "STATIC.EXAMPLE.COM" },
		},
		{
			writeHead() {
				assert.fail("the gate must not answer")
			},
			end() {
				assert.fail("the gate must not answer")
			},
		},
	)
	assert.equal(passed, true)
})
