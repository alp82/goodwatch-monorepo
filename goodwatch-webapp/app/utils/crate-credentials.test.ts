// CRATE_USER and CRATE_PASS reach every coordinator as one Basic header (#562), through the failover of #589.
import assert from "node:assert/strict"
import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { test, type TestContext } from "node:test"
import { CrateAuthenticationError, execute, query, setCrateClientForTest, upsert } from "./crate.ts"

type Handler = (req: IncomingMessage, res: ServerResponse, stmt: string) => void

const answer = (res: ServerResponse) => {
	res.setHeader("Content-Type", "application/json")
	res.end(JSON.stringify({ cols: ["n"], col_types: [9], rows: [[1]], rowcount: 1, duration: 1 }))
}

// What CrateDB sends when host-based authentication refuses a request: plain text, not its JSON error. In the local
// cluster a node that had just restarted answered this way for valid credentials (docs/implementation/auth/
// cratedb-credentials.md), until it had the users from the cluster state.
const reject = (res: ServerResponse, user = "goodwatch_webapp") => {
	res.statusCode = 401
	res.setHeader("Content-Type", "text/plain")
	res.end(`password authentication failed for user "${user}"`)
}

// A statement refused for a missing privilege: Crate's JSON error, after authentication.
const missingPrivilege = (res: ServerResponse) => {
	res.statusCode = 401
	res.setHeader("Content-Type", "application/json")
	res.end(JSON.stringify({ error: { message: "MissingPrivilegeException[Missing 'DQL' privilege for user 'goodwatch_webapp']", code: 4011 } }))
}

const basic = (credentials: string) => `Basic ${Buffer.from(credentials, "utf8").toString("base64")}`

async function cluster(t: TestContext, env: { CRATE_USER?: string; CRATE_PASS?: string }, handlers: Handler[]) {
	const previous = { ...process.env }
	const hosts = handlers.map((_, i) => `127.0.0.${i + 1}`)
	const authorization: (string | undefined)[][] = handlers.map(() => [])
	const servers = handlers.map((handle, i) => createServer((req, res) => {
		let body = ""
		req.on("data", (chunk) => { body += chunk })
		req.on("end", () => {
			authorization[i].push(req.headers.authorization)
			handle(req, res, (JSON.parse(body) as { stmt: string }).stmt)
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
	for (const key of ["CRATE_USER", "CRATE_PASS"]) delete process.env[key]
	Object.assign(process.env, { CRATE_HOSTS: hosts.join(","), CRATE_PORT: String(port), CRATE_TIMEOUT_MS: "10000" }, env)
	setCrateClientForTest(null)
	return authorization
}

test("without CRATE_USER the default crate identity reaches every coordinator", async (t) => {
	const authorization = await cluster(t, {}, [(_, res) => answer(res), (_, res) => answer(res)])
	for (let i = 0; i < 4; i++) await query("SELECT n")
	assert.deepEqual(authorization, [[basic("crate:"), basic("crate:")], [basic("crate:"), basic("crate:")]])
})

test("an empty CRATE_USER uses the default crate identity", async (t) => {
	const authorization = await cluster(t, { CRATE_USER: "", CRATE_PASS: "" }, [(_, res) => answer(res)])
	await query("SELECT n")
	assert.deepEqual(authorization, [[basic("crate:")]])
})

test("a password with URL characters reaches every coordinator unchanged", async (t) => {
	const password = "p@ss:w/rd #1?%41ä"
	const authorization = await cluster(t, { CRATE_USER: "goodwatch_webapp", CRATE_PASS: password }, [
		(_, res) => answer(res), (_, res) => answer(res), (_, res) => answer(res),
	])
	for (let i = 0; i < 6; i++) await query("SELECT n")
	const expected = basic(`goodwatch_webapp:${password}`)
	assert.deepEqual(authorization, [[expected, expected], [expected, expected], [expected, expected]])
})

test("a user with an empty password is still sent, as before", async (t) => {
	const authorization = await cluster(t, { CRATE_USER: "crate", CRATE_PASS: "" }, [(_, res) => answer(res)])
	await query("SELECT n")
	assert.deepEqual(authorization, [[basic("crate:")]])
})

test("a read with credentials fails over from a lost coordinator and the next one gets the same credentials", async (t) => {
	const authorization = await cluster(t, { CRATE_USER: "goodwatch_webapp", CRATE_PASS: "s3cret" }, [
		(req) => req.socket.destroy(),
		(_, res) => answer(res),
	])
	assert.deepEqual(await query("SELECT n"), [{ n: 1 }])
	const expected = basic("goodwatch_webapp:s3cret")
	assert.deepEqual(authorization, [[expected], [expected]])
})

test("a missing privilege reaches the caller at once and is not retried elsewhere", async (t) => {
	const authorization = await cluster(t, { CRATE_USER: "goodwatch_webapp", CRATE_PASS: "s3cret" }, [
		(_, res) => missingPrivilege(res), (_, res) => answer(res), (_, res) => answer(res),
	])
	await assert.rejects(query("SELECT n"), /MissingPrivilegeException/)
	assert.deepEqual(authorization.map((received) => received.length), [1, 0, 0])
})

test("a read refused by authentication on a starting node succeeds on the next coordinator", async (t) => {
	const authorization = await cluster(t, { CRATE_USER: "goodwatch_webapp", CRATE_PASS: "s3cret" }, [
		(_, res) => reject(res), (_, res) => answer(res), (_, res) => answer(res),
	])
	for (let i = 0; i < 4; i++) assert.deepEqual(await query("SELECT n"), [{ n: 1 }])
	// The refusing node cools down like an unreachable one.
	assert.deepEqual(authorization.map((received) => received.length), [1, 2, 2])
})

test("a write refused by authentication never ran, so it goes to the next coordinator", async (t) => {
	const authorization = await cluster(t, { CRATE_USER: "goodwatch_webapp", CRATE_PASS: "s3cret" }, [
		(_, res) => reject(res), (_, res) => answer(res),
	])
	assert.equal((await execute("UPDATE counter SET n = n + 1 WHERE id = ?", ["a"])).rowcount, 1)
	assert.deepEqual(authorization.map((received) => received.length), [1, 1])
})

test("a password every coordinator refuses fails after one attempt each, as an authentication error", async (t) => {
	const authorization = await cluster(t, { CRATE_USER: "goodwatch_webapp", CRATE_PASS: "wrong" }, [
		(_, res) => reject(res), (_, res) => reject(res), (_, res) => reject(res),
	])
	await assert.rejects(query("SELECT n"), (error: Error) => {
		assert.ok(error instanceof CrateAuthenticationError)
		assert.match(error.message, /^CrateDB HTTP 401: password authentication failed for user "goodwatch_webapp"$/)
		return true
	})
	assert.deepEqual(authorization.map((received) => received.length), [1, 1, 1])
	await assert.rejects(execute("DELETE FROM t WHERE id = ?", ["a"]), CrateAuthenticationError)
	assert.deepEqual(authorization.map((received) => received.length), [2, 2, 2])
})

test("the safe write helpers send the credentials on the write and on its readback", async (t) => {
	const authorization = await cluster(t, { CRATE_USER: "goodwatch_webapp", CRATE_PASS: "s3cret" }, [
		(_, res) => answer(res),
	])
	await upsert({ table: "user_setting", data: [{ user_id: "u", key: "k", value: "v" }], conflictColumns: ["user_id", "key"] })
	assert.ok(authorization[0].length >= 1)
	assert.deepEqual(new Set(authorization[0]), new Set([basic("goodwatch_webapp:s3cret")]))
})
