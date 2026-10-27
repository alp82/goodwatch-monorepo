// Exercise the production composition and its actual TMDB lookup. Only unrelated backends are replaced. The search
// filters (allowsTitle, toCrateSql) are the real module. The catalog is a stub: its `eligible` is a gate the tests
// set, so these tests show where the search asks it and with what, not catalog.server.ts's own rule.
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
	// While set, the paid reading of a "held reading" query waits for it, then returns what the real stage returns at
	// that point (see the runtime stub). Each returned outcome is kept, so a test reads the charge instead of assuming it.
	readGate: null as Promise<void> | null,
	readHeld: 0,
	readOutcomes: [] as { kind: string; reason?: string; chargedNano: number }[],
	// While set, the ranking of a "held ranking" query waits for it (see the serve stub). The ranking of a "late ranking"
	// query misses its deadline after 40 ms instead: the error carries the one original ranking, which waits for the gate
	// and fails when the gate rejects. The ranking of a "sibling rejection" query also lists movie:99, a title the
	// lookup did not find, so its display reads the catalog for it.
	rankGate: null as Promise<void> | null,
	rankHeld: 0,
	rankSettled: 0,
	// The ranking of a "staged ranking" query also misses its deadline after 40 ms, but inside a round1 span of the
	// search's own RankingProgress: the error carries that progress's real frozen snapshot, and the original ranking
	// returns the round1 time it observed across the gate, under rankSearch's timing names (see the serve stub).
	staged: null as null | {
		progress: { snapshot(): Readonly<Record<string, number>> }
		ranking?: Promise<{ timings: Record<string, number> }>
		deadline?: Readonly<Record<string, number>>
		deadlineCopy?: Record<string, number>
		completed?: { timings: Record<string, number> }
	},
	// While set, a ranked list's display fields wait for it (see the reading-retrieval stub), whatever time limit the
	// search passed: the ranking is done and its display is not. Each limit passed is kept.
	displayGate: null as Promise<void> | null,
	displayHeld: 0,
	displaySettled: 0,
	displayTimeouts: [] as (number | undefined)[],
	literals: 0,
	displays: [] as string[][],
	metadata: [] as string[][],
	failMetadataKey: "",
	// While set, a catalog read that includes heldMetadataKey waits for it after it was recorded (see the catalog stub).
	metadataGate: null as Promise<void> | null,
	heldMetadataKey: "",
	metadataHeld: 0,
	metadataSettled: 0,
	// Queries, lowercased, whose reading is ready and whose ranking waits for rankGate without the marker words
	// "ranked" and "held ranking": for searches whose every word matters ("the"). See the runtime and serve stubs.
	forced: new Set<string>(),
	// The catalog stub's gates. A key's IMDb id, for rows that are one title. Keys the stubbed `eligible` refuses, and,
	// while set, each call it received. The stub is a gate and not catalog.server.ts's rule.
	imdb: {} as Record<string, string>,
	ineligible: new Set<string>(),
	eligibility: null as null | { key: string; discovery: boolean }[],
	// The command palette's matches per query (see the command-palette stub).
	palette: {} as Record<string, object[]>,
	// The people step's reading per query as typed, and each read of a query that has one (see the people stub). A query
	// without an entry names nobody, as before.
	people: {} as Record<
		string,
		{
			named: {
				id: number
				name: string
				popularity: number
				profile: string | null
				department: string
			}[]
			offered: object[]
			scope: null
		}
	>,
	peopleReads: [] as { q: string; narrow: boolean }[],
	history: [] as {
		elapsedMs: number
		chargedNano: number
		outcome?: string
		reason?: string
		rankerVersion?: string
		rankerFallback?: string
		stageMs: Record<string, number>
	}[],
}
Object.assign(globalThis, { titleLookupProbe: probe })
// The serve stub writes probe.staged from evaluated source the compiler cannot see, so a test that reset it reads it
// back through here, under its declared type, instead of under the null the test itself assigned.
const stagedRanking = (): (typeof probe)["staged"] => probe.staged

