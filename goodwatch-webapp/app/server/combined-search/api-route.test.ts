import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { after, test } from "node:test"
import ts from "typescript"
import "../title-filter/test-alias.ts"

const state = { auth: 0, taste: 0, release: 0, run: null as null | ((...args: any[]) => Promise<any>) }
const events: Record<string, unknown>[] = []
const info = console.info
console.info = (line: string) => {
	try {
		const event = JSON.parse(line)
		if (event.event === "search.lifecycle.v1") { events.push(event); return }
	} catch {}
	info(line)
}
after(() => { console.info = info })
;(globalThis as any).__routeSearchTest = state
const stubs: Record<string, string> = {
	"/media-payload.server.ts": `export const payloadLanguage=request=>new URL(request.url).searchParams.get("displayLanguage")||"en"; export const localizeApiTitlePayload=async(batch,request)=>new URL(request.url).searchParams.has("displayLanguage")?({...batch,rows:batch.rows.map(row=>({...row,displayLanguage:new URL(request.url).searchParams.get("displayLanguage")}))}):batch;`,
	"@remix-run/node": `export const json=(body,options={})=>Response.json(body,options);`,
	"/utils/auth.ts": `export const getAuthFromRequest=async()=>{globalThis.__routeSearchTest.auth++;return {user:{id:'member'},headers:new Headers()}};`,
	"/combined-search/search.server.ts": `export const combinedSearch=(...args)=>globalThis.__routeSearchTest.run(...args);`,
	"/combined-search/search-filters.ts": `export const parseSearchFilters=()=>({});`,
	"/role.server.ts": `export const runsSearch=()=>true;`,
	"/search-runtime/admission.server.ts": `export const searchAdmission={enter:()=>()=>{globalThis.__routeSearchTest.release++}};export const searchBusyResponse=()=>Response.json({error:'busy'},{status:503});`,
	"/search-ranking/ranking.server.ts": `export const RESULT_LENGTH=100;`,
	"/combined-search/taste-rows.server.ts": `export const searchTaste=async()=>{globalThis.__routeSearchTest.taste++;return {}};export const withTaste=rows=>rows.map(row=>({...row,tasteMatch:87}));`,
}
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		resolve(specifier: string, context: unknown, next: (specifier: string, context: unknown) => unknown): unknown
		load(url: string, context: unknown, next: (url: string, context: unknown) => unknown): unknown
	}): void
}
registerHooks({
	resolve(specifier, context, next) {
		if (specifier === "@remix-run/node") return { url: "test:remix", shortCircuit: true }
		return next(specifier, context)
	},
	load(url, context, next) {
		const stub = url === "test:remix" ? stubs["@remix-run/node"] : Object.entries(stubs).find(([suffix]) => url.endsWith(suffix))?.[1]
		if (stub) return { format: "module", source: stub, shortCircuit: true }
		if (url.endsWith("/routes/api.combined-search.ts")) return {
			format: "module", shortCircuit: true,
			source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext } }).outputText,
		}
		return next(url, context)
	},
})
const { action } = await import("../../routes/api.combined-search.ts")
const reset = () => { state.auth = 0; state.taste = 0; state.release = 0; events.length = 0 }
const request = () => new Request("http://localhost:3003/api/combined-search?displayLanguage=fr", {
	method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: "fixture", forYou: true }),
})
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r }); return { promise, resolve } }

