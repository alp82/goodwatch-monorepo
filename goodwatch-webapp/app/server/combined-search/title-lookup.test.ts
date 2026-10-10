// Exercise the production composition and its actual TMDB lookup. Only unrelated backends are replaced.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { after, test } from "node:test"
import ts from "typescript"
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from "undici"
import "../title-filter/test-alias.ts"

const stubs: Record<string, string> = {
	"/combined-search/reading-retrieval.server.ts": `export const attributeRequest=()=>({}); export const fingerprintRequest=()=>({}); export const describeTitles=async()=>[]; export const readingFields=()=>({}); export const summarizeReading=()=>[];`,
	"/combined-search/search-filters.ts": `export const allowsTitle=()=>true; export const toCrateSql=()=>({sql:'',params:[]});`,
	"/combined-search/catalog.server.ts": `export const eligible=()=>true; export const metadataFor=async()=>[]; export const searchQuery=async()=>[];`,
	"/combined-search/language.server.ts": `export const prepareLanguage=async text=>({text,policy:{mode:'english'},chargedNano:0});`,
	"/search-runtime/runtime.server.ts": `export const BASIC_SEARCH_MESSAGE='Showing basic search results'; export const translationEnabled=()=>false; export const keepJevConnectionsWarm=()=>{}; export const runJevStage=async input=>input.requestText.startsWith('ranked ')?{kind:'ready',readings:{},chargedNano:0}:{kind:'basic',reason:'budget',chargedNano:0}; export const recordSearchHistory=async()=>({recorded:true,id:'test'});`,
	"/search-ranking/serve.server.ts": `export class RankingDeadlineError extends Error{}; export const rankForServing=async(_reading,request)=>({results:request.titleLookup.map(t=>({id:1e12+t.id,mediaType:t.type==='tv'?'show':'movie',title:t.title,year:t.year,score:3})),rounds:[],timings:{},rankerVersion:'fixture'}); export const servingFallback=search=>search.hasReading?null:'basic search'; export const startSearchRanking=()=>{};`,
	"/search-ranking/rank-search.server.ts": `export const prepareSearch=async()=>({});`,
	"/search-runtime/limits.server.ts": `export const readingsConfigured=()=>false;`,
	"/search-ranking/ranking.server.ts": `export const HEAD_LENGTH=50;`,
	"/search-ranking/search-filter.server.ts": `export const ELIGIBLE_VOTES=2000;`,
	"/search-people/people.server.ts": `export const readPeople=async()=>({named:[],offered:[],scope:null}); export const peopleToShow=async(_q,_p,people)=>people; export const startPeopleIndex=()=>{};`,
	"/role.server.ts": `export const runsSearch=()=>false;`,
}
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: { load(url: string, context: unknown, next: (url: string, context: unknown) => unknown): unknown }): void
}
registerHooks({
	load(url, context, next) {
		const stub = Object.entries(stubs).find(([suffix]) => url.endsWith(suffix))?.[1]
		if (stub !== undefined) return { format: "module", source: stub, shortCircuit: true }
		if (url.endsWith("/combined-search/search.server.ts") || url.endsWith("/ui/search/search-model.tsx")) return {
			format: "module", shortCircuit: true,
			source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
				// Highlight's JSX is never rendered here; keep its transform from importing a browser runtime.
				compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext, jsx: ts.JsxEmit.React },
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
		if ((query === "stalled fetch" || query === "stalled body") && url.searchParams.get("page") === "2") {
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
after(async () => { setGlobalDispatcher(original); await agent.close() })

function page(query: string, number: number, response: object, delay = 0) {
	const scope = agent.get("https://api.themoviedb.org").intercept({
		path: path => {
			const url = new URL(path, "https://api.themoviedb.org")
			return url.pathname === "/3/search/multi" && url.searchParams.get("query") === query && url.searchParams.get("page") === String(number)
		},
	}).reply(200, response)
	if (delay) scope.delay(delay)
}
const fixture = { id: 42, title: "Exact obscure title", original_title: "Özgün başlık", media_type: "movie", adult: false }
const policy = { includeAdult: false, lesserKnown: false, filters: {} }
const visitor = { accountId: null, networkIdentity: "test" }

test("fast exact title retains its native name and identity", async () => {
	page("Özgün başlık", 1, { total_pages: 1, results: [fixture] })
	const result = await combinedSearch("Özgün başlık", policy, visitor, new AbortController().signal)
	assert.equal(result.rows[0].key, "movie:42")
	assert.equal(result.rows[0].original, "Özgün başlık")
	assert.equal(result.rows[0].lexical, 2)
	assert.equal(result.rows[0].match, "Exact title (original name)")
})

test("slow optional TMDB page must not hold an already found exact title", async () => {
	page("slow optional page", 1, { total_pages: 2, results: [{ ...fixture, title: "slow optional page" }] })
	page("slow optional page", 2, { total_pages: 2, results: [] }, 600)
	const started = performance.now()
	const result = await combinedSearch("slow optional page", policy, visitor, new AbortController().signal)
	assert.equal(result.rows[0].key, "movie:42")
	assert.equal(result.rows[0].lexical, 2)
	assert.ok(performance.now() - started < 300, "an optional TMDB page exceeded the interactive budget")
})

test("ranked composition preserves exact title while a later TMDB page stalls", async () => {
	const query = "ranked exact title"
	page(query, 1, { total_pages: 2, results: [{ ...fixture, title: query }] })
	page(query, 2, { results: [] }, 600)
	const started = performance.now()
	const result = await combinedSearch(query, policy, visitor, new AbortController().signal)
	assert.equal(result.rows[0].key, "movie:42")
	assert.equal(result.rows[0].lexical, 2)
	assert.equal(result.rows[0].match, "Exact title")
	assert.equal(result.errors.length, 0)
	assert.ok(performance.now() - started < 350, "ranked composition waited for the optional page")
})

test("optional-page deadline aborts pending fetch and body decoding", async () => {
	for (const query of ["stalled fetch", "stalled body"]) {
		page(query, 1, { total_pages: 2, results: [fixture] })
		const started = performance.now()
		const result = await combinedSearch(query, policy, visitor, new AbortController().signal)
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
	const partial = await combinedSearch(query, policy, visitor, new AbortController().signal)
	assert.deepEqual(partial.rows.map(row => row.key), ["movie:42", "movie:43"])
	page(query, 1, { total_pages: 2, results: [fixture] })
	page(query, 2, { results: [{ ...fixture, id: 45 }] })
	const complete = await combinedSearch(query, policy, visitor, new AbortController().signal)
	assert.deepEqual(complete.rows.map(row => row.key), ["movie:42", "movie:45"])
	// The complete lookup is cached: there are no third-call network fixtures.
	const cached = await combinedSearch(query, policy, visitor, new AbortController().signal)
	assert.deepEqual(cached.rows.map(row => row.key), ["movie:42", "movie:45"])
})

test("one caller leaving does not cancel another caller's shared first-page lookup", async () => {
	const query = "shared first page"
	page(query, 1, { total_pages: 1, results: [fixture] }, 80)
	const controller = new AbortController()
	const first = combinedSearch(query, policy, visitor, controller.signal)
	const rejected = assert.rejects(first, /Search interrupted/)
	const second = combinedSearch(query, policy, visitor, new AbortController().signal)
	await new Promise(resolve => setTimeout(resolve, 10))
	controller.abort()
	await rejected
	assert.equal((await second).rows[0].key, "movie:42")
})

test("a failed first page is retried and never cached as an empty success", async () => {
	const query = "retry first page"
	agent.get("https://api.themoviedb.org").intercept({ path: path => new URL(path, "https://api.themoviedb.org").searchParams.get("query") === query }).reply(503, {})
	const failed = await combinedSearch(query, policy, visitor, new AbortController().signal)
	assert.ok(failed.errors.includes("Title lookup unavailable"))
	page(query, 1, { total_pages: 1, results: [fixture] })
	assert.equal((await combinedSearch(query, policy, visitor, new AbortController().signal)).rows[0].key, "movie:42")
})

test("first-page title and people correctness remains unchanged, including a slow first page", async () => {
	const query = "slow first page"
	page(query, 1, { total_pages: 1, results: [
		fixture,
		{ ...fixture, id: 99, adult: true },
		{ id: 7, name: "Zendaya", media_type: "person", adult: false, known_for: [] },
	] }, 400)
	const result = await combinedSearch(query, policy, visitor, new AbortController().signal)
	assert.deepEqual(result.rows.map(row => row.key), ["movie:42"])
	assert.equal(result.rows[0].original, "Özgün başlık")
	assert.equal(result.people[0].name, "Zendaya")
})
