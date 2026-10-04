import assert from "node:assert/strict"
import { channel } from "node:diagnostics_channel"
import {
	type IncomingHttpHeaders,
	IncomingMessage,
	ServerResponse,
	createServer,
	request as httpRequest,
} from "node:http"
import type { AddressInfo, Socket } from "node:net"
import { Duplex } from "node:stream"
import { type TestContext, test } from "node:test"
import {
	brotliCompressSync,
	brotliDecompressSync,
	gunzipSync,
	gzipSync,
} from "node:zlib"
import {
	SHARED_PAGE_CACHE_CONTROL,
	applyCachePolicy,
} from "./cache-identity.server.ts"
import { SHARE_LIST_PAGE_CACHE_CONTROL } from "../utils/auth-cookie.ts"
import { HtmlStream } from "./html-stream.server.ts"
import {
	renderMetrics,
	resetMetricsForTest,
} from "./metrics/registry.server.ts"
import {
	type PageCacheOptions,
	TRACKING_PARAMETERS,
	createPageCache,
	normalizePageUrl,
	pageCacheKey,
	pageCacheWants,
	putPageCacheFirst,
	restoreTracking,
	startPageCache,
	stripTracking,
} from "./page-cache.server.ts"

const tick = () => new Promise<void>((resolve) => setImmediate(resolve))
function deferred<T = void>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((done) => {
		resolve = done
	})
	return { promise, resolve }
}
async function until(check: () => boolean) {
	for (let i = 0; i < 2000; i++) {
		if (check()) return
		await new Promise((resolve) => setTimeout(resolve, 1))
	}
	assert.fail("condition did not settle")
}
type Answer = { status: number; headers: IncomingHttpHeaders; body: Buffer }
const decode = (answer: Answer) =>
	(answer.headers["content-encoding"] === "br"
		? brotliDecompressSync(answer.body)
		: answer.headers["content-encoding"] === "gzip"
			? gunzipSync(answer.body)
			: answer.body
	).toString()

async function fixture(t: TestContext, options: PageCacheOptions = {}) {
	// The default exercises TCP. Restricted sandboxes can exercise the same Node HTTP objects in memory.
	const memory = process.env.PAGE_CACHE_TEST_MEMORY === "1"
	const cache = createPageCache(options)
	const app = {
		calls: 0,
		status: 200,
		policy: SHARED_PAGE_CACHE_CONTROL,
		cookie: false,
		errored: false,
		body: "<html>complete</html>",
		delay: undefined as Promise<void> | undefined,
		urls: [] as string[],
		location: "",
	}
	const server = createServer(async (incoming, response) => {
		app.calls++
		app.urls.push(incoming.url ?? "")
		const headers = new Headers()
		for (const [name, value] of Object.entries(incoming.headers))
			if (value !== undefined)
				headers.set(name, Array.isArray(value) ? value.join(", ") : value)
		const request = new Request(
			`http://${incoming.headers.host}${incoming.url}`,
			{ method: incoming.method, headers },
		)
		const body = Buffer.from(
			`${app.body}:${headers.get("accept-language") ?? "en-US"}`,
		)
		if (app.delay) await app.delay
		if (response.destroyed) return
		const outgoing = new Headers({
			"Cache-Control": app.policy,
			"Content-Type": "text/html",
			"X-Custom": "preserved",
		})
		if (app.cookie) outgoing.set("Set-Cookie", "foo=bar")
		if (app.location) response.setHeader("Location", app.location)
		const decision = applyCachePolicy(request, app.status, outgoing)
		const offer = cache.wants(
			request,
			app.status,
			outgoing,
			decision,
			app.policy,
		)
		if (!app.errored) offer?.(body)
		response.writeHead(app.status, Object.fromEntries(outgoing))
		response.end(incoming.method === "HEAD" ? undefined : body)
	})
	putPageCacheFirst(server, cache)
	if (!memory)
		await new Promise<void>((resolve, reject) => {
			server.once("error", reject)
			server.listen(0, "127.0.0.1", resolve)
		})
	t.after(() => {
		cache.stop()
		server.closeAllConnections()
		server.close()
	})
	const port = memory ? 0 : (server.address() as AddressInfo).port
	function inMemory(
		path: string,
		headers: Record<string, string>,
		method: string,
	) {
		const parts: Buffer[] = []
		const socket = new Duplex({
			read() {},
			write(chunk, _encoding, callback) {
				parts.push(Buffer.from(chunk))
				callback()
			},
		})
		const incoming = new IncomingMessage(socket as Socket)
		incoming.method = method
		incoming.url = path
		incoming.headers = headers
		const response = new ServerResponse(incoming)
		response.assignSocket(socket as Socket)
		socket.once("close", () => response.emit("close"))
		const promise = new Promise<Answer>((resolve) =>
			response.once("finish", () => {
				const wire = Buffer.concat(parts)
				const split = wire.indexOf("\r\n\r\n")
				const result: IncomingHttpHeaders = {}
				for (const line of wire
					.subarray(0, split)
					.toString()
					.split("\r\n")
					.slice(1)) {
					const colon = line.indexOf(":")
					result[line.slice(0, colon).toLowerCase()] = line
						.slice(colon + 1)
						.trim()
				}
				response.emit("close")
				resolve({
					status: response.statusCode,
					headers: result,
					body: wire.subarray(split + 4),
				})
			}),
		)
		server.emit("request", incoming, response)
		return { promise, destroy: () => response.destroy() }
	}
	function get(
		path = "/page",
		headers: Record<string, string> = {},
		method = "GET",
	): Promise<Answer> {
		if (memory)
			return inMemory(
				path,
				{ host: "example.test", "accept-encoding": "gzip", ...headers },
				method,
			).promise
		return new Promise((resolve, reject) => {
			const req = httpRequest(
				{
					hostname: "127.0.0.1",
					port,
					path,
					method,
					headers: {
						host: "example.test",
						"accept-encoding": "gzip",
						...headers,
					},
				},
				(res) => {
					const parts: Buffer[] = []
					res.on("data", (chunk) => parts.push(chunk))
					res.on("end", () =>
						resolve({
							status: res.statusCode ?? 0,
							headers: res.headers,
							body: Buffer.concat(parts),
						}),
					)
				},
			)
			req.on("error", reject)
			req.end()
		})
	}
	async function warm(path = "/page", headers: Record<string, string> = {}) {
		await get(path, headers)
		await until(() => cache.stats().flights === 0)
		const answer = await get(path, headers)
		await until(() => cache.stats().flights === 0)
		return answer
	}
	function disconnectable(path: string) {
		if (memory) return inMemory(path, { host: "example.test" }, "GET")
		const req = httpRequest({
			hostname: "127.0.0.1",
			port,
			path,
			headers: { host: "example.test" },
		})
		req.on("error", () => {})
		req.end()
		return req
	}
	return { cache, app, get, warm, disconnectable }
}

