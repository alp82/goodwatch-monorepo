import assert from "node:assert/strict"
import test from "node:test"
import { createTmdbClient } from "./tmdb-client.server.ts"

test("TMDB reads all six paginated lists, rounds half steps up and leaves v3 ratings undated", async () => {
	const requests: string[] = []
	const client = createTmdbClient({
		apiKey: "application-secret",
		sleep: async () => {},
		fetch: async (url, init) => {
			requests.push(String(url))
			assert.equal(new Headers(init?.headers).get("Authorization"), null)
			const path = new URL(String(url))
			assert.equal(path.searchParams.get("api_key"), "application-secret")
			assert.equal(path.searchParams.get("session_id"), "member-secret")
			assert.match(
				path.pathname,
				/^\/3\/account\/account\/(rated|watchlist|favorite)\/(movies|tv)$/,
			)
			const page = Number(path.searchParams.get("page"))
			const rating = path.pathname.includes("/rated/")
			return Response.json({
				page,
				total_pages: rating ? 2 : 1,
				total_results: rating ? 2 : 1,
				results: [
					{
						id: page,
						title: "Movie",
						name: "Show",
						release_date: "1995-01-01",
						first_air_date: "2001-01-01",
						rating: page === 1 ? 7.5 : 0.5,
					},
				],
			})
		},
	})
	const parsed = await client.readAccount("account", "member-secret")
	assert.equal(requests.length, 8)
	assert.equal(parsed.source, "tmdb")
	assert.deepEqual(
		parsed.observations.map((x) => [x.key, x.score ?? null, x.addedAt]),
		[
			["tmdb:rating:movie:1", 8, null],
			["tmdb:rating:movie:2", 1, null],
			["tmdb:want:movie:1", null, null],
			["tmdb:favorite:movie:1", null, null],
			["tmdb:rating:show:1", 8, null],
			["tmdb:rating:show:2", 1, null],
			["tmdb:want:show:1", null, null],
			["tmdb:favorite:show:1", null, null],
		],
	)
	assert.ok(
		parsed.observations.every(
			(x) => x.watchedAt === undefined && x.imdbId === null,
		),
	)
	assert.match(parsed.warnings.join(" "), /7.5 becomes 8/)
	assert.match(parsed.warnings.join(" "), /Episode ratings.*not read/)
})

test("v3 authentication uses only the API key, retries 429 and deletes the session", async () => {
	const waits: number[] = []
	const calls: { url: URL; init?: RequestInit }[] = []
	const responses = [
		new Response(null, { status: 429, headers: { "Retry-After": "2" } }),
		Response.json({ success: true, request_token: "request-secret" }),
		Response.json({ success: true, session_id: "member-secret" }),
		Response.json({ id: 123 }),
		Response.json({ success: true }),
	]
	const client = createTmdbClient({
		apiKey: "app-secret",
		sleep: async (ms) => {
			waits.push(ms)
		},
		fetch: async (url, init) => {
			calls.push({ url: new URL(String(url)), init })
			const response = responses.shift()
			assert.ok(response)
			return response
		},
	})
	assert.equal(await client.createRequest(), "request-secret")
	assert.deepEqual(await client.exchange("request-secret"), {
		sessionId: "member-secret",
	})
	assert.equal(await client.getAccountId("member-secret"), "123")
	await client.revoke("member-secret")
	assert.deepEqual(waits, [2000])
	for (const call of calls) {
		assert.equal(call.url.searchParams.get("api_key"), "app-secret")
		assert.equal(new Headers(call.init?.headers).get("Authorization"), null)
	}
	assert.deepEqual(
		calls.map((x) => [x.url.pathname, x.init?.method]),
		[
			["/3/authentication/token/new", "GET"],
			["/3/authentication/token/new", "GET"],
			["/3/authentication/session/new", "POST"],
			["/3/account", "GET"],
			["/3/authentication/session", "DELETE"],
		],
	)
	assert.deepEqual(JSON.parse(String(calls[2].init?.body)), {
		request_token: "request-secret",
	})
	assert.equal(calls[3].url.searchParams.get("session_id"), "member-secret")
	assert.deepEqual(JSON.parse(String(calls[4].init?.body)), {
		session_id: "member-secret",
	})
})

test("invalid ratings stay visible and partial or repeated pages cannot silently import", async () => {
	const build = (results: unknown[], total = results.length) =>
		createTmdbClient({
			apiKey: "app",
			sleep: async () => {},
			fetch: async (url) =>
				Response.json({
					page: 1,
					total_pages: 1,
					total_results: String(url).includes("/rated/movies") ? total : 0,
					results: String(url).includes("/rated/movies") ? results : [],
				}),
		})
	const rows = Array.from({ length: 100 }, (_, i) => ({
		id: i + 1,
		title: "Example",
		rating: i === 0 ? 0 : 8.5,
	}))
	const parsed = await build(rows).readAccount("account", "secret")
	assert.equal(parsed.observations[0].problem?.outcome, "invalid")
	const partial = await build(rows, 101).readAccount("account", "secret")
	assert.equal(partial.observations.length, 100)
	assert.match(partial.warnings.join(" "), /100 of 101.*movie rated/)
	await assert.rejects(
		build([rows[0], rows[0]]).readAccount("account", "secret"),
		/duplicate/,
	)
})

