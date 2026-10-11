// Exercise the production composition and its actual TMDB lookup. Only unrelated backends are replaced.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { after, test } from "node:test"
import ts from "typescript"
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from "undici"
import "../title-filter/test-alias.ts"

const probe = {
	translation: false,
	translations: 0,
	readings: 0,
	rankings: 0,
	literals: 0,
	displays: [] as string[][],
	metadata: [] as string[][],
	failMetadataKey: "",
	history: [] as {
		elapsedMs: number
		chargedNano: number
		stageMs: Record<string, number>
	}[],
}
Object.assign(globalThis, { titleLookupProbe: probe })

const stubs: Record<string, string> = {
	"/combined-search/reading-retrieval.server.ts": `export const attributeRequest=()=>({}); export const fingerprintRequest=()=>({}); export const describeTitles=async(_reading,rows)=>{globalThis.titleLookupProbe.displays.push(rows.map(row=>row.key));return []}; export const readingFields=()=>({}); export const summarizeReading=()=>[];`,
	"/combined-search/search-filters.ts": `export const allowsTitle=()=>true; export const toCrateSql=()=>({sql:'',params:[]});`,
	"/combined-search/catalog.server.ts": `export const eligible=()=>true; export const metadataFor=async keys=>{if(keys.includes(globalThis.titleLookupProbe.failMetadataKey))throw new Error("Catalog completion failed");if(keys.length)globalThis.titleLookupProbe.metadata.push(keys);return keys.map(key=>({media_type:key.split(':')[0],tmdb_id:Number(key.split(':')[1]),adult:false,imdb_id:null,poster_path:null,genres:null,goodwatch_overall_score_voting_count:0,goodwatch_overall_score_normalized_percent:null}))}; export const searchQuery=async()=>{globalThis.titleLookupProbe.literals++;return []}; export const exactCatalogTitles=async q=>{if(q.includes('race fallback'))await new Promise(resolve=>setTimeout(resolve,180));return q.includes('delayed primary')?[{id:41,title:q,original:'Native name',type:'movie',year:'1980',poster:null,popularity:0}]:[]};`,
	"/combined-search/language.server.ts": `export const prepareLanguage=async text=>{if(!globalThis.titleLookupProbe.translation)return {text,policy:{mode:'english'},chargedNano:0};globalThis.titleLookupProbe.translations++;return {text:'translated '+text,policy:{mode:'translated'},chargedNano:99}};`,
	"/search-runtime/runtime.server.ts": `export const BASIC_SEARCH_MESSAGE='Showing basic search results'; export const translationEnabled=()=>globalThis.titleLookupProbe.translation; export const keepJevConnectionsWarm=()=>{}; export const runJevStage=async input=>{globalThis.titleLookupProbe.readings++;return input.requestText.startsWith('ranked ')?{kind:'ready',readings:{},chargedNano:input.requestText.includes('abort after')?123:0}:{kind:'basic',reason:'budget',chargedNano:0}}; export const recordSearchHistory=async entry=>{globalThis.titleLookupProbe.history.push(entry);return {recorded:true,id:'test'}};`,
	"/search-ranking/serve.server.ts": `export class RankingDeadlineError extends Error{}; const rows=titles=>titles.map(t=>({id:1e12+t.id,mediaType:t.type==='tv'?'show':'movie',title:t.title,year:t.year,score:3})); export const rankForServing=async(_reading,request)=>{globalThis.titleLookupProbe.rankings++;return {results:rows(request.titleLookup),reblend:rows,rounds:[],timings:{},rankerVersion:'fixture'}}; export const servingFallback=search=>search.hasReading?null:'basic search'; export const startSearchRanking=()=>{};`,
	"/search-ranking/rank-search.server.ts": `export const prepareSearch=async()=>({});`,
	"/search-runtime/limits.server.ts": `export const readingsConfigured=()=>false;`,
	"/search-ranking/ranking.server.ts": `export const HEAD_LENGTH=50;`,
	"/search-ranking/search-filter.server.ts": `export const ELIGIBLE_VOTES=2000;`,
	"/search-people/people.server.ts": `export const readPeople=async()=>({named:[],offered:[],scope:null}); export const peopleToShow=async(_q,_p,people)=>people; export const startPeopleIndex=()=>{};`,
	"/role.server.ts": `export const runsSearch=()=>false;`,
}
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		load(
			url: string,
			context: unknown,
			next: (url: string, context: unknown) => unknown,
		): unknown
	}): void
}
registerHooks({
	load(url, context, next) {
		const stub = Object.entries(stubs).find(([suffix]) =>
			url.endsWith(suffix),
		)?.[1]
		if (stub !== undefined)
			return { format: "module", source: stub, shortCircuit: true }
		if (
			url.endsWith("/combined-search/search.server.ts") ||
			url.endsWith("/ui/search/search-model.tsx")
		)
			return {
				format: "module",
				shortCircuit: true,
				source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
					// Highlight's JSX is never rendered here; keep its transform from importing a browser runtime.
					compilerOptions: {
						module: ts.ModuleKind.ESNext,
						target: ts.ScriptTarget.ESNext,
						jsx: ts.JsxEmit.React,
					},
				}).outputText,
			}
		return next(url, context)
	},
})
const { combinedSearch } = await import("./search.server.ts")
const original = getGlobalDispatcher()
const agent = new MockAgent()
agent.disableNetConnect()
let fetchAborts = 0
let bodyAborts = 0
// A minimal dispatcher can expose separate response-header and response-body stalls, unlike MockAgent.delay.
setGlobalDispatcher({
	dispatch(options, handler) {
		const url = new URL(String(options.path), "https://api.themoviedb.org")
		const query = url.searchParams.get("query")
		if (
			(query === "stalled fetch" || query === "stalled body") &&
			url.searchParams.get("page") === "2"
		) {
			handler.onConnect?.((error) => {
				if (query === "stalled body") bodyAborts++
				else fetchAborts++
				handler.onError?.(error ?? new Error("TMDB request aborted"))
			})
			if (query === "stalled body") {
				handler.onHeaders?.(200, [], () => {}, "OK")
				handler.onData?.(Buffer.from('{"results":['))
			}
			return true
		}
		return agent.dispatch(options, handler)
	},
} as Parameters<typeof setGlobalDispatcher>[0])
after(async () => {
	setGlobalDispatcher(original)
	await agent.close()
})