test("admission requires two requests in one window; third request skips the app", async (t) => {
	let now = 0
	const f = await fixture(t, { now: () => now })
	const first = await f.get()
	await until(() => f.cache.stats().flights === 0)
	assert.equal(f.cache.stats().entries, 0)
	const second = await f.get()
	await until(() => f.cache.stats().entries === 1)
	const third = await f.get()
	assert.equal(third.headers["gw-page-cache"], "hit")
	assert.equal(decode(third), decode(second))
	assert.equal(decode(first), decode(second))
	assert.equal(f.app.calls, 2)
	await f.get("/slow")
	await until(() => f.cache.stats().flights === 0)
	now += 60_001
	await f.get("/slow")
	await until(() => f.cache.stats().flights === 0)
	assert.equal(f.cache.stats().entries, 1)
})

test("normalization drops only decoded tracking names and keeps exact real parameter bytes", () => {
	for (const name of TRACKING_PARAMETERS) {
		const tracking = name === "utm_*" ? "utm_source" : name
		assert.equal(normalizePageUrl(`/x?${tracking}=value`), "/x")
		assert.equal(
			normalizePageUrl(`/x?a=%2f+%20&${tracking}=value&b=2`),
			"/x?a=%2f+%20&b=2",
		)
	}
	assert.equal(
		normalizePageUrl("/x?%75tm_source=z&UTM_source=kept&%xx=kept"),
		"/x?UTM_source=kept&%xx=kept",
	)
	assert.equal(normalizePageUrl("/x?"), "/x")
	assert.equal(
		normalizePageUrl("http://example.test/a/../x?q=1&fbclid=2"),
		"/x?q=1",
	)
	assert.deepEqual(
		pageCacheKey({ url: "/x?a=1", host: "EXAMPLE.test" }),
		pageCacheKey({ url: "http://example.test/x?a=1", host: "example.test" }),
	)
})

