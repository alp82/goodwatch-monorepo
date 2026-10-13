// The people step of a search runs beside its language step and reading (search.server.ts's shownPeople). This file
// runs the production composition with the real people module: combinedSearch, the search's own admission,
// people.server.ts's index, readPeople, peopleToShow, its credits and its known-for titles, down to the Crate client's
// HTTP requests (utils/crate.ts) and the catalog module's (catalog.server.ts). Only unrelated backends are replaced, as
// in late-catalog-sibling.test.ts. Crate is an HTTP server of this process on the loopback interface: each people
// request stays open until the test answers it. TMDB is answered by a mock dispatcher. Nothing leaves the process.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createServer, type ServerResponse } from "node:http"
import * as nodeModule from "node:module"
import type { AddressInfo } from "node:net"
import { dirname, resolve as resolvePath } from "node:path"
import { after, test } from "node:test"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import {
	Agent,
	MockAgent,
	getGlobalDispatcher,
	setGlobalDispatcher,
} from "undici"
import "../title-filter/test-alias.ts"

const probe = {
	// While set, the language step waits for it and then fails (see the language stub).
	languageGate: null as Promise<void> | null,
	readings: 0,
	history: [] as { outcome?: string; stageMs: Record<string, number> }[],
}
Object.assign(globalThis, { earlyPeopleProbe: probe })

