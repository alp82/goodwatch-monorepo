import "../title-filter/test-alias.ts"
import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { test } from "node:test"
import type { SearchStore } from "../search-runtime/store.server.ts"
import type { combinedSearch } from "../combined-search/search.server.ts"
import type { ReadingChip } from "../combined-search/reading-retrieval.server.ts"
import type { SearchReason } from "./search-reading.ts"
import { searchTitles } from "./search.server.ts"
import {
	discordSearchResponse,
	searchHeaders,
	SEARCH_LIMIT_NOTE,
	SEARCH_TIMEOUT_NOTE,
} from "./search-engine.server.ts"

// Keep the real reading-cache/claim sequence and limiter. Replace storage and never dispatch a model request.
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		resolve(
			specifier: string,
			context: { parentURL?: string },
			next: (specifier: string, context: { parentURL?: string }) => unknown,
		): unknown
	}): void
}
registerHooks({
	resolve(specifier, context, next) {
		if (specifier === "~/utils/cache")
			return {
				url: "data:text/javascript,export const getRedisCluster=()=>null",
				shortCircuit: true,
			}
		if (
			context.parentURL?.endsWith("/search-runtime/runtime.server.ts") &&
			specifier === "./store.server"
		)
			return next(
				new URL("../search-runtime/runtime-test-store.ts", import.meta.url)
					.href,
				context,
			)
		return next(specifier, context)
	},
})
const { executeJevStage } = await import("../search-runtime/runtime.server.ts")
const { createRateLimiter } = await import("../rate-limit.server.ts")
const title = { id: "movie:42", name: "A dark story", year: 2024 }

test("website reading cache hits are free, including a cache hit returned by the claim", async () => {
	const original = process.env.TYPESAFE_API_KEY
	process.env.TYPESAFE_API_KEY = "offline-test"
	try {
		let checks = 0,
			dispatches = 0,
			releases = 0
		const limiter = createRateLimiter({ redis: () => null })
		const run = async (cached: "lookup" | "claim" | false) => {
			const store = {
				digest: () => "test",
				unseal: () => [{}, {}],
				lookup: async () =>
					cached === "lookup" ? { kind: "cached", ciphertext: "test" } : null,
				claim: async () =>
					cached === "claim"
						? { kind: "cached", ciphertext: "test" }
						: { kind: "claimed", id: "one" },
				finish: async (_id: string, cost: number) => {
					assert.equal(cost, 0)
					releases++
				},
				dispatch: async () => {
					dispatches++
					throw new Error("Offline: no model call")
				},
			} as unknown as SearchStore
			return executeJevStage(store, {
				requestText: "dark vibes",
				questionVersion: "test",
				language: { mode: "english", version: "test" },
				requests: [
					{ state: {}, questions: {} },
					{ state: {}, questions: {} },
				],
				visitor: {
					accountId: null,
					networkIdentity: "discord:1",
					beforeUncachedReading: async () => {
						checks++
						const verdict = await limiter.take("discord-search", "1", [
							{ limit: 20, seconds: 86400 },
						])
						if (!verdict.allowed) throw new Error("Daily limit")
					},
				},
			})
		}
		for (let i = 0; i < 20; i++) await run(false)
		assert.equal(checks, 20)
		assert.equal(dispatches, 20)
		assert.equal((await run("lookup")).kind, "cached")
		assert.equal((await run("claim")).kind, "cached")
		assert.equal(checks, 20)
		await assert.rejects(run(false), /Daily limit/)
		assert.equal(dispatches, 20, "over-cap searches cannot dispatch")
		assert.equal(
			releases,
			1,
			"denied reading releases its reservation at zero cost",
		)
	} finally {
		if (original === undefined) delete process.env.TYPESAFE_API_KEY
		else process.env.TYPESAFE_API_KEY = original
	}
})