test("tracking variants hit the same entry; query and host remain separate; the app never sees tracking parameters", async (t) => {
	const f = await fixture(t)
	await f.warm("/page?a=%2f&b=2")
	for (const path of [
		"/page?utm_source=x&a=%2f&fbclid=z&b=2&gclid=y",
		"/page?a=%2f&b=2&utm_medium=x",
		"/page?fbclid=y&a=%2f&b=2",
	])
		assert.equal((await f.get(path)).headers["gw-page-cache"], "hit")
	assert.equal(
		(await f.get("/page?a=%2F&b=2")).headers["gw-page-cache"],
		"miss",
	)
	assert.equal(
		(await f.get("/page?a=%2f&b=2", { host: "other.test" })).headers[
			"gw-page-cache"
		],
		"miss",
	)
	await f.get("/other?utm_source=one&fbclid=visitor-one")
	await f.get("/other?fbclid=visitor-two")
	await until(() => f.cache.stats().entries === 2)
	assert.deepEqual(
		f.app.urls.filter((url) => url.startsWith("/other")),
		["/other", "/other"],
	)
	assert.equal((await f.get("/other?")).headers["gw-page-cache"], "hit")
	assert.equal((await f.get("/other")).headers["gw-page-cache"], "hit")
	// A real parameter next to tracking ones stays, in place.
	await f.get("/third?utm_source=x&q=1&gclid=y&r=2")
	assert.equal(f.app.urls.at(-1), "/third?q=1&r=2")
})

test("a target that starts with two slashes is a path, not a host, and a target that doesn't parse goes to the app", async (t) => {
	const f = await fixture(t)
	await f.warm("/page")
	const other = await f.get("//x/page")
	assert.notEqual(other.headers["gw-page-cache"], "hit")
	assert.notDeepEqual(
		pageCacheKey({ url: "//x/page", host: "example.test" }),
		pageCacheKey({ url: "/page", host: "example.test" }),
	)
	assert.deepEqual(
		pageCacheKey({ url: "//x/page", host: "example.test" }),
		pageCacheKey({ url: "http://example.test//x/page", host: "example.test" }),
	)
	assert.throws(() => pageCacheKey({ url: "*", host: "example.test" }))
})

test("stripTracking works on the raw target and restoreTracking puts the parameters back on a redirect", () => {
	assert.deepEqual(stripTracking("/x"), { url: "/x", dropped: "" })
	assert.deepEqual(stripTracking("/x?a=1&&b"), {
		url: "/x?a=1&&b",
		dropped: "",
	})
	assert.deepEqual(stripTracking("/x?"), { url: "/x", dropped: "" })
	assert.deepEqual(stripTracking("/a/../x?utm_source=s&a=%2f&fbclid=f"), {
		url: "/a/../x?a=%2f",
		dropped: "utm_source=s&fbclid=f",
	})
	assert.equal(restoreTracking("/y", "fbclid=f"), "/y?fbclid=f")
	assert.equal(restoreTracking("/y?a=1#top", "fbclid=f"), "/y?a=1&fbclid=f#top")
	assert.equal(
		restoreTracking("https://other.test/y", "fbclid=f"),
		"https://other.test/y",
	)
	assert.equal(restoreTracking("//other.test/y", "fbclid=f"), "//other.test/y")
	assert.equal(restoreTracking("/y", ""), "/y")
})

test("a redirect of a request with tracking parameters keeps them", async (t) => {
	const f = await fixture(t)
	f.app.status = 301
	f.app.location = "/canonical?a=1"
	const answer = await f.get("/old?a=1&utm_source=share&fbclid=abc")
	assert.equal(answer.status, 301)
	assert.equal(
		answer.headers.location,
		"/canonical?a=1&utm_source=share&fbclid=abc",
	)
	assert.equal(f.app.urls.at(-1), "/old?a=1")
	const plain = await f.get("/old?a=1")
	assert.equal(plain.headers.location, "/canonical?a=1")
})

test("the fresh time can be capped below the response's own policy", async (t) => {
	let now = 0
	const f = await fixture(t, {
		now: () => now,
		limits: { MAX_FRESH_MS: 60_000 },
	})
	await f.warm()
	const entry = [...f.cache.entries.values()][0]
	assert.equal(entry.freshUntil, 60_000)
	assert.equal(entry.staleUntil, 60_000 + 7_200_000)
	now = 59_999
	assert.equal((await f.get()).headers["gw-page-cache"], "hit")
	now = 60_000
	assert.equal((await f.get()).headers["gw-page-cache"], "stale")
})

test("locale and front-cache policy have separate entries and replay their headers", async (t) => {
	const f = await fixture(t)
	for (const language of ["de-DE", "en-US"])
		await f.warm("/page", { "accept-language": language })
	await f.warm("/page", {
		"gw-cache-identity": "anon;DE;de",
		"accept-language": "de-DE",
	})
	for (const language of ["de-DE", "en-US"]) {
		const hit = await f.get("/page", { "accept-language": language })
		assert.equal(decode(hit), `<html>complete</html>:${language}`)
		assert.equal(hit.headers["cache-control"], "private, max-age=0")
		assert.equal(hit.headers.vary, "Accept-Language, Accept-Encoding")
	}
	const shared = await f.get("/page", { "gw-cache-identity": "anon;DE;de" })
	assert.equal(shared.headers["cache-control"], SHARED_PAGE_CACHE_CONTROL)
	assert.equal(shared.headers.vary, "GW-Cache-Identity, Accept-Encoding")
	assert.equal(shared.headers["gw-cache-identity"], "anon;DE;de")
	assert.equal(f.cache.stats().entries, 3)
})