function page(query: string, number: number, response: object, delay = 0) {
	const scope = agent
		.get("https://api.themoviedb.org")
		.intercept({
			path: (path) => {
				const url = new URL(path, "https://api.themoviedb.org")
				return (
					url.pathname === "/3/search/multi" &&
					url.searchParams.get("query") === query &&
					url.searchParams.get("page") === String(number)
				)
			},
		})
		.reply(200, response)
	if (delay) scope.delay(delay)
}
const fixture = {
	id: 42,
	title: "Exact obscure title",
	original_title: "Özgün başlık",
	media_type: "movie",
	adult: false,
}
const policy = { includeAdult: false, lesserKnown: false, filters: {} }
const visitor = { accountId: null, networkIdentity: "test" }

test("fast exact title retains its native name and identity", async () => {
	page("Özgün başlık", 1, { total_pages: 1, results: [fixture] })
	const result = await combinedSearch(
		"Özgün başlık",
		policy,
		visitor,
		new AbortController().signal,
	)
	assert.equal(result.rows[0].key, "movie:42")
	assert.equal(result.rows[0].original, "Özgün başlık")
	assert.equal(result.rows[0].lexical, 2)
	assert.equal(result.rows[0].match, "Exact title (original name)")
})

test("slow optional TMDB page must not hold an already found exact title", async () => {
	page("slow optional page", 1, {
		total_pages: 2,
		results: [{ ...fixture, title: "slow optional page" }],
	})
	page("slow optional page", 2, { total_pages: 2, results: [] }, 600)
	const started = performance.now()
	const result = await combinedSearch(
		"slow optional page",
		policy,
		visitor,
		new AbortController().signal,
	)
	assert.equal(result.rows[0].key, "movie:42")
	assert.equal(result.rows[0].lexical, 2)
	assert.ok(
		performance.now() - started < 300,
		"an optional TMDB page exceeded the interactive budget",
	)
})

test("ranked composition preserves exact title while a later TMDB page stalls", async () => {
	const query = "ranked exact title"
	page(query, 1, { total_pages: 2, results: [{ ...fixture, title: query }] })
	page(query, 2, { results: [] }, 600)
	const started = performance.now()
	const result = await combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
	)
	assert.equal(result.rows[0].key, "movie:42")
	assert.equal(result.rows[0].lexical, 2)
	assert.equal(result.rows[0].match, "Exact title")
	assert.equal(result.errors.length, 0)
	assert.ok(
		performance.now() - started < 350,
		"ranked composition waited for the optional page",
	)
})