test("signed requests use the website engine, count only misses per Discord user, and fall back at the cap", async () => {
	const original = process.env.SEARCH_STORAGE_KEY
	process.env.SEARCH_STORAGE_KEY = "ab".repeat(32)
	try {
		const limiter = createRateLimiter({ redis: () => null })
		const counted: string[] = []
		let cached = false,
			calls = 0
		const engine: typeof combinedSearch = async (
			query,
			eligibility,
			visitor,
			signal,
			_reading,
			options,
		) => {
			calls++
			assert.equal(query, "dark vibes")
			assert.deepEqual(eligibility, { includeAdult: false, lesserKnown: false })
			assert.equal(visitor.accountId, null)
			assert.equal(visitor.allowTranslation, false)
			assert.equal(options?.rows, 100)
			assert.equal(signal.aborted, false)
			if (!cached) await visitor.beforeUncachedReading!()
			return {
				q: query,
				rows: [
					{
						key: title.id,
						title: title.name,
						type: "movie",
						year: "2024",
						poster: null,
						popularity: 10,
						lexical: 0,
						match: "",
						score: 1,
					},
				],
				errors: [],
				people: [],
				reading: [],
				metadata: [],
				creditScope: null,
				mode: "english",
				elapsedMs: 10,
				chargedNano: cached ? 0 : 100,
			}
		}
		const run = async (user = "123") => {
			const body = JSON.stringify({ q: "dark vibes" })
			return discordSearchResponse(
				new Request("https://goodwatch.app/api/combined-search", {
					method: "POST",
					headers: searchHeaders(user, body),
					body,
				}),
				engine,
				async (user) => {
					counted.push(user)
					return limiter.take("discord-search", user, [
						{ limit: 20, seconds: 86400 },
					])
				},
			)
		}
		for (let i = 0; i < 20; i++) assert.equal((await run()).status, 200)
		assert.equal(counted.length, 20)
		cached = true
		assert.equal((await run()).status, 200)
		assert.equal(counted.length, 20)
		cached = false
		const result = await searchTitles("dark vibes", "123", {
			engine: async () => ({
				titles: (await run()).status === 429 ? null : [],
				note: SEARCH_LIMIT_NOTE,
			}),
			fallback: async () => [title],
		})
		assert.deepEqual(result, { titles: [title], note: SEARCH_LIMIT_NOTE })
		assert.equal((await run("456")).status, 200)
		const before = calls
		const body = JSON.stringify({ q: "dark vibes" })
		const forged = new Request("https://goodwatch.app/api/combined-search", {
			method: "POST",
			headers: { ...searchHeaders("123", body), "X-Goodwatch-Discord": "999" },
			body,
		})
		assert.equal((await discordSearchResponse(forged, engine)).status, 403)
		const stale = new Request("https://goodwatch.app/api/combined-search", {
			method: "POST",
			headers: searchHeaders("123", body, Date.now() - 31_000),
			body,
		})
		assert.equal((await discordSearchResponse(stale, engine)).status, 403)
		assert.equal(calls, before)
	} finally {
		if (original === undefined) delete process.env.SEARCH_STORAGE_KEY
		else process.env.SEARCH_STORAGE_KEY = original
	}
})

test("slow or failed website search falls back to title matches before the deferral deadline", async () => {
	let signal: AbortSignal | undefined
	let calls = 0
	const start = Date.now()
	const result = await searchTitles("dark vibes", "123", {
		timeoutMs: 15,
		engine: async (_query, _user, abort) => {
			signal = abort
			return new Promise(() => {})
		},
		fallback: async (query) => {
			calls++
			assert.equal(query, "dark vibes")
			return [title]
		},
	})
	assert.deepEqual(result, { titles: [title], note: SEARCH_TIMEOUT_NOTE })
	assert.equal(signal?.aborted, true)
	assert.equal(calls, 1)
	assert.ok(Date.now() - start < 1000)
	assert.deepEqual(
		await searchTitles("dark vibes", "123", {
			engine: async () => {
				throw new Error("Search role is down")
			},
			fallback: async () => [title],
		}),
		result,
	)
})

