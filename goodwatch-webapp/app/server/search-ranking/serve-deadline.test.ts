// Real ranking composition and deadline; replace only the external index, encoder and Qdrant boundaries.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { test } from "node:test"
import ts from "typescript"
import "../title-filter/test-alias.ts"

function deferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((yes) => {
		resolve = yes
	})
	return { promise, resolve }
}
const vectors = {
	english: [new Float32Array([1])],
	multilingual: [],
	timings: { totalMs: 1 },
}
const probe = {
	gate: "",
	blocked: deferred<void>(),
	entered: deferred<void>(),
	calls: [] as string[],
	index: {
		buildId: "fixture",
		titleTable: { size: 0, pointIds: [], rowOf: new Map(), flagNames: [] },
		words: {
			df: new Map([["encoder", 1]]),
			spellVocabulary: [],
			spellByLength: new Map(),
		},
		termStatistics: { indexOf: new Map(), ids: [], terms: [] },
		collocations: new Set(),
		titleNames: [],
		alternateCuts: new Map(),
	},
	async block(name: string) {
		this.calls.push(name)
		if (this.gate === name) {
			this.entered.resolve()
			await this.blocked.promise
		}
	},
	async encode() {
		await this.block("encodeEarly")
		return vectors
	},
	async query(collection: string, queries: unknown[]) {
		await this.block(
			collection === "search_reference_profiles"
				? "prefetch"
				: this.calls.includes("round1")
					? "round2"
					: "round1",
		)
		return { results: queries.map(() => []), serverMs: 1, wallMs: 1 }
	},
}
Object.assign(globalThis, { deadlineProbe: probe })
const stubs: Record<string, string> = {
	"/search-ranking/search-index.server.ts": `export const getSearchIndex=async()=>globalThis.deadlineProbe.index; export const loadedSearchIndexBuild=()=>true; export const startSearchIndex=()=>{};`,
	"/search-ranking/query-encoder.server.ts": `export const encodeQueryTexts=()=>globalThis.deadlineProbe.encode(); export const queryEncoderState=()=>({ready:true,pending:0,maxPending:32}); export const startQueryEncoder=async()=>({});`,
	"/search-ranking/qdrant-http.server.ts": `export const queryBatch=(collection,queries)=>globalThis.deadlineProbe.query(collection,queries);`,
	"/search-ranking/references.server.ts": `export const resolveReference=(_index,query)=>query==='prefetch'?{kind:'entity',text:'',negated:[],seeds:[],own:new Set(),weights:new Map(),words:new Set(),intent:'filmography',detection:{intentText:null,entities:[{entity:{id:'fixture-person',name:'Fixture',mention:[]}}]}}:null; export const nearestIntent=()=>null;`,
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
		if (url.endsWith(".json") && url.includes("/search-ranking/"))
			return {
				format: "module",
				source: `export default ${readFileSync(new URL(url), "utf8")}`,
				shortCircuit: true,
			}
		const stub = Object.entries(stubs).find(([suffix]) =>
			url.endsWith(suffix),
		)?.[1]
		if (stub) return { format: "module", source: stub, shortCircuit: true }
		if (url.endsWith(".ts") && url.includes("/app/server/"))
			return {
				format: "module",
				shortCircuit: true,
				source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
					compilerOptions: {
						module: ts.ModuleKind.ESNext,
						target: ts.ScriptTarget.ESNext,
					},
				}).outputText,
			}
		return next(url, context)
	},
})
const { rankForServing, RankingDeadlineError } = await import(
	"./serve.server.ts"
)
const { searchAdmission } = await import(
	"../search-runtime/admission.server.ts"
)
const reading = {
	weights: {},
	flags: [],
	searchedPhrases: [],
	concreteWords: [],
	chips: [],
	vector: [],
}
const policy = { includeAdult: false, lesserKnown: false }

for (const phase of ["encodeEarly", "prefetch", "round1"] as const) {
	test(`a deadline preserves the pending ${phase} span and freezes it while background work finishes`, async () => {
		probe.gate = phase
		probe.blocked = deferred<void>()
		probe.entered = deferred<void>()
		probe.calls = []
		const before = searchAdmission.inFlight()
		let caught: InstanceType<typeof RankingDeadlineError> | undefined
		const ranking = rankForServing(
			reading,
			{
				query: phase === "prefetch" ? "prefetch" : "encoder",
				text: phase === "prefetch" ? "" : "encoder",
				nonEnglish: false,
				titleLookup: [],
			},
			policy,
			40,
		)
		const rejection = ranking.catch((error) => {
			caught = error
		})
		await probe.entered.promise
		await rejection
		try {
			assert.ok(caught instanceof RankingDeadlineError, String(caught))
			const snapshot = (
				caught as unknown as { timings: Record<string, number> }
			).timings
			assert.ok(snapshot, "deadline discarded the pending work's timings")
			assert.equal(snapshot[`${phase}Pending`], 1)
			assert.ok(snapshot[`${phase}Elapsed`] >= 20)
			assert.ok(Object.isFrozen(snapshot))
			const copy = { ...snapshot }
			assert.equal(
				searchAdmission.inFlight(),
				before + 1,
				"timed-out work must still count against admission",
			)
			probe.blocked.resolve()
			await new Promise((resolve) => setTimeout(resolve, 10))
			assert.deepEqual(
				snapshot,
				copy,
				"background completion changed the captured timeout",
			)
			assert.equal(searchAdmission.inFlight(), before)
		} finally {
			probe.blocked.resolve()
			probe.gate = ""
			await new Promise((resolve) => setTimeout(resolve, 10))
		}
	})
}

test("preparation started during the reading keeps its original encoder span without another encoder call", async () => {
	const { RankingProgress } = await import("./ranking-progress.server.ts")
	const { prepareSearch } = await import("./rank-search.server.ts")
	const progress = new RankingProgress()
	probe.gate = "encodeEarly"
	probe.blocked = deferred<void>()
	probe.entered = deferred<void>()
	probe.calls = []
	const request = {
		query: "encoder",
		text: "encoder",
		nonEnglish: false,
		titleLookup: [],
		progress,
	}
	const prepared = prepareSearch(request)
	await probe.entered.promise
	await new Promise((resolve) => setTimeout(resolve, 30))
	try {
		await assert.rejects(
			rankForServing(reading, { ...request, prepared }, policy, 40),
			(error) => {
				assert.ok(error instanceof RankingDeadlineError)
				assert.equal(error.timings.encodeEarlyPending, 1)
				assert.ok(error.timings.encodeEarlyElapsed >= 60)
				return true
			},
		)
		assert.equal(probe.calls.filter((name) => name === "encodeEarly").length, 1)
	} finally {
		probe.blocked.resolve()
		probe.gate = ""
		await new Promise((resolve) => setTimeout(resolve, 10))
	}
	assert.equal(searchAdmission.inFlight(), 0)
})