const stubs: Record<string, string> = {
	"/combined-search/reading-retrieval.server.ts": `export const attributeRequest=()=>({}); export const fingerprintRequest=()=>({}); export const describeTitles=async(_reading,rows,options)=>{const probe=globalThis.titleLookupProbe;probe.displays.push(rows.map(row=>row.key));if(probe.displayGate){const gate=probe.displayGate;probe.displayHeld++;probe.displayTimeouts.push(options?.timeoutMs);await gate;probe.displaySettled++}return []}; export const readingFields=()=>({}); export const summarizeReading=()=>[];`,
	"/combined-search/catalog.server.ts": `export const eligible=(metadata,_policy,discovery)=>{const probe=globalThis.titleLookupProbe;const key=metadata?metadata.media_type+':'+metadata.tmdb_id:'';probe.eligibility?.push({key,discovery});return !probe.ineligible.has(key)}; export const metadataFor=async keys=>{if(keys.includes(globalThis.titleLookupProbe.failMetadataKey))throw new Error("Catalog completion failed");if(keys.length)globalThis.titleLookupProbe.metadata.push(keys);const probe=globalThis.titleLookupProbe;if(probe.metadataGate&&keys.includes(probe.heldMetadataKey)){const gate=probe.metadataGate;probe.metadataHeld++;await gate;probe.metadataSettled++}return keys.map(key=>({media_type:key.split(':')[0],tmdb_id:Number(key.split(':')[1]),adult:false,imdb_id:globalThis.titleLookupProbe.imdb[key]??null,poster_path:null,genres:null,goodwatch_overall_score_voting_count:0,goodwatch_overall_score_normalized_percent:null}))}; export const searchQuery=async()=>{globalThis.titleLookupProbe.literals++;return []}; export const exactCatalogTitles=async q=>{if(q.includes('race fallback'))await new Promise(resolve=>setTimeout(resolve,180));return q.includes('delayed primary')?[{id:41,title:q,original:'Native name',type:'movie',year:'1980',poster:null,popularity:0}]:[]};`,
	"/combined-search/language.server.ts": `export const prepareLanguage=async text=>{if(!globalThis.titleLookupProbe.translation)return {text,policy:{mode:'english'},chargedNano:0};globalThis.titleLookupProbe.translations++;return {text:'translated '+text,policy:{mode:'translated'},chargedNano:99}};`,
	"/search-runtime/runtime.server.ts": `export const BASIC_SEARCH_MESSAGE='Showing basic search results'; export const translationEnabled=()=>globalThis.titleLookupProbe.translation; export const keepJevConnectionsWarm=()=>{}; export const runJevStage=async input=>{globalThis.titleLookupProbe.readings++;if(globalThis.titleLookupProbe.readGate&&input.requestText.includes('held reading')){globalThis.titleLookupProbe.readHeld++;await globalThis.titleLookupProbe.readGate;const outcome=input.signal?.aborted?{kind:'basic',reason:'cancelled',message:BASIC_SEARCH_MESSAGE,chargedNano:123}:{kind:'ready',readings:{},chargedNano:123};globalThis.titleLookupProbe.readOutcomes.push(outcome);return outcome}return input.requestText.startsWith('ranked ')||globalThis.titleLookupProbe.forced.has(input.requestText)?{kind:'ready',readings:{},chargedNano:input.requestText.includes('abort after')?123:0}:{kind:'basic',reason:'budget',chargedNano:0}}; export const recordSearchHistory=async entry=>{globalThis.titleLookupProbe.history.push(entry);return {recorded:true,id:'test'}};`,
	"/search-ranking/serve.server.ts": `export class RankingDeadlineError extends Error{timings=Object.freeze({round1Elapsed:40,round1Pending:1});constructor(message,ranking,timings){super(message);this.ranking=ranking;if(timings)this.timings=timings}}; const rows=titles=>titles.map(t=>({id:1e12+t.id,mediaType:t.type==='tv'?'show':'movie',title:t.title,year:t.year,score:3})); export const rankForServing=async(_reading,request)=>{globalThis.titleLookupProbe.rankings++;if(request.query.includes("diagnostic deadline"))throw new RankingDeadlineError("private fixture failure");if(globalThis.titleLookupProbe.rankGate&&request.query.includes("staged ranking")){const probe=globalThis.titleLookupProbe;const gate=probe.rankGate;const staged=probe.staged={progress:request.progress};const started=performance.now();staged.ranking=(async()=>{probe.rankHeld++;await request.progress.measure("round1",()=>gate);const round1=performance.now()-started;probe.rankSettled++;staged.completed={results:[...rows(request.titleLookup),...(request.query.includes('sibling rejection')?[{id:1e12+99,mediaType:'movie',title:'A ranked discovery',year:'2000',score:1}]:[])],reblend:rows,rounds:[],timings:{round1,total:performance.now()-started},rankerVersion:'fixture'};return staged.completed})();await new Promise(resolve=>setTimeout(resolve,40));staged.deadline=request.progress.snapshot();staged.deadlineCopy={...staged.deadline};throw new RankingDeadlineError("private fixture failure",staged.ranking,staged.deadline)}if(globalThis.titleLookupProbe.rankGate&&request.query.includes("late ranking")){const gate=globalThis.titleLookupProbe.rankGate;const ranking=(async()=>{globalThis.titleLookupProbe.rankHeld++;await gate;globalThis.titleLookupProbe.rankSettled++;return {results:[...rows(request.titleLookup),...(request.query.includes('sibling rejection')?[{id:1e12+99,mediaType:'movie',title:'A ranked discovery',year:'2000',score:1}]:[])],reblend:rows,rounds:[],timings:{},rankerVersion:'fixture'}})();ranking.catch(()=>{});await new Promise(resolve=>setTimeout(resolve,40));throw new RankingDeadlineError("private fixture failure",ranking)}if(globalThis.titleLookupProbe.rankGate&&(request.query.includes("held ranking")||globalThis.titleLookupProbe.forced.has(request.query.toLowerCase()))){globalThis.titleLookupProbe.rankHeld++;await globalThis.titleLookupProbe.rankGate;globalThis.titleLookupProbe.rankSettled++}return {results:[...rows(request.titleLookup),...(request.query.includes('sibling rejection')?[{id:1e12+99,mediaType:'movie',title:'A ranked discovery',year:'2000',score:1}]:[])],reblend:rows,rounds:[],timings:{},rankerVersion:'fixture'}}; export const servingFallback=search=>search.hasReading?null:'basic search'; export const startSearchRanking=()=>{};`,
	"/search-ranking/rank-search.server.ts": `export const prepareSearch=async()=>({});`,
	"/search-runtime/limits.server.ts": `export const readingsConfigured=()=>false; export const searchInFlightLimit=()=>4;`,
	"/search-ranking/ranking.server.ts": `export const HEAD_LENGTH=50;`,
	"/search-ranking/search-filter.server.ts": `export const ELIGIBLE_VOTES=2000;`,
	"/search-people/people.server.ts": `export const readPeople=async(q,narrow)=>{const probe=globalThis.titleLookupProbe;const reading=probe.people[q];if(!reading)return {named:[],offered:[],scope:null};probe.peopleReads.push({q,narrow});return reading}; export const peopleToShow=async(_q,reading,people)=>[...reading.named.map(p=>({id:p.id,name:p.name,department:p.department,profile:p.profile,knownFor:[]})),...people]; export const startPeopleIndex=()=>{};`,
	"/role.server.ts": `export const runsSearch=()=>false;`,
	"/command-palette.server.ts": `export const paletteLookupTitles=async q=>globalThis.titleLookupProbe.palette[q]??[];`,
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
// The search's own admission, not a copy: the late-window tests read the places it holds.
const { searchAdmission } = await import(
	"../search-runtime/admission.server.ts"
)
const original = getGlobalDispatcher()
const agent = new MockAgent()
agent.disableNetConnect()
let fetchAborts = 0
let bodyAborts = 0
let observePageAbort: (() => void) | undefined
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
				observePageAbort?.()
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

test("optional-page deadline aborts pending fetch and body decoding", { timeout: 5000 }, async () => {
	for (const query of ["stalled fetch", "stalled body"]) {
		const aborted = new Promise<void>((resolve) => { observePageAbort = resolve })
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
		// The timeout race settles before undici finishes cancelling a response body. Observe the actual
		// dispatcher cancellation instead of assuming its callback ran in the same microtask.
		await aborted
		observePageAbort = undefined
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

test("the command palette's titles join TMDB's once each, and the people stay TMDB's", async () => {
	for (const query of ["ranked lord of", "basic lord of"]) {
		page(query, 1, {
			total_pages: 1,
			results: [
				{ id: 7, title: "Lord of War", media_type: "movie" },
				{ id: 3, name: "Some Lord", media_type: "person", known_for: [] },
			],
		})
		const fromIndex = (id: number, title: string, type = "movie") => ({
			id,
			title,
			type,
			year: "2001",
			poster: null,
			popularity: 1,
		})
		probe.palette[query] = [
			fromIndex(7, "Lord of War"),
			fromIndex(8, "Lord of the Flies"),
			fromIndex(9, "Lord of the Rings Saga", "tv"),
		]
		const result = await combinedSearch(
			query,
			policy,
			visitor,
			new AbortController().signal,
		)
		const keys = result.rows.map((row) => row.key)
		for (const key of ["movie:7", "movie:8", "show:9"])
			assert.equal(keys.filter((k) => k === key).length, 1, `${query}: ${key}`)
		assert.deepEqual(
			result.people.map((person) => person.name),
			["Some Lord"],
		)
	}
})

test("a title the palette found by a localized name keeps that name, also when TMDB found it too", async () => {
	for (const query of ["ranked chihiros reise", "basic chihiros reise"]) {
		page(query, 1, {
			total_pages: 1,
			results: [
				{
					id: 129,
					title: "Spirited Away",
					original_title: "千と千尋の神隠し",
					media_type: "movie",
				},
			],
		})
		const alias = { text: "Chihiros Reise ins Zauberland", language: "de" }
		probe.palette[query] = [
			{
				id: 129,
				title: "Spirited Away",
				original: "千と千尋の神隠し",
				type: "movie",
				year: "2001",
				poster: null,
				popularity: 1,
				matchedAlias: alias,
			},
			{
				id: 130,
				title: "Another Title",
				type: "movie",
				year: "2002",
				poster: null,
				popularity: 1,
				matchedAlias: { text: "Chihiros Reise zurück", language: "de" },
			},
		]
		const result = await combinedSearch(
			query,
			policy,
			visitor,
			new AbortController().signal,
		)
		const spirited = result.rows.find((row) => row.key === "movie:129")
		assert.deepEqual(spirited?.matchedAlias, alias, query)
		assert.match(spirited?.match ?? "", /\(localized name\)$/, query)
		assert.ok((spirited?.lexical ?? 0) > 0, query)
		assert.equal(
			result.rows.find((row) => row.key === "movie:130")?.matchedAlias?.text,
			"Chihiros Reise zurück",
			query,
		)
	}
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
	let secondAt = 0
	const provisional: import("./search.server.ts").SearchBatch[] = []
	const result = await combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
		undefined,
		{
			onProgress: async (batch) => {
				if (!provisional.length) firstAt = performance.now() - started
				else secondAt ||= performance.now() - started
				provisional.push(batch)
				await new Promise((resolve) => setTimeout(resolve, 50))
			},
		},
	)
	// The two pending flags are independent: the catalog's exact title while the ranking and the primary lookup run,
	// then the ranked list while only the primary lookup runs.
	assert.deepEqual(
		provisional.map((batch) => ({
			pendingTitleLookup: batch.pendingTitleLookup,
			pendingRanking: batch.pendingRanking,
		})),
		[
			{ pendingTitleLookup: true, pendingRanking: true },
			{ pendingTitleLookup: true, pendingRanking: false },
		],
		"slow primary lookup did not emit the early batch and then the ranked provisional batch",
	)
	assert.ok(firstAt < 450, "first results waited for the primary lookup")
	assert.ok(secondAt < 450, "ranked results waited for the primary lookup")
	for (const batch of provisional) {
		assert.equal(batch.rows[0].key, "movie:41")
		assert.equal(batch.rows[0].lexical, 2)
		assert.equal(batch.people.length, 0)
	}
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
	assert.ok(
		history.stageMs.firstResults < secondAt + 45,
		"first results must keep the first delivery's time, not the second's",
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
	const before = { rankings: probe.rankings, displays: probe.displays.length }
	const started = performance.now()
	const provisional: import("./search.server.ts").SearchBatch[] = []
	const result = await combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
		undefined,
		{
			onProgress: (batch) => {
				provisional.push(batch)
			},
		},
	)
	// The primary lookup answered first, so its exact title goes out ahead of the ranking. No batch waits on a title
	// lookup: there is no ranked provisional batch, and nothing to reblend.
	assert.deepEqual(
		provisional.map((batch) => ({
			pendingTitleLookup: batch.pendingTitleLookup,
			pendingRanking: batch.pendingRanking,
			rows: batch.rows.map((row) => [row.key, row.lexical]),
		})),
		[
			{
				pendingTitleLookup: false,
				pendingRanking: true,
				rows: [["movie:42", 2]],
			},
		],
	)
	assert.equal(result.rows[0].key, "movie:42")
	assert.equal(result.rows[0].lexical, 2)
	assert.equal(result.pendingTitleLookup, false)
	assert.equal(probe.rankings - before.rankings, 1)
	assert.deepEqual(probe.displays.slice(before.displays), [["movie:42"]])
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

test("a strong exact title is delivered with pendingRanking while the original ranking is held, then the unchanged final replaces it", async () => {
	await new Promise((resolve) => setImmediate(resolve))
	const query = "ranked held ranking exact title"
	page(query, 1, { total_pages: 1, results: [{ ...fixture, title: query }] })
	const before = {
		readings: probe.readings,
		rankings: probe.rankings,
		rankHeld: probe.rankHeld,
		rankSettled: probe.rankSettled,
		history: probe.history.length,
	}
	const sleep = (ms: number) =>
		new Promise<void>((resolve) => setTimeout(resolve, ms))
	// Every wait below is bounded, and the gate opens by itself, so a missing early delivery fails instead of hanging.
	const within = <T>(promise: Promise<T>, ms: number) => {
		let timer: ReturnType<typeof setTimeout> | undefined
		return Promise.race([
			promise,
			new Promise<undefined>((resolve) => {
				timer = setTimeout(() => resolve(undefined), ms)
			}),
		]).finally(() => clearTimeout(timer))
	}
	let release = () => {}
	probe.rankGate = new Promise<void>((resolve) => {
		release = resolve
	})
	const safety = setTimeout(() => release(), 1200)
	type Streamed = import("./search.server.ts").SearchBatch & {
		pendingRanking?: boolean
	}
	const early: { batch: Streamed; rankSettled: number; completed: number }[] =
		[]
	const completed: Streamed[] = []
	let seen = () => {}
	const firstEarly = new Promise<void>((resolve) => {
		seen = resolve
	})
	const search = combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
		undefined,
		{
			onProgress: (batch) => {
				early.push({
					batch,
					rankSettled: probe.rankSettled - before.rankSettled,
					completed: completed.length,
				})
				seen()
			},
			onComplete: (batch) => {
				completed.push(batch)
			},
		},
	)
	search.catch(() => {})
	const held = { early: 0, rankings: 0, rankHeld: 0, rankSettled: 0, final: 0 }
	try {
		await within(firstEarly, 600)
		// The original ranking has started and is waiting at the gate.
		for (let i = 0; i < 60 && probe.rankHeld === before.rankHeld; i++)
			await sleep(10)
		await sleep(40)
		held.early = early.length
		held.rankings = probe.rankings - before.rankings
		held.rankHeld = probe.rankHeld - before.rankHeld
		held.rankSettled = probe.rankSettled - before.rankSettled
		held.final = completed.length
	} finally {
		clearTimeout(safety)
		release()
		probe.rankGate = null
	}
	const result: Streamed | undefined = await within(search, 5000)
	assert.ok(result, "the search did not complete after the ranking was released")
	assert.equal(
		held.early,
		1,
		"a strong exact title was not delivered while the original ranking was held",
	)
	assert.deepEqual(
		{ ...held, early: 1 },
		{ early: 1, rankings: 1, rankHeld: 1, rankSettled: 0, final: 0 },
		"the one original ranking must still be pending, with no final, when the early batch is shown",
	)
	const first = early[0]
	assert.equal(first.rankSettled, 0)
	assert.equal(first.completed, 0)
	assert.equal(first.batch.q, query)
	assert.equal(first.batch.pendingRanking, true)
	// The primary lookup answered: only the ranking is pending.
	assert.equal(first.batch.pendingTitleLookup, false)
	assert.deepEqual(
		first.batch.rows.map((row) => [row.key, row.lexical, row.match]),
		[["movie:42", 2, "Exact title"]],
	)
	// A lookup row has no description hit; the early batch claims no interpretation and no basic search.
	assert.equal(first.batch.rows[0].discovery, undefined)
	assert.deepEqual(first.batch.reading, [])
	assert.deepEqual(first.batch.errors, [])
	assert.equal(early.length, 1, "the ranked final is not another provisional")
	assert.equal(completed.length, 1)
	assert.equal(completed[0], result)
	assert.equal(result.pendingRanking, false)
	assert.equal(result.pendingTitleLookup, false)
	await new Promise((resolve) => setImmediate(resolve))
	assert.equal(probe.readings - before.readings, 1)
	assert.equal(probe.rankings - before.rankings, 1)
	assert.equal(probe.rankSettled - before.rankSettled, 1)
	assert.equal(probe.history.length - before.history, 1)
	const history = probe.history.at(-1)!
	assert.equal(history.outcome, "ready")
	assert.equal(history.rankerFallback, undefined)
	assert.equal(history.stageMs.completionFailed, undefined)
	assert.equal(history.stageMs.completionAborted, undefined)
	assert.equal(history.elapsedMs, result.elapsedMs)
	assert.ok(
		history.stageMs.firstResults + 30 <= result.elapsedMs,
		"first results must keep the early delivery's time, not the final's",
	)
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
	assert.deepEqual(result.metadata, finalOnly.metadata)
	assert.deepEqual(result.people, finalOnly.people)
	assert.deepEqual(result.reading, finalOnly.reading)
	assert.deepEqual(result.errors, finalOnly.errors)
	assert.equal(result.mode, finalOnly.mode)
})

test("a declined early exact title and a declined final are attempts, not deliveries: no first results and no history", async () => {
	await new Promise((resolve) => setImmediate(resolve))
	const query = "ranked held ranking declined delivery"
	page(query, 1, { total_pages: 1, results: [{ ...fixture, title: query }] })
	const before = {
		readings: probe.readings,
		rankings: probe.rankings,
		rankHeld: probe.rankHeld,
		rankSettled: probe.rankSettled,
		history: probe.history.length,
	}
	const sleep = (ms: number) =>
		new Promise<void>((resolve) => setTimeout(resolve, ms))
	// Every wait below is bounded, and the gate opens by itself, so a missing attempt fails instead of hanging.
	const within = <T>(promise: Promise<T>, ms: number) => {
		let timer: ReturnType<typeof setTimeout> | undefined
		return Promise.race([
			promise,
			new Promise<undefined>((resolve) => {
				timer = setTimeout(() => resolve(undefined), ms)
			}),
		]).finally(() => clearTimeout(timer))
	}
	let release = () => {}
	probe.rankGate = new Promise<void>((resolve) => {
		release = resolve
	})
	const safety = setTimeout(() => release(), 1200)
	type Streamed = import("./search.server.ts").SearchBatch
	const offered: { batch: Streamed; rankSettled: number; final: number }[] = []
	const finals: Streamed[] = []
	let seen = () => {}
	const firstOffer = new Promise<void>((resolve) => {
		seen = resolve
	})
	// The consumer answers each attempt with an explicit synchronous false: the batch did not reach the person.
	const declineProgress: (batch: Streamed) => void = (batch) => {
		offered.push({
			batch,
			rankSettled: probe.rankSettled - before.rankSettled,
			final: finals.length,
		})
		seen()
		return false
	}
	const declineComplete: (batch: Streamed) => void = (batch) => {
		finals.push(batch)
		return false
	}
	const search = combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
		undefined,
		{ onProgress: declineProgress, onComplete: declineComplete },
	)
	// Whether a search nobody received resolves or rejects is not this test's subject; it must settle.
	const settled = search.then(
		() => "resolved" as const,
		() => "rejected" as const,
	)
	const held = { offered: 0, rankHeld: 0, rankSettled: 0, final: 0 }
	try {
		await within(firstOffer, 600)
		// The original ranking has started and is waiting at the gate.
		for (let i = 0; i < 60 && probe.rankHeld === before.rankHeld; i++)
			await sleep(10)
		await sleep(40)
		held.offered = offered.length
		held.rankHeld = probe.rankHeld - before.rankHeld
		held.rankSettled = probe.rankSettled - before.rankSettled
		held.final = finals.length
	} finally {
		clearTimeout(safety)
		release()
		probe.rankGate = null
	}
	assert.ok(
		await within(settled, 5000),
		"the search did not settle after the ranking was released",
	)
	assert.deepEqual(
		held,
		{ offered: 1, rankHeld: 1, rankSettled: 0, final: 0 },
		"the early exact title must be declined while the one original ranking is still held",
	)
	assert.equal(offered[0].rankSettled, 0)
	assert.equal(offered[0].final, 0)
	assert.equal(offered[0].batch.pendingRanking, true)
	assert.deepEqual(
		offered[0].batch.rows.map((row) => [row.key, row.lexical]),
		[["movie:42", 2]],
	)
	assert.equal(offered.length, 1, "a declined early batch is not offered again")
	assert.equal(finals.length, 1, "the final is still attempted exactly once")
	// Let the deferred history write run, if one was queued.
	await new Promise((resolve) => setImmediate(resolve))
	await sleep(20)
	await new Promise((resolve) => setImmediate(resolve))
	assert.equal(probe.readings - before.readings, 1)
	assert.equal(probe.rankings - before.rankings, 1)
	assert.equal(probe.rankSettled - before.rankSettled, 1)
	assert.deepEqual(
		probe.history.slice(before.history).map((row) => ({
			outcome: row.outcome,
			firstResults: row.stageMs.firstResults !== undefined,
		})),
		[],
		"two declined attempts recorded a delivery: a callback that returned is not a batch that arrived",
	)
})

test("ranking deadline diagnostics reach fallback history while exact title results are still served", async (t) => {
	await new Promise((resolve) => setImmediate(resolve))
	const query = "ranked diagnostic deadline"
	page(query, 1, { total_pages: 1, results: [{ ...fixture, title: query }] })
	const logs = t.mock.method(console, "error", () => {})
	const before = {
		history: probe.history.length,
		readings: probe.readings,
		rankings: probe.rankings,
	}
	const batch = await combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
	)
	await new Promise((resolve) => setImmediate(resolve))
	assert.equal(batch.rows[0].key, "movie:42")
	assert.equal(probe.history.length - before.history, 1)
	assert.equal(probe.readings - before.readings, 1)
	assert.equal(probe.rankings - before.rankings, 1)
	const history = probe.history.at(-1)!
	assert.equal(history.rankerFallback, "timeout")
	assert.equal(history.stageMs.rankingRound1Elapsed, 40)
	assert.equal(history.stageMs.rankingRound1Pending, 1)
	assert.ok(history.stageMs.failedRanking >= 0)
	assert.equal(history.elapsedMs, batch.elapsedMs)
	assert.ok(
		!JSON.stringify(logs.mock.calls.map((call) => call.arguments)).includes(
			"private fixture",
		),
	)
})

test("a delivered exact title waits past the ranking deadline for the same original ranking: no basic fallback, then the full ranked final", async (t) => {
	await new Promise((resolve) => setImmediate(resolve))
	const query = "ranked late ranking exact title"
	page(query, 1, { total_pages: 1, results: [{ ...fixture, title: query }] })
	t.mock.method(console, "error", () => {})
	const before = {
		readings: probe.readings,
		rankings: probe.rankings,
		rankHeld: probe.rankHeld,
		rankSettled: probe.rankSettled,
		literals: probe.literals,
		history: probe.history.length,
	}
	const sleep = (ms: number) =>
		new Promise<void>((resolve) => setTimeout(resolve, ms))
	// Every wait below is bounded, and the gate opens by itself, so a missing early delivery fails instead of hanging.
	const within = <T>(promise: Promise<T>, ms: number) => {
		let timer: ReturnType<typeof setTimeout> | undefined
		return Promise.race([
			promise,
			new Promise<undefined>((resolve) => {
				timer = setTimeout(() => resolve(undefined), ms)
			}),
		]).finally(() => clearTimeout(timer))
	}
	let release = () => {}
	probe.rankGate = new Promise<void>((resolve) => {
		release = resolve
	})
	const safety = setTimeout(() => release(), 1200)
	type Streamed = import("./search.server.ts").SearchBatch
	const early: Streamed[] = []
	const completed: { batch: Streamed; rankSettled: number; early: number }[] =
		[]
	let seen = () => {}
	const firstEarly = new Promise<void>((resolve) => {
		seen = resolve
	})
	let settled = false
	const search = combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
		undefined,
		{
			onProgress: (batch) => {
				early.push(batch)
				seen()
			},
			onComplete: (batch) => {
				completed.push({
					batch,
					rankSettled: probe.rankSettled - before.rankSettled,
					early: early.length,
				})
			},
		},
	)
	search.then(
		() => {
			settled = true
		},
		() => {
			settled = true
		},
	)
	const held = {
		early: 0,
		rankings: 0,
		rankHeld: 0,
		rankSettled: 0,
		final: 0,
		literals: 0,
		settled: true,
		history: 0,
	}
	try {
		await within(firstEarly, 600)
		// The original ranking has started and is waiting at the gate.
		for (let i = 0; i < 60 && probe.rankHeld === before.rankHeld; i++)
			await sleep(10)
		// Well past the ranking's 40 ms deadline: long enough for a basic fallback to be queried, served and recorded.
		await sleep(150)
		await new Promise((resolve) => setImmediate(resolve))
		held.early = early.length
		held.rankings = probe.rankings - before.rankings
		held.rankHeld = probe.rankHeld - before.rankHeld
		held.rankSettled = probe.rankSettled - before.rankSettled
		held.final = completed.length
		held.literals = probe.literals - before.literals
		held.settled = settled
		held.history = probe.history.length - before.history
	} finally {
		clearTimeout(safety)
		release()
		probe.rankGate = null
	}
	const result: Streamed | undefined = await within(
		search.catch(() => undefined),
		5000,
	)
	assert.deepEqual(
		held,
		{
			early: 1,
			rankings: 1,
			rankHeld: 1,
			rankSettled: 0,
			final: 0,
			literals: 0,
			settled: false,
			history: 0,
		},
		"past the ranking deadline, a search whose exact title was delivered must wait for its original ranking: no basic search, no final, no row",
	)
	assert.ok(result, "the search did not complete after the ranking was released")
	assert.equal(early[0].pendingRanking, true)
	assert.deepEqual(
		early[0].rows.map((row) => [row.key, row.lexical, row.match]),
		[["movie:42", 2, "Exact title"]],
	)
	assert.equal(early.length, 1, "the ranked final is not another provisional")
	// The final follows the early batch and the original ranking's end, once.
	assert.deepEqual(
		completed.map(({ rankSettled, early }) => ({ rankSettled, early })),
		[{ rankSettled: 1, early: 1 }],
	)
	assert.equal(completed[0].batch, result)
	assert.equal(result.pendingRanking, false)
	assert.equal(result.pendingTitleLookup, false)
	assert.deepEqual(result.errors, [], "the late ranked final is not a basic search")
	assert.deepEqual(
		result.rows.map((row) => [row.key, row.lexical, row.score]),
		[["movie:42", 2, 3]],
	)
	assert.ok(
		result.elapsedMs >= 150,
		"full completion includes the wait for the original ranking",
	)
	await new Promise((resolve) => setImmediate(resolve))
	assert.equal(probe.readings - before.readings, 1)
	assert.equal(probe.rankings - before.rankings, 1, "the search ranked twice")
	assert.equal(probe.rankHeld - before.rankHeld, 1)
	assert.equal(probe.rankSettled - before.rankSettled, 1)
	assert.equal(probe.literals - before.literals, 0)
	assert.equal(probe.history.length - before.history, 1)
	const history = probe.history.at(-1)!
	assert.equal(history.outcome, "ready")
	assert.equal(history.rankerVersion, "fixture")
	assert.equal(history.elapsedMs, result.elapsedMs)
	assert.equal(history.stageMs.total, result.elapsedMs)
	assert.equal(history.stageMs.completionFailed, undefined)
	assert.equal(history.stageMs.completionAborted, undefined)
	assert.ok(
		history.stageMs.firstResults + 100 <= result.elapsedMs,
		"first results must keep the early delivery's time, not the late final's",
	)
	// The deadline's own snapshot stays on the row even though the ranking completed late, under its own names.
	assert.equal(history.stageMs.rankingDeadlineRound1Elapsed, 40)
	assert.equal(history.stageMs.rankingDeadlineRound1Pending, 1)
	const finalOnly = await combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
	)
	assert.deepEqual(
		result.rows,
		finalOnly.rows,
		"the late final must match the existing final-only behavior",
	)
	assert.deepEqual(result.metadata, finalOnly.metadata)
	assert.deepEqual(result.people, finalOnly.people)
	assert.deepEqual(result.reading, finalOnly.reading)
	assert.equal(result.mode, finalOnly.mode)
})