test("members never read, count, lead or join; ordinary cookies do not bypass", async (t) => {
	const previous = process.env.SUPABASE_URL
	process.env.SUPABASE_URL = "https://pagecache.supabase.co"
	t.after(() => {
		if (previous === undefined)
			Reflect.deleteProperty(process.env, "SUPABASE_URL")
		else process.env.SUPABASE_URL = previous
	})
	resetMetricsForTest()
	const f = await fixture(t)
	await f.warm()
	const before = f.cache.stats()
	for (const path of ["/page", "/member", "/member", "/member"])
		assert.equal(
			(await f.get(path, { cookie: "sb-pagecache-auth-token.0=forged" }))
				.headers["gw-page-cache"],
			"bypass",
		)
	assert.deepEqual(f.cache.stats(), before)
	const counted = renderMetrics()
	assert.match(
		counted,
		/goodwatch_page_cache_requests_total\{route="page",result="bypass",audience="member"\} 4/,
	)
	assert.doesNotMatch(
		counted,
		/goodwatch_page_cache_requests_total\{[^}]*result="(?:hit|stale|joined|miss)",audience="member"\}/,
	)
	assert.equal(
		(await f.get("/page", { cookie: "_ga=123; ph_foo=bar; gw_browser=1" }))
			.headers["gw-page-cache"],
		"hit",
	)
})

test("non-pages pass untouched; eligibility and gate bypass precede lookup", async (t) => {
	const f = await fixture(t)
	for (const path of [
		"/health/ready",
		"/health/custom",
		"/api/foo",
		"/og/foo",
		"/assets/foo",
		"/foo/bar.png",
		"/page?_data=routes/x",
	])
		assert.equal((await f.get(path)).headers["gw-page-cache"], undefined)
	assert.equal(
		(await f.get("/page", {}, "POST")).headers["gw-page-cache"],
		undefined,
	)
	assert.equal(
		(await f.get(`/page?x=${"a".repeat(2048)}`)).headers["gw-page-cache"],
		"bypass",
	)
	const gated = "/person/123-name?genre=Drama"
	for (let i = 0; i < 3; i++)
		assert.equal((await f.get(gated)).headers["gw-page-cache"], "bypass")
	assert.equal(f.cache.stats().admission_keys, 0)
	await f.warm(gated, { cookie: "gw_browser=1" })
	assert.equal(
		(await f.get(gated, { cookie: "gw_browser=1" })).headers["gw-page-cache"],
		"hit",
	)
	assert.equal((await f.get(gated)).headers["gw-page-cache"], "bypass")
})

test("errors, redirects, cookies, private routes and render errors never store", async (t) => {
	for (const change of [
		{ status: 404 },
		{ status: 500 },
		{ status: 301 },
		{ cookie: true },
		{ policy: "private, no-store" },
		{ errored: true },
	]) {
		const f = await fixture(t)
		Object.assign(f.app, change)
		for (let i = 0; i < 3; i++) await f.get()
		await until(() => f.cache.stats().flights === 0)
		assert.equal(f.cache.stats().entries, 0)
	}
})

test("HEAD, all encodings, cross-variant validators and stored headers", async (t) => {
	const f = await fixture(t)
	await f.get("/head", {}, "HEAD")
	assert.deepEqual(f.cache.stats(), {
		entries: 0,
		bytes: 0,
		flights: 0,
		waiters: 0,
		admission_keys: 0,
	})
	const original = await f.warm()
	const tags: string[] = []
	for (const encoding of [
		"br",
		"gzip",
		"identity",
		"br;q=0,gzip;q=1",
		"*;q=0",
	]) {
		const hit = await f.get("/page", { "accept-encoding": encoding })
		assert.equal(decode(hit), decode(original))
		assert.equal(
			hit.headers["content-encoding"],
			encoding === "br" ? "br" : encoding.includes("gzip") ? "gzip" : undefined,
		)
		assert.equal(hit.headers["x-custom"], "preserved")
		assert.equal(Number(hit.headers["content-length"]), hit.body.length)
		tags.push(hit.headers.etag as string)
		const head = await f.get("/page", { "accept-encoding": encoding }, "HEAD")
		assert.equal(head.body.length, 0)
		assert.equal(head.headers["content-length"], hit.headers["content-length"])
		assert.equal(head.headers.etag, hit.headers.etag)
	}
	for (const tag of [...tags, "*", `"other", W/${tags[0]}`]) {
		const answer = await f.get("/page", { "if-none-match": tag })
		assert.equal(answer.status, 304)
		assert.equal(answer.body.length, 0)
		assert.equal(answer.headers["cache-control"], "private, max-age=0")
		assert.equal(answer.headers.etag, tags[1])
	}
	assert.equal(
		(await f.get("/page", { "if-none-match": '"wrong"' })).status,
		200,
	)
})

