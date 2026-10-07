import assert from "node:assert/strict"
import { createServer } from "node:http"
import { test } from "node:test"
import Redis from "ioredis"
import "./title-filter/test-alias.ts"
import { BackendTimeoutError, withBackendTimeout } from "../utils/backend-timeout.ts"

test("TMDB genres and keywords cancel stalled requests", async (t) => {
	const closures: Promise<void>[] = []
	const server = createServer((req) => {
		closures.push(new Promise((resolve) => req.socket.once("close", resolve)))
	})
	const previous = process.env.TMDB_TIMEOUT_MS
	t.after(async () => {
		if (previous === undefined) delete process.env.TMDB_TIMEOUT_MS; else process.env.TMDB_TIMEOUT_MS = previous
		server.closeAllConnections()
		await new Promise((resolve) => server.close(resolve))
	})
	await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve) })
	const address = server.address()
	assert.ok(address && typeof address !== "string")
	const origin = `http://127.0.0.1:${address.port}`
	const realFetch = globalThis.fetch
	t.mock.method(globalThis, "fetch", (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
		const url = String(input)
		assert.ok(url.startsWith("https://api.themoviedb.org/"))
		return realFetch(url.replace("https://api.themoviedb.org", origin), init)
	})
	for (const method of ["log", "error", "trace"] as const) t.mock.method(console, method, () => {})
	// Importing the cache must not initiate a Redis cluster connection.
	const connect = t.mock.method(Redis.Cluster.prototype, "connect", async () => {})
	const { _getGenresMovie, _getGenresTV } = await import("./genres.server.ts")
	const { _getKeywordSearchResults } = await import("./keywords.server.ts")
	connect.mock.restore()
	process.env.TMDB_TIMEOUT_MS = "200"
	for (const run of [() => _getGenresMovie({ type: "default" }), () => _getGenresTV({ type: "default" }), () => _getKeywordSearchResults({ query: "test" })]) {
		const started = performance.now()
		const count = closures.length
		await assert.rejects(run(), (error) => {
			assert.ok(error instanceof BackendTimeoutError)
			assert.equal(error.service, "TMDB")
			assert.equal(error.timeoutMs, 200)
			return true
		})
		assert.ok(performance.now() - started >= 180)
		assert.ok(performance.now() - started < 1000)
		assert.equal(closures.length, count + 1)
		await withBackendTimeout("Socket close", 700, async () => { await closures[count] })
	}
})
