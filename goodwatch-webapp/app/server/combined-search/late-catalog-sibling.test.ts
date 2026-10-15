// The late display's catalog read is two queries, one per table (catalog.server.ts's metadataFor). This file runs the
// production composition with the real catalog module: combinedSearch, rankedList, the late window, the search's own
// admission, and metadataFor down to its two HTTP requests. Only unrelated backends are replaced, as in
// title-lookup.test.ts. The catalog's HTTP is answered by a dispatcher in this process: each request stays open until
// the test answers it, and an aborted one ends through the handler's own error path. Nothing reaches a host.
import assert from "node:assert/strict"
import "node-crate"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { after, test } from "node:test"
import ts from "typescript"
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from "undici"
import "../title-filter/test-alias.ts"

const probe = {
	readings: 0,
	rankings: 0,
	// The ranking waits for it (see the serve stub): it misses its deadline after 40 ms, and the error carries the one
	// original ranking. That ranking lists the lookup's titles, then movie:99 and show:98, which the lookup did not find.
	rankGate: null as Promise<void> | null,
	rankHeld: 0,
	rankSettled: 0,
	displays: [] as string[][],
	history: [] as {
		outcome?: string
		rankerFallback?: string
		stageMs: Record<string, number>
	}[],
}
Object.assign(globalThis, { lateCatalogProbe: probe })

