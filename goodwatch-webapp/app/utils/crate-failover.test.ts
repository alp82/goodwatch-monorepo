import assert from "node:assert/strict"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { test, type TestContext } from "node:test"
import { query, setCrateClientForTest } from "./crate.ts"

type Statement = { stmt: string; args: unknown[] }
type Handler = (statement: Statement, req: IncomingMessage, res: ServerResponse) => void

const answer = (res: ServerResponse) => {
	res.setHeader("Content-Type", "application/json")
	res.end(JSON.stringify({ cols: ["n"], col_types: [9], rows: [[1]], rowcount: 1, duration: 1 }))
}

async function cluster(t: TestContext, handlers: Handler[]) {
	const previous = { ...process.env }
	const hosts = handlers.map((_, i) => `127.0.0.${i + 1}`)
	const received: Statement[][] = handlers.map(() => [])
	const servers = handlers.map((handle, i) => createServer((req, res) => {
		assert.equal(req.url, "/_sql?types")
		let body = ""
		req.on("data", (chunk) => { body += chunk })
		req.on("end", () => {
			const statement = JSON.parse(body) as Statement
			received[i].push(statement)
			handle(statement, req, res)
		})
	}))
	t.after(async () => {
		for (const key of ["CRATE_HOSTS", "CRATE_PORT", "CRATE_TIMEOUT_MS", "CRATE_USER", "CRATE_PASS"]) {
			if (previous[key] === undefined) delete process.env[key]
			else process.env[key] = previous[key]
		}
		setCrateClientForTest(null)
		await Promise.all(servers.map(async (server) => {
			server.closeAllConnections()
			await new Promise((resolve) => server.close(resolve))
		}))
	})
	for (const method of ["log", "error", "trace", "warn"] as const) t.mock.method(console, method, () => {})
	let port = 0
	for (const [i, server] of servers.entries()) {
		await new Promise<void>((resolve, reject) => {
			server.once("error", reject)
			server.listen(port, hosts[i], resolve)
		})
		const address = server.address()
		assert.ok(address && typeof address !== "string")
		port = address.port
	}
	Object.assign(process.env, { CRATE_HOSTS: hosts.join(","), CRATE_PORT: String(port), CRATE_TIMEOUT_MS: "150", CRATE_USER: "", CRATE_PASS: "" })
	setCrateClientForTest(null)
	return received
}

test("reads survive a lost coordinator and leave it out of subsequent rotation", async (t) => {
	const received = await cluster(t, [
		(_, req) => req.socket.destroy(),
		(_, req) => req.socket.destroy(),
		(_, __, res) => answer(res),
	])
	for (let i = 0; i < 20; i++) assert.deepEqual(await query("SELECT n", [42]), [{ n: 1 }])
	assert.equal(received[0].length, 1)
	assert.equal(received[1].length, 1)
	assert.equal(received[2].length, 20)
	assert.deepEqual(received[2][0].args, [42])
})

test("a stalled read closes its request and succeeds elsewhere within the caller's time budget", async (t) => {
	let closed!: Promise<void>
	const received = await cluster(t, [
		(_, req) => { closed = new Promise((resolve) => req.socket.once("close", resolve)) },
		(_, __, res) => answer(res),
		(_, __, res) => answer(res),
	])
	const started = performance.now()
	assert.deepEqual(await query("SELECT stalled", undefined, { timeoutMs: 300 }), [{ n: 1 }])
	assert.ok(performance.now() - started < 500)
	await closed
	for (let i = 0; i < 6; i++) await query("SELECT recovered")
	assert.equal(received[0].length, 1)
})