test("long Retry-After defers revocation without retrying early, and errors never expose credentials", async () => {
	let calls = 0
	const waits: number[] = []
	const client = createTmdbClient({
		apiKey: "app-secret",
		sleep: async (ms) => {
			waits.push(ms)
		},
		fetch: async () => {
			calls++
			return new Response("member-secret", {
				status: 429,
				headers: { "Retry-After": "120" },
			})
		},
	})
	await assert.rejects(client.revoke("member-secret"), (error) => {
		assert.ok(error instanceof Error)
		assert.doesNotMatch(error.message, /member-secret|app-secret/)
		assert.equal((error as { retryAfterMs?: number }).retryAfterMs, 120_000)
		return true
	})
	assert.equal(calls, 1)
	assert.deepEqual(waits, [])
	const failed = createTmdbClient({
		apiKey: "app-secret",
		sleep: async () => {},
		fetch: async () => {
			throw new Error("member-secret")
		},
	})
	await assert.rejects(
		failed.exchange("request-secret"),
		(error) => error instanceof Error && !error.message.includes("secret"),
	)
})

test("v3 rating scores never acquire a date from release dates or unrelated metadata", async () => {
	const client = createTmdbClient({
		apiKey: "app",
		sleep: async () => {},
		fetch: async (url) => {
			const results = String(url).includes("/rated/movies")
				? [
						{
							id: 862,
							title: "Toy Story",
							rating: 8.5,
							release_date: "1995-01-01",
							account_rating: { value: 2, created_at: "2020-02-01T12:00:00Z" },
						},
					]
				: []
			return Response.json({
				page: 1,
				total_pages: 1,
				total_results: results.length,
				results,
			})
		},
	})
	const parsed = await client.readAccount("account", "secret")
	assert.equal(parsed.observations[0].score, 9)
	assert.equal(parsed.observations[0].addedAt, null)
	assert.equal(parsed.observations[0].watchedAt, undefined)
	assert.match(parsed.warnings.join(" "), /no rating dates/)
})

test("revocation accepts a missing session only when the key works and account access rejects the session", async () => {
	for (const [status, code, probeStatus, probeCode, accepted] of [
		[404, 34, 401, 3, true],
		[401, 7, 401, 3, false],
		[404, 0, 401, 3, false],
		[404, 34, 401, 7, false],
		[404, 34, 404, 34, false],
	] as const) {
		let deletes = 0
		const client = createTmdbClient({
			apiKey: "app",
			sleep: async () => {},
			fetch: async (url, init) => {
				if (new URL(String(url)).pathname === "/3/authentication")
					return Response.json({ success: true })
				if (new URL(String(url)).pathname === "/3/account")
					return Response.json(
						{ status_code: probeCode, success: false },
						{ status: probeStatus },
					)
				assert.equal(init?.method, "DELETE")
				deletes++
				return Response.json(
					{ success: false, status_code: code, status_message: "secret" },
					{ status },
				)
			},
		})
		if (accepted) {
			await client.revoke("member")
			assert.equal(deletes, 1)
		} else
			await assert.rejects(
				client.revoke("member"),
				/not confirmed disconnection/,
			)
	}
	const invalidApp = createTmdbClient({
		apiKey: "bad-app",
		sleep: async () => {},
		fetch: async (_url, init) =>
			init?.method === "DELETE"
				? Response.json({ success: false, status_code: 34 }, { status: 404 })
				: Response.json({ success: false, status_code: 7 }, { status: 401 }),
	})
	await assert.rejects(
		invalidApp.revoke("member"),
		/not confirmed disconnection/,
	)
})

test("page counts are bounded in items, and changing counts warn while keeping the pages read", async () => {
	let huge = true
	const client = createTmdbClient({
		apiKey: "app",
		sleep: async () => {},
		fetch: async (url) => {
			const path = new URL(String(url))
			const page = Number(path.searchParams.get("page"))
			return Response.json({
				page,
				total_pages: huge ? 2501 : page === 1 ? 2 : 1,
				total_results: page === 1 ? 2 : 1,
				results: [{ id: page, title: "Title" }],
			})
		},
	})
	await assert.rejects(client.readAccount("account", "secret"), /50,000/)
	huge = false
	const parsed = await client.readAccount("account", "secret")
	assert.equal(parsed.observations.length, 12)
	assert.match(parsed.warnings.join(" "), /changed/)
})

test("a missing-session deletion response cannot discard a session that still reads its account", async () => {
	const client = createTmdbClient({
		apiKey: "app",
		sleep: async () => {},
		fetch: async (url, init) => {
			if (new URL(String(url)).pathname === "/3/authentication")
				return Response.json({ success: true })
			if (init?.method === "GET")
				return Response.json({
					page: 1,
					total_pages: 0,
					total_results: 0,
					results: [],
				})
			return Response.json({ status_code: 34, success: false }, { status: 404 })
		},
	})
	await assert.rejects(client.revoke("member"), /not confirmed disconnection/)
})
