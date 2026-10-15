import assert from "node:assert/strict"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { test, type TestContext } from "node:test"
import { CrateError, CrateTimeoutError, execute, getCrateClient, insertRows, query, setCrateClientForTest, upsert } from "./crate.ts"

type Statement = { stmt: string; args: unknown[] }
type Handler = (statement: Statement, req: IncomingMessage, res: ServerResponse) => void

const answer = (res: ServerResponse, n = 1) => {
	res.setHeader("Content-Type", "application/json")
	res.end(JSON.stringify({ cols: ["n"], col_types: [9], rows: [[n]], rowcount: 1, duration: 1 }))
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
	Object.assign(process.env, { CRATE_HOSTS: hosts.join(","), CRATE_PORT: String(port), CRATE_TIMEOUT_MS: "10000", CRATE_USER: "", CRATE_PASS: "" })
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
	assert.deepEqual(await query("SELECT stalled", undefined, { timeoutMs: 3_000 }), [{ n: 1 }])
	assert.ok(performance.now() - started < 5_000)
	await closed
	for (let i = 0; i < 6; i++) await query("SELECT recovered")
	assert.equal(received[0].length, 1)
})

test("an upsert whose response was lost reads back its key on a healthy host without writing again", async (t) => {
	let writes = 0
	const received = await cluster(t, [
		({ stmt }, req) => {
			assert.match(stmt, /INSERT INTO/)
			writes += 1
			req.socket.destroy()
		},
		({ stmt }, _, res) => { assert.match(stmt, /SELECT count/); answer(res) },
		({ stmt }, _, res) => { assert.match(stmt, /SELECT count/); answer(res) },
	])
	assert.deepEqual(await upsert({ table: "saved", data: [{ id: "fixed" }], conflictColumns: ["id"] }), { rowcount: 1 })
	assert.equal(writes, 1)
	assert.equal(received.flat().filter(({ stmt }) => stmt.includes("INSERT INTO")).length, 1)
})

test("keyed inserts replay the identical batch on another host after a connection loss", async (t) => {
	const received = await cluster(t, [
		(_, req) => req.socket.destroy(),
		(_, __, res) => answer(res),
		(_, __, res) => answer(res),
	])
	assert.deepEqual(await insertRows("saved", ["id", "n"], [["fixed", 1]], { conflict: ["id"] }), { rowcount: 1, statements: 1 })
	assert.deepEqual(received[1], received[0])
	assert.match(received[1][0].stmt, /ON CONFLICT \("id"\) DO NOTHING$/)
})

test("reads fail over if a coordinator closes halfway through its response", async (t) => {
	await cluster(t, [
		(_, req, res) => {
			res.writeHead(200, { "Content-Type": "application/json" })
			res.write('{"cols":')
			setImmediate(() => req.socket.destroy())
		},
		(_, __, res) => answer(res),
		(_, __, res) => answer(res),
	])
	assert.deepEqual(await query("SELECT n"), [{ n: 1 }])
})

test("a draining coordinator's HTTP 503 is retried and cooled down", async (t) => {
	const received = await cluster(t, [
		(_, __, res) => {
			res.writeHead(503, { "Content-Type": "application/json" })
			res.end(JSON.stringify({ error: { message: "SQL disabled during drain", code: 5030 } }))
		},
		(_, __, res) => answer(res),
		(_, __, res) => answer(res),
	])
	for (let i = 0; i < 6; i++) assert.deepEqual(await query("SELECT n"), [{ n: 1 }])
	assert.equal(received[0].length, 1)
})

test("commented SELECTs and read-only CTEs survive a lost coordinator", async (t) => {
	await cluster(t, [
		(_, req) => req.socket.destroy(),
		(_, req) => req.socket.destroy(),
		(_, __, res) => answer(res),
	])
	assert.deepEqual(await query("-- caller\n /* lookup */ WITH item AS (SELECT 'UPDATE; --' AS label) SELECT * FROM item"), [{ n: 1 }])
})

test("a recovered coordinator returns to rotation after its cooldown", async (t) => {
	let failed = true
	const received = await cluster(t, [
		(_, req, res) => failed ? req.socket.destroy() : answer(res),
		(_, __, res) => answer(res),
		(_, __, res) => answer(res),
	])
	t.mock.timers.enable({ apis: ["Date"] })
	await query("SELECT n")
	failed = false
	for (let i = 0; i < 4; i++) await query("SELECT n")
	assert.equal(received[0].length, 1)
	t.mock.timers.tick(5_001)
	for (let i = 0; i < 3; i++) await query("SELECT n")
	assert.equal(received[0].length, 2)
})

test("generic writes including increments, CAS and apparent upserts are never replayed", async (t) => {
	const received = await cluster(t, Array.from({ length: 3 }, () => (_, req) => req.socket.destroy()))
	const statements = [
		"UPDATE saved SET n = n + 1 WHERE id = ?",
		"UPDATE saved SET n = 1 WHERE id = ? AND _seq_no = 0 AND _primary_term = 1",
		"INSERT INTO saved (id) VALUES (?) ON CONFLICT (id) DO UPDATE SET n = n + 1",
		"WITH value AS (SELECT 1) DELETE FROM saved WHERE id = ?",
		"SELECT 1; DELETE FROM saved WHERE id = ?",
	]
	for (const sql of statements) {
		const before = received.flat().length
		await assert.rejects(execute(sql, ["fixed"]), { code: "ECONNRESET" })
		assert.equal(received.flat().length, before + 1)
	}
})