test("a late completion's history keeps the completed ranking's own stage timings, and the deadline's frozen snapshot under separate rankingDeadline names", async (t) => {
	await new Promise((resolve) => setImmediate(resolve))
	const query = "ranked staged ranking exact title"
	page(query, 1, { total_pages: 1, results: [{ ...fixture, title: query }] })
	t.mock.method(console, "error", () => {})
	probe.staged = null
	const before = {
		rankings: probe.rankings,
		rankHeld: probe.rankHeld,
		rankSettled: probe.rankSettled,
		history: probe.history.length,
	}
	const sleep = (ms: number) =>
		new Promise<void>((resolve) => setTimeout(resolve, ms))
	// Every wait below is bounded, and the gate opens by itself, so a missing early delivery fails instead of hanging.
	const within = <T>(promise: Promise<T>, ms: number) => {
		let timer: ReturnType<typeof setTimeout> | undefined
		return Promise.race([
			promise,
			new Promise<undefined>((resolve) => {
				timer = setTimeout(() => resolve(undefined), ms)
			}),
		]).finally(() => clearTimeout(timer))
	}
	let release = () => {}
	probe.rankGate = new Promise<void>((resolve) => {
		release = resolve
	})
	const safety = setTimeout(() => release(), 1200)
	let early = 0
	let finals = 0
	let seen = () => {}
	const firstEarly = new Promise<void>((resolve) => {
		seen = resolve
	})
	const search = combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
		undefined,
		{
			onProgress: () => {
				early++
				seen()
			},
			onComplete: () => {
				finals++
			},
		},
	)
	const held = { early: 0, rankHeld: 0, rankSettled: 0, final: 0, history: 0 }
	let deadline: Readonly<Record<string, number>> | undefined
	try {
		await within(firstEarly, 600)
		// The original ranking has started and is waiting at the gate, inside its round1 span.
		for (let i = 0; i < 60 && probe.rankHeld === before.rankHeld; i++)
			await sleep(10)
		// Well past the 40 ms deadline, so the completed round1 is far longer than the span the deadline froze.
		await sleep(150)
		await new Promise((resolve) => setImmediate(resolve))
		held.early = early
		held.rankHeld = probe.rankHeld - before.rankHeld
		held.rankSettled = probe.rankSettled - before.rankSettled
		held.final = finals
		held.history = probe.history.length - before.history
		deadline = stagedRanking()?.deadline
	} finally {
		clearTimeout(safety)
		release()
		probe.rankGate = null
	}
	const result = await within(
		search.catch(() => undefined),
		5000,
	)
	assert.deepEqual(
		held,
		{ early: 1, rankHeld: 1, rankSettled: 0, final: 0, history: 0 },
		"the deadline must pass while the one original ranking is still inside round1",
	)
	assert.ok(result, "the search did not complete after the ranking was released")
	assert.deepEqual(
		result.rows.map((row) => [row.key, row.lexical, row.score]),
		[["movie:42", 2, 3]],
	)
	const staged = stagedRanking()
	assert.ok(staged?.ranking && staged.completed && staged.deadlineCopy)
	// The deadline's snapshot is RankingProgress's own, taken while round1 was pending, and nothing changed it since.
	assert.ok(deadline, "the deadline passed without a snapshot")
	assert.equal(staged.deadline, deadline)
	assert.ok(Object.isFrozen(deadline))
	assert.deepEqual(
		deadline,
		staged.deadlineCopy,
		"late completion changed the captured timeout",
	)
	assert.deepEqual(Object.keys(deadline).sort(), [
		"round1Elapsed",
		"round1Pending",
	])
	assert.equal(deadline.round1Pending, 1)
	assert.ok(deadline.round1Elapsed >= 35)
	// The same original ranking completed, once, with the round1 time it observed across the gate.
	assert.equal(await staged.ranking, staged.completed)
	const completed = staged.completed.timings
	assert.ok(
		completed.round1 >= deadline.round1Elapsed + 50,
		"the completed round1 must be longer than the span frozen at the deadline",
	)
	// The same progress now reads the ended span: the frozen snapshot is a separate, earlier reading.
	const ended = staged.progress.snapshot()
	assert.equal(ended.round1Pending, undefined)
	assert.ok(ended.round1Elapsed >= deadline.round1Elapsed + 50)
	await new Promise((resolve) => setImmediate(resolve))
	assert.equal(probe.rankings - before.rankings, 1, "the search ranked twice")
	assert.equal(probe.rankSettled - before.rankSettled, 1)
	assert.equal(early, 1)
	assert.equal(finals, 1)
	assert.equal(probe.history.length - before.history, 1)
	const history = probe.history.at(-1)!
	assert.equal(history.outcome, "ready")
	assert.equal(history.rankerVersion, "fixture")
	assert.equal(history.rankerFallback, undefined)
	assert.equal(history.elapsedMs, result.elapsedMs)
	assert.equal(history.stageMs.completionFailed, undefined)
	assert.equal(history.stageMs.completionAborted, undefined)
	// Every ranking field of the row but the two walls: ranking<Name> holds the completed stages only, and the
	// deadline's snapshot keeps its values under rankingDeadline<Name>.
	const round1 = (ms: number) => Math.round(ms * 10) / 10
	assert.deepEqual(
		Object.fromEntries(
			Object.entries(history.stageMs)
				.filter(
					([name]) =>
						name.startsWith("ranking") &&
						name !== "ranking" &&
						name !== "rankingDeadlineElapsed",
				)
				.sort(([a], [b]) => a.localeCompare(b)),
		),
		{
			rankingDeadlineRound1Elapsed: deadline.round1Elapsed,
			rankingDeadlineRound1Pending: 1,
			rankingQdrant: 0,
			rankingQdrantServer: 0,
			rankingRound1: round1(completed.round1),
		},
		"the deadline's snapshot shares the completed ranking's stage names",
	)
	// The ranking's wall time is the whole completed ranking, the wait past the deadline included.
	assert.ok(history.stageMs.ranking >= round1(completed.round1))
	// The marker: how far the ranking was when the deadline passed, which is before it completed.
	assert.equal(typeof history.stageMs.rankingDeadlineElapsed, "number")
	assert.ok(
		history.stageMs.rankingDeadlineElapsed >= deadline.round1Elapsed - 1,
		"the deadline marker is earlier than the span it froze",
	)
	assert.ok(
		history.stageMs.rankingDeadlineElapsed + 50 <= history.stageMs.ranking,
		"the deadline marker must not be the completed ranking's wall time",
	)
})

test("a person leaving after an exact title arrived keeps the search and its place in line until the held paid reading returns its charge", async () => {
	await new Promise((resolve) => setImmediate(resolve))
	const query = "ranked held reading exact title abort"
	page(query, 1, { total_pages: 1, results: [{ ...fixture, title: query }] })
	// The route's own admission, entered and released as the route does: released when the search settles.
	const { createSearchAdmission } = await import(
		"../search-runtime/admission.server.ts"
	)
	const admission = createSearchAdmission({ limit: () => 1 })
	const release = admission.enter()
	assert.ok(release, "the search was not admitted")
	const before = {
		readings: probe.readings,
		readHeld: probe.readHeld,
		outcomes: probe.readOutcomes.length,
		rankings: probe.rankings,
		translations: probe.translations,
		history: probe.history.length,
	}
	const sleep = (ms: number) =>
		new Promise<void>((resolve) => setTimeout(resolve, ms))
	// Every wait below is bounded, and the gate opens by itself, so a missing early delivery fails instead of hanging.
	const within = <T>(promise: Promise<T>, ms: number) => {
		let timer: ReturnType<typeof setTimeout> | undefined
		return Promise.race([
			promise,
			new Promise<undefined>((resolve) => {
				timer = setTimeout(() => resolve(undefined), ms)
			}),
		]).finally(() => clearTimeout(timer))
	}
	let open = () => {}
	probe.readGate = new Promise<void>((resolve) => {
		open = resolve
	})
	const safety = setTimeout(() => open(), 1200)
	const controller = new AbortController()
	const early: import("./search.server.ts").SearchBatch[] = []
	let finals = 0
	let seen = () => {}
	const firstEarly = new Promise<void>((resolve) => {
		seen = resolve
	})
	let end: { error?: unknown } | undefined
	const settled = combinedSearch(
		query,
		policy,
		visitor,
		controller.signal,
		undefined,
		{
			onProgress: (batch) => {
				early.push(batch)
				seen()
			},
			onComplete: () => {
				finals++
			},
		},
	)
		.then(
			() => ({}),
			(error: unknown) => ({ error }),
		)
		.then((value) => {
			release()
			end = value
			return value
		})
	const held = {
		early: 0,
		readHeld: 0,
		outcomes: 0,
		settled: true,
		inFlight: 0,
		refused: false,
		final: 0,
		history: 0,
	}
	try {
		await within(firstEarly, 600)
		// The one original reading has been dispatched and is waiting at the gate.
		for (let i = 0; i < 60 && probe.readHeld === before.readHeld; i++)
			await sleep(10)
		await sleep(20)
		controller.abort()
		// Long enough for a search that rejected on the abort to free its place and queue its history row.
		await sleep(60)
		await new Promise((resolve) => setImmediate(resolve))
		held.early = early.length
		held.readHeld = probe.readHeld - before.readHeld
		held.outcomes = probe.readOutcomes.length - before.outcomes
		held.settled = end !== undefined
		held.inFlight = admission.inFlight()
		const second = admission.enter()
		held.refused = second === null
		second?.()
		held.final = finals
		held.history = probe.history.length - before.history
	} finally {
		clearTimeout(safety)
		open()
		probe.readGate = null
	}
	assert.ok(
		await within(settled, 5000),
		"the search did not settle after the reading returned",
	)
	assert.deepEqual(
		held,
		{
			early: 1,
			readHeld: 1,
			outcomes: 0,
			settled: false,
			inFlight: 1,
			refused: true,
			final: 0,
			history: 0,
		},
		"while the paid reading is held, the aborted search must stay unsettled, keep its place in line and write no row",
	)
	assert.equal(early[0].pendingRanking, true)
	assert.deepEqual(
		early[0].rows.map((row) => [row.key, row.lexical, row.match]),
		[["movie:42", 2, "Exact title"]],
	)
	assert.match(
		String((end?.error as Error | undefined)?.message),
		/Search interrupted/,
	)
	assert.equal(admission.inFlight(), 0, "the settled search kept its place")
	// Let the deferred history write run.
	await new Promise((resolve) => setImmediate(resolve))
	await sleep(20)
	await new Promise((resolve) => setImmediate(resolve))
	// What the stage returned for a reading aborted after dispatch: basic, cancelled, with the estimate charged.
	const outcomes = probe.readOutcomes.slice(before.outcomes)
	assert.deepEqual(
		outcomes.map(({ kind, reason, chargedNano }) => ({
			kind,
			reason,
			chargedNano,
		})),
		[{ kind: "basic", reason: "cancelled", chargedNano: 123 }],
	)
	assert.equal(probe.readings - before.readings, 1)
	assert.equal(probe.readHeld - before.readHeld, 1)
	assert.equal(probe.rankings - before.rankings, 0)
	assert.equal(probe.translations - before.translations, 0)
	assert.equal(finals, 0)
	assert.equal(early.length, 1)
	assert.equal(
		probe.history.length - before.history,
		1,
		"the served early batch is recorded exactly once",
	)
	const history = probe.history.at(-1)!
	assert.equal(history.chargedNano, outcomes[0].chargedNano)
	assert.equal(history.outcome, "basic")
	assert.equal(history.reason, "cancelled")
	assert.equal(history.stageMs.completionAborted, 1)
	assert.equal(history.stageMs.completionFailed, undefined)
	assert.ok(
		history.stageMs.firstResults + 30 <= history.elapsedMs,
		"first results must keep the early delivery's time, not the time the reading returned",
	)
})

