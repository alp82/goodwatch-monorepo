import "./remix-runtime.test-support.ts"
import "../tracking-loader.test-support.ts"
import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { ConnectDb } from "./connect-db.test-support.ts"
const { setImportDbForTest } = await import("./store.server.ts")
import { type TmdbClient, createTmdbClient } from "./tmdb-client.server.ts"
import { createTmdbConnect } from "./tmdb-connect.server.ts"
const { createConnectionStore } = await import("./connect-store.server.ts")
function fixture(keys = { current: "11".repeat(32), previous: "" }) {
	let now = Date.parse("2026-10-15T12:00:00Z")
	const store = createConnectionStore(
		() => keys.current,
		() => keys.previous,
	)
	const revoked: string[] = []
	const alerts: string[] = []
	const client: TmdbClient = {
		createRequest: async () => "request-secret",
		exchange: async () => ({
			sessionId: "member-secret",
		}),
		getAccountId: async () => "account",
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
		store,
		client,
		alert: (id: string) => {
			alerts.push(id)
		},
		now: () => now,
		member: async (request) => ({
			userId: request.headers.get("Member"),
			headers: new Headers(),
		}),
		origin: () => "https://goodwatch.test",
	})
	const request = (
		step: string,
		id = "",
		cookie = "",
		member = "member",
		denied = false,
	) =>
		flow.handle(
			new Request(`https://goodwatch.test/api/imports/tmdb/${step}`, {
				method: "POST",
				headers: {
					Origin: "https://goodwatch.test",
					Member: member,
					Cookie: cookie,
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams({ state: id, denied: String(denied) }),
			}),
			step,
		)
	return {
		flow,
		alerts,
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

test("start returns a safe JSON error under the production Remix runtime when TMDB fails", async () => {
	const f = fixture()
	f.client.createRequest = async () => {
		throw new Error("request-secret")
	}
	const response = await f.request("start")
	assert.equal(response.status, 503)
	assert.equal(
		response.headers.get("Content-Type"),
		"application/json; charset=utf-8",
	)
	assert.equal(response.headers.get("Cache-Control"), "private, no-store")
	assert.equal(response.headers.get("Referrer-Policy"), "no-referrer")
	assert.deepEqual(await response.json(), {
		error: "TMDB Connect is temporarily unavailable. Please try again.",
	})
	assert.equal(f.db.connections.size, 0)
})

test("TMDB API-key rejection reaches the member as JSON without leaking provider text", async () => {
	const f = fixture()
	f.client.createRequest = createTmdbClient({
		apiKey: "application-secret",
		fetch: async () =>
			new Response(
				JSON.stringify({
					success: false,
					status_code: 7,
					status_message: "Invalid API key: application-secret",
				}),
				{ status: 401 },
			),
	}).createRequest
	const response = await f.request("start")
	assert.equal(response.status, 401)
	assert.deepEqual(await response.json(), {
		error: "TMDB could not complete this connection. Please try again.",
	})
	assert.equal(f.db.connections.size, 0)
})

test("start and return bind approval to the member and browser, then revoke before a normal preview", async () => {
	const f = fixture()
	const start = await f.request("start")
	assert.equal(start.status, 303)
	assert.match(
		start.headers.get("Location") ?? "",
		/^https:\/\/www.themoviedb.org\/authenticate\/request-secret\?redirect_to=/,
	)
	assert.equal(
		new URL(start.headers.get("Location") ?? "").searchParams.get(
			"redirect_to",
		),
		`https://goodwatch.test/settings/imports?source=tmdb&connect=${[...f.db.connections.keys()][0]}`,
	)
	assert.match(start.headers.get("Cache-Control") ?? "", /no-store/)
	const cookie = start.headers.get("Set-Cookie") ?? ""
	assert.match(cookie, /HttpOnly/)
	assert.match(cookie, /SameSite=Lax/i)
	assert.doesNotMatch(cookie, /request-secret|member-secret/)
	const id = [...f.db.connections.keys()][0]
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
	assert.equal(f.db.connections.size, 0)
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
		const id = [...f.db.connections.keys()][0]
		if (mode === "read-failure")
			f.client.readAccount = async () => {
				throw new Error("member-secret")
			}
		if (mode === "preview-failure") {
			const select = f.db.select.bind(f.db)
			f.db.select = async (sql, params) => {
				if (!sql.includes("user_import_connection"))
					throw new Error("database unavailable")
				return select(sql, params)
			}
		}
		const response = await f.request(
			mode === "abandon" ? "abandon" : "return",
			id,
			start.headers.get("Set-Cookie") ?? "",
		)
		assert.equal(response.status, mode === "abandon" ? 303 : 502)
		assert.deepEqual(f.revoked, ["member-secret"])
		assert.equal(f.db.connections.size, 0)
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
	assert.equal(f.db.connections.size, 1)
	// A new server instance shares only the durable store, not the old handler's memory.
	const restarted = createTmdbConnect({
		store: createConnectionStore(() => "11".repeat(32)),
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
	assert.equal(f.db.connections.size, 0)
	assert.equal(f.db.imports.length, 0)
})

test("canceling before approval retains only cleanup work and catches a later approval", async () => {
	const f = fixture()
	const start = await f.request("start")
	const id = [...f.db.connections.keys()][0]
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
	assert.equal(f.db.connections.size, 1)
	f.client.exchange = async () => ({
		sessionId: "late-secret",
	})
	f.advance(60_000)
	await f.flow.sweep()
	assert.deepEqual(f.revoked, ["late-secret"])
	assert.equal(f.db.connections.size, 0)
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
	assert.equal(f.db.connections.size, 1)
	f.advance(5 * 60_000)
	await f.flow.sweep()
	assert.equal(f.db.connections.size, 1)
	f.advance(50 * 60_000)
	await f.flow.sweep()
	assert.equal(f.db.connections.size, 0)
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
	assert.equal(f.db.connections.size, 0)
	await f.request("start")
	const id = [...f.db.connections.keys()][0]
	assert.equal((await f.request("return", id, "")).status, 404)
	assert.equal(f.revoked.length, 0)
})

test("simultaneous return and abandon never exchange or import twice", async () => {
	const f = fixture()
	const start = await f.request("start")
	const id = [...f.db.connections.keys()][0]
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
	const f = fixture()
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
	const f = fixture()
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

test("a session is revoked when the account lookup fails", async () => {
	const f = fixture()
	const start = await f.request("start")
	const id = [...f.db.connections.keys()][0]
	f.client.getAccountId = async () => {
		throw new Error("member-secret")
	}
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
	const f = fixture()
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
	const id = [...f.db.connections.keys()][0]
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
	assert.equal(
		(await f.request("return", id, start.headers.get("Set-Cookie") ?? ""))
			.status,
		404,
	)
	assert.equal(f.revoked.length, 0)
	f.advance(119_000)
	await f.flow.sweep()
	assert.equal(f.revoked.length, 0)
	f.advance(1000)
	await f.flow.sweep()
	assert.deepEqual(f.revoked, ["member-secret"])
	assert.equal(f.db.connections.size, 0)
})

test("a revocation outage withholds preview and retains encrypted cleanup until deletion succeeds", async () => {
	const f = fixture()
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

test("return after the connection deadline revokes access and explains how to restart", async () => {
	const f = fixture()
	const start = await f.request("start")
	const id = [...f.db.connections.keys()][0]
	f.advance(10 * 60_000)
	const response = await f.request(
		"return",
		id,
		start.headers.get("Set-Cookie") ?? "",
	)
	assert.equal(response.status, 410)
	assert.match(await response.text(), /Connection expired, start again/)
	assert.deepEqual(f.revoked, ["member-secret"])
	assert.equal(f.db.connections.size, 0)
	assert.equal(f.db.imports.length, 0)
})

test("rotated encryption keys still clean up pending approvals using the previous key and write a key-id prefix", async () => {
	const keys = { current: "11".repeat(32), previous: "" }
	const f = fixture(keys)
	await f.request("start")
	const oldPayload = [...f.db.connections.values()][0].payload
	assert.match(oldPayload, /^v1:[a-f0-9]{16}:/)
	keys.previous = keys.current
	keys.current = "22".repeat(32)
	const next = await f.request("start", "", "", "another-member")
	assert.equal(next.status, 303)
	const newPayload = [...f.db.connections.values()][1].payload
	assert.notEqual(oldPayload.split(":")[1], newPayload.split(":")[1])
	f.advance(10 * 60_000)
	await f.flow.sweep()
	assert.deepEqual(f.revoked, ["member-secret", "member-secret"])
	assert.equal(f.db.connections.size, 0)
})

test("persistent revocation failure pauses after eight cleanup attempts with one credential-free alert", async () => {
	const f = fixture()
	await f.request("start")
	const id = [...f.db.connections.keys()][0]
	let attempts = 0
	f.client.revoke = async () => {
		attempts++
		throw new Error("member-secret")
	}
	f.advance(10 * 60_000)
	for (let i = 0; i < 12; i++) {
		await f.flow.sweep()
		f.advance(60_000)
	}
	assert.equal(attempts, 8)
	assert.deepEqual(f.alerts, [id])
	assert.equal(f.db.connections.size, 1)
	assert.equal(f.db.connections.get(id)?.cleanup_at, null)
})

test("an unreadable credential row is paused and alerted without blocking other members' cleanup", async () => {
	const f = fixture()
	await f.request("start")
	const id = [...f.db.connections.keys()][0]
	const row = f.db.connections.get(id)
	assert.ok(row)
	row.payload = "unreadable-secret"
	await f.request("start", "", "", "another-member")
	f.advance(10 * 60_000)
	await f.flow.sweep()
	assert.deepEqual(f.alerts, [id])
	assert.deepEqual(f.revoked, ["member-secret"])
	assert.equal(f.db.connections.size, 1)
	assert.equal(f.db.connections.get(id)?.cleanup_at, null)
	f.advance(10 * 60_000)
	await f.flow.sweep()
	assert.deepEqual(f.alerts, [id])
})

test("a member can have at most three open connections, including concurrent starts and paused cleanup", async () => {
	const f = fixture()
	let minted = 0
	f.client.createRequest = async () => {
		minted++
		return "request-secret"
	}
	const responses = await Promise.all(
		Array.from({ length: 6 }, () => f.request("start")),
	)
	assert.deepEqual(
		responses.map((r) => r.status).sort(),
		[303, 303, 303, 429, 429, 429],
	)
	assert.equal(minted, 3)
	const paused = [...f.db.connections.values()][2]
	paused.cleanup_at = null
	assert.equal((await f.request("start")).status, 429)
	assert.equal(f.db.connections.size, 3)
	const blocked = responses.find((r) => r.status === 429)
	assert.ok(blocked)
	assert.match(await blocked.text(), /open connections/)
	assert.equal((await f.request("start", "", "", "other-member")).status, 303)
	const first = responses.find((r) => r.status === 303)
	assert.ok(first)
	const id = [...f.db.connections.keys()][0]
	assert.equal(
		(await f.request("abandon", id, first.headers.get("Set-Cookie") ?? ""))
			.status,
		303,
	)
	assert.equal((await f.request("start")).status, 303)
})

test("cleanup respects the real store lease while a member's account is being read", async () => {
	const f = fixture()
	const start = await f.request("start")
	const id = [...f.db.connections.keys()][0]
	f.advance(9 * 60_000)
	let enteredResolve = () => {}
	let finishResolve = () => {}
	const entered = new Promise<void>((resolve) => {
		enteredResolve = resolve
	})
	const finish = new Promise<void>((resolve) => {
		finishResolve = resolve
	})
	const read = f.client.readAccount
	f.client.readAccount = async (...args) => {
		enteredResolve()
		await finish
		return read(...args)
	}
	const returned = f.request(
		"return",
		id,
		start.headers.get("Set-Cookie") ?? "",
	)
	await entered
	f.advance(60_000)
	await f.flow.sweep()
	assert.equal(f.revoked.length, 0)
	finishResolve()
	assert.equal((await returned).status, 303)
	assert.deepEqual(f.revoked, ["member-secret"])
	assert.equal(f.db.connections.size, 0)
})

test("missing or malformed encryption keys reject start before any TMDB request", async () => {
	for (const current of ["", "not-a-32-byte-key"]) {
		const f = fixture({ current, previous: "" })
		let minted = 0
		f.client.createRequest = async () => {
			minted++
			return "request-secret"
		}
		assert.equal((await f.request("start")).status, 503)
		assert.equal(minted, 0)
		assert.equal(f.db.connections.size, 0)
	}
})

test("denied sign-in clears the connection without minting a session or importing", async () => {
	const f = fixture()
	const start = await f.request("start")
	const id = [...f.db.connections.keys()][0]
	f.client.exchange = async () => {
		throw new Error("must not exchange denied request")
	}
	const response = await f.request(
		"return",
		id,
		start.headers.get("Set-Cookie") ?? "",
		"member",
		true,
	)
	assert.equal(response.status, 403)
	assert.match(await response.text(), /denied.*start again/i)
	assert.equal(f.db.connections.size, 0)
	assert.equal(f.db.imports.length, 0)
	assert.deepEqual(f.revoked, [])
})

test("an expired TMDB request token shows a safe restart message and is eventually erased", async () => {
	const f = fixture()
	const start = await f.request("start")
	const id = [...f.db.connections.keys()][0]
	f.client.exchange = createTmdbClient({
		apiKey: "app-secret",
		fetch: async () =>
			new Response(
				JSON.stringify({
					success: false,
					status_code: 17,
					status_message: "Expired request-secret",
				}),
				{ status: 401 },
			),
	}).exchange
	f.advance(65 * 60_000)
	const response = await f.request(
		"return",
		id,
		start.headers.get("Set-Cookie") ?? "",
	)
	assert.equal(response.status, 401)
	const body = await response.text()
	assert.match(body, /expired.*Start again/)
	assert.doesNotMatch(body, /request-secret|app-secret/)
	assert.equal(f.db.imports.length, 0)
	assert.deepEqual(f.revoked, [])
	f.advance(60_000)
	await f.flow.sweep()
	assert.equal(f.db.connections.size, 0)
})

test("the v3 client and connection flow delete sessions after success, list failure and account failure", async () => {
	for (const mode of ["success", "list-failure", "account-failure"]) {
		const f = fixture()
		const calls: { path: string; method: string; body?: string }[] = []
		const client = createTmdbClient({
			apiKey: "app-secret",
			sleep: async () => {},
			fetch: async (input, init) => {
				const url = new URL(String(input))
				assert.equal(url.searchParams.get("api_key"), "app-secret")
				assert.equal(new Headers(init?.headers).get("Authorization"), null)
				calls.push({
					path: url.pathname,
					method: init?.method ?? "GET",
					body: init?.body?.toString(),
				})
				if (url.pathname === "/3/authentication/token/new")
					return new Response(
						JSON.stringify({ success: true, request_token: "request-secret" }),
					)
				if (url.pathname === "/3/authentication/session/new")
					return new Response(
						JSON.stringify({ success: true, session_id: "member-secret" }),
					)
				if (url.pathname === "/3/authentication/session")
					return new Response(JSON.stringify({ success: true }))
				assert.equal(url.searchParams.get("session_id"), "member-secret")
				if (url.pathname === "/3/account") {
					if (mode === "account-failure") throw new Error("member-secret")
					return new Response(JSON.stringify({ id: 123 }))
				}
				if (mode === "list-failure") throw new Error("member-secret")
				return new Response(
					JSON.stringify({
						page: 1,
						total_pages: 1,
						total_results: 1,
						results: [
							url.pathname.endsWith("/rated/tv/episodes")
								? {
										id: 62085,
										show_id: 1396,
										season_number: 1,
										episode_number: 1,
										rating: 9,
									}
								: { id: 862, title: "Toy Story", rating: 7.5 },
						],
					}),
				)
			},
		})
		Object.assign(f.client, client)
		const start = await f.request("start")
		const id = [...f.db.connections.keys()][0]
		const response = await f.request(
			"return",
			id,
			start.headers.get("Set-Cookie") ?? "",
		)
		assert.equal(response.status, mode === "success" ? 303 : 502)
		assert.deepEqual(calls.at(-1), {
			path: "/3/authentication/session",
			method: "DELETE",
			body: '{"session_id":"member-secret"}',
		})
		assert.equal(f.db.connections.size, 0)
		assert.equal(f.db.imports.length, mode === "success" ? 1 : 0)
		assert.doesNotMatch(
			await response.text(),
			/member-secret|request-secret|app-secret/,
		)
	}
})

test("cleanup retries an already-deleted TMDB session and removes the retained connection row", async () => {
	const f = fixture()
	const calls: string[] = []
	let deleted = false
	f.client.revoke = createTmdbClient({
		apiKey: "app-secret",
		sleep: async () => {},
		fetch: async (input, init) => {
			const url = new URL(String(input))
			assert.equal(url.searchParams.get("api_key"), "app-secret")
			calls.push(`${init?.method} ${url.pathname}`)
			if (url.pathname === "/3/authentication/session") {
				assert.equal(init?.method, "DELETE")
				assert.deepEqual(JSON.parse(String(init.body)), {
					session_id: "member-secret",
				})
				if (deleted)
					return new Response(
						JSON.stringify({ success: false, status_code: 34 }),
						{ status: 404 },
					)
				deleted = true
				return new Response(JSON.stringify({ success: true }))
			}
			if (url.pathname === "/3/authentication")
				return new Response(JSON.stringify({ success: true }))
			assert.equal(url.pathname, "/3/account")
			assert.equal(url.searchParams.get("session_id"), "member-secret")
			return new Response(JSON.stringify({ success: false, status_code: 3 }), {
				status: 401,
			})
		},
	}).revoke
	const remove = f.store.remove
	let removals = 0
	f.store.remove = async (id) => {
		if (++removals === 1)
			throw new Error("database unavailable after TMDB deleted the session")
		await remove(id)
	}
	const start = await f.request("start")
	const id = [...f.db.connections.keys()][0]
	const response = await f.request(
		"return",
		id,
		start.headers.get("Set-Cookie") ?? "",
	)
	assert.equal(response.status, 502)
	assert.match(await response.text(), /retry automatically/)
	assert.equal(f.db.connections.size, 1)
	assert.equal(deleted, true)
	f.advance(60_000)
	await f.flow.sweep()
	assert.deepEqual(calls, [
		"DELETE /3/authentication/session",
		"DELETE /3/authentication/session",
		"GET /3/authentication",
		"GET /3/account",
	])
	assert.equal(removals, 2)
	assert.equal(f.db.connections.size, 0)
	assert.equal(f.db.imports.length, 0)
	assert.deepEqual(f.alerts, [])
})