test("50 cold requests share one admitted render", async (t) => {
	resetMetricsForTest()
	const f = await fixture(t)
	await f.get()
	await until(() => f.cache.stats().flights === 0)
	const gate = deferred()
	f.app.delay = gate.promise
	const pending = Array.from({ length: 50 }, () => f.get())
	await until(() => f.cache.stats().waiters === 49)
	assert.equal(f.app.calls, 2)
	gate.resolve()
	const answers = await Promise.all(pending)
	assert.ok(answers.every((a) => a.headers["gw-page-cache"] === "miss"))
	assert.ok(answers.every((a) => decode(a) === decode(answers[0])))
	assert.match(
		renderMetrics(),
		/goodwatch_page_cache_requests_total\{route="page",result="joined",audience="anon"\} 49/,
	)
	assert.equal(f.cache.stats().waiters, 0)
})

test("unstorable leaders release waiters; pass periods double and probes never collect waiters", async (t) => {
	let now = 0
	const f = await fixture(t, { now: () => now })
	f.app.policy = "private, no-store"
	const gate = deferred()
	f.app.delay = gate.promise
	const one = f.get()
	await until(() => f.app.calls === 1)
	const two = f.get()
	await until(() => f.cache.stats().waiters === 1)
	gate.resolve()
	await Promise.all([one, two])
	const row = [...f.cache.admission.values()][0]
	assert.equal(row.passUntil, 5000)
	await f.get()
	assert.equal(f.cache.stats().flights, 0)
	for (let streak = 2; streak <= 8; streak++) {
		now = row.passUntil
		// Keep this probe admitted even when a capped pass outlives the admission window.
		row.windowStart = now
		row.count = 2
		const blocked = deferred()
		f.app.delay = blocked.promise
		const pending = f.get()
		await until(() => f.cache.stats().flights === 1)
		assert.equal([...f.cache.flights.values()][0].joinable, false)
		blocked.resolve()
		await pending
		await until(() => f.cache.stats().flights === 0)
		assert.equal(
			row.passUntil - now,
			Math.min(5000 * 2 ** (streak - 1), 300_000),
		)
	}
})

test("wait timeout passes a waiter to the app and disconnect drops it", async (t) => {
	const f = await fixture(t, { limits: { JOIN_WAIT_MS: 20 } })
	const gate = deferred()
	f.app.delay = gate.promise
	const leader = f.get()
	await until(() => f.app.calls === 1)
	const waiter = f.get()
	await until(() => f.app.calls === 2)
	assert.equal(f.cache.stats().waiters, 0)
	gate.resolve()
	await Promise.all([leader, waiter])
	await until(() => f.cache.stats().flights === 0)
	const block = deferred()
	f.app.delay = block.promise
	const pending = f.get("/disconnect")
	await until(() => f.cache.stats().flights === 1)
	const req = f.disconnectable("/disconnect")
	await until(() => f.cache.stats().waiters === 1)
	req.destroy()
	await until(() => f.cache.stats().waiters === 0)
	block.resolve()
	await pending
})

test("stale refresh is single-flight, renders the URL without tracking parameters with safe headers, and replaces the body", async (t) => {
	let now = 0
	let renders = 0
	const gate = deferred()
	const f = await fixture(t, {
		now: () => now,
		render: async (request) => {
			renders++
			assert.equal(new URL(request.url).pathname, "/page")
			assert.equal(new URL(request.url).search, "")
			assert.equal(request.headers.get("if-none-match"), null)
			assert.equal(request.headers.get("range"), null)
			assert.equal(request.headers.get("x-remove"), null)
			assert.equal(request.headers.get("cookie"), "gw_browser=1")
			await gate.promise
			const headers = new Headers({
				"Cache-Control": SHARED_PAGE_CACHE_CONTROL,
			})
			const decision = applyCachePolicy(request, 200, headers)
			f.cache.wants(request, 200, headers, decision)?.(Buffer.from("new HTML"))
			return { status: 200 }
		},
	})
	await f.warm()
	now = 1_800_000
	const triggering = {
		cookie: "gw_browser=1",
		"if-none-match": '"wrong"',
		range: "bytes=1-2",
		connection: "x-remove",
		"x-remove": "secret",
	}
	for (let i = 0; i < 5; i++)
		assert.equal(
			(await f.get("/page?utm_source=original", triggering)).headers[
				"gw-page-cache"
			],
			"stale",
		)
	assert.equal(renders, 1)
	gate.resolve()
	await until(() => f.cache.stats().flights === 0)
	const hit = await f.get()
	assert.equal(hit.headers["gw-page-cache"], "hit")
	assert.equal(decode(hit), "new HTML")
})