const reading: ReadingChip[] = [
	{ text: "Funny", kind: "want", key: "humor" },
	{ text: "Family", kind: "attribute" },
	{ text: "Not horror", kind: "excluded" },
]
const reasons: SearchReason[] = [
	{ text: "Funny 9", kind: "dimension" },
	{ text: "Family", kind: "attribute" },
]
const batch: Awaited<ReturnType<typeof combinedSearch>> = {
	q: "funny family",
	reading,
	errors: [],
	metadata: [],
	people: [],
	creditScope: null,
	mode: "english",
	elapsedMs: 10,
	chargedNano: 0,
	rows: [
		{
			key: title.id,
			title: title.name,
			type: "movie",
			year: "2024",
			poster: null,
			popularity: 10,
			lexical: 0,
			match: "",
			score: 1,
			discovery: {
				tmdb_id: 42,
				media_type: "movie",
				title: title.name,
				release_year: 2024,
				poster_path: null,
				genres: [],
				rank: 1,
				weightedSum: 1,
				cosine: 1,
				combined: 1,
				tropes: [],
				scores: [],
				reasons,
			},
		},
	],
}
function signedRequest(q = "funny family") {
	const body = JSON.stringify({ q })
	return new Request("https://goodwatch.app/api/combined-search", {
		method: "POST",
		headers: searchHeaders("123", body),
		body,
	})
}
async function withSigningKey(work: () => Promise<void>) {
	const original = process.env.SEARCH_STORAGE_KEY
	process.env.SEARCH_STORAGE_KEY = "ab".repeat(32)
	try {
		await work()
	} finally {
		if (original === undefined) delete process.env.SEARCH_STORAGE_KEY
		else process.env.SEARCH_STORAGE_KEY = original
	}
}

test("signed stream delivers the reading before titles, including the title's reason chips", () =>
	withSigningKey(async () => {
		const { websiteSearch } = await import("./search-engine.server.ts")
		let complete!: () => void
		const ready = new Promise<void>((resolve) => {
			complete = resolve
		})
		let sawReading!: () => void
		const read = new Promise<void>((resolve) => {
			sawReading = resolve
		})
		let finished = false
		const engine: typeof combinedSearch = async (
			_q,
			_policy,
			_visitor,
			_signal,
			onReading,
		) => {
			onReading?.(reading)
			await ready
			return batch
		}
		const send: typeof fetch = async (_url, init) => {
			const response = await discordSearchResponse(
				new Request("https://goodwatch.app/api/combined-search", init),
				engine,
			)
			assert.match(
				response.headers.get("Content-Type")!,
				/application\/x-ndjson/,
			)
			assert.match(response.headers.get("Cache-Control")!, /no-transform/)
			return response
		}
		const result = websiteSearch(
			"funny family",
			"123",
			new AbortController().signal,
			send,
			(value) => {
				assert.equal(finished, false)
				assert.deepEqual(value, reading)
				sawReading()
			},
		).then((value) => {
			finished = true
			return value
		})
		try {
			await read
			assert.equal(
				finished,
				false,
				"reading arrives while ranking is still pending",
			)
		} finally {
			complete()
		}
		assert.deepEqual(await result, {
			titles: [{ ...title, poster_url: null, reasons }],
			reading,
		})
	}))

test("stream parser handles split UTF-8, several lines per chunk, and a final line without a newline", () =>
	withSigningKey(async () => {
		const { websiteSearch } = await import("./search-engine.server.ts")
		const chips = [{ text: "Comédie", kind: "attribute" }]
		const raw = new TextEncoder().encode(
			`${JSON.stringify({ kind: "reading", reading: chips })}\n\n${JSON.stringify({ kind: "batch", titles: [title], reading: chips })}`,
		)
		const accent = raw.indexOf(0xc3)
		let observed = 0
		const send: typeof fetch = async () =>
			new Response(
				new ReadableStream({
					start(controller) {
						controller.enqueue(raw.slice(0, accent + 1))
						controller.enqueue(raw.slice(accent + 1))
						controller.close()
					},
				}),
				{ headers: { "Content-Type": "application/x-ndjson" } },
			)
		assert.deepEqual(
			await websiteSearch(
				"funny family",
				"123",
				new AbortController().signal,
				send,
				(value) => {
					observed++
					assert.deepEqual(value, chips)
				},
			),
			{ titles: [title], reading: chips },
		)
		assert.equal(observed, 1)
	}))

test("websiteSearch accepts old single-JSON search roles during deployment", () =>
	withSigningKey(async () => {
		const { websiteSearch } = await import("./search-engine.server.ts")
		const send: typeof fetch = async () => Response.json({ titles: [title] })
		assert.deepEqual(
			await websiteSearch(
				"funny family",
				"123",
				new AbortController().signal,
				send,
				() => {
					assert.fail("old responses have no early reading")
				},
			),
			{ titles: [title] },
		)
	}))