test("SQL and authorization failures reach the caller unchanged and do not evict a healthy host", async (t) => {
	const received = await cluster(t, Array.from({ length: 3 }, () => ({ stmt }, _, res) => {
		if (stmt.includes("bad")) {
			res.writeHead(400, { "Content-Type": "application/json" })
			res.end(JSON.stringify({ error: { message: "SQLParseException[bad]", code: 4000 } }))
		} else answer(res)
	}))
	await assert.rejects(query("SELECT bad"), (error) => error instanceof CrateError && error.code === 4000)
	assert.equal(received.flat().length, 1)
	for (let i = 0; i < 3; i++) await query("SELECT n")
	assert.equal(received[0].length, 2)
})

test("all coordinators failing is bounded to one request per host", async (t) => {
	const received = await cluster(t, Array.from({ length: 3 }, () => (_, req) => req.socket.destroy()))
	await assert.rejects(query("SELECT n"), { code: "ECONNRESET" })
	assert.deepEqual(received.map((node) => node.length), [1, 1, 1])
})

test("caller cancellation closes the active request without retrying or evicting its host", async (t) => {
	let arrived!: () => void
	const arrival = new Promise<void>((resolve) => { arrived = resolve })
	let closure!: Promise<void>
	const received = await cluster(t, [
		({ stmt }, req, res) => {
			if (stmt.includes("cancel")) {
				closure = new Promise((resolve) => req.socket.once("close", resolve))
				arrived()
			} else answer(res)
		},
		(_, __, res) => answer(res),
		(_, __, res) => answer(res),
	])
	const controller = new AbortController()
	const cancelled = query("SELECT cancel", undefined, { signal: controller.signal, timeoutMs: 5_000 })
	await arrival
	controller.abort(new Error("caller cancelled"))
	await assert.rejects(cancelled, /caller cancelled/)
	await closure
	assert.equal(received.flat().length, 1)
	for (let i = 0; i < 3; i++) await query("SELECT n")
	assert.equal(received[0].length, 2)
	const before = received.flat().length
	await assert.rejects(getCrateClient().execute("SELECT n", [], { signal: controller.signal }), /caller cancelled/)
	assert.equal(received.flat().length, before)
})

test("reads wait for shard routing to recover when surviving coordinators still reference a lost node", async (t) => {
	let recoveredAt = Infinity
	const messages = [
		"NodeNotConnectedException[[node2] Node not connected]",
		"NoSuchNodeException[No such node [node2]]",
		"JobKilledException[Job killed. Participating node node2 disconnected]",
	]
	const received = await cluster(t, messages.map((message) => (_, __, res) => {
		if (performance.now() >= recoveredAt) return answer(res)
		res.writeHead(500, { "Content-Type": "application/json" })
		res.end(JSON.stringify({ error: { message, code: 5000 } }))
	}))
	recoveredAt = performance.now() + 200
	assert.deepEqual(await query("SELECT n", [], { timeoutMs: 1_000 }), [{ n: 1 }])
	const before = received.map((host) => host.length)
	for (let i = 0; i < 3; i++) await query("SELECT n")
	assert.deepEqual(received.map((host, i) => host.length - before[i]), [1, 1, 1])
})

test("a single coordinator's routing retry uses the remaining timeout rather than starting another full budget", async (t) => {
	let calls = 0
	await cluster(t, [(_, __, res) => {
		if (++calls > 1) return
		res.writeHead(500, { "Content-Type": "application/json" })
		res.end(JSON.stringify({ error: { message: "NoSuchNodeException[No such node [old]]", code: 5000 } }))
	}])
	await assert.rejects(query("SELECT n", [], { timeoutMs: 500 }), (error) => {
		assert.ok(error instanceof CrateTimeoutError)
		assert.ok(error.timeoutMs < 450, `Retry received ${error.timeoutMs} ms after its backoff`)
		return true
	})
})

test("an insert helper without every fixed key returns a lost response without replaying", async (t) => {
	const received = await cluster(t, Array.from({ length: 3 }, () => (_, req) => req.socket.destroy()))
	await assert.rejects(insertRows("saved", ["n"], [[1]], { conflict: ["id"] }), { code: "ECONNRESET" })
	assert.equal(received.flat().length, 1)
})

test("an upsert helper without every fixed key returns the original lost response without readback or replay", async (t) => {
	const received = await cluster(t, Array.from({ length: 3 }, () => ({ stmt }, req, res) => {
		if (stmt.includes("INSERT")) req.socket.destroy()
		else answer(res, 0)
	}))
	await assert.rejects(upsert({ table: "saved", data: [{ n: 1 }], conflictColumns: ["id"] }), { code: "ECONNRESET" })
	assert.equal(received.flat().length, 1)
})