test("a progress callback that rejects while the paid reading is held is kept until the reading returns: no early rejection, no delivery, no history", async () => {
	await new Promise((resolve) => setImmediate(resolve))
	const query = "ranked held reading exact title failed callback"
	page(query, 1, { total_pages: 1, results: [{ ...fixture, title: query }] })
	// The route's own admission, entered and released as the route does: released when the search settles.
	const { createSearchAdmission } = await import(
		"../search-runtime/admission.server.ts"
	)
	const admission = createSearchAdmission({ limit: () => 1 })
	const release = admission.enter()
	assert.ok(release, "the search was not admitted")
	const before = {
		readings: probe.readings,
		readHeld: probe.readHeld,
		outcomes: probe.readOutcomes.length,
		rankings: probe.rankings,
		translations: probe.translations,
		history: probe.history.length,
	}
	const sleep = (ms: number) =>
		new Promise<void>((resolve) => setTimeout(resolve, ms))
	// Every wait below is bounded, and the gate opens by itself, so a missing attempt fails instead of hanging.
	const within = <T>(promise: Promise<T>, ms: number) => {
		let timer: ReturnType<typeof setTimeout> | undefined
		return Promise.race([
			promise,
			new Promise<undefined>((resolve) => {
				timer = setTimeout(() => resolve(undefined), ms)
			}),
		]).finally(() => clearTimeout(timer))
	}
	let open = () => {}
	probe.readGate = new Promise<void>((resolve) => {
		open = resolve
	})
	const safety = setTimeout(() => open(), 1200)
	let offered = 0
	let finals = 0
	let seen = () => {}
	const firstOffer = new Promise<void>((resolve) => {
		seen = resolve
	})
	let end: { error?: unknown } | undefined
	const settled = combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
		undefined,
		{
			// The first batch never reaches the person: the consumer rejects it.
			onProgress: async () => {
				offered++
				seen()
				throw new Error("Progress consumer disconnected")
			},
			onComplete: () => {
				finals++
			},
		},
	)
		.then(
			() => ({}),
			(error: unknown) => ({ error }),
		)
		.then((value) => {
			release()
			end = value
			return value
		})
	const held = {
		offered: 0,
		readHeld: 0,
		outcomes: 0,
		settled: true,
		inFlight: 0,
		refused: false,
		final: 0,
		history: 0,
	}
	try {
		await within(firstOffer, 600)
		// The one original reading has been dispatched and is waiting at the gate.
		for (let i = 0; i < 60 && probe.readHeld === before.readHeld; i++)
			await sleep(10)
		// Long enough for a search that rejected on the failed callback to free its place.
		await sleep(60)
		await new Promise((resolve) => setImmediate(resolve))
		held.offered = offered
		held.readHeld = probe.readHeld - before.readHeld
		held.outcomes = probe.readOutcomes.length - before.outcomes
		held.settled = end !== undefined
		held.inFlight = admission.inFlight()
		const second = admission.enter()
		held.refused = second === null
		second?.()
		held.final = finals
		held.history = probe.history.length - before.history
	} finally {
		clearTimeout(safety)
		open()
		probe.readGate = null
	}
	assert.ok(
		await within(settled, 5000),
		"the search did not settle after the reading returned",
	)
	assert.deepEqual(
		held,
		{
			offered: 1,
			readHeld: 1,
			outcomes: 0,
			settled: false,
			inFlight: 1,
			refused: true,
			final: 0,
			history: 0,
		},
		"while the paid reading is held, the failed callback must not reject the search or free its place in line",
	)
	assert.match(
		String((end?.error as Error | undefined)?.message),
		/Progress consumer disconnected/,
	)
	assert.equal(admission.inFlight(), 0, "the settled search kept its place")
	// Let the deferred history write run, if one was queued.
	await new Promise((resolve) => setImmediate(resolve))
	await sleep(20)
	await new Promise((resolve) => setImmediate(resolve))
	// The reading was not aborted: the stage returned it, with its charge, before the search rejected.
	assert.deepEqual(
		probe.readOutcomes
			.slice(before.outcomes)
			.map(({ kind, chargedNano }) => ({ kind, chargedNano })),
		[{ kind: "ready", chargedNano: 123 }],
	)
	assert.equal(probe.readings - before.readings, 1)
	assert.equal(probe.readHeld - before.readHeld, 1)
	assert.ok(probe.rankings - before.rankings <= 1, "the search ranked twice")
	assert.equal(probe.translations - before.translations, 0)
	assert.equal(offered, 1, "a rejected early batch is not offered again")
	assert.equal(finals, 0)
	assert.deepEqual(
		probe.history.slice(before.history).map((row) => ({
			outcome: row.outcome,
			firstResults: row.stageMs.firstResults !== undefined,
		})),
		[],
		"a batch the consumer rejected recorded a delivery",
	)
})

// The late window: a search whose exact title reached the person, and whose ranking then missed its deadline.
// search.server.ts's cap, restated: no test below shortens it or sets a knob for it.
const LATE_COMPLETION_CAP_MS = 15_000
type Batch = import("./search.server.ts").SearchBatch
// The helpers keep the timers they were created with: the last test controls setTimeout.
const realSetTimeout = setTimeout
const realClearTimeout = clearTimeout
const pause = (ms: number) =>
	new Promise<void>((resolve) => realSetTimeout(resolve, ms))
// Every wait is bounded, and each test's gates open by themselves, so a missing step fails instead of hanging.
const settlesWithin = <T>(promise: Promise<T>, ms: number) => {
	let timer: ReturnType<typeof setTimeout> | undefined
	return Promise.race([
		promise,
		new Promise<undefined>((resolve) => {
			timer = realSetTimeout(() => resolve(undefined), ms)
		}),
	]).finally(() => realClearTimeout(timer))
}
const until = async (done: () => boolean, ms: number) => {
	for (let waited = 0; waited < ms && !done(); waited += 10) await pause(10)
}
const nextTurn = () => new Promise((resolve) => setImmediate(resolve))
function gate() {
	let open = () => {}
	let fail = (_reason: Error) => {}
	const promise = new Promise<void>((resolve, reject) => {
		open = resolve
		fail = reject
	})
	promise.catch(() => {})
	return { promise, open, fail }
}
const settlement = (work: Promise<unknown>) =>
	Promise.race([
		work.then(
			() => "settled" as const,
			() => "settled" as const,
		),
		new Promise<"pending">((resolve) =>
			setImmediate(() => resolve("pending")),
		),
	])
const counts = () => ({
	readings: probe.readings,
	rankings: probe.rankings,
	rankHeld: probe.rankHeld,
	rankSettled: probe.rankSettled,
	literals: probe.literals,
	history: probe.history.length,
	inFlight: searchAdmission.inFlight(),
})
const since = (before: ReturnType<typeof counts>) =>
	Object.fromEntries(
		Object.entries(counts()).map(([name, value]) => [
			name,
			value - before[name as keyof typeof before],
		]),
	)
/** A streaming search whose callbacks return nothing: each batch they receive reached the person. */
function streamedSearch(
	query: string,
	hooks: {
		onEarly?: () => void
		onFinal?: (batch: Batch) => void | Promise<void>
	} = {},
	// What the route passes besides the callbacks: allTitles when the person asked to search all titles.
	options: { allTitles?: boolean } = {},
	eligibility: Parameters<typeof combinedSearch>[1] = policy,
) {
	const startedAt = Date.now()
	const run = {
		early: [] as Batch[],
		// Measured from before the search began, so the search's own firstResults is never later than this.
		earlyAt: 0,
		finals: [] as Batch[],
		end: undefined as
			| { result?: Batch; error?: unknown; at: number }
			| undefined,
	}
	let seen = () => {}
	const firstEarly = new Promise<void>((resolve) => {
		seen = resolve
	})
	const settled = combinedSearch(
		query,
		eligibility,
		visitor,
		new AbortController().signal,
		undefined,
		{
			...options,
			onProgress: (batch) => {
				run.early.push(batch)
				run.earlyAt = Date.now() - startedAt
				hooks.onEarly?.()
				seen()
			},
			onComplete: async (batch) => {
				run.finals.push(batch)
				await hooks.onFinal?.(batch)
			},
		},
	).then(
		(result) => {
			run.end = { result, at: performance.now() }
		},
		(error: unknown) => {
			run.end = { error, at: performance.now() }
		},
	)
	return { run, firstEarly, settled }
}
const failure = (end: { error?: unknown } | undefined) =>
	String((end?.error as Error | undefined)?.message)

test("a declined early exact title does not open the late window: past the ranking deadline the basic search completes at once, with one reading and one ranking", async (t) => {
	await nextTurn()
	const query = "ranked late ranking declined early"
	page(query, 1, { total_pages: 1, results: [{ ...fixture, title: query }] })
	t.mock.method(console, "error", () => {})
	// The real admission still counts; the spy only records which work was held.
	const holds = t.mock.method(searchAdmission, "hold")
	const before = counts()
	const rank = gate()
	probe.rankGate = rank.promise
	const safety = realSetTimeout(() => rank.open(), 3000)
	const offered: Batch[] = []
	const finals: Batch[] = []
	const started = performance.now()
	const search = combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
		undefined,
		{
			// The consumer answers the early batch with an explicit false: it did not reach the person.
			onProgress: (batch) => {
				offered.push(batch)
				return false
			},
			onComplete: (batch) => {
				finals.push(batch)
			},
		},
	)
	let result: Batch | undefined
	let resolvedMs = 0
	let completed: Record<string, number> | undefined
	let drained: Record<string, number> | undefined
	try {
		result = await settlesWithin(
			search.catch(() => undefined),
			2000,
		)
		resolvedMs = performance.now() - started
		await nextTurn()
		await pause(20)
		await nextTurn()
		completed = {
			...since(before),
			offered: offered.length,
			finals: finals.length,
			holds: holds.mock.callCount(),
		}
		// The original ranking ends in the background and changes nothing.
		rank.open()
		await until(() => probe.rankSettled > before.rankSettled, 600)
		await pause(30)
		await nextTurn()
		drained = {
			...since(before),
			offered: offered.length,
			finals: finals.length,
			holds: holds.mock.callCount(),
		}
	} finally {
		realClearTimeout(safety)
		rank.open()
		probe.rankGate = null
		await pause(20)
	}
	assert.ok(result, "the search did not complete while its ranking was held")
	assert.ok(
		resolvedMs < 1000,
		`the basic search waited ${Math.round(resolvedMs)} ms for a ranking nobody was shown results for`,
	)
	assert.deepEqual(
		completed,
		{
			readings: 1,
			rankings: 1,
			rankHeld: 1,
			rankSettled: 0,
			literals: 2,
			history: 1,
			inFlight: 0,
			offered: 1,
			finals: 1,
			holds: 0,
		},
		"the basic search must complete while the one original ranking is still held",
	)
	assert.deepEqual(drained, { ...completed, rankSettled: 1 })
	assert.equal(offered[0].pendingRanking, true)
	assert.deepEqual(
		offered[0].rows.map((row) => [row.key, row.lexical]),
		[["movie:42", 2]],
	)
	assert.equal(finals[0], result)
	assert.equal(result.rows[0].key, "movie:42")
	assert.equal(result.pendingRanking, false)
	assert.equal(result.pendingTitleLookup, false)
	assert.equal(
		result.errors.filter((error) => error === "Showing basic search results")
			.length,
		1,
	)
	const history = probe.history.at(-1)!
	assert.equal(history.outcome, "basic")
	assert.equal(history.rankerFallback, "timeout")
	assert.equal(history.elapsedMs, result.elapsedMs)
	assert.equal(history.stageMs.completionFailed, undefined)
	assert.equal(history.stageMs.completionAborted, undefined)
	// The deadline's snapshot under the basic fallback's names; nothing of the late window.
	assert.equal(history.stageMs.rankingRound1Elapsed, 40)
	assert.equal(history.stageMs.rankingRound1Pending, 1)
	assert.ok(history.stageMs.failedRanking >= 35)
	assert.deepEqual(
		Object.keys(history.stageMs).filter(
			(name) => name.startsWith("rankingDeadline") || name === "lateCompletion",
		),
		[],
	)
	assert.ok(
		history.stageMs.firstResults >= result.elapsedMs,
		"the declined early batch counted as first results",
	)
})