test("optional-page deadline aborts pending fetch and body decoding", async () => {
	for (const query of ["stalled fetch", "stalled body"]) {
		page(query, 1, { total_pages: 2, results: [fixture] })
		const started = performance.now()
		const result = await combinedSearch(
			query,
			policy,
			visitor,
			new AbortController().signal,
		)
		assert.equal(result.rows[0].key, "movie:42")
		assert.ok(performance.now() - started < 350)
	}
	assert.equal(fetchAborts, 1)
	assert.equal(bodyAborts, 1)
})

test("completed additional pages survive a sibling timeout and partial results are retried", async () => {
	const query = "partial then complete"
	page(query, 1, { total_pages: 3, results: [fixture] })
	page(query, 2, { results: [{ ...fixture, id: 43 }] })
	page(query, 3, { results: [{ ...fixture, id: 44 }] }, 600)
	const partial = await combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
	)
	assert.deepEqual(
		partial.rows.map((row) => row.key),
		["movie:42", "movie:43"],
	)
	page(query, 1, { total_pages: 2, results: [fixture] })
	page(query, 2, { results: [{ ...fixture, id: 45 }] })
	const complete = await combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
	)
	assert.deepEqual(
		complete.rows.map((row) => row.key),
		["movie:42", "movie:45"],
	)
	// The complete lookup is cached: there are no third-call network fixtures.
	const cached = await combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
	)
	assert.deepEqual(
		cached.rows.map((row) => row.key),
		["movie:42", "movie:45"],
	)
})

test("one caller leaving does not cancel another caller's shared first-page lookup", async () => {
	const query = "shared first page"
	page(query, 1, { total_pages: 1, results: [fixture] }, 80)
	const controller = new AbortController()
	const first = combinedSearch(query, policy, visitor, controller.signal)
	const rejected = assert.rejects(first, /Search interrupted/)
	const second = combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
	)
	await new Promise((resolve) => setTimeout(resolve, 10))
	controller.abort()
	await rejected
	assert.equal((await second).rows[0].key, "movie:42")
})

test("a failed first page is retried and never cached as an empty success", async () => {
	const query = "retry first page"
	agent
		.get("https://api.themoviedb.org")
		.intercept({
			path: (path) =>
				new URL(path, "https://api.themoviedb.org").searchParams.get(
					"query",
				) === query,
		})
		.reply(503, {})
	const failed = await combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
	)
	assert.ok(failed.errors.includes("Title lookup unavailable"))
	page(query, 1, { total_pages: 1, results: [fixture] })
	assert.equal(
		(await combinedSearch(query, policy, visitor, new AbortController().signal))
			.rows[0].key,
		"movie:42",
	)
})

test("first-page title and people correctness remains unchanged, including a slow first page", async () => {
	const query = "slow first page"
	page(
		query,
		1,
		{
			total_pages: 1,
			results: [
				fixture,
				{ ...fixture, id: 99, adult: true },
				{
					id: 7,
					name: "Zendaya",
					media_type: "person",
					adult: false,
					known_for: [],
				},
			],
		},
		400,
	)
	const result = await combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
	)
	assert.deepEqual(
		result.rows.map((row) => row.key),
		["movie:42"],
	)
	assert.equal(result.rows[0].original, "Özgün başlık")
	assert.equal(result.people[0].name, "Zendaya")
})