const stubs: Record<string, string> = {
	"/combined-search/reading-retrieval.server.ts": `export const attributeRequest=()=>({}); export const fingerprintRequest=()=>({}); export const describeTitles=async(_reading,rows)=>{globalThis.lateCatalogProbe.displays.push(rows.map(row=>row.key));return []}; export const readingFields=()=>({}); export const summarizeReading=()=>[];`,
	"/combined-search/language.server.ts": `export const prepareLanguage=async text=>({text,policy:{mode:'english'},chargedNano:0});`,
	"/search-runtime/runtime.server.ts": `export const BASIC_SEARCH_MESSAGE='Showing basic search results'; export const translationEnabled=()=>false; export const keepJevConnectionsWarm=()=>{}; export const runJevStage=async()=>{globalThis.lateCatalogProbe.readings++;return {kind:'ready',readings:{},chargedNano:0}}; export const recordSearchHistory=async entry=>{globalThis.lateCatalogProbe.history.push(entry);return {recorded:true,id:'test'}};`,
	"/search-ranking/serve.server.ts": `export class RankingDeadlineError extends Error{timings=Object.freeze({round1Elapsed:40,round1Pending:1});constructor(message,ranking){super(message);this.ranking=ranking}}; const rows=titles=>titles.map(t=>({id:1e12+t.id,mediaType:t.type==='tv'?'show':'movie',title:t.title,year:t.year,score:3})); export const rankForServing=async(_reading,request)=>{const probe=globalThis.lateCatalogProbe;probe.rankings++;const gate=probe.rankGate;const ranking=(async()=>{probe.rankHeld++;await gate;probe.rankSettled++;return {results:[...rows(request.titleLookup),{id:1e12+99,mediaType:'movie',title:'A ranked movie',year:'2000',score:1},{id:1e12+98,mediaType:'show',title:'A ranked show',year:'2001',score:1}],reblend:rows,rounds:[],timings:{},rankerVersion:'fixture'}})();ranking.catch(()=>{});await new Promise(resolve=>setTimeout(resolve,40));throw new RankingDeadlineError("private fixture failure",ranking)}; export const servingFallback=search=>search.hasReading?null:'basic search'; export const startSearchRanking=()=>{};`,
	"/search-ranking/rank-search.server.ts": `export const prepareSearch=async()=>({});`,
	"/search-runtime/limits.server.ts": `export const readingsConfigured=()=>false; export const searchInFlightLimit=()=>4;`,
	"/search-ranking/ranking.server.ts": `export const HEAD_LENGTH=50;`,
	"/search-ranking/search-filter.server.ts": `export const ELIGIBLE_VOTES=2000;`,
	"/search-people/people.server.ts": `export const readPeople=async()=>({named:[],offered:[],scope:null}); export const peopleToShow=async(_q,_reading,people)=>people; export const startPeopleIndex=()=>{};`,
	"/role.server.ts": `export const runsSearch=()=>false;`,
	"/command-palette.server.ts": `export const paletteLookupTitles=async()=>[];`,
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
		// The catalog module is the file itself, transpiled like the search: no export of it is replaced.
		if (
			url.endsWith("/combined-search/search.server.ts") ||
			url.endsWith("/combined-search/catalog.server.ts") ||
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
// The search's own admission, not a copy: the tests read the places it holds.
const { searchAdmission } = await import(
	"../search-runtime/admission.server.ts"
)

// A reserved name that never resolves; the dispatcher below answers it before any connection is tried.
const CATALOG = "http://catalog.invalid:4200"
const catalogEnv = {
	CRATE_HOSTS: process.env.CRATE_HOSTS,
	CRATE_PORT: process.env.CRATE_PORT,
}
process.env.CRATE_HOSTS = "catalog.invalid"
process.env.CRATE_PORT = "4200"
/** One of the catalog's HTTP requests: open until the test answers it, or until its own signal aborts it. */
interface CatalogRead {
	table: "movie" | "show"
	ids: number[]
	answered: boolean
	aborted: boolean
	/** Answers 200 with one catalog row per id asked for. */
	rows(): void
	/** Answers 503: searchStatement's own "Catalog unavailable". */
	refuse(): void
}
const answer = (read: CatalogRead) => read.rows()
const catalog = { reads: [] as CatalogRead[], script: answer }
// undici's fetch hands a dispatcher that is not a MockAgent the request body as an async iterable.
async function requestText(body: unknown) {
	if (typeof body === "string") return body
	if (body instanceof Uint8Array) return Buffer.from(body).toString()
	const chunks: Buffer[] = []
	for await (const chunk of body as AsyncIterable<Uint8Array>)
		chunks.push(Buffer.from(chunk))
	return Buffer.concat(chunks).toString()
}
const original = getGlobalDispatcher()
const agent = new MockAgent()
agent.disableNetConnect()
setGlobalDispatcher({
	dispatch(options, handler) {
		if (String(options.origin) !== CATALOG)
			return agent.dispatch(options, handler)
		const reply = (status: number, body?: object) => {
			if (read.answered || read.aborted) return
			read.answered = true
			handler.onHeaders?.(
				status,
				[],
				() => {},
				status === 200 ? "OK" : "Service Unavailable",
			)
			if (body) handler.onData?.(Buffer.from(JSON.stringify(body)))
			handler.onComplete?.([])
		}
		const read: CatalogRead = {
			table: "movie",
			ids: [],
			answered: false,
			aborted: false,
			rows: () =>
				reply(200, {
					cols: [
						"tmdb_id",
						"genres",
						"adult",
						"imdb_id",
						"goodwatch_overall_score_voting_count",
						"poster_path",
						"goodwatch_overall_score_normalized_percent",
						"media_type",
					],
					rows: read.ids.map((id) => [
						id,
						null,
						false,
						null,
						0,
						null,
						null,
						read.table,
					]),
					rowcount: read.ids.length,
				}),
			refuse: () => reply(503),
		}
		handler.onConnect?.((error) => {
			if (read.answered || read.aborted) return
			read.aborted = true
			handler.onError?.(error ?? new Error("Catalog request aborted"))
		})
		void requestText(options.body).then((text) => {
			const { stmt, args } = JSON.parse(text) as { stmt: string; args: number[] }
			read.table = / FROM show /.test(stmt) ? "show" : "movie"
			read.ids = args
			catalog.reads.push(read)
			catalog.script(read)
		})
		return true
	},
} as Parameters<typeof setGlobalDispatcher>[0])
after(async () => {
	for (const read of catalog.reads) read.rows()
	setGlobalDispatcher(original)
	await agent.close()
	for (const [name, value] of Object.entries(catalogEnv))
		if (value === undefined) delete process.env[name]
		else process.env[name] = value
})

function page(query: string, response: object) {
	agent
		.get("https://api.themoviedb.org")
		.intercept({
			path: (path) => {
				const url = new URL(path, "https://api.themoviedb.org")
				return (
					url.pathname === "/3/search/multi" &&
					url.searchParams.get("query") === query
				)
			},
		})
		.reply(200, response)
}
const policy = { includeAdult: false, lesserKnown: false, filters: {} }
const visitor = { accountId: null, networkIdentity: "test" }
type Batch = import("./search.server.ts").SearchBatch
const pause = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms))
// Every wait is bounded, and each test's gates open by themselves, so a missing step fails instead of hanging.
const settlesWithin = <T>(promise: Promise<T>, ms: number) => {
	let timer: ReturnType<typeof setTimeout> | undefined
	return Promise.race([
		promise,
		new Promise<undefined>((resolve) => {
			timer = setTimeout(() => resolve(undefined), ms)
		}),
	]).finally(() => clearTimeout(timer))
}
const until = async (done: () => boolean, ms: number) => {
	for (let waited = 0; waited < ms && !done(); waited += 10) await pause(10)
}
const nextTurn = () => new Promise((resolve) => setImmediate(resolve))
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
	displays: probe.displays.length,
	catalogReads: catalog.reads.length,
	history: probe.history.length,
	inFlight: searchAdmission.inFlight(),
})