test("a delivered exact title whose original ranking fails after the deadline: no basic search, no final, one history row with the charge, the completion flag and the deadline's snapshot", async (t) => {
	await nextTurn()
	const query = "ranked late ranking failing abort after"
	page(query, 1, { total_pages: 1, results: [{ ...fixture, title: query }] })
	t.mock.method(console, "error", () => {})
	const holds = t.mock.method(searchAdmission, "hold")
	const before = counts()
	const rank = gate()
	probe.rankGate = rank.promise
	const safety = realSetTimeout(() => rank.open(), 3000)
	const { run, firstEarly, settled } = streamedSearch(query)
	const snapshot = () => ({
		...since(before),
		early: run.early.length,
		finals: run.finals.length,
		settled: Number(run.end !== undefined),
		holds: holds.mock.callCount(),
	})
	let held: ReturnType<typeof snapshot> | undefined
	let failed: ReturnType<typeof snapshot> | undefined
	let failedAt = 0
	try {
		await settlesWithin(firstEarly, 600)
		// The original ranking has started and is waiting at the gate.
		await until(() => probe.rankHeld > before.rankHeld, 600)
		// Well past the ranking's 40 ms deadline.
		await pause(150)
		await nextTurn()
		held = snapshot()
		failedAt = performance.now()
		rank.fail(new Error("private late ranking failure"))
		await settlesWithin(settled, 2000)
		// Long enough for a second history row, a basic search or a final to show up.
		await nextTurn()
		await pause(60)
		await nextTurn()
		failed = snapshot()
	} finally {
		realClearTimeout(safety)
		rank.open()
		probe.rankGate = null
		await pause(20)
	}
	const waiting = {
		readings: 1,
		rankings: 1,
		rankHeld: 1,
		rankSettled: 0,
		literals: 0,
		history: 0,
		inFlight: 0,
		early: 1,
		finals: 0,
		settled: 0,
		holds: 0,
	}
	assert.deepEqual(
		held,
		waiting,
		"past the deadline the search must wait for its one original ranking",
	)
	assert.deepEqual(
		failed,
		{ ...waiting, history: 1, settled: 1 },
		"the failed late ranking must end the search once: no basic search, no final, no second ranking or row",
	)
	assert.ok(run.end && "error" in run.end, "the search resolved")
	assert.doesNotMatch(failure(run.end), /interrupted|did not complete/)
	assert.ok(
		run.end.at - failedAt < 1000,
		"the search kept waiting after its ranking failed",
	)
	assert.equal(run.early[0].pendingRanking, true)
	assert.deepEqual(
		run.early[0].rows.map((row) => [row.key, row.lexical]),
		[["movie:42", 2]],
	)
	const history = probe.history.at(-1)!
	assert.equal(history.chargedNano, 123)
	assert.equal(history.outcome, "ready")
	assert.equal(history.rankerFallback, "error")
	assert.equal(history.stageMs.completionFailed, 1)
	assert.equal(history.stageMs.completionAborted, undefined)
	assert.equal(history.stageMs.lateCompletion, undefined)
	assert.ok(history.stageMs.failedRanking >= 150)
	// The deadline's frozen snapshot, under its own names only.
	assert.equal(history.stageMs.rankingDeadlineRound1Elapsed, 40)
	assert.equal(history.stageMs.rankingDeadlineRound1Pending, 1)
	assert.equal(typeof history.stageMs.rankingDeadlineElapsed, "number")
	assert.equal(history.stageMs.rankingRound1Elapsed, undefined)
	assert.equal(history.stageMs.rankingRound1Pending, undefined)
	assert.ok(
		history.stageMs.firstResults <= run.earlyAt + 50,
		"first results must keep the early delivery's time",
	)
	assert.ok(history.stageMs.firstResults + 100 <= history.elapsedMs)
})

// Coverage boundary: this file replaces rankForServing, and the stub holds no place in line. That the real
// rankForServing holds the same original ranking exactly once is serve-deadline.test.ts ("a deadline exposes the same
// original pending ranking, ..."). Here: combinedSearch waits for that one ranking and adds no hold of its own for it.
test("a delivered exact title whose original ranking never ends rejects at the 15 s cap: no basic search, no final, one failed-completion row, and no second hold for the ranking", {
	timeout: 30_000,
}, async (t) => {
	await nextTurn()
	const query = "ranked late ranking never ending abort after"
	page(query, 1, { total_pages: 1, results: [{ ...fixture, title: query }] })
	t.mock.method(console, "error", () => {})
	const holds = t.mock.method(searchAdmission, "hold")
	const before = counts()
	const rank = gate()
	probe.rankGate = rank.promise
	const safety = realSetTimeout(
		() => rank.open(),
		LATE_COMPLETION_CAP_MS + 8000,
	)
	const { run, firstEarly, settled } = streamedSearch(query)
	const snapshot = () => ({
		...since(before),
		early: run.early.length,
		finals: run.finals.length,
		settled: Number(run.end !== undefined),
		holds: holds.mock.callCount(),
	})
	let heldAt = 0
	let waited: ReturnType<typeof snapshot> | undefined
	let capped: ReturnType<typeof snapshot> | undefined
	let drained: ReturnType<typeof snapshot> | undefined
	try {
		await settlesWithin(firstEarly, 600)
		// The original ranking has started and is waiting at the gate; its deadline passes 40 ms later.
		await until(() => probe.rankHeld > before.rankHeld, 600)
		heldAt = performance.now()
		await pause(1000)
		await nextTurn()
		waited = snapshot()
		await settlesWithin(settled, LATE_COMPLETION_CAP_MS + 3000)
		await nextTurn()
		await pause(60)
		await nextTurn()
		capped = snapshot()
		// Only now does the gate open: the same ranking ends in the background, once, and changes nothing.
		rank.open()
		await until(() => probe.rankSettled > before.rankSettled, 600)
		await pause(60)
		await nextTurn()
		drained = snapshot()
	} finally {
		realClearTimeout(safety)
		rank.open()
		probe.rankGate = null
		await pause(20)
	}
	const waiting = {
		readings: 1,
		rankings: 1,
		rankHeld: 1,
		rankSettled: 0,
		literals: 0,
		history: 0,
		inFlight: 0,
		early: 1,
		finals: 0,
		settled: 0,
		holds: 0,
	}
	assert.deepEqual(
		waited,
		waiting,
		"a second past the deadline the search must still wait for its one original ranking",
	)
	assert.deepEqual(
		capped,
		{ ...waiting, history: 1, settled: 1 },
		"the cap must end the search once, while the ranking is still held: no basic search, no final, no hold",
	)
	assert.deepEqual(drained, { ...waiting, history: 1, settled: 1, rankSettled: 1 })
	assert.ok(run.end && "error" in run.end, "the search resolved")
	assert.match(failure(run.end), /Search ranking did not complete/)
	// Wall time from the held ranking to the rejection: the deadline's 40 ms and the cap, less the poll that saw it.
	const wall = run.end.at - heldAt
	assert.ok(
		wall >= LATE_COMPLETION_CAP_MS - 50 && wall <= LATE_COMPLETION_CAP_MS + 1000,
		`the search rejected ${Math.round(wall)} ms after its ranking was held`,
	)
	const history = probe.history.at(-1)!
	assert.equal(history.chargedNano, 123)
	assert.equal(history.outcome, "ready")
	assert.equal(history.rankerFallback, "timeout")
	assert.equal(history.stageMs.completionFailed, 1)
	assert.equal(history.stageMs.completionAborted, undefined)
	assert.equal(history.stageMs.lateCompletion, undefined)
	assert.equal(history.stageMs.rankingDeadlineRound1Elapsed, 40)
	assert.equal(history.stageMs.rankingDeadlineRound1Pending, 1)
	assert.equal(history.stageMs.rankingRound1Elapsed, undefined)
	// The search's own clocks: from the miss to the rejection is the cap.
	const afterMiss =
		history.stageMs.failedRanking - history.stageMs.rankingDeadlineElapsed
	assert.ok(
		afterMiss >= LATE_COMPLETION_CAP_MS - 5 &&
			afterMiss <= LATE_COMPLETION_CAP_MS + 750,
		`the search waited ${afterMiss} ms after the miss`,
	)
	assert.ok(
		history.stageMs.firstResults <= run.earlyAt + 50,
		"first results must keep the early delivery's time",
	)
	assert.ok(history.elapsedMs >= LATE_COMPLETION_CAP_MS)
})

test("the 15 s cap covers the display, not only the ranking: a display stalled after the late ranking ended rejects the completion at the cap, and holds one real place in line until it ends", {
	timeout: 30_000,
}, async (t) => {
	await nextTurn()
	const query = "ranked late ranking stalled display abort after"
	page(query, 1, { total_pages: 1, results: [{ ...fixture, title: query }] })
	t.mock.method(console, "error", () => {})
	// The real admission still counts; the spy only records which work was held.
	const holds = t.mock.method(searchAdmission, "hold")
	const before = {
		...counts(),
		displays: probe.displays.length,
		metadata: probe.metadata.length,
		displayHeld: probe.displayHeld,
		displaySettled: probe.displaySettled,
		displayTimeouts: probe.displayTimeouts.length,
	}
	const rank = gate()
	const display = gate()
	probe.rankGate = rank.promise
	// Nothing is described before the ranking: the early batch's catalog rows do not pass this gate.
	probe.displayGate = display.promise
	const safety = realSetTimeout(() => {
		rank.open()
		display.open()
	}, LATE_COMPLETION_CAP_MS + 8000)
	const { run, firstEarly, settled } = streamedSearch(query)
	const snapshot = () => ({
		...since(before),
		displayHeld: probe.displayHeld - before.displayHeld,
		displaySettled: probe.displaySettled - before.displaySettled,
		early: run.early.length,
		finals: run.finals.length,
		settled: Number(run.end !== undefined),
		holds: holds.mock.callCount(),
	})
	let heldAt = 0
	let rankEndedAt = 0
	let missed: ReturnType<typeof snapshot> | undefined
	let stalled: ReturnType<typeof snapshot> | undefined
	let capped: ReturnType<typeof snapshot> | undefined
	let released: ReturnType<typeof snapshot> | undefined
	const heldWork = { atCap: "", afterRelease: "" }
	try {
		await settlesWithin(firstEarly, 600)
		// The original ranking has started and is waiting at the gate.
		await until(() => probe.rankHeld > before.rankHeld, 600)
		heldAt = performance.now()
		// Well past the ranking's 40 ms deadline.
		await pause(150)
		await nextTurn()
		missed = snapshot()
		// The same ranking ends late; its display starts and stalls.
		rank.open()
		await until(() => probe.displayHeld > before.displayHeld, 600)
		rankEndedAt = performance.now()
		await pause(1000)
		await nextTurn()
		stalled = snapshot()
		await settlesWithin(settled, LATE_COMPLETION_CAP_MS + 3000)
		await nextTurn()
		await pause(100)
		await nextTurn()
		capped = snapshot()
		const work = holds.mock.calls[0]?.arguments[0] as
			| Promise<unknown>
			| undefined
		if (work) heldWork.atCap = await settlement(work)
		// The stalled display ends only when its gate opens: the held work is that display, and its place returns then.
		display.open()
		await until(() => probe.displaySettled > before.displaySettled, 600)
		await pause(60)
		await nextTurn()
		released = snapshot()
		if (work) heldWork.afterRelease = await settlement(work)
	} finally {
		realClearTimeout(safety)
		rank.open()
		display.open()
		probe.rankGate = null
		probe.displayGate = null
		await pause(20)
	}
	const waiting = {
		readings: 1,
		rankings: 1,
		rankHeld: 1,
		rankSettled: 0,
		literals: 0,
		history: 0,
		inFlight: 0,
		displayHeld: 0,
		displaySettled: 0,
		early: 1,
		finals: 0,
		settled: 0,
		holds: 0,
	}
	assert.deepEqual(
		missed,
		waiting,
		"past the deadline the search must wait for its one original ranking",
	)
	assert.deepEqual(
		stalled,
		{ ...waiting, rankSettled: 1, displayHeld: 1 },
		"the late ranking ended and its display is pending: nothing is served, recorded or held yet",
	)
	assert.deepEqual(
		capped,
		{
			...waiting,
			rankSettled: 1,
			displayHeld: 1,
			history: 1,
			settled: 1,
			holds: 1,
			inFlight: 1,
		},
		"the cap must reject the completion while its display is unfinished, and that display holds one place in line",
	)
	assert.equal(heldWork.atCap, "pending", "the held work ended before the display")
	assert.deepEqual(
		released,
		{
			...waiting,
			rankSettled: 1,
			displayHeld: 1,
			displaySettled: 1,
			history: 1,
			settled: 1,
			holds: 1,
			inFlight: 0,
		},
		"the place in line returns once, when the stalled display ends: no final, no basic search, no second row",
	)
	assert.equal(heldWork.afterRelease, "settled")
	assert.ok(run.end && "error" in run.end, "the search resolved")
	assert.match(failure(run.end), /Search ranking did not complete/)
	// The cap counts from the miss, not from the ranking's late end: the ranking ended early in the window.
	assert.ok(rankEndedAt - heldAt < 1000)
	const wall = run.end.at - heldAt
	assert.ok(
		wall >= LATE_COMPLETION_CAP_MS - 50 && wall <= LATE_COMPLETION_CAP_MS + 1000,
		`the search rejected ${Math.round(wall)} ms after its ranking was held`,
	)
	// One original ranking, one display of its head, and the early batch's catalog read as before.
	assert.deepEqual(probe.displays.slice(before.displays), [["movie:42"]])
	assert.deepEqual(probe.metadata.slice(before.metadata), [["movie:42"]])
	assert.equal(run.early[0].pendingRanking, true)
	assert.deepEqual(
		run.early[0].rows.map((row) => [row.key, row.lexical, row.match]),
		[["movie:42", 2, "Exact title"]],
	)
	assert.deepEqual(
		run.early[0].metadata.map((m) => m.tmdb_id),
		[42],
	)
	// The display's own time limit, as the search passed it: its usual 2 s at most, within the window.
	const limits = probe.displayTimeouts.slice(before.displayTimeouts)
	assert.equal(limits.length, 1)
	assert.ok(
		typeof limits[0] === "number" && limits[0] > 0 && limits[0] <= 2000,
		`the display's time limit was ${limits[0]}`,
	)
	const history = probe.history.at(-1)!
	assert.equal(history.chargedNano, 123)
	assert.equal(history.outcome, "ready")
	assert.equal(history.rankerFallback, "timeout")
	assert.equal(history.stageMs.completionFailed, 1)
	assert.equal(history.stageMs.completionAborted, undefined)
	assert.equal(history.stageMs.lateCompletion, undefined)
	assert.equal(history.stageMs.rankingDeadlineRound1Elapsed, 40)
	assert.equal(history.stageMs.rankingDeadlineRound1Pending, 1)
	assert.equal(history.stageMs.rankingRound1Elapsed, undefined)
	const afterMiss =
		history.stageMs.failedRanking - history.stageMs.rankingDeadlineElapsed
	assert.ok(
		afterMiss >= LATE_COMPLETION_CAP_MS - 5 &&
			afterMiss <= LATE_COMPLETION_CAP_MS + 750,
		`the search waited ${afterMiss} ms after the miss`,
	)
	assert.ok(
		history.stageMs.firstResults <= run.earlyAt + 50,
		"first results must keep the early delivery's time",
	)
	assert.ok(history.elapsedMs >= LATE_COMPLETION_CAP_MS)
})