test("slow primary lookup emits provisional results then completes the original search", async () => {
	const query = "ranked delayed primary"
	await new Promise((resolve) => setImmediate(resolve))
	const before = {
		readings: probe.readings,
		rankings: probe.rankings,
		history: probe.history.length,
		displays: probe.displays.length,
		metadata: probe.metadata.length,
	}
	page(
		query,
		1,
		{
			total_pages: 1,
			results: [
				{ ...fixture, title: query },
				{
					...fixture,
					id: 41,
					title: query,
					original_title: "Native name",
					release_date: "1980-01-01",
				},
				{
					id: 7,
					name: "Zendaya",
					media_type: "person",
					adult: false,
					known_for: [],
				},
			],
		},
		650,
	)
	const started = performance.now()
	let firstAt = 0
	const provisional: import("./search.server.ts").SearchBatch[] = []
	const result = await combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
		undefined,
		{
			onProgress: async (batch) => {
				firstAt = performance.now() - started
				provisional.push(batch)
				await new Promise((resolve) => setTimeout(resolve, 50))
			},
		},
	)
	assert.equal(
		provisional.length,
		1,
		"slow primary lookup did not emit an early batch",
	)
	assert.ok(firstAt < 450, "first results waited for the primary lookup")
	assert.equal(provisional[0].pendingTitleLookup, true)
	assert.equal(provisional[0].rows[0].key, "movie:41")
	assert.equal(provisional[0].rows[0].lexical, 2)
	assert.equal(provisional[0].people.length, 0)
	assert.equal(result.rows[0].key, "movie:42")
	assert.equal(result.rows[0].lexical, 2)
	assert.equal(result.people[0].name, "Zendaya")
	assert.equal(result.pendingTitleLookup, false)
	assert.ok(
		result.elapsedMs >= 600,
		"full completion must remain the history latency",
	)
	await new Promise((resolve) => setImmediate(resolve))
	assert.equal(probe.readings - before.readings, 1)
	assert.equal(probe.rankings - before.rankings, 1)
	assert.equal(probe.history.length - before.history, 1)
	const history = probe.history.at(-1)!
	assert.equal(history.elapsedMs, result.elapsedMs)
	assert.ok(history.stageMs.firstResults < 450)
	assert.ok(
		history.stageMs.firstResults >= firstAt + 45,
		"history must include the awaited progress callback",
	)
	assert.equal(history.stageMs.total, result.elapsedMs)
	assert.ok(history.stageMs.titleCompletion > 200)
	assert.ok(history.stageMs.finalDisplay >= 0)
	assert.deepEqual(probe.displays.slice(before.displays), [
		["movie:41"],
		["movie:42"],
	])
	assert.deepEqual(probe.metadata.slice(before.metadata), [
		["movie:41"],
		["movie:42"],
	])
	const finalOnly = await combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
	)
	assert.deepEqual(
		result.rows,
		finalOnly.rows,
		"final update must match the existing final-only behavior",
	)
	assert.deepEqual(result.people, finalOnly.people)
})

test("basic provisional and final batches reuse the same literal retrieval", async () => {
	const query = "basic delayed primary"
	const before = { literals: probe.literals, readings: probe.readings }
	page(
		query,
		1,
		{ total_pages: 1, results: [{ ...fixture, title: query }] },
		500,
	)
	let early = false
	const result = await combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
		undefined,
		{
			onProgress: (batch) => {
				early = true
				assert.equal(batch.rows[0].key, "movie:41")
			},
		},
	)
	assert.ok(early)
	assert.equal(result.rows[0].key, "movie:42")
	assert.equal(
		probe.literals - before.literals,
		2,
		"movies and shows queried once, not once per batch",
	)
	assert.equal(probe.readings - before.readings, 1)
	assert.equal(
		result.errors.filter((error) => error === "Showing basic search results")
			.length,
		1,
	)
})

test("empty provisional batches are skipped and final delivery determines first usable results", async () => {
	const query = "ranked delayed empty"
	page(
		query,
		1,
		{ total_pages: 1, results: [{ ...fixture, title: query }] },
		500,
	)
	let early = false
	const result = await combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
		undefined,
		{
			onProgress: (batch) => {
				early = true
				assert.equal(batch.rows.length, 0)
				assert.equal(batch.people.length, 0)
			},
			onComplete: async () => {
				await new Promise((resolve) => setTimeout(resolve, 30))
			},
		},
	)
	assert.equal(early, false)
	assert.equal(result.rows[0].key, "movie:42")
	await new Promise((resolve) => setImmediate(resolve))
	assert.ok(probe.history.at(-1)!.stageMs.firstResults >= result.elapsedMs + 25)
})

test("progress callback failures propagate without a second inference or a history success", async () => {
	await new Promise((resolve) => setImmediate(resolve))
	const before = {
		readings: probe.readings,
		rankings: probe.rankings,
		history: probe.history.length,
	}
	const query = "ranked delayed primary failed callback"
	page(query, 1, { total_pages: 1, results: [fixture] }, 500)
	await assert.rejects(
		combinedSearch(
			query,
			policy,
			visitor,
			new AbortController().signal,
			undefined,
			{
				onProgress: () => {
					throw new Error("Progress consumer disconnected")
				},
			},
		),
		/Progress consumer disconnected/,
	)
	await new Promise((resolve) => setImmediate(resolve))
	assert.equal(probe.readings - before.readings, 1)
	assert.equal(probe.rankings - before.rankings, 1)
	assert.equal(probe.history.length, before.history)
})

