import assert from "node:assert/strict"
import { after, test } from "node:test"
import "node-crate"
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from "undici"
import "../title-filter/test-alias.ts"
const { searchStatement, metadataFor } = await import("./catalog.server.ts")
const { setCrateClientForTest } = await import("../../utils/crate.ts")
const original = getGlobalDispatcher()
const env = { ...process.env }
const agent = new MockAgent()
agent.disableNetConnect()
setGlobalDispatcher(agent)
Object.assign(process.env, {
	CRATE_HOSTS: "first.invalid,second.invalid,third.invalid",
	CRATE_PORT: "4200",
	CRATE_USER: "fixture",
	CRATE_PASS: "secret-fixture",
})
after(async () => {
	setGlobalDispatcher(original)
	for (const key of ["CRATE_HOSTS", "CRATE_PORT", "CRATE_USER", "CRATE_PASS"]) {
		if (env[key] === undefined) delete process.env[key]
		else process.env[key] = env[key]
	}
	setCrateClientForTest(null)
	await agent.close()
})
test("catalog metadata survives losing the first coordinator and cools it down", async (t) => {
	for (const method of ["log", "warn", "error", "trace"] as const)
		t.mock.method(console, method, () => {})
	setCrateClientForTest(null)
	agent
		.get("http://first.invalid:4200")
		.intercept({ path: "/_sql", method: "POST" })
		.replyWithError(
			Object.assign(new Error("connection refused"), { code: "ECONNREFUSED" }),
		)
	const statements: string[] = []
	for (const host of ["second.invalid", "third.invalid"]) {
		agent
			.get(`http://${host}:4200`)
			.intercept({
				path: "/_sql",
				method: "POST",
				body: (body) => {
					statements.push(JSON.parse(String(body)).stmt)
					return true
				},
			})
			.reply(200, {
				cols: ["tmdb_id", "media_type"],
				rows: [[42, "movie"]],
				rowcount: 1,
			})
			.persist()
	}
	assert.deepEqual(await metadataFor(["movie:42"]), [
		{ tmdb_id: 42, media_type: "movie" },
	])
	for (let i = 0; i < 4; i++)
		assert.equal(
			(await searchStatement("SELECT tmdb_id FROM movie")).rows[0][0],
			42,
		)
	assert.equal(statements.length, 5)
	agent.assertNoPendingInterceptors()
})

test("catalog SQL errors propagate once with redacted diagnostics; authorization is not retried", async (t) => {
	const fixture = new MockAgent()
	fixture.disableNetConnect()
	setGlobalDispatcher(fixture)
	t.after(async () => {
		setGlobalDispatcher(agent)
		setCrateClientForTest(null)
		await fixture.close()
	})
	const logs: string[] = []
	for (const level of ["log", "warn", "error", "trace"] as const)
		t.mock.method(console, level, (line: unknown) => logs.push(String(line)))
	for (const [status, code, message] of [
		[400, 4000, "SQLParseException[private-title]"],
		[401, 4010, "UnauthorizedException[secret-fixture]"],
	] as const) {
		setCrateClientForTest(null)
		fixture
			.get("http://first.invalid:4200")
			.intercept({ path: "/_sql", method: "POST" })
			.reply(status, { error: { message, code } })
		await assert.rejects(
			searchStatement("SELECT 'private-title' FROM movie", ["private-value"]),
			(error) => error instanceof Error && error.message === message,
		)
	}
	assert.equal(
		logs.filter((line) => line.includes('"event":"crate.attempt_failed"'))
			.length,
		2,
	)
	assert.equal(
		logs.filter((line) => line.includes('"event":"crate.failover_attempt"'))
			.length,
		0,
	)
	assert.doesNotMatch(
		logs.join("\n"),
		/private-title|private-value|secret-fixture/,
	)
})

