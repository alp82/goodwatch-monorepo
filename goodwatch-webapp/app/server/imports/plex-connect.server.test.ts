import "./remix-runtime.test-support.ts"
import "../tracking-loader.test-support.ts"
import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { ConnectDb } from "./connect-db.test-support.ts"
import type { PlexClient } from "./plex-client.server.ts"
import { createPlexConnect } from "./plex-connect.server.ts"
const { setImportDbForTest } = await import("./store.server.ts")
const { createConnectionStore } = await import("./connect-store.server.ts")

afterEach(() => setImportDbForTest())
function fixture() {
	let now = Date.now()
	const db = new ConnectDb()
	setImportDbForTest(db)
	const client: PlexClient = {
		createPin: async () => ({ id: "123", code: "approve-code" }),
		claimPin: async () => "member-secret",
		readImport: async () => ({
			source: "plex",
			observations: [],
			warnings: ["Server unreachable"],
		}),
	}
	const flow = createPlexConnect({
		store: createConnectionStore(
			() => "11".repeat(32),
			() => "",
			"plex",
		),
		client,
		member: async (req) => ({
			userId: req.headers.get("Member"),
			headers: new Headers(),
		}),
		origin: () => "https://goodwatch.test",
		now: () => now,
	})
	const request = (
		step: string,
		state = "",
		cookie = "",
		member = "member",
		origin = "https://goodwatch.test",
	) =>
		flow.handle(
			new Request(`https://goodwatch.test/api/imports/plex/${step}`, {
				method: "POST",
				headers: {
					Origin: origin,
					Member: member,
					Cookie: cookie,
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams({ state }),
			}),
			step,
		)
	return {
		db,
		client,
		flow,
		request,
		advance: () => {
			now += 11 * 60_000
		},
	}
}
test("Plex PIN return binds member and browser, encrypts credentials and discards them before preview", async () => {
	const f = fixture()
	const start = await f.request("start")
	assert.equal(start.status, 303)
	const location = start.headers.get("Location") ?? ""
	assert.match(location, /^https:\/\/app.plex.tv\/auth#\?/)
	const state = [...f.db.connections.keys()][0]
	const cookie = start.headers.get("Set-Cookie") ?? ""
	assert.match(cookie, /HttpOnly/)
	assert.equal((await f.request("return", state, cookie, "other")).status, 404)
	assert.equal((await f.request("return", state, "")).status, 404)
	const response = await f.request("return", state, cookie)
	assert.equal(response.status, 303)
	assert.match(response.headers.get("Location") ?? "", /source=plex&import=/)
	assert.equal(f.db.connections.size, 0)
	assert.equal(f.db.imports[0].source, "plex")
	assert.doesNotMatch(
		JSON.stringify(f.db.connectionWrites) +
			JSON.stringify(f.db.imports) +
			(await response.text()),
		/member-secret/,
	)
	assert.equal((await f.request("return", state, cookie)).status, 404)
})

test("Plex cancel, expiry, failure and abandoned-browser cleanup discard credentials without touching TMDB", async () => {
	for (const mode of ["abandon", "expired", "failure", "closed"] as const) {
		const f = fixture()
		const tmdb = createConnectionStore(() => "11".repeat(32))
		await tmdb.create(
			{
				id: "tmdb-row",
				userId: "other",
				requestToken: "tmdb-secret",
				expiresAt: 0,
			},
			0,
		)
		const start = await f.request("start")
		const state =
			[...f.db.connections.keys()].find((id) => id !== "tmdb-row") ?? ""
		if (mode === "failure")
			f.client.readImport = async () => {
				throw new Error("member-secret")
			}
		if (mode === "expired" || mode === "closed") f.advance()
		if (mode === "closed") await f.flow.sweep()
		else {
			const response = await f.request(
				mode === "abandon" ? "abandon" : "return",
				state,
				start.headers.get("Set-Cookie") ?? "",
			)
			assert.equal(
				response.status,
				mode === "abandon" ? 303 : mode === "expired" ? 404 : 503,
			)
			assert.doesNotMatch(await response.text(), /member-secret/)
		}
		assert.deepEqual([...f.db.connections.keys()], ["tmdb-row"])
		assert.equal(f.db.imports.length, 0)
	}
})

test("Plex endpoints reject unauthenticated, cross-origin and GET requests before PIN creation", async () => {
	const f = fixture()
	assert.equal((await f.request("start", "", "", "")).status, 401)
	assert.equal(
		(await f.request("start", "", "", "member", "https://evil.test")).status,
		403,
	)
	assert.equal(
		(
			await f.flow.handle(
				new Request("https://goodwatch.test/api/imports/plex/start", {
					headers: { Member: "member" },
				}),
				"start",
			)
		).status,
		405,
	)
	assert.equal(f.db.connections.size, 0)
})

test("Plex pending approval can retry, concurrent return cannot fetch twice, and failed credential save leaves no token", async () => {
	const f = fixture()
	const start = await f.request("start")
	const state = [...f.db.connections.keys()][0]
	const cookie = start.headers.get("Set-Cookie") ?? ""
	f.client.claimPin = async () => null
	assert.equal((await f.request("return", state, cookie)).status, 409)
	f.client.claimPin = async () => "member-secret"
	const replies = await Promise.all([
		f.request("return", state, cookie),
		f.request("return", state, cookie),
	])
	assert.deepEqual(replies.map((r) => r.status).sort(), [303, 404])
	assert.equal(f.db.imports.length, 1)
	const g = fixture()
	const begun = await g.request("start")
	g.db.failCredentialSave = true
	const failed = await g.request(
		"return",
		[...g.db.connections.keys()][0],
		begun.headers.get("Set-Cookie") ?? "",
	)
	assert.equal(failed.status, 503)
	assert.equal(g.db.connections.size, 0)
	assert.equal(g.db.imports.length, 0)
})

test("Plex sweep isolates undecryptable rows and wipes an issued credential before a failed delete", async () => {
	const f = fixture()
	const store = createConnectionStore(
		() => "11".repeat(32),
		() => "",
		"plex",
	)
	await store.create(
		{
			id: "broken",
			source: "plex",
			userId: "broken-member",
			requestToken: "old-pin",
			expiresAt: 0,
		},
		0,
	)
	const broken = f.db.connections.get("broken")
	assert.ok(broken)
	broken.payload = "unreadable"
	await store.create(
		{
			id: "retry",
			source: "plex",
			userId: "retry-member",
			requestToken: "old-pin",
			accessToken: "legacy-token",
			expiresAt: 0,
		},
		0,
	)
	await store.create(
		{
			id: "healthy",
			source: "plex",
			userId: "healthy-member",
			requestToken: "old-pin",
			expiresAt: 0,
		},
		0,
	)
	const run = f.db.run.bind(f.db)
	let failDelete = true
	f.db.run = async (sql, params) => {
		if (
			sql.startsWith("DELETE FROM doc.user_import_connection") &&
			params[0] === "retry" &&
			failDelete
		)
			throw new Error("delete unavailable")
		return run(sql, params)
	}
	await f.flow.sweep()
	assert.equal(f.db.connections.has("healthy"), false)
	assert.equal(broken.cleanup_at, null)
	const retained = await store.claim(
		"retry",
		undefined,
		Date.now() + 11 * 60_000,
	)
	assert.ok(retained)
	assert.equal(retained.requestToken, "")
	assert.equal(retained.accessToken, undefined)
	assert.equal(retained.canceled, true)
	await store.save(retained, 0)
	failDelete = false
	await f.flow.sweep()
	assert.equal(f.db.connections.has("retry"), false)
})

test("Plex stores a PIN ID and a replay marker, never the issued token even while reading", async () => {
	const f = fixture()
	const store = createConnectionStore(
		() => "11".repeat(32),
		() => "",
		"plex",
	)
	const start = await f.request("start")
	const state = [...f.db.connections.keys()][0]
	const pending = await store.claim(state, undefined, Date.now())
	assert.ok(pending)
	assert.equal("pinId" in pending && pending.pinId, "123")
	assert.equal(pending.requestToken, "")
	await store.save(pending, pending.expiresAt)
	f.client.readImport = async (token) => {
		assert.equal(token, "member-secret")
		const issued = await store.claim(state, undefined, Date.now() + 11 * 60_000)
		assert.ok(issued)
		assert.equal("consumed" in issued && issued.consumed, true)
		assert.equal(issued.accessToken, undefined)
		assert.doesNotMatch(JSON.stringify(issued), /member-secret/)
		assert.equal(
			await store.claim(state, "member", Date.now() + 22 * 60_000),
			null,
		)
		return { source: "plex", observations: [], warnings: [] }
	}
	const result = await f.request(
		"return",
		state,
		start.headers.get("Set-Cookie") ?? "",
	)
	assert.equal(result.status, 303)
	assert.equal(f.db.connections.size, 0)
})