// The late window's last stage. The ranked list was built inside the window while the primary title lookup was still
// running; the lookup then answers, and the reblend first reads the catalog for its title (titleMatches, movie:42).
// That read is the stub's: it ignores the cap's signal, as a read past its abort point does. Only after it would the
// reblend describe the title. The cap is production's real 15 s.
test("a late reblend whose catalog read outlasts the 15 s cap rejects the completion at the cap, holds one real place in line until that read ends, and then starts no display, catalog read or ranking", {
	timeout: 30_000,
}, async (t) => {
	await nextTurn()
	const query = "ranked delayed primary late ranking stalled reblend abort after"
	// The catalog's exact title (movie:41) answers first; TMDB's own (movie:42) arrives after the ranked list was built.
	page(
		query,
		1,
		{ total_pages: 1, results: [{ ...fixture, title: query }] },
		800,
	)
	t.mock.method(console, "error", () => {})
	// The real admission still counts; the spy only records which work was held.
	const holds = t.mock.method(searchAdmission, "hold")
	const before = {
		...counts(),
		displays: probe.displays.length,
		metadata: probe.metadata.length,
		metadataHeld: probe.metadataHeld,
		metadataSettled: probe.metadataSettled,
	}
	const rank = gate()
	const catalog = gate()
	probe.rankGate = rank.promise
	// The early batch's catalog read (movie:41) does not pass this gate; the reblend's (movie:42) waits at it.
	probe.metadataGate = catalog.promise
	probe.heldMetadataKey = "movie:42"
	const safety = realSetTimeout(() => {
		rank.open()
		catalog.open()
	}, LATE_COMPLETION_CAP_MS + 8000)
	const { run, firstEarly, settled } = streamedSearch(query)
	const snapshot = () => ({
		...since(before),
		metadataHeld: probe.metadataHeld - before.metadataHeld,
		metadataSettled: probe.metadataSettled - before.metadataSettled,
		displays: probe.displays.length - before.displays,
		catalogReads: probe.metadata.length - before.metadata,
		finals: run.finals.length,
		settled: Number(run.end !== undefined),
		holds: holds.mock.callCount(),
	})
	let heldAt = 0
	let stalled: ReturnType<typeof snapshot> | undefined
	let capped: ReturnType<typeof snapshot> | undefined
	let released: ReturnType<typeof snapshot> | undefined
	const heldWork = { atCap: "", afterRelease: "" }
	try {
		await settlesWithin(firstEarly, 1000)
		// The original ranking has started and is waiting at the gate; its deadline passes 40 ms later.
		await until(() => probe.rankHeld > before.rankHeld, 600)
		heldAt = performance.now()
		await pause(100)
		// The same ranking ends inside the window and its list is built; the reblend then waits for the lookup's title.
		rank.open()
		await until(() => probe.metadataHeld > before.metadataHeld, 3000)
		await nextTurn()
		stalled = snapshot()
		await settlesWithin(settled, LATE_COMPLETION_CAP_MS + 3000)
		await nextTurn()
		await pause(100)
		await nextTurn()
		capped = snapshot()
		const work = holds.mock.calls[0]?.arguments[0] as
			| Promise<unknown>
			| undefined
		if (work) heldWork.atCap = await settlement(work)
		// The catalog read ends only now, well after the window: the reblend resumes behind it.
		catalog.open()
		await until(() => probe.metadataSettled > before.metadataSettled, 600)
		// Long enough for a display, a catalog read or a ranking started after the read to be counted.
		await pause(100)
		await nextTurn()
		released = snapshot()
		if (work) heldWork.afterRelease = await settlement(work)
	} finally {
		realClearTimeout(safety)
		rank.open()
		catalog.open()
		probe.rankGate = null
		probe.metadataGate = null
		probe.heldMetadataKey = ""
		await pause(20)
	}
	const waiting = {
		readings: 1,
		rankings: 1,
		rankHeld: 1,
		rankSettled: 1,
		literals: 0,
		history: 0,
		inFlight: 0,
		metadataHeld: 1,
		metadataSettled: 0,
		// The ranked list's display of movie:41, and the two catalog reads: the early batch's and the reblend's.
		displays: 1,
		catalogReads: 2,
		finals: 0,
		settled: 0,
		holds: 0,
	}
	assert.deepEqual(
		stalled,
		waiting,
		"the late ranking ended, its list was built, and the reblend's catalog read is pending: nothing is final, recorded or held yet",
	)
	assert.deepEqual(
		capped,
		{ ...waiting, history: 1, settled: 1, holds: 1, inFlight: 1 },
		"the cap must reject the completion while the reblend's catalog read is unfinished, and that reblend holds one place in line",
	)
	assert.equal(
		heldWork.atCap,
		"pending",
		"the held work ended before the catalog read",
	)
	assert.deepEqual(
		released,
		{
			...waiting,
			metadataSettled: 1,
			history: 1,
			settled: 1,
			holds: 1,
			inFlight: 0,
		},
		"the place in line returns once, when the catalog read ends, and the reblend starts nothing after the window: no display, no catalog read, no ranking, no final",
	)
	assert.equal(heldWork.afterRelease, "settled")
	assert.deepEqual(probe.displays.slice(before.displays), [["movie:41"]])
	assert.deepEqual(probe.metadata.slice(before.metadata), [
		["movie:41"],
		["movie:42"],
	])
	assert.ok(run.end && "error" in run.end, "the search resolved")
	assert.match(failure(run.end), /Search ranking did not complete/)
	// Wall time from the held ranking to the rejection: the deadline's 40 ms and the cap, less the poll that saw it.
	const wall = run.end.at - heldAt
	assert.ok(
		wall >= LATE_COMPLETION_CAP_MS - 50 && wall <= LATE_COMPLETION_CAP_MS + 1000,
		`the search rejected ${Math.round(wall)} ms after its ranking was held`,
	)
	assert.ok(run.early.length >= 1, "the exact title was not delivered early")
	assert.equal(run.early[0].pendingRanking, true)
	assert.deepEqual(
		run.early[0].rows.map((row) => [row.key, row.lexical]),
		[["movie:41", 2]],
	)
	const history = probe.history.at(-1)!
	assert.equal(history.chargedNano, 123)
	assert.equal(history.outcome, "ready")
	// The ranking served inside the window: it is the completion that failed.
	assert.equal(history.rankerVersion, "fixture")
	assert.equal(history.rankerFallback, undefined)
	assert.equal(history.stageMs.completionFailed, 1)
	assert.equal(history.stageMs.completionAborted, undefined)
	assert.equal(history.stageMs.lateCompletion, undefined)
	assert.equal(history.stageMs.rankingDeadlineRound1Elapsed, 40)
	assert.equal(history.stageMs.rankingDeadlineRound1Pending, 1)
	assert.equal(typeof history.stageMs.titleCompletion, "number")
	assert.ok(history.elapsedMs >= LATE_COMPLETION_CAP_MS)
})

// Controlled clock: from the early delivery on, setTimeout is the test runner's, so the cap's timer is registered on
// it, with production's own delay. performance.now and Date stay real and prove nothing here. What this shows is the
// registration and the clearing of that one timer around the final's delivery; that the real 15 s timer rejects a
// search is the two tests above.
test("a built late final clears the cap's timer before its delivery is awaited: a delivery that outlasts the cap on a controlled clock is not a failed completion", {
	timeout: 20_000,
}, async (t) => {
	await nextTurn()
	const query = "ranked late ranking delayed delivery abort after"
	page(query, 1, { total_pages: 1, results: [{ ...fixture, title: query }] })
	t.mock.method(console, "error", () => {})
	const before = counts()
	const rank = gate()
	probe.rankGate = rank.promise
	const safety = realSetTimeout(() => rank.open(), 5000)
	const registered: { ms: unknown; handle: unknown; fired: boolean }[] = []
	const cleared: unknown[] = []
	const capTimers = () =>
		registered.filter((timer) => timer.ms === LATE_COMPLETION_CAP_MS)
	let restore: (() => void) | undefined
	const control = () => {
		t.mock.timers.enable({ apis: ["setTimeout"] })
		const fake = {
			setTimeout: globalThis.setTimeout,
			clearTimeout: globalThis.clearTimeout,
		}
		// Records each registration and each clear on the controlled clock; the timers themselves are the runner's.
		globalThis.setTimeout = ((
			run: (...args: unknown[]) => void,
			ms?: number,
			...args: unknown[]
		) => {
			const timer = { ms, handle: undefined as unknown, fired: false }
			timer.handle = fake.setTimeout(() => {
				timer.fired = true
				run(...args)
			}, ms)
			registered.push(timer)
			return timer.handle
		}) as unknown as typeof setTimeout
		globalThis.clearTimeout = ((handle: unknown) => {
			cleared.push(handle)
			fake.clearTimeout(handle as Parameters<typeof clearTimeout>[0])
		}) as typeof clearTimeout
		restore = () => {
			globalThis.setTimeout = fake.setTimeout
			globalThis.clearTimeout = fake.clearTimeout
			t.mock.timers.reset()
			globalThis.setTimeout = realSetTimeout
			globalThis.clearTimeout = realClearTimeout
		}
	}
	const delivery = {
		calls: 0,
		capCleared: false,
		capFiredBefore: true,
		capFiredDuring: true,
		rankSettled: 0,
	}
	const { run, firstEarly, settled } = streamedSearch(query, {
		onEarly: control,
		onFinal: async () => {
			const [cap] = capTimers()
			delivery.calls++
			delivery.capCleared = !!cap && cleared.includes(cap.handle)
			delivery.capFiredBefore = !cap || cap.fired
			delivery.rankSettled = probe.rankSettled - before.rankSettled
			// The controlled clock passes the cap while the final is still being delivered.
			if (restore) t.mock.timers.tick(2000)
			await pause(80)
			delivery.capFiredDuring = !cap || cap.fired
		},
	})
	const window = { capTimers: 0, capFired: true, settled: true, finals: -1 }
	let waited: Record<string, number> | undefined
	try {
		await settlesWithin(firstEarly, 600)
		// The original ranking has started and is waiting at the gate.
		await until(() => probe.rankHeld > before.rankHeld, 600)
		// The fixture's 40 ms deadline, on whichever clock it was registered; the miss registers the cap.
		if (restore) t.mock.timers.tick(40)
		await until(() => capTimers().length > 0, 600)
		// 14 s into the 15 s window on the controlled clock: the cap has not passed.
		if (restore) t.mock.timers.tick(LATE_COMPLETION_CAP_MS - 1000)
		await pause(30)
		await nextTurn()
		window.capTimers = capTimers().length
		window.capFired = capTimers().some((timer) => timer.fired)
		window.settled = run.end !== undefined
		window.finals = run.finals.length
		waited = since(before)
		rank.open()
		await settlesWithin(settled, 3000)
		await nextTurn()
		await pause(30)
		await nextTurn()
	} finally {
		realClearTimeout(safety)
		rank.open()
		probe.rankGate = null
		restore?.()
		await pause(20)
	}
	assert.equal(globalThis.setTimeout, realSetTimeout)
	assert.equal(run.early.length, 1, "the exact title was not delivered early")
	assert.deepEqual(
		window,
		{ capTimers: 1, capFired: false, settled: false, finals: 0 },
		"the miss must register the one 15 000 ms cap timer, and the search must wait inside the window",
	)
	assert.deepEqual(waited, {
		readings: 1,
		rankings: 1,
		rankHeld: 1,
		rankSettled: 0,
		literals: 0,
		history: 0,
		inFlight: 0,
	})
	assert.deepEqual(
		delivery,
		{
			calls: 1,
			capCleared: true,
			capFiredBefore: false,
			capFiredDuring: false,
			rankSettled: 1,
		},
		"the cap's timer must be cleared when the final is handed over, and must not fire during the delivery",
	)
	assert.equal(capTimers().length, 1, "the cap was registered again")
	assert.ok(
		run.end && "result" in run.end && run.end.result,
		`the delivered late final failed: ${failure(run.end)}`,
	)
	const result = run.end.result
	assert.equal(run.finals[0], result)
	assert.equal(result.pendingRanking, false)
	assert.deepEqual(result.errors, [])
	assert.deepEqual(
		result.rows.map((row) => [row.key, row.lexical, row.score]),
		[["movie:42", 2, 3]],
	)
	assert.deepEqual(since(before), {
		readings: 1,
		rankings: 1,
		rankHeld: 1,
		rankSettled: 1,
		literals: 0,
		history: 1,
		inFlight: 0,
	})
	const history = probe.history.at(-1)!
	assert.equal(history.chargedNano, 123)
	assert.equal(history.outcome, "ready")
	assert.equal(history.rankerVersion, "fixture")
	assert.equal(history.rankerFallback, undefined)
	assert.equal(history.elapsedMs, result.elapsedMs)
	assert.equal(history.stageMs.completionFailed, undefined)
	assert.equal(history.stageMs.completionAborted, undefined)
	assert.equal(history.stageMs.failedRanking, undefined)
	assert.equal(typeof history.stageMs.lateCompletion, "number")
	assert.equal(history.stageMs.rankingDeadlineRound1Elapsed, 40)
	assert.equal(history.stageMs.rankingDeadlineRound1Pending, 1)
	assert.ok(
		history.stageMs.firstResults <= run.earlyAt + 50,
		"first results must keep the early delivery's time, not the late final's",
	)
})

// The late display's two reads, each the search's own: the display fields (describeTitles) and the catalog rows of the
// ranked titles the lookup did not find (metadataFor, here movie:99). When one fails the completion fails at once; the
// other may still be running, and then holds one place in the real admission until it has ended.
const DISCOVERY = "movie:99"
/**
 * One streamed "sibling rejection" search whose ranking ends after its deadline, observed once the completion was
 * rejected and again once every gate has opened. `rejects` is the read that fails; `siblingHeld`, whether the read
 * beside it is still at its gate then.
 */
