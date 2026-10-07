import assert from "node:assert/strict"
import { createServer, type RequestListener } from "node:http"
import { test } from "node:test"
import { BackendTimeoutError, fetchJsonWithBackendTimeout, fetchWithBackendTimeout, timeoutSetting, withBackendTimeout } from "./backend-timeout.ts"

async function bounded(promise: Promise<unknown>) {
	let timer: ReturnType<typeof setTimeout> | undefined
	try {
		await Promise.race([promise, new Promise((_, reject) => {
			timer = setTimeout(() => reject(new Error("Socket did not close")), 700)
		})])
	} finally { clearTimeout(timer) }
}

async function localServer(handler: RequestListener, run: (url: string) => Promise<void>) {
	const server = createServer(handler)
	try {
		await new Promise<void>((resolve, reject) => {
			server.once("error", reject)
			server.listen(0, "127.0.0.1", resolve)
		})
		const address = server.address()
		assert.ok(address && typeof address !== "string")
		await run(`http://127.0.0.1:${address.port}`)
	} finally {
		server.closeAllConnections()
		await new Promise((resolve) => server.close(resolve))
	}
}

for (const body of [false, true]) {
	test(`timeout closes a request stalled ${body ? "after headers" : "before headers"}`, async () => {
		let closed!: () => void
		const closure = new Promise<void>((resolve) => { closed = resolve })
		await localServer((req, res) => {
			req.socket.once("close", closed)
			if (body) { res.writeHead(200); res.write('{"partial":') }
		}, async (url) => {
			const started = performance.now()
			await assert.rejects(fetchJsonWithBackendTimeout("Test", 200, url), (error) => {
				assert.ok(error instanceof BackendTimeoutError)
				assert.equal(error.service, "Test")
				assert.equal(error.timeoutMs, 200)
				return true
			})
			assert.ok(performance.now() - started >= 180)
			assert.ok(performance.now() - started < 1000)
			await bounded(closure)
		})
	})
}

test("caller cancellation keeps its reason and closes the socket", async () => {
	const controller = new AbortController()
	const reason = new Error("Caller canceled")
	let closed!: () => void
	const closure = new Promise<void>((resolve) => { closed = resolve })
	await localServer((req) => {
		req.socket.once("close", closed)
		controller.abort(reason)
	}, async (url) => {
		await assert.rejects(fetchJsonWithBackendTimeout("Test", 1000, url, { signal: controller.signal }), (error) => error === reason)
		await bounded(closure)
	})
})

test("fast JSON and headers resolve and clear their timers", async (t) => {
	const timers = t.mock.method(globalThis, "clearTimeout")
	await localServer((_, res) => res.end('{"ok":true}'), async (url) => {
		assert.deepEqual(await fetchJsonWithBackendTimeout("Test", 60_000, url), { ok: true })
		const response = await fetchWithBackendTimeout("Test", 60_000, url)
		assert.equal(await response.text(), '{"ok":true}')
	})
	assert.ok(timers.mock.callCount() >= 2)
})

test("timeout wins over wrapped abort errors and handles late rejection", async () => {
	await assert.rejects(withBackendTimeout("Test", 10, (signal) => new Promise((_, reject) => {
		signal.addEventListener("abort", () => reject(new Error("wrapped abort")))
	})), BackendTimeoutError)
	await assert.rejects(withBackendTimeout("Test", 10, () => new Promise((_, reject) => {
		setTimeout(() => reject(new Error("late")), 30)
	})), BackendTimeoutError)
	await new Promise((resolve) => setTimeout(resolve, 50))
})

test("already aborted caller never invokes run", async () => {
	const reason = new Error("already canceled")
	await assert.rejects(withBackendTimeout("Test", 10, async () => assert.fail("must not run"), {
		signal: AbortSignal.abort(reason),
	}), (error) => error === reason)
})

test("settings are positive integers read at call time", (t) => {
	const key = "BACKEND_TIMEOUT_TEST_MS"
	const previous = process.env[key]
	t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous })
	for (const value of ["", "0", "-1", "1.5", "200ms", "Infinity"]) {
		process.env[key] = value
		assert.equal(timeoutSetting(key, 5000), 5000)
	}
	process.env[key] = "200"
	assert.equal(timeoutSetting(key, 5000), 200)
})

test("successful and failed operations clear timers and detach caller listeners", async (t) => {
	const controller = new AbortController()
	const clear = t.mock.method(globalThis, "clearTimeout")
	const remove = t.mock.method(controller.signal, "removeEventListener")
	assert.equal(await withBackendTimeout("Test", 60_000, async () => 42, { signal: controller.signal }), 42)
	assert.equal(clear.mock.callCount(), 1)
	assert.equal(remove.mock.callCount(), 1)
	const reason = new Error("backend failed")
	await assert.rejects(withBackendTimeout("Test", 60_000, async () => { throw reason }, { signal: controller.signal }), (error) => error === reason)
	assert.equal(clear.mock.callCount(), 2)
	assert.equal(remove.mock.callCount(), 2)
})