test("route applies the same member taste to provisional and final packets and holds admission", async () => {
	reset()
	const finish = deferred()
	const partial = { rows: [{ key: "movie:42" }], pendingTitleLookup: true }
	const final = { rows: [{ key: "movie:43" }], pendingTitleLookup: false }
	state.run = async (_q, _policy, _viewer, _signal, onReading, options) => {
		onReading([])
		await options.onProgress(partial)
		await finish.promise
		await options.onComplete(final)
		return final
	}
	const response = await action({ request: request() } as any)
	const reader = response.body!.getReader()
	let text = ""
	while (!text.includes('"provisional"')) text += new TextDecoder().decode((await reader.read()).value)
	assert.equal(state.release, 0)
	assert.equal(state.auth, 1)
	assert.equal(state.taste, 1)
	assert.match(text, /"tasteMatch":87/)
	finish.resolve()
	while (true) { const chunk = await reader.read(); if (chunk.done) break; text += new TextDecoder().decode(chunk.value) }
	const packets = text.trim().split("\n").map(line => JSON.parse(line))
	assert.deepEqual(packets.map(packet => packet.kind), ["reading", "provisional", "batch"])
	assert.equal(packets[2].batch.rows[0].tasteMatch, 87)
	assert.equal(packets[1].batch.rows[0].displayLanguage, "fr")
	assert.equal(packets[2].batch.rows[0].displayLanguage, "fr")
	assert.equal(state.release, 1)
	assert.deepEqual(events.map(event => event.phase), ["accepted", "finished"])
	assert.equal(events[1].status, "completed")
})

test("stream cancellation aborts the search and releases admission only after work settles", async () => {
	reset()
	const finish = deferred()
	let signal!: AbortSignal
	state.run = async (_q, _policy, _viewer, inputSignal, _onReading, options) => {
		signal = inputSignal
		await options.onProgress({ rows: [], pendingTitleLookup: true })
		await finish.promise
		const batch = { rows: [], pendingTitleLookup: false }
		await options.onComplete(batch)
		return batch
	}
	const response = await action({ request: request() } as any)
	const reader = response.body!.getReader()
	await reader.read()
	await reader.cancel()
	assert.equal(signal.aborted, true)
	assert.equal(state.release, 0)
	finish.resolve()
	await new Promise(resolve => setImmediate(resolve))
	assert.equal(state.release, 1)
	assert.equal(events[1].status, "aborted")
	assert.equal(events[1].firstResultsMs, null)
})

test("a failed late title check emits an error after usable provisional rows", async () => {
	reset()
	state.run = async (_q, _policy, _viewer, _signal, _onReading, options) => {
		await options.onProgress({ rows: [{ key: "movie:42" }], pendingTitleLookup: true })
		throw new Error("late lookup failed")
	}
	const response = await action({ request: request() } as any)
	const packets = (await response.text()).trim().split("\n").map(line => JSON.parse(line))
	assert.deepEqual(packets.map(packet => packet.kind), ["provisional", "error"])
	assert.equal(packets[0].batch.rows[0].key, "movie:42")
	assert.match(packets[1].error, /Search is unavailable/)
	assert.equal(events[1].status, "failed")
	assert.equal(typeof events[1].firstResultsMs, "number")
	assert.equal(state.auth, 1)
	assert.equal(state.taste, 1)
	assert.equal(state.release, 1)
})

test("accepted failures before any delivery remain visible in anonymous completion evidence", async () => {
	reset()
	state.run = async () => { throw new Error("private search/account sentinel") }
	const response = await action({ request: request() } as any)
	assert.match(await response.text(), /Search is unavailable/)
	assert.equal(events[1].status, "failed")
	assert.equal(events[1].firstResultsMs, null)
	assert.ok(!JSON.stringify(events).includes("sentinel"))
	assert.equal(state.release, 1)
})


test("legacy search request against a new role retains the canonical NDJSON row contract", async () => {
	reset()
	state.run=async(_q,_policy,_viewer,_signal,_reading,options)=>{const batch={rows:[{key:"movie:42",title:"Canonical English"}]};await options.onComplete(batch);return batch}
	const response=await action({request:new Request("http://localhost:3003/api/combined-search",{method:"POST",headers:{"Content-Type":"application/json","Accept-Language":"fr"},body:JSON.stringify({q:"fixture"})})} as any)
	const packet=JSON.parse((await response.text()).trim())
	assert.equal(packet.kind,"batch")
	assert.equal(packet.batch.rows[0].title,"Canonical English")
	assert.equal(packet.batch.rows[0].displayLanguage,undefined)
})