test("refresh errors pause, unstorable refreshes retain stale data, 404 removes, and expiry sweeps", async (t) => {
	let now = 0
	let renders = 0
	let status = 500
	const f = await fixture(t, {
		now: () => now,
		render: async () => {
			renders++
			return { status }
		},
	})
	await f.warm()
	now = 1_800_000
	await f.get()
	await until(() => f.cache.stats().flights === 0)
	await f.get()
	assert.equal(renders, 1)
	assert.equal(f.cache.stats().entries, 1)
	now += 30_000
	status = 200
	await f.get()
	await until(() => f.cache.stats().flights === 0)
	assert.equal(f.cache.stats().entries, 1)
	now += 30_000
	status = 404
	await f.get()
	await until(() => f.cache.stats().flights === 0)
	assert.equal(f.cache.stats().entries, 0)
	await f.warm("/expire")
	now += 9_000_000
	f.cache.sweep()
	assert.equal(f.cache.stats().entries, 0)
	assert.equal(f.cache.stats().admission_keys, 0)
})

test("refresh timeout rejects late offers and compression errors release flights", async (t) => {
	let now = 0
	const gate = deferred()
	const f = await fixture(t, {
		now: () => now,
		limits: { REFRESH_TIMEOUT_MS: 10 },
		render: async (request) => {
			const headers = new Headers({
				"Cache-Control": SHARED_PAGE_CACHE_CONTROL,
			})
			const offer = f.cache.wants(request, 200, headers, "keyed")
			await gate.promise
			offer?.(Buffer.from("late"))
			return { status: 200 }
		},
	})
	await f.warm()
	now = 1_800_000
	await f.get()
	await until(() => f.cache.stats().flights === 0)
	gate.resolve()
	await tick()
	assert.equal(decode(await f.get()), "<html>complete</html>:en-US")
	const broken = await fixture(t, {
		compress: async () => {
			throw new Error("compression")
		},
	})
	await broken.warm()
	assert.equal(broken.cache.stats().entries, 0)
})

test("LRU entry and byte bounds preserve recently served entries and account exact bytes", async (t) => {
	const f = await fixture(t, { limits: { MAX_ENTRIES: 2 } })
	await f.warm("/a")
	await f.warm("/b")
	await f.get("/a")
	await f.warm("/c")
	assert.deepEqual(
		[...f.cache.entries.values()].map((e) => e.path),
		["/a", "/c"],
	)
	assert.equal(
		f.cache.stats().bytes,
		[...f.cache.entries.values()].reduce((n, e) => n + e.bytes, 0),
	)
	const bytes = await fixture(t, {
		limits: { MAX_BYTES: 2200 },
		compress: async () => ({ br: Buffer.alloc(20), gzip: Buffer.alloc(30) }),
	})
	for (const path of ["/a", "/b", "/c"]) await bytes.warm(path)
	assert.equal(bytes.cache.stats().entries, 2)
	assert.equal(bytes.cache.stats().bytes, 2148)
	for (const limits of [{ MAX_HTML_BYTES: 1 }, { MAX_ENTRY_BYTES: 1 }]) {
		const small = await fixture(t, { limits })
		await small.warm()
		assert.equal(small.cache.stats().entries, 0)
	}
})

test("10,000 one-off URLs store nothing and admission remains bounded", async (t) => {
	const f = await fixture(t, { limits: { ADMIT_MAX_KEYS: 25 } })
	for (let i = 0; i < 10_000; i++) {
		await f.get(`/tail/${i}`)
		assert.ok(f.cache.stats().admission_keys <= 25)
	}
	assert.equal(f.cache.stats().entries, 0)
})

test("reset matches pathname across identities and queries and cancels pending compression", async (t) => {
	const f = await fixture(t)
	await f.warm("/u/a/lists/123?x=1")
	await f.warm("/u/a/lists/123?x=2", { "accept-language": "de-DE" })
	await f.warm("/other")
	assert.equal(
		f.cache.reset((path) => path.endsWith("/lists/123")),
		2,
	)
	assert.equal([...f.cache.entries.values()][0].path, "/other")
	const gate = deferred<{ br: Buffer; gzip: Buffer }>()
	const slow = await fixture(t, { compress: () => gate.promise })
	await slow.get()
	await slow.get()
	assert.equal(slow.cache.stats().flights, 1)
	slow.cache.reset()
	gate.resolve({ br: Buffer.from("old"), gzip: Buffer.from("old") })
	await tick()
	assert.equal(slow.cache.stats().entries, 0)
})

