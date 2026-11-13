// The overload shedder: who may be shed, when the process counts as overloaded, and what a real server answers.
import assert from "node:assert/strict"
import { type Server, createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { after, before, test } from "node:test"
import {
	HOLD_MS,
	RETRY_AFTER_SECONDS,
	TICK_MS,
	createShedder,
	isOverloaded,
	isSheddable,
	putShedderFirst,
} from "./overload-shed.server.ts"

const SAFARI =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15"
const page = (
	url: string,
	headers: Record<string, string> = {},
	method = "GET",
) => ({
	method,
	url,
	headers: { "user-agent": SAFARI, ...headers },
})

test("an anonymous page request without the script cookie may be shed", () => {
	assert.equal(isSheddable(page("/movie/11587-the-exorcist-iii")), true)
	assert.equal(isSheddable(page("/person/5086499-ross-saxon")), true)
	assert.equal(isSheddable(page("/discover?q=Adult+Only+Context")), true)
	assert.equal(isSheddable(page("/show/1-x", {}, "HEAD")), true)
	assert.equal(isSheddable(page("/", { cookie: "theme=dark" })), true)
	// Crawlers that name themselves but aren't search engines.
	for (const agent of [
		"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 (compatible; Epochal-Search/1.0; +https://crawler.epochal.com)",
		"Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.3; +https://openai.com/gptbot)",
		"",
	])
		assert.equal(
			isSheddable(page("/movie/1-x", { "user-agent": agent })),
			true,
			agent,
		)
})

test("a browser that ran the site's scripts, and a member, are never shed", () => {
	assert.equal(
		isSheddable(page("/movie/1-x", { cookie: "a=b; gw_browser=1; c=d" })),
		false,
	)
	assert.equal(
		isSheddable(page("/movie/1-x", { cookie: "gw_browser=1" })),
		false,
	)
	assert.equal(
		isSheddable(page("/movie/1-x", { cookie: "gw.session_token=abc" })),
		false,
	)
	assert.equal(
		isSheddable(
			page("/movie/1-x", { cookie: "__Secure-gw.session_token=abc" }),
		),
		false,
	)
	assert.equal(
		isSheddable(page("/movie/1-x", { cookie: "sb-abc-auth-token=x" })),
		false,
	)
	// Not the cookie, only a similar name.
	assert.equal(
		isSheddable(page("/movie/1-x", { cookie: "gw_browser=0" })),
		true,
	)
	assert.equal(
		isSheddable(page("/movie/1-x", { cookie: "xgw_browser=1" })),
		true,
	)
})

test("APIs, data requests, writes, health, share cards and crawler files are never shed", () => {
	for (const url of [
		"/api/award-marks",
		"/api/combined-search?q=dune",
		"/movie/1-x?_data=routes%2Fmovie",
		"/movie/1-x?tab=cast&_data=routes%2Fmovie",
		"/mcp",
		"/.well-known/oauth-authorization-server",
		"/og/person/1-x.jpg?brand=D2",
		"/robots.txt",
		"/sitemap.xml",
		"/sitemap-movies-1.xml",
		"/favicon-32x32.png",
		"/site.webmanifest",
		"/health/ready",
		"/health/live",
	])
		assert.equal(isSheddable(page(url)), false, url)
	assert.equal(isSheddable(page("/movie/1-x", {}, "POST")), false)
	assert.equal(
		isSheddable({ method: "GET", url: undefined, headers: {} }),
		false,
	)
})

test("search engines, link previews and the status monitor are let through", () => {
	for (const agent of [
		"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
		"Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.122 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
		"Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36",
		"facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
		"Twitterbot/1.0",
		"Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
		"WhatsApp/2.23.20.0",
		"Uptime-Kuma/1.23.16",
	])
		assert.equal(
			isSheddable(page("/movie/1-x", { "user-agent": agent })),
			false,
			agent,
		)
})

test("overloaded means a late event loop or too many requests in the app", () => {
	const limits = { lagMs: 200, inFlight: 64 }
	assert.equal(isOverloaded({ lagMs: 0, inFlight: 0 }, limits), false)
	assert.equal(isOverloaded({ lagMs: 199, inFlight: 63 }, limits), false)
	assert.equal(isOverloaded({ lagMs: 200, inFlight: 0 }, limits), true)
	assert.equal(isOverloaded({ lagMs: 0, inFlight: 64 }, limits), true)
})

function clockedShedder() {
	let time = 1_000
	const shedder = createShedder({
		now: () => time,
		limits: { lagMs: 200, inFlight: 3 },
	})
	return {
		shedder,
		advance(ms: number) {
			time += ms
		},
		// Ticks on time for this long.
		run(ms: number) {
			for (let at = 0; at < ms; at += TICK_MS) {
				time += TICK_MS
				shedder.tick()
			}
		},
	}
}
const BOT = page("/movie/1-x")
const BROWSER = page("/movie/1-x", { cookie: "gw_browser=1" })

test("a process that runs on time sheds nothing", () => {
	const { shedder, run } = clockedShedder()
	run(5_000)
	assert.equal(shedder.state.lagMs, 0)
	assert.equal(shedder.shouldShed(BOT), false)
	assert.equal(shedder.takeReport(), null)
})

test("after a stall, the backlog is shed for a while, and then requests are served again", () => {
	const { shedder, advance, run } = clockedShedder()
	run(1_000)
	// A 2 second stall: the requests that queued up meanwhile arrive before the late tick has run.
	advance(2_000)
	assert.equal(shedder.shouldShed(BOT), true)
	assert.equal(shedder.shouldShed(BROWSER), false)
	shedder.tick()
	assert.ok(shedder.state.lagMs >= 1_900)
	// Still shed while the delay decays and during the hold after it.
	run(HOLD_MS - TICK_MS)
	assert.equal(shedder.shouldShed(BOT), true)
	run(HOLD_MS + 2_000)
	assert.ok(shedder.state.lagMs < 200)
	assert.equal(shedder.shouldShed(BOT), false)
})

test("too many requests in the app shed the anonymous ones until the hold ends", () => {
	const { shedder, run } = clockedShedder()
	run(500)
	shedder.entered()
	shedder.entered()
	assert.equal(shedder.shouldShed(BOT), false)
	shedder.entered()
	assert.equal(shedder.shouldShed(BOT), true)
	assert.equal(shedder.shouldShed(BROWSER), false)
	shedder.left()
	shedder.left()
	shedder.left()
	run(HOLD_MS - 200)
	assert.equal(shedder.shouldShed(BOT), true)
	run(400)
	assert.equal(shedder.shouldShed(BOT), false)
})

test("the report counts what was shed and resets", () => {
	const { shedder, advance } = clockedShedder()
	advance(1_000)
	shedder.tick()
	shedder.shed()
	shedder.shed()
	const report = shedder.takeReport()
	assert.equal(report?.shed, 2)
	assert.ok((report?.maxLagMs ?? 0) >= 900)
	assert.equal(shedder.takeReport(), null)
})

let server: Server
let base: string
let inFlightLimit: ReturnType<typeof createShedder>
before(async () => {
	inFlightLimit = createShedder({ limits: { lagMs: 10_000, inFlight: 1 } })
	let release: () => void = () => {}
	server = createServer((request, response) => {
		if (request.url === "/slow") {
			release = () => response.end("slow page")
			return
		}
		if (request.url === "/release") {
			release()
			return response.end("released")
		}
		response.end(`app ${request.url}`)
	})
	putShedderFirst(server, inFlightLimit)
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
	base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
after(() => server.close())

test("on a real server: the busy page goes to the anonymous request while the app is full, the rest is served", async () => {
	const fetchAs = (path: string, headers: Record<string, string> = {}) =>
		fetch(base + path, { headers: { "user-agent": SAFARI, ...headers } })
	assert.equal(await (await fetchAs("/movie/1-x")).text(), "app /movie/1-x")
	// One request held in the app fills it.
	const slow = fetchAs("/slow", { cookie: "gw_browser=1" })
	await new Promise((resolve) => setTimeout(resolve, 50))
	const busy = await fetchAs("/movie/2-y")
	assert.equal(busy.status, 503)
	assert.equal(busy.headers.get("retry-after"), String(RETRY_AFTER_SECONDS))
	assert.equal(busy.headers.get("cache-control"), "private, no-store")
	assert.equal(busy.headers.get("x-robots-tag"), "noindex")
	assert.equal(busy.headers.get("gw-overload"), "shed")
	const body = await busy.text()
	assert.match(body, /gw_browser=1/)
	assert.match(body, /location\.reload\(\)/)
	assert.ok(Buffer.byteLength(body) < 1_000)
	// A browser with the cookie, a member, an API call and a health check still reach the app.
	assert.equal(
		(await fetchAs("/movie/2-y", { cookie: "gw_browser=1" })).status,
		200,
	)
	assert.equal(
		(await fetchAs("/movie/2-y", { cookie: "gw.session_token=t" })).status,
		200,
	)
	assert.equal((await fetchAs("/api/award-marks")).status, 200)
	assert.equal((await fetchAs("/health/live")).status, 200)
	await fetchAs("/release", { cookie: "gw_browser=1" })
	assert.equal((await slow).status, 200)
})
