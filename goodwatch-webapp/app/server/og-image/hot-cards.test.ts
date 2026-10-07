import assert from "node:assert/strict"
import { createServer, request } from "node:http"
import { test, type TestContext } from "node:test"
import { createHotCards, type HotCard } from "./hot-cards.server.ts"

const path = "/og/movie/603.jpg"
const card: HotCard = {
	image: Buffer.from("jpeg"),
	etag: '"card"',
	contentType: "image/jpeg",
	cacheControl: "public, max-age=86400",
	lastModified: new Date(1000).toUTCString(),
}
async function fixture(t: TestContext, cards = createHotCards()) {
	const server = createServer((req, res) => {
		res.sendDate = false
		if (!cards.answer(req, res)) {
			assert.equal(res.headersSent, false)
			assert.deepEqual(res.getHeaders(), Object.create(null))
			assert.equal(res.statusCode, 200)
			res.writeHead(418, { "Content-Length": 0 })
			res.end()
		}
	})
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject)
		server.listen(0, "127.0.0.1", resolve)
	})
	t.after(
		() =>
			new Promise<void>((resolve, reject) => {
				server.close((error) => (error ? reject(error) : resolve()))
			}),
	)
	const address = server.address()
	assert.ok(address && typeof address !== "string")
	const get = (url = path, method = "GET", headers = {}) =>
		new Promise<{
			status: number | undefined
			headers: import("node:http").IncomingHttpHeaders
			body: Buffer
		}>((resolve, reject) => {
			const req = request(
				{
					host: "127.0.0.1",
					port: address.port,
					path: url,
					method,
					headers: { Connection: "close", ...headers },
				},
				(res) => {
					const chunks: Buffer[] = []
					res.on("data", (chunk) => chunks.push(chunk))
					res.on("end", () =>
						resolve({
							status: res.statusCode,
							headers: res.headers,
							body: Buffer.concat(chunks),
						}),
					)
				},
			)
			req.on("error", reject)
			req.end()
		})
	return { cards, get }
}

test("GET, HEAD and conditional answers have exact headers and count each hit", async (t) => {
	const { cards, get } = await fixture(t)
	let hits = 0
	cards.remember(path, { ...card, onHit: () => hits++ })
	const headers = {
		"cache-control": card.cacheControl,
		etag: card.etag,
		"x-og-card": "hot",
		connection: "close",
	}
	for (const method of ["GET", "HEAD"]) {
		const response = await get(`${path}?v=1`, method)
		assert.equal(response.status, 200)
		assert.deepEqual(response.headers, {
			...headers,
			"content-type": card.contentType,
			"content-length": "4",
			"last-modified": card.lastModified,
		})
		assert.deepEqual(
			response.body,
			method === "HEAD" ? Buffer.alloc(0) : card.image,
		)
	}
	for (const tag of [
		card.etag,
		`W/${card.etag}`,
		`"other", W/${card.etag}`,
		"*",
	]) {
		const response = await get(path, "GET", { "If-None-Match": tag })
		assert.equal(response.status, 304)
		assert.deepEqual(response.headers, headers)
		assert.equal(response.body.length, 0)
	}
	assert.equal(hits, 6)
	assert.equal(
		(await get(path, "GET", { "If-None-Match": '"other"' })).status,
		200,
	)
	assert.equal(hits, 7)
	cards.remember("/outside.jpg", card)
	for (const [url, method] of [
		["/og/other.jpg", "GET"],
		[path, "POST"],
		["/outside.jpg", "GET"],
	])
		assert.equal((await get(url, method)).status, 418)
	assert.equal(hits, 7)
})

test("expiry deletes entries and forget only drops matching paths", async (t) => {
	let now = 0
	const { cards, get } = await fixture(
		t,
		createHotCards({ now: () => now, hotMs: 10 }),
	)
	cards.remember(path, card)
	now = 9
	assert.equal((await get()).status, 200)
	now = 10
	assert.equal((await get()).status, 418)
	assert.deepEqual(cards.stats(), { entries: 0, bytes: 0 })
	cards.remember(path, card)
	cards.remember("/og/lists/abc/hash.jpg", card)
	cards.remember("/og/lists/abcd/hash.jpg", card)
	cards.forget((path) => path.startsWith("/og/lists/abc/"))
	assert.deepEqual(cards.stats(), { entries: 2, bytes: 8 })
	assert.equal((await get("/og/lists/abc/hash.jpg")).status, 418)
	assert.equal((await get("/og/lists/abcd/hash.jpg")).status, 200)
	assert.equal((await get()).status, 200)
})

test("byte bound evicts oldest entries and replacement renews insertion order", async (t) => {
	const { cards, get } = await fixture(t, createHotCards({ maxBytes: 8 }))
	cards.remember(path, card)
	cards.remember("/og/second.jpg", card)
	cards.remember(path, card)
	assert.deepEqual(cards.stats(), { entries: 2, bytes: 8 })
	cards.remember("/og/third.jpg", card)
	assert.deepEqual(cards.stats(), { entries: 2, bytes: 8 })
	assert.equal((await get("/og/second.jpg")).status, 418)
	assert.equal((await get()).status, 200)
	assert.equal((await get("/og/third.jpg")).status, 200)
	cards.remember(path, { ...card, image: Buffer.alloc(9) })
	assert.deepEqual(cards.stats(), { entries: 0, bytes: 0 })
})

test("remember prunes expired oldest entries and retains the original buffer", async (t) => {
	let now = 0
	const { cards, get } = await fixture(
		t,
		createHotCards({ now: () => now, hotMs: 10 }),
	)
	cards.remember("/og/old.jpg", card)
	now = 10
	const image = Buffer.from("jpeg")
	cards.remember(path, { ...card, image, lastModified: undefined })
	assert.deepEqual(cards.stats(), { entries: 1, bytes: 4 })
	image.write("same")
	const response = await get()
	assert.equal(response.body.toString(), "same")
	assert.equal(response.headers["last-modified"], undefined)
})

test("hot hits receive the User-Agent and share list cards still answer", async (t) => {
	const { cards, get } = await fixture(t)
	const agents: (string | undefined)[] = []
	const listPath = "/og/lists/abc/hash.jpg"
	cards.remember(listPath, {
		...card,
		onHit: (userAgent) => agents.push(userAgent),
	})
	const response = await get(listPath, "GET", {
		"User-Agent": "facebookexternalhit/1.1",
	})
	assert.equal(response.status, 200)
	assert.deepEqual(response.body, card.image)
	assert.deepEqual(response.headers, {
		"cache-control": card.cacheControl,
		etag: card.etag,
		"x-og-card": "hot",
		connection: "close",
		"content-type": card.contentType,
		"content-length": "4",
		"last-modified": card.lastModified,
	})
	assert.equal((await get(listPath, "HEAD")).status, 200)
	assert.equal(
		(
			await get(listPath, "GET", {
				"If-None-Match": card.etag,
				"User-Agent": "Googlebot-Image/1.0",
			})
		).status,
		304,
	)
	assert.deepEqual(agents, [
		"facebookexternalhit/1.1",
		undefined,
		"Googlebot-Image/1.0",
	])
})