test("reset releases waiters and an old render cannot offer to a replacement flight", async (t) => {
	const f = await fixture(t)
	const gate = deferred()
	f.app.delay = gate.promise
	const leader = f.get()
	await until(() => f.cache.stats().flights === 1)
	const waiter = f.get()
	await until(() => f.cache.stats().waiters === 1)
	f.cache.reset()
	const replacement = f.get()
	await until(() => f.cache.stats().flights === 1)
	gate.resolve()
	await Promise.all([leader, waiter, replacement])
	await until(() => f.cache.stats().flights === 0)
	assert.equal(f.cache.stats().entries, 1)
})

test("shutdown releases waiters and bypasses further requests", async (t) => {
	const f = await fixture(t)
	const gate = deferred()
	f.app.delay = gate.promise
	const leader = f.get()
	await until(() => f.cache.stats().flights === 1)
	const waiter = f.get()
	await until(() => f.cache.stats().waiters === 1)
	f.cache.stop()
	gate.resolve()
	await Promise.all([leader, waiter])
	assert.equal((await f.get()).headers["gw-page-cache"], "bypass")
	assert.deepEqual(f.cache.stats(), {
		entries: 0,
		bytes: 0,
		flights: 0,
		waiters: 0,
		admission_keys: 0,
	})
})

test("off switch disables offers and automatic wrapping", async (t) => {
	const previous = { node: process.env.NODE_ENV, cache: process.env.PAGE_CACHE }
	t.after(() => {
		if (previous.node === undefined)
			Reflect.deleteProperty(process.env, "NODE_ENV")
		else process.env.NODE_ENV = previous.node
		if (previous.cache === undefined)
			Reflect.deleteProperty(process.env, "PAGE_CACHE")
		else process.env.PAGE_CACHE = previous.cache
	})
	process.env.NODE_ENV = "production"
	for (const off of ["off", "OFF", "0", "false", "FALSE"]) {
		process.env.PAGE_CACHE = off
		startPageCache()
		const app = () => {}
		const server = createServer(app)
		channel("http.server.request.start").publish({
			server,
			request: { socket: { localPort: Number(process.env.PORT) || 3000 } },
		})
		assert.deepEqual(server.listeners("request"), [app])
		assert.equal(
			pageCacheWants(new Request("http://x/page"), 200, new Headers(), "keyed"),
			null,
		)
	}
	const f = await fixture(t, { enabled: () => false })
	assert.equal((await f.get()).headers["gw-page-cache"], undefined)
	assert.equal(f.cache.stats().flights, 0)
})

test("flight and waiter limits pass excess requests through without growing state", async (t) => {
	const f = await fixture(t, { limits: { MAX_FLIGHTS: 1, MAX_WAITERS: 1 } })
	const gate = deferred()
	f.app.delay = gate.promise
	const leader = f.get()
	await until(() => f.app.calls === 1)
	const waiter = f.get()
	await until(() => f.cache.stats().waiters === 1)
	const busy = f.get()
	const other = f.get("/other")
	await until(() => f.app.calls === 3)
	assert.equal(f.cache.stats().flights, 1)
	assert.equal(f.cache.stats().waiters, 1)
	gate.resolve()
	await Promise.all([leader, waiter, busy, other])
	assert.equal(f.cache.stats().waiters, 0)
})

test("refresh flight limits include compression, and policy lifetimes come from the response", async (t) => {
	let now = 0
	let renders = 0
	const blocked = deferred()
	let blockCompression = false
	const f = await fixture(t, {
		now: () => now,
		limits: { MAX_REFRESHES: 1 },
		compress: async (html) => {
			if (blockCompression) await blocked.promise
			return { br: brotliCompressSync(html), gzip: gzipSync(html) }
		},
		render: async (request) => {
			renders++
			const headers = new Headers({
				"Cache-Control": "public, s-maxage=1, stale-while-revalidate=2",
			})
			f.cache.wants(request, 200, headers, "shared")?.(Buffer.from("new"))
			return { status: 200 }
		},
	})
	await f.warm("/a")
	await f.warm("/b")
	// Hold compression after the background renderer itself has settled.
	blockCompression = true
	now = 1_800_000
	await f.get("/a")
	await f.get("/b")
	assert.equal(renders, 1)
	blocked.resolve()
	await until(() => f.cache.stats().flights === 0)
	const entry = [...f.cache.entries.values()].find(
		(entry) => entry.path === "/a",
	)
	assert.ok(entry)
	assert.equal(entry.freshUntil, now + 1000)
	assert.equal(entry.staleUntil, now + 3000)
})