async function lateDisplayRejection(
	t: import("node:test").TestContext,
	query: string,
	rejects: "catalog" | "display",
	siblingHeld: boolean,
) {
	await nextTurn()
	page(query, 1, { total_pages: 1, results: [{ ...fixture, title: query }] })
	t.mock.method(console, "error", () => {})
	// The real admission still counts; the spy only records how often work was held.
	const holds = t.mock.method(searchAdmission, "hold")
	const before = {
		...counts(),
		displays: probe.displays.length,
		metadata: probe.metadata.length,
		displayHeld: probe.displayHeld,
		displaySettled: probe.displaySettled,
		metadataHeld: probe.metadataHeld,
		metadataSettled: probe.metadataSettled,
	}
	const rank = gate()
	const display = gate()
	const catalog = gate()
	probe.rankGate = rank.promise
	if (rejects === "catalog") {
		probe.failMetadataKey = DISCOVERY
		if (siblingHeld) probe.displayGate = display.promise
	} else {
		probe.displayGate = display.promise
		if (siblingHeld) {
			probe.metadataGate = catalog.promise
			probe.heldMetadataKey = DISCOVERY
		}
	}
	const safety = realSetTimeout(() => {
		rank.open()
		display.open()
		catalog.open()
	}, 4000)
	const { run, firstEarly, settled } = streamedSearch(query)
	const snapshot = () => ({
		...since(before),
		displayHeld: probe.displayHeld - before.displayHeld,
		displaySettled: probe.displaySettled - before.displaySettled,
		metadataHeld: probe.metadataHeld - before.metadataHeld,
		metadataSettled: probe.metadataSettled - before.metadataSettled,
		early: run.early.length,
		finals: run.finals.length,
		settled: Number(run.end !== undefined),
		holds: holds.mock.callCount(),
	})
	let rejected: ReturnType<typeof snapshot> | undefined
	let drained: ReturnType<typeof snapshot> | undefined
	try {
		await settlesWithin(firstEarly, 600)
		// The original ranking has started and is waiting at the gate.
		await until(() => probe.rankHeld > before.rankHeld, 600)
		// Past the ranking's 40 ms deadline: the late window is open when the ranking ends.
		await pause(100)
		rank.open()
		if (rejects === "display") {
			await until(() => probe.displayHeld > before.displayHeld, 600)
			if (siblingHeld)
				await until(() => probe.metadataHeld > before.metadataHeld, 600)
			display.fail(new Error("Display completion failed"))
		}
		await settlesWithin(settled, 1500)
		// Long enough for the deferred history row, and for a second one, a basic search or a final to show up.
		await nextTurn()
		await pause(30)
		await nextTurn()
		rejected = snapshot()
		display.open()
		catalog.open()
		await pause(30)
		await nextTurn()
		drained = snapshot()
	} finally {
		realClearTimeout(safety)
		rank.open()
		display.open()
		catalog.open()
		probe.rankGate = null
		probe.displayGate = null
		probe.metadataGate = null
		probe.heldMetadataKey = ""
		probe.failMetadataKey = ""
		await pause(20)
	}
	return {
		run,
		rejected,
		drained,
		displays: probe.displays.slice(before.displays),
		metadata: probe.metadata.slice(before.metadata),
		history: probe.history.slice(before.history),
	}
}
// The search after its late completion was rejected: one reading, the one original ranking ended, no basic search, no
// final, and the delivered early batch recorded once.
const lateRejection = {
	readings: 1,
	rankings: 1,
	rankHeld: 1,
	rankSettled: 1,
	literals: 0,
	history: 1,
	early: 1,
	finals: 0,
	settled: 1,
}
function assertRejectedOnce(
	outcome: Awaited<ReturnType<typeof lateDisplayRejection>>,
	query: string,
	chargedNano: number,
) {
	const { run, history } = outcome
	assert.equal(run.early[0].q, query)
	assert.equal(run.early[0].pendingRanking, true)
	assert.deepEqual(
		run.early[0].rows.map((row) => [row.key, row.lexical]),
		[["movie:42", 2]],
	)
	// One display of the ranked head, the lookup's title and the ranked discovery together: nothing was read again.
	assert.deepEqual(outcome.displays, [["movie:42", DISCOVERY]])
	assert.equal(history.length, 1)
	assert.equal(history[0].chargedNano, chargedNano)
	assert.equal(history[0].outcome, "ready")
	assert.equal(history[0].rankerFallback, "error")
	assert.equal(history[0].stageMs.completionFailed, 1)
	assert.equal(history[0].stageMs.completionAborted, undefined)
	assert.equal(history[0].stageMs.lateCompletion, undefined)
	assert.equal(history[0].stageMs.rankingDeadlineRound1Elapsed, 40)
	assert.equal(history[0].stageMs.rankingDeadlineRound1Pending, 1)
	assert.ok(
		history[0].stageMs.firstResults <= run.earlyAt + 50,
		"first results must keep the early delivery's time",
	)
}

test("a late catalog read that fails while the display fields are still being read rejects the completion at once, and the unfinished display holds one real place in line until it ends", async (t) => {
	const query = "ranked late ranking sibling rejection"
	const outcome = await lateDisplayRejection(t, query, "catalog", true)
	assert.ok(
		outcome.run.end && "error" in outcome.run.end,
		"the catalog's refusal should reject the completion",
	)
	assert.match(failure(outcome.run.end), /Catalog completion failed/)
	assert.deepEqual(
		outcome.rejected,
		{
			...lateRejection,
			displayHeld: 1,
			displaySettled: 0,
			metadataHeld: 0,
			metadataSettled: 0,
			holds: 1,
			inFlight: 1,
		},
		"the display read still running when the catalog read failed lost its place in line",
	)
	assert.deepEqual(
		outcome.drained,
		{ ...outcome.rejected, displaySettled: 1, inFlight: 0 },
		"the place in line returns once, when the display has ended: no second hold, row, ranking or final",
	)
	// The early batch's catalog read only: the failed read of the ranked discovery is not repeated.
	assert.deepEqual(outcome.metadata, [["movie:42"]])
	assertRejectedOnce(outcome, query, 0)
})

test("late display fields that fail while the catalog read is still running reject the completion at once, and the unfinished catalog read holds one real place in line until it ends", async (t) => {
	const query = "ranked late ranking sibling rejection of display abort after"
	const outcome = await lateDisplayRejection(t, query, "display", true)
	assert.ok(
		outcome.run.end && "error" in outcome.run.end,
		"the failed display should reject the completion",
	)
	assert.match(failure(outcome.run.end), /Display completion failed/)
	assert.deepEqual(
		outcome.rejected,
		{
			...lateRejection,
			displayHeld: 1,
			displaySettled: 0,
			metadataHeld: 1,
			metadataSettled: 0,
			holds: 1,
			inFlight: 1,
		},
		"the catalog read still running when the display failed lost its place in line",
	)
	assert.deepEqual(
		outcome.drained,
		{ ...outcome.rejected, metadataSettled: 1, inFlight: 0 },
		"the place in line returns once, when the catalog read has ended: no second hold, row, ranking or final",
	)
	assert.deepEqual(outcome.metadata, [["movie:42"], [DISCOVERY]])
	assertRejectedOnce(outcome, query, 123)
})

test("a late catalog read that fails after the display fields were read holds no place in line: both reads have ended", async (t) => {
	const query = "ranked late ranking sibling rejection both ended"
	const outcome = await lateDisplayRejection(t, query, "catalog", false)
	assert.ok(
		outcome.run.end && "error" in outcome.run.end,
		"the catalog's refusal should reject the completion",
	)
	assert.match(failure(outcome.run.end), /Catalog completion failed/)
	assert.deepEqual(
		outcome.rejected,
		{
			...lateRejection,
			displayHeld: 0,
			displaySettled: 0,
			metadataHeld: 0,
			metadataSettled: 0,
			holds: 0,
			inFlight: 0,
		},
		"a completion whose reads had all ended held a place in line",
	)
	assert.deepEqual(outcome.drained, outcome.rejected)
	assert.deepEqual(outcome.metadata, [["movie:42"]])
	assertRejectedOnce(outcome, query, 0)
})

// People-only early batches: the query names a person exactly (the people step's own reading, through peopleToShow),
// the title lookup has no row, and the one original ranking is held. The people are offered early whichever titles the
// search covers: with allTitles (the route passes it when the request asks for it, from the search page or from
// Discover) as without it, since both pages show a batch's people above its titles.
const namedPerson = {
	id: 7001,
	name: "Fixture Person",
	popularity: 9,
	profile: null,
	department: "Acting",
}
const shownPerson = {
	id: 7001,
	name: "Fixture Person",
	department: "Acting",
	profile: null,
	knownFor: [],
}
/**
 * One streamed search of a query that names namedPerson, observed while its original ranking is held and again once it
 * has settled. The final's delivery takes 50 ms, so a first-results time taken at the final is later than elapsedMs.
 */
async function namedPersonSearch(
	query: string,
	results: object[],
	options: { allTitles?: boolean },
) {
	await nextTurn()
	page(query, 1, { total_pages: 1, results })
	probe.people[query] = { named: [namedPerson], offered: [], scope: null }
	const reads = probe.peopleReads.length
	const before = counts()
	const rank = gate()
	probe.rankGate = rank.promise
	const safety = realSetTimeout(() => rank.open(), 1200)
	try {
		const { run, settled } = streamedSearch(
			query,
			{ onFinal: () => pause(50) },
			options,
		)
		const snapshot = () => ({
			...since(before),
			early: run.early.length,
			finals: run.finals.length,
			settled: Number(run.end !== undefined),
		})
		let held: ReturnType<typeof snapshot> | undefined
		try {
			// The original ranking has started and is waiting at the gate.
			await until(() => probe.rankHeld > before.rankHeld, 600)
			// Long enough for an early batch to be offered and counted.
			await pause(60)
			await nextTurn()
			held = snapshot()
		} finally {
			realClearTimeout(safety)
			rank.open()
			probe.rankGate = null
		}
		await settlesWithin(settled, 5000)
		// Let the deferred history write run.
		await nextTurn()
		await pause(20)
		await nextTurn()
		const done = snapshot()
		const peopleReads = probe.peopleReads.slice(reads)
		const history = probe.history.slice(before.history)
		const finalOnly = await combinedSearch(
			query,
			policy,
			visitor,
			new AbortController().signal,
			undefined,
			options,
		)
		return { run, held, done, peopleReads, history, finalOnly }
	} finally {
		realClearTimeout(safety)
		rank.open()
		probe.rankGate = null
		delete probe.people[query]
		await pause(20)
	}
}
const heldRanking = {
	readings: 1,
	rankings: 1,
	rankHeld: 1,
	rankSettled: 0,
	literals: 0,
	history: 0,
	inFlight: 0,
	settled: 0,
}

test("the search page's search offers the people a query names, without a title row, as a pendingRanking batch while the original ranking is held, and counts it as first results", async () => {
	const query = "ranked held ranking named person"
	const { run, held, done, peopleReads, history, finalOnly } =
		await namedPersonSearch(query, [], {})
	assert.deepEqual(
		held,
		{ ...heldRanking, early: 1, finals: 0 },
		"the named person was not offered while the one original ranking was held",
	)
	const early = run.early[0]
	assert.equal(early.q, query)
	assert.equal(early.pendingRanking, true)
	assert.equal(early.pendingTitleLookup, false)
	assert.deepEqual(early.rows, [])
	assert.deepEqual(early.metadata, [])
	assert.deepEqual(early.people, [shownPerson])
	assert.equal(early.creditScope, null)
	// The early batch claims no interpretation and no basic search.
	assert.deepEqual(early.reading, [])
	assert.deepEqual(early.errors, [])
	assert.deepEqual(
		done,
		{ ...heldRanking, rankSettled: 1, history: 1, settled: 1, early: 1, finals: 1 },
		"the ranked final is not another provisional, and the search ranks and records once",
	)
	assert.ok(run.end?.result, `the search failed: ${failure(run.end)}`)
	const result = run.end.result
	assert.equal(run.finals[0], result)
	assert.equal(result.pendingRanking, false)
	assert.equal(result.pendingTitleLookup, false)
	assert.deepEqual(result.rows, [])
	assert.deepEqual(result.errors, [])
	// The people step's decision is the default one: names may narrow the search.
	assert.deepEqual(peopleReads, [{ q: query, narrow: true }])
	assert.deepEqual(result.people, [shownPerson])
	assert.equal(result.creditScope, null)
	assert.deepEqual(result.people, finalOnly.people)
	assert.equal(result.creditScope, finalOnly.creditScope)
	assert.deepEqual(result.rows, finalOnly.rows)
	assert.equal(history[0].outcome, "ready")
	assert.equal(history[0].elapsedMs, result.elapsedMs)
	assert.equal(history[0].stageMs.completionFailed, undefined)
	assert.equal(history[0].stageMs.completionAborted, undefined)
	assert.ok(
		history[0].stageMs.firstResults <= run.earlyAt + 50,
		"first results must keep the early delivery's time",
	)
	assert.ok(
		history[0].stageMs.firstResults + 30 <= result.elapsedMs,
		"first results must keep the early delivery's time, not the final's",
	)
})

test("a search of all titles (allTitles) is offered the people a query names too, without a title row, as a pendingRanking batch while the original ranking is held, and counts it as first results", async () => {
	const query = "ranked held ranking named person all titles"
	const { run, held, done, peopleReads, history, finalOnly } =
		await namedPersonSearch(query, [], { allTitles: true })
	assert.deepEqual(
		held,
		{ ...heldRanking, early: 1, finals: 0 },
		"the named person was not offered while the one original ranking was held",
	)
	const early = run.early[0]
	assert.equal(early.q, query)
	assert.equal(early.pendingRanking, true)
	assert.equal(early.pendingTitleLookup, false)
	assert.deepEqual(early.rows, [])
	assert.deepEqual(early.metadata, [])
	assert.deepEqual(early.people, [shownPerson])
	assert.equal(early.creditScope, null)
	// The early batch claims no interpretation and no basic search.
	assert.deepEqual(early.reading, [])
	assert.deepEqual(early.errors, [])
	assert.deepEqual(
		done,
		{ ...heldRanking, rankSettled: 1, history: 1, settled: 1, early: 1, finals: 1 },
		"the ranked final is not another provisional, and the search ranks and records once",
	)
	assert.ok(run.end?.result, `the search failed: ${failure(run.end)}`)
	const result = run.end.result
	assert.equal(run.finals[0], result)
	assert.equal(result.pendingRanking, false)
	assert.equal(result.pendingTitleLookup, false)
	assert.deepEqual(result.rows, [])
	assert.deepEqual(result.errors, [])
	// The people step's decision is unchanged: allTitles never narrows, and it is read once.
	assert.deepEqual(peopleReads, [{ q: query, narrow: false }])
	assert.deepEqual(result.people, [shownPerson])
	assert.equal(result.creditScope, null)
	assert.deepEqual(result.people, finalOnly.people)
	assert.equal(result.creditScope, finalOnly.creditScope)
	assert.deepEqual(result.rows, finalOnly.rows)
	assert.equal(history[0].outcome, "ready")
	assert.equal(history[0].elapsedMs, result.elapsedMs)
	assert.equal(history[0].stageMs.completionFailed, undefined)
	assert.equal(history[0].stageMs.completionAborted, undefined)
	assert.ok(
		history[0].stageMs.firstResults <= run.earlyAt + 50,
		"first results must keep the early delivery's time",
	)
	assert.ok(
		history[0].stageMs.firstResults + 30 <= result.elapsedMs,
		"first results must keep the early delivery's time, not the final's",
	)
})

