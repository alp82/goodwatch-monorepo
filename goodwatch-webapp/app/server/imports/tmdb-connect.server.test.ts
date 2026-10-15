import "../tracking-loader.test-support.ts"
import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { ConnectDb } from "./connect-db.test-support.ts"
const { setImportDbForTest } = await import("./store.server.ts")
import type { TmdbClient } from "./tmdb-client.server.ts"
import {
	type Connection,
	type ConnectionStore,
	createTmdbConnect,
} from "./tmdb-connect.server.ts"

class MemoryConnections implements ConnectionStore {
	rows = new Map<
		string,
		{ value: Connection; available: number; lease: number }
	>()
	async create(value: Connection, available: number) {
		this.rows.set(value.id, {
			value: structuredClone(value),
			available,
			lease: 0,
		})
	}
	async claim(id: string, userId: string | undefined, now: number) {
		const row = this.rows.get(id)
		if (
			!row ||
			(userId !== undefined && row.value.userId !== userId) ||
			row.lease > now
		)
			return null
		row.lease = now + 10 * 60_000
		return structuredClone(row.value)
	}
	async save(value: Connection, available?: number) {
		const row = this.rows.get(value.id)
		assert.ok(row)
		row.value = structuredClone(value)
		if (available !== undefined) {
			row.available = available
			row.lease = 0
		}
	}
	async remove(id: string) {
		this.rows.delete(id)
	}
	async due(now: number) {
		return [...this.rows.values()]
			.filter((x) => x.available <= now)
			.map((x) => x.value.id)
	}
}
const { createConnectionStore } = await import("./connect-store.server.ts")
function fixture(persistent = false) {
	let now = Date.parse("2026-10-15T12:00:00Z")
	const store = new MemoryConnections()
	const revoked: string[] = []
	const client: TmdbClient = {
		createRequest: async () => "request-secret",
		exchange: async () => ({
			accessToken: "member-secret",
			accountId: "account",
		}),
		readAccount: async () => ({
			source: "tmdb",
			observations: [
				{
					key: "tmdb:favorite:movie:862",
					kind: "favorite",
					mediaType: "movie",
					title: "Toy Story",
					year: 1995,
					tmdbId: 862,
					imdbId: null,
				},
			],
			warnings: [],
		}),
		revoke: async (token) => {
			revoked.push(token)
		},
	}
	const db = new ConnectDb()
	db.catalog = [
		{
			tmdb_id: 862,
			imdb_id: "tt0114709",
			title: "Toy Story",
			release_year: 1995,
		},
	]
	setImportDbForTest(db)
	const flow = createTmdbConnect({
		store: persistent ? createConnectionStore(() => "app-secret") : store,
		client,
		now: () => now,
		member: async (request) => ({
			userId: request.headers.get("Member"),
			headers: new Headers(),
		}),
		origin: () => "https://goodwatch.test",
	})
	const request = (step: string, id = "", cookie = "", member = "member") =>
		flow.handle(
			new Request(`https://goodwatch.test/api/imports/tmdb/${step}`, {
				method: "POST",
				headers: {
					Origin: "https://goodwatch.test",
					Member: member,
					Cookie: cookie,
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams({ state: id }),
			}),
			step,
		)
	return {
		flow,
		store,
		client,
		revoked,
		db,
		request,
		advance: (ms: number) => {
			now += ms
		},
	}
}
afterEach(() => setImportDbForTest())

test("start and return bind approval to the member and browser, then revoke before a normal preview", async () => {
	const f = fixture()
	const start = await f.request("start")
	assert.equal(start.status, 303)
	assert.match(
		start.headers.get("Location") ?? "",
		/^https:\/\/www.themoviedb.org\/auth\/access\?request_token=request-secret$/,
	)
	assert.match(start.headers.get("Cache-Control") ?? "", /no-store/)
	const cookie = start.headers.get("Set-Cookie") ?? ""
	assert.match(cookie, /HttpOnly/)
	assert.match(cookie, /SameSite=Lax/i)
	assert.doesNotMatch(cookie, /request-secret|member-secret/)
	const id = [...f.store.rows.keys()][0]
	assert.equal(
		(await f.request("return", id, cookie, "other-member")).status,
		404,
	)
	const returned = await f.request("return", id, cookie)
	assert.equal(returned.status, 303)
	assert.match(
		returned.headers.get("Location") ?? "",
		/settings\/imports\?source=tmdb&import=/,
	)
	assert.deepEqual(f.revoked, ["member-secret"])
	assert.equal(f.store.rows.size, 0)
	assert.equal(f.db.imports.length, 1)
	assert.doesNotMatch(
		JSON.stringify(f.db.imports) + JSON.stringify(f.db.items),
		/member-secret|request-secret/,
	)
	assert.equal((await f.request("return", id, cookie)).status, 404)
})

test("abandon, read failure and preview failure all delete the token and server state", async () => {
	for (const mode of ["abandon", "read-failure", "preview-failure"]) {
		const f = fixture()
		const start = await f.request("start")
		const id = [...f.store.rows.keys()][0]
		if (mode === "read-failure")
			f.client.readAccount = async () => {
				throw new Error("member-secret")
			}
		if (mode === "preview-failure")
			f.db.select = async () => {
				throw new Error("database unavailable")
			}
		const response = await f.request(
			mode === "abandon" ? "abandon" : "return",
			id,
			start.headers.get("Set-Cookie") ?? "",
		)
		assert.equal(response.status, mode === "abandon" ? 303 : 502)
		assert.deepEqual(f.revoked, ["member-secret"])
		assert.equal(f.store.rows.size, 0)
		assert.doesNotMatch(await response.text(), /member-secret/)
	}
})

test("closing the browser still revokes an approved connection; failed deletion is retried after restart", async () => {
	const f = fixture()
	await f.request("start")
	f.advance(10 * 60_000)
	f.client.revoke = async () => {
		throw new Error("TMDB unavailable: member-secret")
	}
	await f.flow.sweep()
	assert.equal(f.store.rows.size, 1)
	// A new server instance shares only the durable store, not the old handler's memory.
	const restarted = createTmdbConnect({
		store: f.store,
		client: {
			...f.client,
			revoke: async (token) => {
				f.revoked.push(token)
			},
		},
		now: () => Date.parse("2026-10-15T12:12:00Z"),
		origin: () => null,
		member: async () => ({ userId: null, headers: new Headers() }),
	})
	await restarted.sweep()
	assert.deepEqual(f.revoked, ["member-secret"])
	assert.equal(f.store.rows.size, 0)
	assert.equal(f.db.imports.length, 0)
})

test("canceling before approval retains only cleanup work and catches a later approval", async () => {
	const f = fixture()
	const start = await f.request("start")
	const id = [...f.store.rows.keys()][0]
	const { TmdbError } = await import("./tmdb-client.server.ts")
	f.client.exchange = async () => {
		throw new TmdbError(undefined, 401)
	}
	const canceled = await f.request(
		"abandon",
		id,
		start.headers.get("Set-Cookie") ?? "",
	)
	assert.equal(canceled.status, 303)
	assert.equal(f.store.rows.size, 1)
	f.client.exchange = async () => ({
		accessToken: "late-secret",
		accountId: "account",
	})
	f.advance(60_000)
	await f.flow.sweep()
	assert.deepEqual(f.revoked, ["late-secret"])
	assert.equal(f.store.rows.size, 0)
	assert.equal(f.db.imports.length, 0)
})

test("a denied or never-approved request expires without creating an import", async () => {
	const f = fixture()
	await f.request("start")
	const { TmdbError } = await import("./tmdb-client.server.ts")
	f.client.exchange = async () => {
		throw new TmdbError(undefined, 401)
	}
	f.advance(10 * 60_000)
	await f.flow.sweep()
	assert.equal(f.store.rows.size, 1)
	f.advance(5 * 60_000)
	await f.flow.sweep()
	assert.equal(f.store.rows.size, 0)
	assert.equal(f.revoked.length, 0)
})

test("unauthenticated, cross-origin, wrong browser and GET requests cannot mint or use a token", async () => {
	const f = fixture()
	assert.equal((await f.request("start", "", "", "")).status, 401)
	for (const [method, origin, status] of [
		["GET", "https://goodwatch.test", 405],
		["POST", "https://attacker.test", 403],
	] as const) {
		assert.equal(
			(
				await f.flow.handle(
					new Request("https://goodwatch.test/api/imports/tmdb/start", {
						method,
						headers: { Member: "member", Origin: origin },
					}),
					"start",
				)
			).status,
			status,
		)
	}
	assert.equal(f.store.rows.size, 0)
	await f.request("start")
	const id = [...f.store.rows.keys()][0]
	assert.equal((await f.request("return", id, "")).status, 404)
	assert.equal(f.revoked.length, 0)
})

test("simultaneous return and abandon never exchange or import twice", async () => {
	const f = fixture()
	const start = await f.request("start")
	const id = [...f.store.rows.keys()][0]
	const cookie = start.headers.get("Set-Cookie") ?? ""
	const responses = await Promise.all([
		f.request("return", id, cookie),
		f.request("abandon", id, cookie),
	])
	assert.deepEqual(responses.map((x) => x.status).sort(), [303, 404])
	assert.deepEqual(f.revoked, ["member-secret"])
	assert.equal(f.db.imports.length, 1)
})

test("the real server store encrypts credentials, prevents concurrent claims and erases them after return", async () => {
	const f = fixture(true)
	const start = await f.request("start")
	const id = [...f.db.connections.keys()][0]
	assert.doesNotMatch(
		JSON.stringify(f.db.connectionWrites),
		/request-secret|member-secret/,
	)
	const responses = await Promise.all([
		f.request("return", id, start.headers.get("Set-Cookie") ?? ""),
		f.request("return", id, start.headers.get("Set-Cookie") ?? ""),
	])
	assert.deepEqual(responses.map((x) => x.status).sort(), [303, 404])
	assert.deepEqual(f.revoked, ["member-secret"])
	assert.equal(f.db.connections.size, 0)
	assert.doesNotMatch(
		JSON.stringify(f.db.connectionWrites),
		/request-secret|member-secret/,
	)
})

test("credential storage failure after exchange still revokes the newly minted token", async () => {
	const f = fixture(true)
	const start = await f.request("start")
	const id = [...f.db.connections.keys()][0]
	f.db.failCredentialSave = true
	const response = await f.request(
		"return",
		id,
		start.headers.get("Set-Cookie") ?? "",
	)
	assert.equal(response.status, 502)
	assert.deepEqual(f.revoked, ["member-secret"])
	assert.equal(f.db.connections.size, 0)
	assert.equal(f.db.imports.length, 0)
})

test("an access token in a malformed exchange response is revoked without reading an account", async () => {
	const f = fixture(true)
	const start = await f.request("start")
	const id = [...f.db.connections.keys()][0]
	f.client.exchange = async () => ({
		accessToken: "member-secret",
		accountId: "",
	})
	let read = false
	f.client.readAccount = async () => {
		read = true
		return { source: "tmdb", observations: [], warnings: [] }
	}
	const response = await f.request(
		"return",
		id,
		start.headers.get("Set-Cookie") ?? "",
	)
	assert.equal(response.status, 502)
	assert.equal(read, false)
	assert.deepEqual(f.revoked, ["member-secret"])
	assert.equal(f.db.connections.size, 0)
})

test("abandoned approval cleanup revokes even when saving the exchanged credential fails", async () => {
	const f = fixture(true)
	await f.request("start")
	f.db.failCredentialSave = true
	f.advance(10 * 60_000)
	await f.flow.sweep()
	assert.deepEqual(f.revoked, ["member-secret"])
	assert.equal(f.db.connections.size, 0)
})

test("a rate-limited read defers cleanup until Retry-After instead of making another TMDB call", async () => {
	const f = fixture()
	const start = await f.request("start")
	const id = [...f.store.rows.keys()][0]
	const { TmdbError } = await import("./tmdb-client.server.ts")
	const busy = new TmdbError("TMDB is busy", 429)
	busy.retryAfterMs = 120_000
	f.client.readAccount = async () => {
		throw busy
	}
	assert.equal(
		(await f.request("return", id, start.headers.get("Set-Cookie") ?? ""))
			.status,
		429,
	)
	assert.equal(f.revoked.length, 0)
	f.advance(119_000)
	await f.flow.sweep()
	assert.equal(f.revoked.length, 0)
	f.advance(1000)
	await f.flow.sweep()
	assert.deepEqual(f.revoked, ["member-secret"])
	assert.equal(f.store.rows.size, 0)
})

test("a revocation outage withholds preview and retains encrypted cleanup until deletion succeeds", async () => {
	const f = fixture(true)
	const start = await f.request("start")
	const id = [...f.db.connections.keys()][0]
	f.client.revoke = async () => {
		throw new Error("member-secret")
	}
	const response = await f.request(
		"return",
		id,
		start.headers.get("Set-Cookie") ?? "",
	)
	assert.equal(response.status, 502)
	assert.match(await response.text(), /retry automatically/)
	assert.equal(f.db.imports.length, 0)
	assert.equal(f.db.connections.size, 1)
	assert.doesNotMatch(
		JSON.stringify(f.db.connectionWrites),
		/member-secret|request-secret/,
	)
	f.client.revoke = async (token) => {
		f.revoked.push(token)
	}
	f.advance(60_000)
	await f.flow.sweep()
	assert.deepEqual(f.revoked, ["member-secret"])
	assert.equal(f.db.connections.size, 0)
})
