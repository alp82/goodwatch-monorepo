import assert from "node:assert/strict"
import { createServer, type ServerHttp2Session } from "node:http2"
import { test } from "node:test"
import { BackendTimeoutError, withBackendTimeout } from "./backend-timeout.ts"
import { search } from "./qdrant.ts"

test("Qdrant timeout cancels its HTTP/2 stream and preserves the raw error", async (t) => {
	const server = createServer()
	const sessions = new Set<ServerHttp2Session>()
	let closed!: () => void
	const closure = new Promise<void>((resolve) => { closed = resolve })
	server.on("session", (session) => { sessions.add(session) })
	server.on("stream", (stream, headers) => {
		stream.on("error", () => {})
		stream.resume()
		if (headers[":path"]?.includes("Search")) stream.once("close", closed)
	})
	const previousUrl = process.env.QDRANT_URL
	const previousTimeout = process.env.QDRANT_TIMEOUT_MS
	t.after(async () => {
		if (previousUrl === undefined) delete process.env.QDRANT_URL; else process.env.QDRANT_URL = previousUrl
		if (previousTimeout === undefined) delete process.env.QDRANT_TIMEOUT_MS; else process.env.QDRANT_TIMEOUT_MS = previousTimeout
		for (const session of sessions) session.destroy()
		await new Promise((resolve) => server.close(resolve))
	})
	t.mock.method(console, "error", () => {})
	t.mock.method(console, "warn", () => {})
	await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve) })
	const address = server.address()
	assert.ok(address && typeof address !== "string")
	process.env.QDRANT_URL = `http://127.0.0.1:${address.port}`
	process.env.QDRANT_TIMEOUT_MS = "200"
	const started = performance.now()
	await assert.rejects(search({ collectionName: "test", vector: [1], using: "test", limit: 1 }), (error) => {
		assert.ok(error instanceof BackendTimeoutError)
		assert.equal(error.service, "Qdrant")
		assert.equal(error.timeoutMs, 200)
		const raw = error.cause as Error & { code?: number }
		assert.equal(raw.name, "ConnectError")
		assert.equal(raw.code, 1)
		return true
	})
	assert.ok(performance.now() - started >= 180)
	assert.ok(performance.now() - started < 1000)
	await withBackendTimeout("Stream close", 700, async () => { await closure })
})