test("failures use HTTP status before streaming and an error line after the reading; the client falls back", () =>
	withSigningKey(async () => {
		const { websiteSearch } = await import("./search-engine.server.ts")
		const fail: typeof combinedSearch = async () => {
			throw new Error("Unavailable")
		}
		assert.equal(
			(await discordSearchResponse(signedRequest(), fail)).status,
			503,
		)
		const afterReading: typeof combinedSearch = async (
			_q,
			_policy,
			_visitor,
			_signal,
			onReading,
		) => {
			onReading?.(reading)
			throw new Error("Ranking failed")
		}
		const response = await discordSearchResponse(signedRequest(), afterReading)
		assert.equal(response.status, 200)
		assert.deepEqual(
			(await response.text())
				.trim()
				.split("\n")
				.map((line) => JSON.parse(line).kind),
			["reading", "error"],
		)
		let observed = 0
		const send: typeof fetch = async () =>
			discordSearchResponse(signedRequest(), afterReading)
		const result = await searchTitles("funny family", "123", {
			engine: (q, u, signal, _send, onReading) =>
				websiteSearch(q, u, signal, send, onReading),
			onReading: () => {
				observed++
			},
			fallback: async () => [title],
		})
		assert.equal(observed, 1)
		assert.deepEqual(result, {
			titles: [title],
			note: SEARCH_TIMEOUT_NOTE,
			reading,
		})
		for (const body of [
			JSON.stringify({ kind: "reading", reading }) + "\n",
			JSON.stringify({ kind: "batch", titles: [title] }) +
				'\n{"kind":"error"}\n',
			"{broken json}\n",
		]) {
			await assert.rejects(
				websiteSearch(
					"funny family",
					"123",
					new AbortController().signal,
					async () =>
						new Response(body, {
							headers: { "Content-Type": "application/x-ndjson" },
						}),
				),
			)
		}
	}))

test("an oversized signed body is rejected before invoking search", () =>
	withSigningKey(async () => {
		const run: typeof combinedSearch = async () => {
			assert.fail("oversized body must not run search")
		}
		assert.equal(
			(await discordSearchResponse(signedRequest("x".repeat(8200)), run))
				.status,
			413,
		)
	}))

test("reading copy follows the website's chip selection and uses not only for excluded chips", async () => {
	const { readingLine, reasonsLine } = await import("./search-reading.ts")
	assert.equal(
		readingLine([
			{ kind: "phrase", text: "hidden phrase" },
			...Array.from({ length: 5 }, (_, i) => ({
				kind: "want" as const,
				text: `Want ${i + 1}`,
			})),
			{ kind: "excluded", text: "Not horror" },
			{ kind: "avoid", text: "Low violence" },
			{ kind: "avoid", text: "Low scare" },
		]),
		"Reads as: Want 1 · Want 2 · Want 3 · Want 4 · not horror · Low violence",
	)
	assert.equal(
		readingLine([{ kind: "phrase", text: "Forest adventure" }]),
		"Reads as: Forest adventure",
	)
	assert.equal(readingLine([]), "")
	assert.equal(
		reasonsLine([
			{ kind: "mismatch", text: "but funny only 1" },
			{ kind: "dimension", text: "Funny 9" },
			{ kind: "dimension", text: "low violence 1" },
			{ kind: "attribute", text: "genre: Science_fiction" },
			{ kind: "attribute", text: "Hidden fourth reason" },
		]),
		"Matches: Funny · Low violence · Science fiction",
	)
})

for (const failure of ["reject", "timeout", "unavailable"] as const) {
	test(`search fallback retains the last streamed reading after ${failure}`, async () => {
		const first: ReadingChip[] = [{ kind: "want", text: "Funny" }]
		const last: ReadingChip[] = [{ kind: "attribute", text: "Family" }]
		const observed: ReadingChip[][] = []
		const result = await searchTitles("funny family", "123", {
			timeoutMs: 15,
			engine: async (_q, _u, _signal, _send, onReading) => {
				onReading?.(first)
				onReading?.(last)
				if (failure === "reject") throw new Error("Ranking failed")
				if (failure === "unavailable") return { titles: null }
				return new Promise(() => {})
			},
			onReading: (value) => {
				observed.push(value)
			},
			fallback: async () => [title],
		})
		assert.deepEqual(observed, [first, last])
		assert.deepEqual(result, {
			titles: [title],
			note: SEARCH_TIMEOUT_NOTE,
			reading: last,
		})
	})
}