const other = { movie: "show", show: "movie" } as const
/**
 * One streamed search whose ranking ends after its deadline, so its display runs in the late window. The display's
 * catalog read asks both tables (movie:99, show:98). Once both requests are open, the `rejects` table answers 503 and
 * the other stays open. Observed once the search was rejected, and again once the open request was answered.
 */
async function mixedRejection(
	t: import("node:test").TestContext,
	query: string,
	rejects: "movie" | "show",
) {
	await nextTurn()
	page(query, {
		total_pages: 1,
		results: [{ id: 42, title: query, media_type: "movie", adult: false }],
	})
	t.mock.method(console, "error", () => {})
	// The real admission still counts; the spy only records which work was held.
	const holds = t.mock.method(searchAdmission, "hold")
	const before = counts()
	let open = () => {}
	probe.rankGate = new Promise<void>((resolve) => {
		open = resolve
	})
	const late: { movie?: CatalogRead; show?: CatalogRead } = {}
	let refusedAt = 0
	// The early batch's read of the lookup's title is answered at once; the late display's two requests are kept.
	catalog.script = (read) => {
		if (!read.ids.includes(99) && !read.ids.includes(98)) return read.rows()
		late[read.table] = read
		if (!late.movie || !late.show) return
		refusedAt = performance.now()
		late[rejects]?.refuse()
	}
	const drain = () => {
		open()
		late.movie?.rows()
		late.show?.rows()
	}
	const safety = setTimeout(drain, 4000)
	const run = {
		early: [] as Batch[],
		finals: [] as Batch[],
		end: undefined as { result?: Batch; error?: unknown; at: number } | undefined,
	}
	let seen = () => {}
	const firstEarly = new Promise<void>((resolve) => {
		seen = resolve
	})
	const settled = combinedSearch(
		query,
		policy,
		visitor,
		new AbortController().signal,
		undefined,
		{
			onProgress: (batch) => {
				run.early.push(batch)
				seen()
			},
			onComplete: (batch) => {
				run.finals.push(batch)
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
	const snapshot = () => {
		const now = counts()
		const sibling = late[other[rejects]]
		return {
			...Object.fromEntries(
				Object.entries(now).map(([name, value]) => [
					name,
					value - before[name as keyof typeof before],
				]),
			),
			early: run.early.length,
			finals: run.finals.length,
			settled: Number(run.end !== undefined),
			holds: holds.mock.callCount(),
			siblingAnswered: Number(sibling?.answered ?? false),
			siblingAborted: Number(sibling?.aborted ?? false),
		}
	}
	let rejected: ReturnType<typeof snapshot> | undefined
	let drained: ReturnType<typeof snapshot> | undefined
	const heldWork = { atRejection: "", afterSibling: "" }
	try {
		await settlesWithin(firstEarly, 600)
		// The original ranking has started and is waiting at the gate.
		await until(() => probe.rankHeld > before.rankHeld, 600)
		// Past the ranking's 40 ms deadline: the late window is open when the ranking ends.
		await pause(100)
		open()
		// Both of the display's catalog requests are open; the script then refuses one.
		await until(() => !!late.movie && !!late.show, 600)
		await settlesWithin(settled, 1500)
		// Long enough for the deferred history row, and for a second one, a basic search or a final to show up.
		await nextTurn()
		await pause(30)
		await nextTurn()
		rejected = snapshot()
		const work = holds.mock.calls[0]?.arguments[0] as
			| Promise<unknown>
			| undefined
		if (work) heldWork.atRejection = await settlement(work)
		// The request beside the refused one ends only now.
		late[other[rejects]]?.rows()
		await pause(30)
		await nextTurn()
		drained = snapshot()
		if (work) heldWork.afterSibling = await settlement(work)
	} finally {
		clearTimeout(safety)
		drain()
		probe.rankGate = null
		catalog.script = answer
		await pause(20)
	}
	return {
		run,
		rejected,
		drained,
		heldWork,
		refusedAt,
		reads: catalog.reads
			.slice(before.catalogReads)
			.map((read) => `${read.table}:${read.ids.join(",")}`),
		history: probe.history.slice(before.history),
	}
}

for (const rejects of ["movie", "show"] as const) {
	const sibling = other[rejects]
	test(`a late catalog read whose ${rejects} query is refused while its ${sibling} query is still open rejects the completion at once with the catalog's own error, and the open ${sibling} query holds one real place in line until it ends`, async (t) => {
		const query = `ranked late catalog ${rejects} query refused`
		const outcome = await mixedRejection(t, query, rejects)
		const { run } = outcome
		// The early batch's read of movie:42, then the late display's one read: a request per table, and no other.
		assert.equal(outcome.reads[0], "movie:42")
		assert.deepEqual(outcome.reads.slice(1).sort(), ["movie:99", "show:98"])
		assert.ok(run.end && "error" in run.end, "the refused query should reject the completion")
		// searchStatement's own error for the refused query, unchanged on its way out.
		assert.equal((run.end.error as Error).message, "Catalog unavailable")
		assert.ok(
			run.end.at - outcome.refusedAt < 1000,
			"the completion waited for the query beside the refused one",
		)
		const rejected = {
			readings: 1,
			rankings: 1,
			rankHeld: 1,
			rankSettled: 1,
			displays: 1,
			catalogReads: 3,
			history: 1,
			early: 1,
			finals: 0,
			settled: 1,
			// The query beside the refused one: still open, neither answered nor aborted.
			siblingAnswered: 0,
			siblingAborted: 0,
			holds: 1,
			inFlight: 1,
		}
		assert.deepEqual(
			outcome.rejected,
			rejected,
			`the ${sibling} query still open when the ${rejects} query was refused lost its place in line`,
		)
		assert.equal(
			outcome.heldWork.atRejection,
			"pending",
			`the held work ended before the ${sibling} query`,
		)
		assert.deepEqual(
			outcome.drained,
			{ ...rejected, siblingAnswered: 1, inFlight: 0 },
			`the place in line returns once, when the ${sibling} query has ended: no second hold, row, ranking or final`,
		)
		assert.equal(outcome.heldWork.afterSibling, "settled")
		assert.equal(run.early[0].pendingRanking, true)
		assert.deepEqual(
			run.early[0].rows.map((row) => [row.key, row.lexical]),
			[["movie:42", 2]],
		)
		assert.deepEqual(probe.displays.at(-1), ["movie:42", "movie:99", "show:98"])
		assert.equal(outcome.history[0].outcome, "ready")
		assert.equal(outcome.history[0].rankerFallback, "error")
		assert.equal(outcome.history[0].stageMs.completionFailed, 1)
		assert.equal(outcome.history[0].stageMs.completionAborted, undefined)
	})
}