const stubs: Record<string, string> = {
	"/combined-search/reading-retrieval.server.ts": `export const attributeRequest=()=>({}); export const fingerprintRequest=()=>({}); export const describeTitles=async()=>[]; export const readingFields=()=>({}); export const summarizeReading=()=>[];`,
	"/combined-search/language.server.ts": `export const prepareLanguage=async text=>{const gate=globalThis.earlyPeopleProbe.languageGate;if(gate){await gate;throw new Error('Language unavailable')}return {text,policy:{mode:'english'},chargedNano:0}};`,
	"/search-runtime/runtime.server.ts": `export const BASIC_SEARCH_MESSAGE='Showing basic search results'; export const translationEnabled=()=>false; export const keepJevConnectionsWarm=()=>{}; export const runJevStage=async()=>{globalThis.earlyPeopleProbe.readings++;return {kind:'basic',reason:'budget',chargedNano:0}}; export const recordSearchHistory=async entry=>{globalThis.earlyPeopleProbe.history.push(entry);return {recorded:true,id:'test'}};`,
	"/search-ranking/serve.server.ts": `export class RankingDeadlineError extends Error{}; export const rankForServing=async()=>{throw new Error('not ranked here')}; export const servingFallback=search=>search.hasReading?null:'basic search'; export const startSearchRanking=()=>{};`,
	"/search-ranking/rank-search.server.ts": `export const prepareSearch=async()=>({});`,
	"/search-runtime/limits.server.ts": `export const readingsConfigured=()=>false; export const searchInFlightLimit=()=>4;`,
	"/search-ranking/ranking.server.ts": `export const HEAD_LENGTH=50;`,
	"/search-ranking/search-filter.server.ts": `export const ELIGIBLE_VOTES=2000;`,
	"/command-palette.server.ts": `export const paletteLookupTitles=async()=>[];`,
}
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		resolve(
			specifier: string,
			context: { parentURL?: string; conditions?: string[] },
			next: (specifier: string, context: unknown) => unknown,
		): unknown
		load(
			url: string,
			context: unknown,
			next: (url: string, context: unknown) => unknown,
		): unknown
	}): void
}
registerHooks({
	// Registered after test-alias.ts, so it runs ahead of it. That hook answers a relative import of an existing file
	// with a file: URL, which require() does not resolve: node-crate's require('./connection-pool.js') failed on it.
	// A relative require inside node_modules goes on as the absolute path instead, which the alias passes through
	// and Node resolves itself. The app's own imports and every import statement keep the alias.
	resolve(specifier, context, next) {
		const parent = context.parentURL
		if (
			/^\.\.?(\/|$)/.test(specifier) &&
			parent?.startsWith("file:") &&
			parent.includes("/node_modules/") &&
			!context.conditions?.includes("import")
		)
			return next(resolvePath(dirname(fileURLToPath(parent)), specifier), context)
		return next(specifier, context)
	},
	load(url, context, next) {
		const stub = Object.entries(stubs).find(([suffix]) =>
			url.endsWith(suffix),
		)?.[1]
		if (stub !== undefined)
			return { format: "module", source: stub, shortCircuit: true }
		// The people module, its matching and the Crate client are the files themselves: none of them is listed above.
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

// The one person of the index, and the one leading role the catalog knows of that person.
const PERSON = {
	id: 7001,
	name: "Mira Oakhollow",
	department: "Acting",
	profile: null,
}
const KNOWN_FOR = {
	type: "movie",
	id: 550,
	title: "A known film",
	year: "1999",
	poster: "/known.jpg",
	backdrop: null,
}
type ReadKind = "index" | "credits" | "knownFor" | "other"
/** One of Crate's HTTP requests: open until the test answers it. */
interface CrateRead {
	kind: ReadKind
	table: string
	args: unknown[]
	answered: boolean
	/** Answers 200 with the fixture's rows for the statement's table. */
	rows(): void
}
const answer = (read: CrateRead) => read.rows()
const crate = { reads: [] as CrateRead[], script: answer }
const fixtureRows = (read: CrateRead): { cols: string[]; rows: unknown[][] } => {
	if (read.kind === "index")
		return {
			cols: ["tmdb_id", "name", "popularity", "profile_path", "known_for_department"],
			rows: [[PERSON.id, PERSON.name, 50, PERSON.profile, PERSON.department]],
		}
	if (read.table === "person_appeared_in")
		return {
			cols: ["media_tmdb_id", "media_type", "character", "order_default"],
			rows: [[KNOWN_FOR.id, "movie", "The lead", 0]],
		}
	if (read.kind === "knownFor" && read.table === "movie")
		return {
			cols: ["tmdb_id", "title", "release_year", "poster_path", "backdrop_path", "votes"],
			rows: [[KNOWN_FOR.id, KNOWN_FOR.title, 1999, KNOWN_FOR.poster, null, 9000]],
		}
	// The person has no crew credit, and every other statement (the basic search's) finds nothing.
	return { cols: [], rows: [] }
}
const server = createServer((request, response: ServerResponse) => {
	const chunks: Buffer[] = []
	request.on("data", (chunk: Buffer) => chunks.push(chunk))
	request.on("end", () => {
		const { stmt, args } = JSON.parse(Buffer.concat(chunks).toString()) as {
			stmt: string
			args?: unknown[]
		}
		const table = /\bFROM\s+(\w+)/i.exec(stmt)?.[1] ?? ""
		const read: CrateRead = {
			kind:
				table === "person"
					? "index"
					: table.startsWith("person_")
						? "credits"
						: stmt.includes("backdrop_path")
							? "knownFor"
							: "other",
			table,
			args: args ?? [],
			answered: false,
			rows() {
				if (read.answered) return
				read.answered = true
				const { cols, rows } = fixtureRows(read)
				response.writeHead(200, { "Content-Type": "application/json" })
				response.end(
					JSON.stringify({
						cols,
						// Crate's text type for every column: none is a timestamp.
						col_types: cols.map(() => 4),
						rows,
						rowcount: rows.length,
						duration: 1,
					}),
				)
			},
		}
		crate.reads.push(read)
		crate.script(read)
	})
})
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
const port = (server.address() as AddressInfo).port
const CRATE = `http://127.0.0.1:${port}`

const environment = {
	CRATE_HOSTS: process.env.CRATE_HOSTS,
	CRATE_PORT: process.env.CRATE_PORT,
	CRATE_USER: process.env.CRATE_USER,
	CRATE_PASS: process.env.CRATE_PASS,
	WEBAPP_ROLE: process.env.WEBAPP_ROLE,
}
process.env.CRATE_HOSTS = "127.0.0.1"
process.env.CRATE_PORT = String(port)
// Fixture values: the server above checks neither.
process.env.CRATE_USER = "fixture"
process.env.CRATE_PASS = "fixture"
// The search role loads the people index when the search module loads (see role.server.ts).
process.env.WEBAPP_ROLE = "both"

// The catalog module's requests go to the server above; everything else stays inside the mock, which answers TMDB.
const original = getGlobalDispatcher()
const agent = new MockAgent()
agent.disableNetConnect()
const loopback = new Agent()
setGlobalDispatcher({
	dispatch(options, handler) {
		return String(options.origin) === CRATE
			? loopback.dispatch(options, handler)
			: agent.dispatch(options, handler)
	},
} as Parameters<typeof setGlobalDispatcher>[0])

const restore = async () => {
	for (const read of crate.reads) read.rows()
	setGlobalDispatcher(original)
	for (const [name, value] of Object.entries(environment))
		if (value === undefined) delete process.env[name]
		else process.env[name] = value
	await agent.close()
	await loopback.close()
	server.closeAllConnections()
	await new Promise((resolve) => server.close(resolve))
}
const modules = async () => {
	const { combinedSearch } = await import("./search.server.ts")
	// The search's own admission, not a copy: the tests read the places it holds.
	const { searchAdmission } = await import(
		"../search-runtime/admission.server.ts"
	)
	// The same module instance the search imported: its index, credit cache and known-for cache.
	const { readPeople } = await import("../search-people/people.server.ts")
	return { combinedSearch, searchAdmission, readPeople }
}
// A module that fails to load leaves no test to run `after`: the server and the dispatchers are closed here, for at
// most two seconds, and the load's own failure is what the file reports.
const { combinedSearch, searchAdmission, readPeople } = await modules().catch(
	async (error: unknown) => {
		let timer: ReturnType<typeof setTimeout> | undefined
		await Promise.race([
			restore().catch(() => {}),
			new Promise<void>((resolve) => {
				timer = setTimeout(resolve, 2000)
			}),
		]).finally(() => clearTimeout(timer))
		throw error
	},
)

after(restore)

// The whole query is the person's name: the index names the person, no word is left to narrow by, and TMDB finds
// neither a title nor a person. The person shown is the index's, so the known-for titles come from the catalog.
const QUERY = PERSON.name
agent
	.get("https://api.themoviedb.org")
	.intercept({
		path: (path) => {
			const url = new URL(path, "https://api.themoviedb.org")
			return (
				url.pathname === "/3/search/multi" &&
				url.searchParams.get("query") === QUERY
			)
		},
	})
	.reply(200, { total_pages: 1, results: [] })
	.persist()

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
/** The people index is loaded: the real people step names the fixture's person in the query. */
async function indexReady() {
	let named = 0
	for (let waited = 0; waited < 3000 && !named; waited += 20) {
		named = (await readPeople(QUERY, false)).named.length
		if (!named) await pause(20)
	}
	assert.equal(named, 1, "the people index did not load from the fixture's Crate")
}
/** One streamed search that holds a place in line the way the route does: entered before, released when it settles. */
function streamedSearch() {
	const run = {
		early: [] as Batch[],
		finals: [] as Batch[],
		end: undefined as { result?: Batch; error?: unknown } | undefined,
	}
	const release = searchAdmission.enter()
	assert.ok(release, "the search should get a place in line")
	const settled = combinedSearch(
		QUERY,
		policy,
		visitor,
		new AbortController().signal,
		undefined,
		{
			onProgress: (batch) => {
				run.early.push(batch)
			},
			onComplete: (batch) => {
				run.finals.push(batch)
			},
		},
	)
		.then(
			(result) => {
				run.end = { result }
			},
			(error: unknown) => {
				run.end = { error }
			},
		)
		.finally(release)
	return { run, settled }
}
const peopleReads = (from: number) =>
	crate.reads
		.slice(from)
		.filter((read) => read.kind === "credits" || read.kind === "knownFor")

test("a search whose language step fails while its people step still reads the person's credits is rejected at once, and the people step holds one real place in line until its credits and its known-for read have ended", async (t) => {
	await indexReady()
	t.mock.method(console, "error", () => {})
	t.mock.method(console, "log", () => {})
	// The real admission still counts; the spy only records which work was held.
	const holds = t.mock.method(searchAdmission, "hold")
	const before = {
		reads: crate.reads.length,
		inFlight: searchAdmission.inFlight(),
		readings: probe.readings,
		history: probe.history.length,
	}
	let fail = () => {}
	probe.languageGate = new Promise<void>((resolve) => {
		fail = resolve
	})
	// The people step's requests are kept open; any other request is answered at once.
	crate.script = (read) => {
		if (read.kind !== "credits" && read.kind !== "knownFor") read.rows()
	}
	const drain = () => {
		fail()
		for (const read of crate.reads) read.rows()
	}
	const safety = setTimeout(drain, 6000)
	const { run, settled } = streamedSearch()
	const snapshot = () => ({
		settled: Number(run.end !== undefined),
		early: run.early.length,
		finals: run.finals.length,
		readings: probe.readings - before.readings,
		history: probe.history.length - before.history,
		holds: holds.mock.callCount(),
		inFlight: searchAdmission.inFlight() - before.inFlight,
		people: peopleReads(before.reads)
			.map((read) => `${read.table}:${read.answered ? "answered" : "open"}`)
			.sort(),
	})
	try {
		// The people step has started: both of the person's credit requests are open.
		await until(() => peopleReads(before.reads).length === 2, 2000)
		assert.deepEqual(
			snapshot(),
			{
				settled: 0,
				early: 0,
				finals: 0,
				readings: 0,
				history: 0,
				holds: 0,
				// The route's own place.
				inFlight: 1,
				people: ["person_appeared_in:open", "person_worked_on:open"],
			},
			"the people step should be reading the person's credits while the language step runs",
		)
		assert.deepEqual(
			peopleReads(before.reads).map((read) => read.args),
			[[PERSON.id], [PERSON.id]],
		)
		fail()
		await settlesWithin(settled, 1500)
		// Long enough for a deferred history row or a late early batch to show up.
		await nextTurn()
		await pause(30)
		await nextTurn()
		assert.ok(run.end && "error" in run.end, "the failed language step should reject the search")
		assert.equal((run.end.error as Error).message, "Language unavailable")
		const rejected = {
			settled: 1,
			early: 0,
			finals: 0,
			readings: 0,
			history: 0,
			holds: 1,
			// The route's place was returned when the search was rejected; this one is the people step's.
			inFlight: 1,
			people: ["person_appeared_in:open", "person_worked_on:open"],
		}
		assert.deepEqual(
			snapshot(),
			rejected,
			"the people step still reading the credits when the search was rejected lost its place in line",
		)
		const work = holds.mock.calls[0]?.arguments[0] as Promise<unknown>
		assert.equal(await settlement(work), "pending")
		// The credits arrive: the same people step goes on to its known-for read, and the place stays taken.
		for (const read of peopleReads(before.reads)) read.rows()
		await until(() => peopleReads(before.reads).length === 3, 2000)
		await nextTurn()
		assert.deepEqual(
			snapshot(),
			{
				...rejected,
				people: [
					"movie:open",
					"person_appeared_in:answered",
					"person_worked_on:answered",
				],
			},
			"the place in line was returned before the people step's known-for read had ended",
		)
		assert.deepEqual(peopleReads(before.reads)[2].args, [KNOWN_FOR.id])
		assert.equal(await settlement(work), "pending")
		for (const read of peopleReads(before.reads)) read.rows()
		await until(() => searchAdmission.inFlight() === before.inFlight, 2000)
		await nextTurn()
		assert.deepEqual(
			snapshot(),
			{
				...rejected,
				inFlight: 0,
				people: [
					"movie:answered",
					"person_appeared_in:answered",
					"person_worked_on:answered",
				],
			},
			"the place in line returns once, when the people step has ended: no second hold, read, batch or row",
		)
		assert.equal(await settlement(work), "settled")
	} finally {
		clearTimeout(safety)
		drain()
		probe.languageGate = null
		crate.script = answer
		await pause(20)
	}
})

test("the next search for the same person shows the known-for titles that held work loaded, reads no credits again and holds no place of its own", async (t) => {
	await indexReady()
	t.mock.method(console, "error", () => {})
	t.mock.method(console, "log", () => {})
	const holds = t.mock.method(searchAdmission, "hold")
	const before = {
		reads: crate.reads.length,
		inFlight: searchAdmission.inFlight(),
		history: probe.history.length,
	}
	const { run, settled } = streamedSearch()
	await settlesWithin(settled, 3000)
	await nextTurn()
	await pause(30)
	await nextTurn()
	assert.ok(run.end && "result" in run.end, "the search should complete")
	const shown = [{ ...PERSON, knownFor: [KNOWN_FOR] }]
	// An early batch carries the person alone: TMDB found no title. Whether one goes out before the final depends on
	// the basic search's own reads, so its count is not asserted.
	for (const batch of run.early) {
		assert.deepEqual(batch.rows, [])
		assert.deepEqual(batch.people, shown)
	}
	assert.equal(run.finals.length, 1)
	assert.deepEqual(run.finals[0].people, shown)
	assert.deepEqual(peopleReads(before.reads), [])
	assert.equal(holds.mock.callCount(), 0)
	assert.equal(searchAdmission.inFlight(), before.inFlight)
	assert.equal(probe.history.length - before.history, 1)
})