test("all catalog hosts unavailable produces three attempts and one final failure", async (t) => {
	const fixture = new MockAgent()
	fixture.disableNetConnect()
	setGlobalDispatcher(fixture)
	setCrateClientForTest(null)
	t.after(async () => {
		setGlobalDispatcher(agent)
		setCrateClientForTest(null)
		await fixture.close()
	})
	const events: Record<string, unknown>[] = []
	for (const level of ["log", "error", "trace"] as const)
		t.mock.method(console, level, () => {})
	t.mock.method(console, "warn", (line: string) =>
		events.push(JSON.parse(line)),
	)
	for (const host of ["first.invalid", "second.invalid", "third.invalid"])
		fixture
			.get(`http://${host}:4200`)
			.intercept({ path: "/_sql", method: "POST" })
			.reply(503, "draining")
	await assert.rejects(
		searchStatement("SELECT * FROM movie"),
		/Catalog unavailable/,
	)
	fixture.assertNoPendingInterceptors()
	assert.equal(
		events.filter((e) => e.event === "crate.attempt_failed").length,
		3,
	)
	assert.equal(
		events.filter((e) => e.event === "crate.failover_attempt").length,
		2,
	)
	assert.equal(events.filter((e) => e.event === "crate.query").length, 1)
	assert.equal(events.at(-1)?.outcome, "failed")
	assert.equal(new Set(events.map((e) => e.queryId)).size, 1)
})

test("catalog fails over an interrupted JSON response and leaves that coordinator out of rotation", async (t) => {
	const { createServer } = await import("node:http")
	const previous = {
		CRATE_HOSTS: process.env.CRATE_HOSTS,
		CRATE_PORT: process.env.CRATE_PORT,
	}
	const counts = [0, 0]
	const servers = [0, 1].map((i) =>
		createServer((req, res) => {
			counts[i]++
			if (i === 0) {
				res.writeHead(200, { "Content-Type": "application/json" })
				res.write('{"cols":')
				setImmediate(() => req.socket.destroy())
				return
			}
			res.end(JSON.stringify({ cols: ["tmdb_id"], rows: [[42]], rowcount: 1 }))
		}),
	)
	for (const level of ["log", "warn", "error", "trace"] as const)
		t.mock.method(console, level, () => {})
	t.after(async () => {
		setGlobalDispatcher(agent)
		setCrateClientForTest(null)
		Object.assign(process.env, previous)
		await Promise.all(
			servers.map(async (s) => {
				s.closeAllConnections()
				await new Promise((resolve) => s.close(resolve))
			}),
		)
	})
	setGlobalDispatcher(original)
	await new Promise<void>((resolve) =>
		servers[0].listen(0, "127.0.0.1", resolve),
	)
	const address = servers[0].address()
	assert.ok(address && typeof address !== "string")
	await new Promise<void>((resolve) =>
		servers[1].listen(address.port, "127.0.0.2", resolve),
	)
	Object.assign(process.env, {
		CRATE_HOSTS: "127.0.0.1,127.0.0.2",
		CRATE_PORT: String(address.port),
	})
	setCrateClientForTest(null)
	for (let i = 0; i < 5; i++)
		assert.equal(
			(await searchStatement("SELECT tmdb_id FROM movie")).rows[0][0],
			42,
		)
	assert.deepEqual(counts, [1, 5])
})

test("catalog sends exact credentials after an HBA refusal and keeps secrets out of diagnostics", async (t) => {
	const fixture = new MockAgent()
	fixture.disableNetConnect()
	setGlobalDispatcher(fixture)
	const password = "fixture:/#?%ä"
	process.env.CRATE_PASS = password
	setCrateClientForTest(null)
	const logs: string[] = []
	for (const level of ["log", "warn", "error", "trace"] as const)
		t.mock.method(console, level, (line: unknown) => logs.push(String(line)))
	t.after(async () => {
		process.env.CRATE_PASS = "secret-fixture"
		setGlobalDispatcher(agent)
		setCrateClientForTest(null)
		await fixture.close()
	})
	const headers = { authorization: `Basic ${Buffer.from(`fixture:${password}`).toString("base64")}` }
	fixture.get("http://first.invalid:4200")
		.intercept({ path: "/_sql", method: "POST", headers })
		.reply(401, "password authentication failed", { headers: { "Content-Type": "text/plain" } })
	fixture.get("http://second.invalid:4200")
		.intercept({ path: "/_sql", method: "POST", headers })
		.reply(200, { cols: ["n"], rows: [[1]], rowcount: 1 })
	assert.deepEqual((await searchStatement("SELECT 1")).rows, [[1]])
	fixture.assertNoPendingInterceptors()
	assert.ok(!logs.join("\n").includes(password))
	assert.ok(!logs.join("\n").includes(headers.authorization))
})