test("cancellation during provisional delivery stops final delivery and history", async () => {
	await new Promise((resolve) => setImmediate(resolve))
	const before = probe.history.length
	const query = "ranked delayed primary cancelled callback"
	page(query, 1, { total_pages: 1, results: [fixture] }, 500)
	const controller = new AbortController()
	await assert.rejects(
		combinedSearch(query, policy, visitor, controller.signal, undefined, {
			onProgress: () => {
				controller.abort()
			},
		}),
		/Search interrupted/,
	)
	await new Promise((resolve) => setImmediate(resolve))
	assert.equal(probe.history.length, before)
})

test("first results include awaited final delivery when no usable provisional batch exists", async () => {
	const query = "ranked final delivery"
	page(query, 1, { total_pages: 1, results: [{ ...fixture, title: query }] })
	let delivered = 0
	const result = await combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
		undefined,
		{
			onComplete: async (batch) => {
				assert.equal(batch.rows[0].lexical, 2)
				await new Promise((resolve) => setTimeout(resolve, 50))
				delivered++
			},
		},
	)
	await new Promise((resolve) => setImmediate(resolve))
	assert.equal(delivered, 1)
	const history = probe.history.at(-1)!
	assert.equal(history.elapsedMs, result.elapsedMs)
	assert.equal(history.stageMs.total, result.elapsedMs)
	assert.ok(history.stageMs.firstResults >= result.elapsedMs + 45)
})

test("final delivery errors propagate without recording successful delivery", async () => {
	await new Promise((resolve) => setImmediate(resolve))
	const before = probe.history.length
	const query = "ranked final failure"
	page(query, 1, { total_pages: 1, results: [{ ...fixture, title: query }] })
	await assert.rejects(
		combinedSearch(
			query,
			policy,
			visitor,
			new AbortController().signal,
			undefined,
			{
				onComplete: () => {
					throw new Error("Final consumer disconnected")
				},
			},
		),
		/Final consumer disconnected/,
	)
	await new Promise((resolve) => setImmediate(resolve))
	assert.equal(probe.history.length, before)
})

test("a usable provisional delivery survives cancellation in history without pretending completion", async () => {
	await new Promise((resolve) => setImmediate(resolve))
	const before = {
		history: probe.history.length,
		readings: probe.readings,
		rankings: probe.rankings,
	}
	const query = "ranked delayed primary abort after"
	page(
		query,
		1,
		{ total_pages: 1, results: [{ ...fixture, title: query }] },
		500,
	)
	const controller = new AbortController()
	let final = false
	await assert.rejects(
		combinedSearch(query, policy, visitor, controller.signal, undefined, {
			onProgress: (batch) => {
				assert.ok(batch.rows.length)
				setTimeout(() => controller.abort(), 20)
			},
			onComplete: () => {
				final = true
			},
		}),
		/Search interrupted/,
	)
	await new Promise((resolve) => setImmediate(resolve))
	assert.equal(final, false)
	assert.equal(probe.history.length - before.history, 1)
	assert.equal(probe.readings - before.readings, 1)
	assert.equal(probe.rankings - before.rankings, 1)
	const history = probe.history.at(-1)!
	assert.equal(history.chargedNano, 123)
	assert.equal(history.stageMs.completionAborted, 1)
	assert.ok(history.stageMs.firstResults > 0)
	assert.ok(history.elapsedMs > history.stageMs.firstResults)
})