// The other provisional batch, sent once the ranking is done while the title lookup still runs: TMDB's first page is
// really delayed, the catalog's exact titles answer first (none here), and the ranking is not held. Both batches carry
// the named people without a title row; the final follows the lookup.
test("a search of all titles whose title lookup is still running is offered the named people without a title row before and after its ranking, then the unchanged final", async () => {
	await nextTurn()
	const query = "ranked delayed lookup named person all titles"
	page(
		query,
		1,
		{ total_pages: 1, results: [{ ...fixture, title: query }] },
		500,
	)
	probe.people[query] = { named: [namedPerson], offered: [], scope: null }
	const reads = probe.peopleReads.length
	const before = { ...counts(), displays: probe.displays.length }
	try {
		const { run, settled } = streamedSearch(
			query,
			{ onFinal: () => pause(50) },
			{ allTitles: true },
		)
		await settlesWithin(settled, 5000)
		// Let the deferred history write run.
		await nextTurn()
		await pause(20)
		await nextTurn()
		assert.ok(run.end?.result, `the search failed: ${failure(run.end)}`)
		const result = run.end.result
		assert.deepEqual(
			run.early.map((batch) => ({
				pendingTitleLookup: batch.pendingTitleLookup,
				pendingRanking: batch.pendingRanking,
				rows: batch.rows.length,
				people: batch.people,
			})),
			[
				{
					pendingTitleLookup: true,
					pendingRanking: true,
					rows: 0,
					people: [shownPerson],
				},
				{
					pendingTitleLookup: true,
					pendingRanking: false,
					rows: 0,
					people: [shownPerson],
				},
			],
			"the named person was withheld from a provisional batch of a search of all titles",
		)
		assert.deepEqual(run.early[1].errors, [])
		assert.deepEqual(since(before), {
			readings: 1,
			rankings: 1,
			rankHeld: 0,
			rankSettled: 0,
			literals: 0,
			history: 1,
			inFlight: 0,
		})
		assert.equal(run.finals.length, 1)
		assert.equal(run.finals[0], result)
		assert.equal(result.pendingRanking, false)
		assert.equal(result.pendingTitleLookup, false)
		assert.deepEqual(
			result.rows.map((row) => [row.key, row.lexical, row.score]),
			[["movie:42", 2, 3]],
		)
		assert.deepEqual(result.errors, [])
		assert.deepEqual(result.people, [shownPerson])
		assert.equal(result.creditScope, null)
		assert.deepEqual(probe.peopleReads.slice(reads), [
			{ q: query, narrow: false },
		])
		// The one ranking is reblended with the lookup's title, not run again; only that title is described.
		assert.deepEqual(probe.displays.slice(before.displays), [["movie:42"]])
		const history = probe.history.at(-1)!
		assert.equal(history.outcome, "ready")
		assert.equal(history.rankerFallback, undefined)
		assert.equal(history.elapsedMs, result.elapsedMs)
		assert.equal(history.stageMs.completionFailed, undefined)
		assert.equal(history.stageMs.completionAborted, undefined)
		assert.ok(history.stageMs.titleCompletion > 100)
		assert.ok(
			history.stageMs.firstResults < 450,
			"first results waited for the title lookup",
		)
		assert.ok(
			history.stageMs.firstResults + 30 <= result.elapsedMs,
			"first results must keep the first delivery's time, not the final's",
		)
	} finally {
		delete probe.people[query]
	}
})

test("a search of all titles (allTitles) is offered a strong exact title together with the person the query names while the original ranking is held", async () => {
	const query = "ranked held ranking named person exact title"
	const { run, held, done, peopleReads, history, finalOnly } =
		await namedPersonSearch(query, [{ ...fixture, title: query }], {
			allTitles: true,
		})
	assert.deepEqual(
		held,
		{ ...heldRanking, early: 1, finals: 0 },
		"a strong exact title was not offered while the one original ranking was held",
	)
	const early = run.early[0]
	assert.equal(early.q, query)
	assert.equal(early.pendingRanking, true)
	assert.equal(early.pendingTitleLookup, false)
	assert.deepEqual(
		early.rows.map((row) => [row.key, row.lexical, row.match]),
		[["movie:42", 2, "Exact title"]],
	)
	assert.deepEqual(
		early.metadata.map((m) => m.tmdb_id),
		[42],
	)
	assert.deepEqual(early.people, [shownPerson])
	assert.equal(early.creditScope, null)
	assert.deepEqual(early.reading, [])
	assert.deepEqual(early.errors, [])
	assert.deepEqual(
		done,
		{ ...heldRanking, rankSettled: 1, history: 1, settled: 1, early: 1, finals: 1 },
		"the ranked final is not another provisional, and the search ranks and records once",
	)
	assert.ok(run.end?.result, `the search failed: ${failure(run.end)}`)
	const result = run.end.result
	assert.equal(run.finals[0], result)
	assert.equal(result.pendingRanking, false)
	assert.deepEqual(
		result.rows.map((row) => [row.key, row.lexical, row.score]),
		[["movie:42", 2, 3]],
	)
	assert.deepEqual(peopleReads, [{ q: query, narrow: false }])
	assert.deepEqual(result.people, [shownPerson])
	assert.equal(result.creditScope, null)
	assert.deepEqual(result.people, finalOnly.people)
	assert.deepEqual(result.rows, finalOnly.rows)
	assert.equal(history[0].outcome, "ready")
	assert.equal(history[0].elapsedMs, result.elapsedMs)
	assert.ok(
		history[0].stageMs.firstResults <= run.earlyAt + 50,
		"first results must keep the early delivery's time",
	)
	assert.ok(
		history[0].stageMs.firstResults + 30 <= result.elapsedMs,
		"first results must keep the early delivery's time, not the final's",
	)
})

// Which title matches the early batch may hold, each with the one original ranking held. The queries here carry no
// marker words, so every word of them is the person's: probe.forced gives them a ready reading and the held ranking.
/**
 * One streamed search of a query, observed while its original ranking is held and again once it has settled. The
 * final's delivery takes 50 ms, so a first-results time taken at the final is later than elapsedMs.
 */
async function heldRankingSearch(
	query: string,
	results: object[],
	eligibility: Parameters<typeof combinedSearch>[1] = policy,
) {
	await nextTurn()
	page(query, 1, { total_pages: 1, results })
	const forced = query.toLowerCase()
	probe.forced.add(forced)
	const before = counts()
	const rank = gate()
	probe.rankGate = rank.promise
	const safety = realSetTimeout(() => rank.open(), 1200)
	try {
		const { run, settled } = streamedSearch(
			query,
			{ onFinal: () => pause(50) },
			{},
			eligibility,
		)
		const snapshot = () => ({
			...since(before),
			early: run.early.length,
			finals: run.finals.length,
			settled: Number(run.end !== undefined),
		})
		let held: ReturnType<typeof snapshot> | undefined
		try {
			// The original ranking has started and is waiting at the gate.
			await until(() => probe.rankHeld > before.rankHeld, 600)
			// Long enough for an early batch to be offered and counted.
			await pause(60)
			await nextTurn()
			held = snapshot()
		} finally {
			realClearTimeout(safety)
			rank.open()
			probe.rankGate = null
		}
		await settlesWithin(settled, 5000)
		// Let the deferred history write run.
		await nextTurn()
		await pause(20)
		await nextTurn()
		return {
			run,
			held,
			done: snapshot(),
			history: probe.history.slice(before.history),
		}
	} finally {
		realClearTimeout(safety)
		rank.open()
		probe.rankGate = null
		probe.forced.delete(forced)
		await pause(20)
	}
}
const matrix = { id: 603, title: "The Matrix", media_type: "movie", adult: false }
const completedOnce = {
	...heldRanking,
	rankSettled: 1,
	history: 1,
	settled: 1,
	finals: 1,
}

test('a search of stopwords alone is not shown a title it only occurs in before the ranking: "the" against "The Matrix" is no early batch and no first results', async () => {
	const { run, held, done, history } = await heldRankingSearch("the", [matrix])
	assert.deepEqual(
		held,
		{ ...heldRanking, early: 0, finals: 0 },
		'"The Matrix" was offered for "the" while the one original ranking was held',
	)
	assert.deepEqual(done, { ...completedOnce, early: 0 })
	assert.ok(run.end?.result, `the search failed: ${failure(run.end)}`)
	const result = run.end.result
	// The final is unchanged: the title is there, with the match titleMatch gives it.
	assert.deepEqual(
		result.rows.map((row) => [row.key, row.lexical, row.match]),
		[["movie:603", 1.05, "Exact phrase in title"]],
	)
	assert.equal(history[0].outcome, "ready")
	assert.ok(
		history[0].stageMs.firstResults >= result.elapsedMs + 45,
		"a stopword match counted as first results: they are the awaited final delivery",
	)
})

// "The!" reads as "the" (titleMatch and the stopword rule both drop punctuation). The mark is only there because the
// title lookup is cached by its text for ten minutes, and the test above already looked up "the".
test('a search of stopwords alone is still shown its exact title before the ranking: the title "The" for "the", without "The Matrix"', async () => {
	const { run, held, done, history } = await heldRankingSearch("The!", [
		{ ...matrix, popularity: 90 },
		{ id: 604, title: "The", media_type: "movie", adult: false },
	])
	assert.deepEqual(
		held,
		{ ...heldRanking, early: 1, finals: 0 },
		'the exact title "The" was not offered while the one original ranking was held',
	)
	assert.equal(run.early[0].pendingRanking, true)
	assert.deepEqual(
		run.early[0].rows.map((row) => [row.key, row.lexical, row.match]),
		[["movie:604", 2, "Exact title"]],
	)
	assert.deepEqual(
		run.early[0].metadata.map((m) => m.tmdb_id),
		[604],
	)
	assert.deepEqual(done, { ...completedOnce, early: 1 })
	assert.ok(run.end?.result, `the search failed: ${failure(run.end)}`)
	const result = run.end.result
	assert.deepEqual(
		result.rows.map((row) => [row.key, row.lexical]).sort(),
		[
			["movie:603", 1.05],
			["movie:604", 2],
		],
	)
	assert.ok(
		history[0].stageMs.firstResults + 30 <= result.elapsedMs,
		"first results must keep the early delivery's time, not the final's",
	)
})

test('a single content word keeps its strong title match before the ranking: "matrix" is shown "The Matrix"', async () => {
	const { run, held, done, history } = await heldRankingSearch("matrix", [
		matrix,
	])
	assert.deepEqual(held, { ...heldRanking, early: 1, finals: 0 })
	assert.deepEqual(
		run.early[0].rows.map((row) => [row.key, row.lexical, row.match]),
		[["movie:603", 1.05, "Exact phrase in title"]],
	)
	assert.deepEqual(done, { ...completedOnce, early: 1 })
	assert.ok(run.end?.result, `the search failed: ${failure(run.end)}`)
	assert.ok(
		history[0].stageMs.firstResults + 30 <= run.end.result.elapsedMs,
		"first results must keep the early delivery's time, not the final's",
	)
})

test("an exact original name is shown before the ranking with its native name", async () => {
	const { run, held, done } = await heldRankingSearch("Yerli başlık", [
		{
			id: 46,
			title: "Local title",
			original_title: "Yerli başlık",
			media_type: "movie",
			adult: false,
		},
	])
	assert.deepEqual(held, { ...heldRanking, early: 1, finals: 0 })
	assert.deepEqual(
		run.early[0].rows.map((row) => [
			row.key,
			row.title,
			row.original,
			row.lexical,
			row.match,
		]),
		[
			[
				"movie:46",
				"Local title",
				"Yerli başlık",
				2,
				"Exact title (original name)",
			],
		],
	)
	assert.deepEqual(done, { ...completedOnce, early: 1 })
})

// What this shows: titleMatches asks the real allowsTitle before it reads the catalog, asks `eligible` for each row
// it read as a typed title (discovery false, the form that ignores votes and scores in catalog.server.ts), and the
// early batch keeps one row per IMDb title. What it does not show: catalog.server.ts's own `eligible`, which the stub
// replaces with the gate set here. The stubbed catalog rows have no poster, no score and no votes throughout.
test("the early batch holds only titles the filters allow and the catalog gate accepts, one row per IMDb title", async () => {
	const query = "ranked held ranking gated titles"
	const exact = (id: number) => ({ ...fixture, id, title: query })
	probe.imdb["movie:42"] = "tt0000042"
	probe.imdb["movie:45"] = "tt0000042"
	probe.ineligible.add("movie:44")
	probe.eligibility = []
	const metadata = probe.metadata.length
	try {
		const { run, held, done } = await heldRankingSearch(
			query,
			[exact(42), exact(43), exact(44), exact(45)],
			{
				...policy,
				// The server's own filter for a narrowed search: movie:43 is not among the titles.
				filters: { onlyTitles: ["movie:42", "movie:44", "movie:45"] },
			},
		)
		const asked = probe.eligibility ?? []
		assert.deepEqual(held, { ...heldRanking, early: 1, finals: 0 })
		assert.deepEqual(
			run.early[0].rows.map((row) => [row.key, row.lexical]),
			[["movie:42", 2]],
			"a forbidden, refused or repeated title reached the early batch",
		)
		assert.deepEqual(
			run.early[0].metadata.map((m) => m.tmdb_id),
			[42],
		)
		assert.deepEqual(
			probe.metadata.slice(metadata),
			[["movie:42", "movie:44", "movie:45"]],
			"the catalog was read for a title the filters forbid, or read again",
		)
		assert.deepEqual(
			asked.slice(0, 3),
			[
				{ key: "movie:42", discovery: false },
				{ key: "movie:44", discovery: false },
				{ key: "movie:45", discovery: false },
			],
			"the title lookup's rows were not checked as typed titles",
		)
		assert.ok(asked.every((call) => call.discovery === false))
		assert.deepEqual(done, { ...completedOnce, early: 1 })
		assert.ok(run.end?.result, `the search failed: ${failure(run.end)}`)
		// The final dedupes the same way, as before.
		assert.deepEqual(
			run.end.result.rows.map((row) => [row.key, row.lexical]),
			[["movie:42", 2]],
		)
	} finally {
		delete probe.imdb["movie:42"]
		delete probe.imdb["movie:45"]
		probe.ineligible.clear()
		probe.eligibility = null
	}
})