test("HtmlStream completion contains every pass and never runs for a destroyed stream", async () => {
	for (const passes of [["single"], ["one", "two", "three"]]) {
		const completed: Buffer[] = []
		const stream = new HtmlStream((html) => completed.push(html))
		stream.resume()
		for (const part of passes) {
			stream.write(part)
			stream.flush()
		}
		stream.end("last")
		await new Promise<void>((resolve) => stream.once("end", resolve))
		assert.equal(completed.length, 1)
		assert.equal(completed[0].toString(), `${passes.join("")}last`)
	}
	let completed = false
	const stream = new HtmlStream(() => {
		completed = true
	})
	stream.write("unfinished")
	stream.flush()
	stream.destroy()
	await tick()
	assert.equal(completed, false)
})

for (const shared of [false, true]) {
	for (const refresh of ["error", "private", "404"] as const) {
		test(`share list lifetime starts before rendering: shared=${shared}, refresh=${refresh}`, async (t) => {
			let now = 0
			let renders = 0
			const gate = deferred()
			const f = await fixture(t, {
				now: () => now,
				compress: async (html) => {
					now += 2000
					return { br: brotliCompressSync(html), gzip: gzipSync(html) }
				},
				render: async (request) => {
					renders++
					await gate.promise
					if (refresh === "error") throw new Error("failed refresh")
					const status = refresh === "404" ? 404 : 200
					const headers = new Headers({ "Cache-Control": "private, no-store" })
					assert.equal(
						f.cache.wants(
							request,
							status,
							headers,
							applyCachePolicy(request, status, headers),
						),
						null,
					)
					return { status }
				},
			})
			const path = "/u/filmfan/lists/AbCd012345"
			const headers: Record<string, string> = shared
				? { "gw-cache-identity": "anon;US;en" }
				: {}
			f.app.policy = SHARE_LIST_PAGE_CACHE_CONTROL
			await f.get(path, headers)
			await until(() => f.cache.stats().flights === 0)
			const renderGate = deferred()
			f.app.delay = renderGate.promise
			const pending = f.get(path, headers)
			await until(() => f.app.calls === 2)
			now = 3000
			renderGate.resolve()
			await pending
			await until(() => f.cache.stats().flights === 0)
			const entry = [...f.cache.entries.values()][0]
			assert.equal(entry.storedAt, 0)
			assert.equal(entry.freshUntil, 10_000)
			assert.equal(entry.staleUntil, 20_000)
			assert.equal((await f.get(path, headers)).headers.age, "5")
			now = 9999
			assert.equal((await f.get(path, headers)).headers["gw-page-cache"], "hit")
			const cookie = `sb-${new URL(process.env.SUPABASE_URL ?? "https://test.supabase.co").hostname.split(".")[0]}-auth-token=x`
			assert.equal(
				(await f.get(path, { ...headers, cookie })).headers["gw-page-cache"],
				"bypass",
			)
			now = 10_000
			for (let i = 0; i < 3; i++)
				assert.equal(
					(await f.get(path, headers)).headers["gw-page-cache"],
					"stale",
				)
			assert.equal(renders, 1)
			gate.resolve()
			await until(() => f.cache.stats().flights === 0)
			if (refresh === "404") assert.equal(f.cache.stats().entries, 0)
			else {
				now = 19_999
				assert.equal(
					(await f.get(path, headers)).headers["gw-page-cache"],
					"stale",
				)
				assert.equal(renders, 1)
			}
			f.app.policy = "private, no-store"
			now = 20_000
			for (const time of [20_000, 21_000]) {
				now = time
				assert.equal(
					(await f.get(path, headers)).headers["gw-page-cache"],
					"miss",
				)
				await until(() => f.cache.stats().flights === 0)
				assert.equal(f.cache.stats().entries, 0)
			}
		})
	}
}

test("compression that reaches the lifetime end refuses storage as expired", async (t) => {
	resetMetricsForTest()
	let now = 0
	const f = await fixture(t, {
		now: () => now,
		compress: async (html) => {
			now = 20_000
			return { br: brotliCompressSync(html), gzip: gzipSync(html) }
		},
	})
	f.app.policy = SHARE_LIST_PAGE_CACHE_CONTROL
	await f.warm()
	assert.equal(f.cache.stats().entries, 0)
	assert.match(
		renderMetrics(),
		/goodwatch_page_cache_not_stored_total\{route="page",reason="expired"\} 1/,
	)
})
