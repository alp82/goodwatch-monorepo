import assert from "node:assert/strict"
import test from "node:test"
import { createTmdbClient } from "./tmdb-client.server.ts"

test("TMDB reads all six paginated lists, rounds half steps up and keeps only rating dates", async () => {
	const requests: string[] = []
	const client = createTmdbClient({
		appToken: "application-secret",
		sleep: async () => {},
		fetch: async (url, init) => {
			requests.push(String(url))
			assert.equal(
				new Headers(init?.headers).get("Authorization"),
				"Bearer member-secret",
			)
			const path = new URL(String(url))
			const page = Number(path.searchParams.get("page"))
			const rating = path.pathname.endsWith("/rated")
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
						account_rating: {
							value: page === 1 ? 7.5 : 0.5,
							created_at: "2020-02-01T12:00:00Z",
						},
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
			["tmdb:rating:movie:1", 8, "2020-02-01T12:00:00.000Z"],
			["tmdb:rating:movie:2", 1, "2020-02-01T12:00:00.000Z"],
			["tmdb:want:movie:1", null, null],
			["tmdb:favorite:movie:1", null, null],
			["tmdb:rating:show:1", 8, "2020-02-01T12:00:00.000Z"],
			["tmdb:rating:show:2", 1, "2020-02-01T12:00:00.000Z"],
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

test("v4 authentication uses the application token, retries 429 and deletes the member token", async () => {
	const waits: number[] = []
	const calls: { url: string; init?: RequestInit }[] = []
	const responses = [
		new Response(null, { status: 429, headers: { "Retry-After": "2" } }),
		Response.json({ success: true, request_token: "request-secret" }),
		Response.json({
			success: true,
			access_token: "member-secret",
			account_id: "account",
		}),
		Response.json({ success: true, status_code: 13 }),
	]
	const client = createTmdbClient({
		appToken: "app-secret",
		sleep: async (ms) => {
			waits.push(ms)
		},
		fetch: async (url, init) => {
			calls.push({ url: String(url), init })
			const response = responses.shift()
			assert.ok(response)
			return response
		},
	})
	assert.equal(
		await client.createRequest(
			"https://goodwatch.test/settings/imports?connect=state",
		),
		"request-secret",
	)
	assert.deepEqual(await client.exchange("request-secret"), {
		accessToken: "member-secret",
		accountId: "account",
	})
	await client.revoke("member-secret")
	assert.deepEqual(waits, [2000])
	assert.ok(
		calls.every(
			(x) =>
				new Headers(x.init?.headers).get("Authorization") ===
				"Bearer app-secret",
		),
	)
	assert.deepEqual(
		calls.map((x) => x.init?.method),
		["POST", "POST", "POST", "DELETE"],
	)
	assert.equal(calls[3].url, "https://api.themoviedb.org/4/auth/access_token")
	assert.deepEqual(JSON.parse(String(calls[3].init?.body)), {
		access_token: "member-secret",
	})
})

test("invalid ratings stay visible, clustered dates warn, and partial or repeated pages cannot silently import", async () => {
	const build = (results: unknown[], total = results.length) =>
		createTmdbClient({
			appToken: "app",
			sleep: async () => {},
			fetch: async (url) =>
				Response.json({
					page: 1,
					total_pages: 1,
					total_results: String(url).includes("/movie/rated") ? total : 0,
					results: String(url).includes("/movie/rated") ? results : [],
				}),
		})
	const rows = Array.from({ length: 100 }, (_, i) => ({
		id: i + 1,
		title: "Example",
		account_rating: {
			value: i === 0 ? 0 : 8.5,
			created_at: new Date(
				Date.parse("2020-02-01T12:00:00Z") + i * 1000,
			).toISOString(),
		},
	}))
	const parsed = await build(rows).readAccount("account", "secret")
	assert.equal(parsed.observations[0].problem?.outcome, "invalid")
	assert.match(parsed.warnings.join(" "), /100 ratings share.*day/)
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
		appToken: "app-secret",
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
		appToken: "app-secret",
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

test("incomplete or impossible rating dates stay undated rather than inventing a calendar day", async () => {
	const client = createTmdbClient({
		appToken: "app",
		sleep: async () => {},
		fetch: async (url) => {
			const results = String(url).includes("movie/rated")
				? ["2020", "2020-02-30T12:00:00Z", "2020-02-01T12:00:00+02:00"].map(
						(created_at, i) => ({
							id: i + 1,
							title: "Example",
							account_rating: { value: 8, created_at },
						}),
					)
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
	assert.deepEqual(
		parsed.observations.map((x) => x.addedAt),
		[null, null, "2020-02-01T10:00:00.000Z"],
	)
	assert.match(parsed.warnings.join(" "), /invalid rating dates/)
})

test("revocation accepts confirmed invalid or missing tokens but never an application auth failure or generic 404", async () => {
	for (const [status, code, accepted] of [
		[401, 35, true],
		[404, 37, true],
		[401, 7, false],
		[404, 34, false],
	] as const) {
		let deletes = 0
		const client = createTmdbClient({
			appToken: "app",
			sleep: async () => {},
			fetch: async (url, init) => {
				if (String(url).endsWith("/3/authentication"))
					return Response.json({ success: true })
				if (String(url).includes("/account/account/"))
					return Response.json(
						{ status_code: 35, success: false },
						{ status: 401 },
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
			await client.revoke("member", "account")
			assert.equal(deletes, 1)
		} else
			await assert.rejects(
				client.revoke("member"),
				/not confirmed disconnection/,
			)
	}
	const invalidApp = createTmdbClient({
		appToken: "bad-app",
		sleep: async () => {},
		fetch: async () =>
			Response.json({ success: false, status_code: 35 }, { status: 401 }),
	})
	await assert.rejects(
		invalidApp.revoke("member", "account"),
		/not confirmed disconnection/,
	)
})

test("page counts are bounded in items, and changing counts warn while keeping the pages read", async () => {
	let huge = true
	const client = createTmdbClient({
		appToken: "app",
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

test("an invalid-token logout response cannot discard a member token that still reads its account", async () => {
	const client = createTmdbClient({
		appToken: "app",
		sleep: async () => {},
		fetch: async (url, init) => {
			if (String(url).endsWith("/3/authentication"))
				return Response.json({ success: true })
			if (init?.method === "GET")
				return Response.json({
					page: 1,
					total_pages: 0,
					total_results: 0,
					results: [],
				})
			return Response.json({ status_code: 35, success: false }, { status: 401 })
		},
	})
	await assert.rejects(
		client.revoke("member", "account"),
		/not confirmed disconnection/,
	)
})
