// The Sentry tunnel must bound what a stranger can make it do, and must pass Sentry's back-off on to the SDK.
// No test reaches Sentry: every tunnel here sends to a local sink or to a stub.
import assert from "node:assert/strict"
import { type Server, createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { after, before, test } from "node:test"
import {
	SENTRY_HOST,
	SENTRY_PROJECT_IDS,
	type SentryTunnelOptions,
	createSentryTunnel,
} from "./sentry-tunnel.server.ts"

const PROJECT_ID = SENTRY_PROJECT_IDS[0]
// A made-up public key: the tunnel only checks the host and the project id.
const header = (host = SENTRY_HOST, projectId = PROJECT_ID) =>
	JSON.stringify({ dsn: `https://public@${host}/${projectId}` })
const envelope = (first = header()) =>
	`${first}\n{"type":"event"}\n{"message":"test"}\n`

const post = (body: BodyInit, headers: Record<string, string> = {}) =>
	new Request("https://goodwatch.app/api/e", { method: "POST", body, headers })

const neverSend: typeof fetch = () => {
	throw new Error("the tunnel must not call the upstream")
}

// The local sink that stands in for Sentry. Each test sets how it answers.
type Received = { url: string; contentType?: string; body: Buffer }
let sink: Server
let sinkUrl: string
let received: Received[] = []
let respond: (res: import("node:http").ServerResponse) => void

before(async () => {
	sink = createServer((req, res) => {
		const chunks: Buffer[] = []
		req.on("data", (chunk) => chunks.push(chunk))
		req.on("end", () => {
			received.push({
				url: req.url ?? "",
				contentType: req.headers["content-type"],
				body: Buffer.concat(chunks),
			})
			respond(res)
		})
	})
	await new Promise<void>((resolve) => sink.listen(0, "127.0.0.1", resolve))
	sinkUrl = `http://127.0.0.1:${(sink.address() as AddressInfo).port}`
})

after(() => {
	sink.closeAllConnections()
	sink.close()
})

const sinkTunnel = (options: SentryTunnelOptions = {}) => {
	received = []
	return createSentryTunnel({
		upstreamBaseUrl: sinkUrl,
		log: () => {},
		...options,
	})
}

const assertNotCacheable = (response: Response) =>
	assert.equal(response.headers.get("Cache-Control"), "no-store")

test("forwards an envelope byte for byte and answers 200", async () => {
	respond = (res) => res.writeHead(200).end('{"id":"abc"}')
	const tunnel = sinkTunnel()
	// Not valid UTF-8, like a compressed replay segment.
	const payload = Buffer.concat([
		Buffer.from(`${header()}\n{"type":"replay_recording"}\n`),
		Buffer.from([0x1f, 0x8b, 0xff, 0xfe, 0x00, 0x80]),
	])

	const response = await tunnel(post(payload))

	assert.equal(response.status, 200)
	assertNotCacheable(response)
	assert.equal(received.length, 1)
	assert.equal(received[0].url, `/api/${PROJECT_ID}/envelope/`)
	assert.equal(received[0].contentType, "application/x-sentry-envelope")
	assert.deepEqual(received[0].body, payload)
})

test("reads the upstream base URL from the environment", async () => {
	respond = (res) => res.writeHead(200).end()
	received = []
	process.env.SENTRY_TUNNEL_UPSTREAM_URL = sinkUrl
	try {
		const tunnel = createSentryTunnel({ log: () => {} })
		assert.equal((await tunnel(post(envelope()))).status, 200)
		assert.equal(received.length, 1)
	} finally {
		Reflect.deleteProperty(process.env, "SENTRY_TUNNEL_UPSTREAM_URL")
	}
})

test("answers 503 and sends nothing when the base URL doesn't parse", async () => {
	const tunnel = createSentryTunnel({
		upstreamBaseUrl: "not a url",
		fetch: neverSend,
		log: () => {},
	})
	const response = await tunnel(post(envelope()))
	assert.equal(response.status, 503)
	assertNotCacheable(response)
})

test("rejects a declared length over the cap without reading the body", async () => {
	const tunnel = createSentryTunnel({
		maxBodyBytes: 100,
		fetch: neverSend,
		log: () => {},
	})
	const request = post(envelope(), { "Content-Length": "101" })

	const response = await tunnel(request)

	assert.equal(response.status, 413)
	assertNotCacheable(response)
	assert.equal(request.bodyUsed, false)
})

test("stops reading a body that grows over the cap", async () => {
	const tunnel = createSentryTunnel({
		maxBodyBytes: 1000,
		fetch: neverSend,
		log: () => {},
	})
	let pulled = 0
	// A body without a declared length that never ends on its own.
	const body = new ReadableStream<Uint8Array>({
		pull(controller) {
			pulled++
			controller.enqueue(new Uint8Array(400))
		},
	})
	const request = new Request("https://goodwatch.app/api/e", {
		method: "POST",
		body,
		duplex: "half",
	} as RequestInit)

	const response = await tunnel(request)

	assert.equal(response.status, 413)
	assertNotCacheable(response)
	assert.ok(pulled < 10, `read ${pulled} chunks`)
})

test("accepts a body at the cap", async () => {
	respond = (res) => res.writeHead(200).end()
	const body = envelope()
	const tunnel = sinkTunnel({ maxBodyBytes: Buffer.byteLength(body) })
	assert.equal((await tunnel(post(body))).status, 200)
})

test("answers 400 to a bad or foreign envelope, with one short log line", async () => {
	const lines: string[] = []
	const tunnel = createSentryTunnel({
		fetch: neverSend,
		log: (line) => lines.push(line),
		now: () => 1_000,
	})
	const bad = [
		post("not json\n{}"),
		post(""),
		post("{}\n{}"),
		post('{"dsn":42}\n{}'),
		post('{"dsn":"not a url"}\n{}'),
		post(envelope(header("o1.ingest.sentry.io"))),
		post(envelope(header(SENTRY_HOST, "1"))),
		post(envelope(header(SENTRY_HOST, ""))),
		post(envelope(), { "Content-Type": "multipart/form-data; boundary=x" }),
	]

	for (const request of bad) {
		const response = await tunnel(request)
		assert.equal(response.status, 400)
		assertNotCacheable(response)
	}

	assert.deepEqual(lines, ["sentry tunnel: bad-envelope=1"])
})

test("reports the rejections of the last minute in the next line", async () => {
	const lines: string[] = []
	let time = 0
	const tunnel = createSentryTunnel({
		fetch: neverSend,
		log: (line) => lines.push(line),
		now: () => time,
	})
	for (let i = 0; i < 5; i++) await tunnel(post("junk"))
	time = 60_000
	await tunnel(post("junk"))

	assert.deepEqual(lines, [
		"sentry tunnel: bad-envelope=1",
		"sentry tunnel: bad-envelope=5",
	])
})

test("accepts the content types that the SDK sends", async () => {
	respond = (res) => res.writeHead(200).end()
	const tunnel = sinkTunnel()
	for (const type of [
		"text/plain;charset=UTF-8",
		"application/x-sentry-envelope",
		"application/octet-stream",
	]) {
		const response = await tunnel(post(envelope(), { "Content-Type": type }))
		assert.equal(response.status, 200, type)
	}
	// A binary body has no type at all.
	const binary = await tunnel(post(new TextEncoder().encode(envelope())))
	assert.equal(binary.status, 200)
})

test("passes a 429 back with Sentry's back-off headers", async () => {
	respond = (res) =>
		res
			.writeHead(429, {
				"Retry-After": "17",
				"X-Sentry-Rate-Limits": "17:transaction:organization",
				"Set-Cookie": "a=b",
			})
			.end('{"detail":"rate limited"}')
	const tunnel = sinkTunnel()

	const response = await tunnel(post(envelope()))

	assert.equal(response.status, 429)
	assert.equal(response.headers.get("Retry-After"), "17")
	assert.equal(
		response.headers.get("X-Sentry-Rate-Limits"),
		"17:transaction:organization",
	)
	assert.equal(response.headers.get("Set-Cookie"), null)
	assertNotCacheable(response)
})

test("passes rate limits on a success back too", async () => {
	respond = (res) =>
		res.writeHead(200, { "X-Sentry-Rate-Limits": "60:replay:key" }).end()
	const response = await sinkTunnel()(post(envelope()))
	assert.equal(response.status, 200)
	assert.equal(response.headers.get("X-Sentry-Rate-Limits"), "60:replay:key")
})

test("answers 503 with Retry-After when the upstream times out", async () => {
	// The sink never answers.
	respond = () => {}
	const lines: string[] = []
	const tunnel = sinkTunnel({
		upstreamTimeoutMs: 50,
		log: (line) => lines.push(line),
	})

	const started = Date.now()
	const response = await tunnel(post(envelope()))

	assert.equal(response.status, 503)
	assert.equal(response.headers.get("Retry-After"), "60")
	assertNotCacheable(response)
	assert.ok(Date.now() - started < 2_000)
	assert.deepEqual(lines, ["sentry tunnel: upstream-timeout=1"])
})

test("answers 503 with Retry-After when the upstream can't be reached", async () => {
	const lines: string[] = []
	const tunnel = createSentryTunnel({
		// fetch refuses port 1 before it opens a socket.
		upstreamBaseUrl: "http://127.0.0.1:1",
		log: (line) => lines.push(line),
	})

	const response = await tunnel(post(envelope()))

	assert.equal(response.status, 503)
	assert.equal(response.headers.get("Retry-After"), "60")
	assertNotCacheable(response)
	assert.deepEqual(lines, ["sentry tunnel: upstream-error=1"])
})

test("answers 503 when the upstream fails, and passes a refusal back", async () => {
	respond = (res) => res.writeHead(502).end()
	const failed = await sinkTunnel()(post(envelope()))
	assert.equal(failed.status, 503)
	assert.equal(failed.headers.get("Retry-After"), "60")
	assertNotCacheable(failed)

	respond = (res) => res.writeHead(400).end()
	const refused = await sinkTunnel()(post(envelope()))
	assert.equal(refused.status, 400)
	assert.equal(refused.headers.get("Retry-After"), null)
	assertNotCacheable(refused)
})

test("answers 429 beyond the bound on requests in flight, without reading the body", async () => {
	const release: Array<() => void> = []
	const stalled: typeof fetch = () =>
		new Promise((resolve) => {
			release.push(() => resolve(new Response(null, { status: 200 })))
		})
	const tunnel = createSentryTunnel({
		maxInFlight: 2,
		fetch: stalled,
		log: () => {},
	})

	const pending = [tunnel(post(envelope())), tunnel(post(envelope()))]
	while (release.length < 2) await new Promise((r) => setTimeout(r, 1))

	const extra = post(envelope())
	const response = await tunnel(extra)
	assert.equal(response.status, 429)
	assert.equal(response.headers.get("Retry-After"), "60")
	assertNotCacheable(response)
	assert.equal(extra.bodyUsed, false)
	assert.equal(release.length, 2)

	for (const done of release) done()
	for (const settled of await Promise.all(pending)) {
		assert.equal(settled.status, 200)
	}

	// The slots are free again, also after a rejection.
	await tunnel(post("junk"))
	const next = tunnel(post(envelope()))
	while (release.length < 3) await new Promise((r) => setTimeout(r, 1))
	release[2]()
	assert.equal((await next).status, 200)
})

test("answers 405 to another method", async () => {
	const tunnel = createSentryTunnel({ fetch: neverSend, log: () => {} })
	const response = await tunnel(new Request("https://goodwatch.app/api/e"))
	assert.equal(response.status, 405)
	assertNotCacheable(response)
})