test("a late final delivery failure records the served provisional batch once and marks completion failed", async () => {
	await new Promise((resolve) => setImmediate(resolve))
	const before = {
		history: probe.history.length,
		readings: probe.readings,
		rankings: probe.rankings,
	}
	const query = "ranked delayed primary late delivery failure"
	page(
		query,
		1,
		{ total_pages: 1, results: [{ ...fixture, title: query }] },
		450,
	)
	let firstDelivered = false
	let fullElapsed = 0
	await assert.rejects(
		combinedSearch(
			query,
			policy,
			visitor,
			new AbortController().signal,
			undefined,
			{
				onProgress: async (batch) => {
					assert.ok(batch.rows.length)
					await new Promise((resolve) => setTimeout(resolve, 20))
					firstDelivered = true
				},
				onComplete: async (batch) => {
					assert.equal(firstDelivered, true)
					fullElapsed = batch.elapsedMs
					await new Promise((resolve) => setTimeout(resolve, 25))
					throw new Error("Final consumer failed")
				},
			},
		),
		/Final consumer failed/,
	)
	await new Promise((resolve) => setImmediate(resolve))
	assert.equal(probe.history.length - before.history, 1)
	assert.equal(probe.readings - before.readings, 1)
	assert.equal(probe.rankings - before.rankings, 1)
	const history = probe.history.at(-1)!
	assert.equal(history.stageMs.completionFailed, 1)
	assert.equal(history.stageMs.completionAborted, undefined)
	assert.equal(history.elapsedMs, fullElapsed)
	assert.equal(history.stageMs.total, fullElapsed)
	assert.ok(history.stageMs.firstResults < fullElapsed)
})

test("catalog failure during final reblend retains provisional delivery history and does not rerank", async () => {
	await new Promise((resolve) => setImmediate(resolve))
	const before = { history: probe.history.length, rankings: probe.rankings }
	const query = "ranked delayed primary catalog failure"
	page(
		query,
		1,
		{ total_pages: 1, results: [{ ...fixture, title: query }] },
		450,
	)
	let delivered = false
	probe.failMetadataKey = "movie:42"
	try {
		await assert.rejects(
			combinedSearch(
				query,
				policy,
				visitor,
				new AbortController().signal,
				undefined,
				{
					onProgress: (batch) => {
						assert.equal(batch.rows[0].key, "movie:41")
						delivered = true
					},
				},
			),
			/Catalog completion failed/,
		)
	} finally {
		probe.failMetadataKey = ""
	}
	await new Promise((resolve) => setImmediate(resolve))
	assert.equal(delivered, true)
	assert.equal(probe.history.length - before.history, 1)
	assert.equal(probe.rankings - before.rankings, 1)
	assert.equal(probe.history.at(-1)!.stageMs.completionFailed, 1)
})

test("translation enabled preserves the full exact person decision without another paid interpretation", async () => {
	const query = "ranked delayed native person"
	page(
		query,
		1,
		{
			total_pages: 1,
			results: [
				{
					id: 7,
					name: query,
					media_type: "person",
					adult: false,
					known_for: [],
				},
				fixture,
			],
		},
		450,
	)
	const before = probe.translations
	probe.translation = true
	try {
		let early = false
		const streamed = await combinedSearch(
			query,
			policy,
			visitor,
			new AbortController().signal,
			undefined,
			{
				onProgress: () => {
					early = true
				},
			},
		)
		const finalOnly = await combinedSearch(
			query,
			policy,
			visitor,
			new AbortController().signal,
		)
		assert.equal(early, false)
		assert.equal(probe.translations, before)
		assert.equal(streamed.mode, "english")
		assert.equal(streamed.chargedNano, 0)
		assert.deepEqual(streamed.rows, finalOnly.rows)
		assert.equal(streamed.people[0].name, query)
		assert.deepEqual(streamed.people, finalOnly.people)
	} finally {
		probe.translation = false
	}
})

test("primary lookup winning the catalog race avoids the remaining fallback wait and provisional reblend", async () => {
	const query = "ranked race fallback"
	page(
		query,
		1,
		{ total_pages: 1, results: [{ ...fixture, title: query }] },
		250,
	)
	const started = performance.now()
	let early = false
	const result = await combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
		undefined,
		{
			onProgress: () => {
				early = true
			},
		},
	)
	assert.equal(early, false)
	assert.equal(result.rows[0].lexical, 2)
	assert.ok(
		performance.now() - started < 340,
		"waited for unnecessary catalog fallback",
	)
})

test("final metadata excludes provisional-only title identities", async () => {
	const query = "ranked delayed primary metadata parity"
	page(
		query,
		1,
		{ total_pages: 1, results: [{ ...fixture, title: query }] },
		450,
	)
	const streamed = await combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
		undefined,
		{ onProgress: (batch) => assert.equal(batch.metadata[0].tmdb_id, 41) },
	)
	const finalOnly = await combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
	)
	assert.deepEqual(streamed.metadata, finalOnly.metadata)
	assert.deepEqual(streamed.rows, finalOnly.rows)
})
