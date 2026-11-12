import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { test } from "node:test"
import ts from "typescript"
import { TypeSafeClient } from "@typesafe-ai/sdk"
import type { SearchAttribution } from "../../domain/search-attribution.ts"
import type { SearchRedis } from "./coordination.server.ts"

// Load the real store and coordinator without connecting to Crate or Redis. Node's type stripping doesn't support
// their constructor parameter properties, so transpile these two modules, as the other store tests do.
type Resolve = (specifier: string, context: { parentURL?: string }) => unknown
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		resolve(...args: [...Parameters<Resolve>, Resolve]): unknown
		load(url: string, context: unknown, next: (url: string, context: unknown) => unknown): unknown
	}): void
}
registerHooks({
	resolve(specifier, context, next) {
		if (context.parentURL?.includes("/search-runtime/")) {
			if (specifier === "../combined-search/catalog.server")
				return next('data:text/javascript,export const searchStatement = () => { throw new Error("Unexpected Crate call") }', context)
			if (specifier === "~/utils/cache")
				return next("data:text/javascript,export const getRedisCluster = () => null", context)
			if (specifier.startsWith(".") && !specifier.endsWith(".ts"))
				return next(new URL(`${specifier}.ts`, context.parentURL).href, context)
		}
		return next(specifier, context)
	},
	load(url, context, next) {
		if (!/\/search-runtime\/(store|coordination)\.server\.ts$/.test(url)) return next(url, context)
		return {
			format: "module",
			source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
				compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
			}).outputText,
			shortCircuit: true,
		}
	},
})
const { SearchStore } = await import("./store.server.ts")
const { SearchCoordination } = await import("./coordination.server.ts")
const { executeJevStage, expiredCost, jevReserveNano, JEV_EXPIRED_NANO, JEV_INPUT_BOUND, JEV_MODEL, JEV_PRICE_VERSION, JEV_RESERVE_NANO } = await import("./runtime.server.ts")

function fixture(client: () => SearchRedis | null, attribution?: SearchAttribution, conflict = false) {
	const statements: { stmt: string; args: unknown[] }[] = []
	const store = new SearchStore(async (stmt, args = []) => {
		statements.push({ stmt, args })
		if (stmt.startsWith("SELECT halted"))
			return { cols: ["halted"], rows: [[false]], rowcount: 1 }
		if (stmt.startsWith("SELECT CURRENT_TIMESTAMP"))
			return { cols: ["now", "day", "month"], rows: [[1000, 0, 0]], rowcount: 1 }
		if (stmt.startsWith("SELECT cache_key, budget_at, amount_nano"))
			return { cols: ["cache_key", "budget_at", "amount_nano", "attribution"], rows: [["key", 1000, JEV_RESERVE_NANO, attribution]], rowcount: 1 }
		if (conflict && stmt.startsWith("INSERT INTO doc.search_interpretations")) throw new Error("claim conflict")
		return { cols: [], rows: [], rowcount: 1 }
	}, new SearchCoordination(client), Buffer.alloc(32, 1))
	return { store, statements }
}

const attribution: SearchAttribution = {
	version: 1, consumer: "web", surface: "start", trigger: "typing_pause", actor_kind: "guest", search_id: "search-1", reported_by: "client",
}

test("paid estimates and every adjustment retain the originating search attribution", async (t) => {
	t.mock.method(SearchCoordination.prototype, "release", async () => {})
	t.mock.method(SearchCoordination.prototype, "cache", async () => {})
	for (const conflict of [false, true]) {
		const { store, statements } = fixture(() => ({ eval: async () => "ok" }) as unknown as SearchRedis, attribution, conflict)
		if (conflict) await assert.rejects(store.claim({ ...claim, attribution }), /claim conflict/)
		else {
			assert.equal((await store.claim({ ...claim, attribution })).kind, "claimed")
			await store.finish("attempt", 840, [{}, {}])
		}
		const ledger = statements.filter(({ stmt }) => stmt.startsWith("INSERT INTO doc.search_spending"))
		assert.equal(ledger.length, 2)
		assert.deepEqual(ledger.map(({ args }) => args.at(-1)), [attribution, attribution])
	}
	const { store, statements } = fixture(() => null, attribution)
	assert.equal(await store.reconcileUnknown("attempt", 840, "provider evidence"), true)
	const adjustment = statements.find(({ stmt }) => stmt.includes("'reconciliation'"))!
	assert.deepEqual(adjustment.args.at(-1), attribution)
	assert.equal(adjustment.args[3], 1000, "adjustment stays in the original budget period")
	assert.ok(!JSON.stringify(adjustment.args).includes("provider evidence"), "evidence remains encrypted")
})

test("history preserves current request attribution, including cache hits", async () => {
	const { store, statements } = fixture(() => null)
	const current = { ...attribution, trigger: "enter" as const, search_id: "search-2" }
	await store.history({ text: "private query", accountId: null, attribution: current, elapsedMs: 10, chargedNano: 0, outcome: "cached", rankerVersion: "test" })
	const row = statements.find(({ stmt }) => stmt.startsWith("INSERT INTO doc.search_history"))!
	assert.deepEqual(row.args.at(-1), current)
	assert.ok(!JSON.stringify(row.args).includes("private query"), "query remains encrypted")
})
const claim = {
	cacheKey: "key",
	contract: "test",
	scopes: ["global"],
	reserveNano: JEV_RESERVE_NANO,
	priceVersion: "test",
}

test("coordination failures return basic without interpretation or spending inserts; warnings are throttled across stores", async (t) => {
	let now = 0
	t.mock.method(performance, "now", () => now)
	const warning = t.mock.method(console, "warn", () => {})
	for (const message of ["RedisNodeDownError", "Command timed out", null]) {
		const redis = { eval: async () => { throw new Error(message!) } } as unknown as SearchRedis
		const { store, statements } = fixture(() => message === null ? null : redis)
		assert.deepEqual(await store.claim(claim), { kind: "basic", reason: "coordination" })
		assert.equal(statements.some(({ stmt }) => stmt.startsWith("INSERT")), false)
	}
	assert.equal(warning.mock.callCount(), 1)
	const { store } = fixture(() => null)
	now = 59_999
	await store.claim(claim)
	assert.equal(warning.mock.callCount(), 1)
	now = 60_000
	await store.claim(claim)
	assert.equal(warning.mock.callCount(), 2)
	assert.deepEqual(warning.mock.calls[0].arguments, [
		"Search coordination unavailable; serving basic results", { reason: "coordination" },
	])
})

for (const stage of ["claim", "dispatch"] as const) {
	test(`runtime serves basic results when coordination fails during ${stage}`, async (t) => {
		const originalKey = process.env.TYPESAFE_API_KEY
		process.env.TYPESAFE_API_KEY = "test-key"
		t.after(() => {
			if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY
			else process.env.TYPESAFE_API_KEY = originalKey
		})
		const paid = t.mock.method(TypeSafeClient.prototype, "systemOne", async () => {
			throw new Error("Unexpected paid call")
		})
		let evals = 0
		const redis = {
			get: async () => null,
			eval: async () => {
				evals++
				if (stage === "dispatch" && evals === 1) return "ok"
				throw new Error("RedisNodeDownError")
			},
		} as unknown as SearchRedis
		const { store, statements } = fixture(() => redis)
		const outcome = await executeJevStage(store, {
			requestText: "quiet movies",
			questionVersion: "test",
			language: { mode: "english", version: "test" },
			requests: [{ state: {}, questions: {} }, { state: {}, questions: {} }],
			visitor: { accountId: null, networkIdentity: "test" },
		})
		assert.deepEqual(outcome, {
			kind: "basic", reason: stage === "claim" ? "coordination" : "storage",
			message: "Showing basic search results.", chargedNano: stage === "claim" ? 0 : jevReserveNano([{ state: {}, questions: {}, model: JEV_MODEL }, { state: {}, questions: {}, model: JEV_MODEL }]),
		})
		assert.equal(paid.mock.callCount(), 0)
		// A failed claim reserves nothing. A lease lost after the claim keeps its estimate, which errs on the safe side.
		const inserts = statements.filter(({ stmt }) => stmt.startsWith("INSERT"))
		assert.equal(inserts.length, stage === "claim" ? 0 : 2)
	})
}

function gate() {
	let release!: () => void
	const promise = new Promise<void>((resolve) => { release = resolve })
	return { promise, release }
}

test("claim measures concurrent SQL and inserts independently and residual scope wait", async (t) => {
	let now = 0
	t.mock.method(performance, "now", () => now)
	const gates = Object.fromEntries(["control", "spend", "redis", "interpretation", "estimate", "scopes"].map(name => [name, gate()]))
	const started: string[] = [], timings: Record<string, number> = {}
	const wait = async (name: string) => { started.push(name); await gates[name].promise }
	const store = new SearchStore(async (stmt) => {
		if (stmt.startsWith("SELECT halted")) { await wait("control"); return { cols: ["halted"], rows: [[false]], rowcount: 1 } }
		if (stmt.startsWith("SELECT CURRENT_TIMESTAMP")) { await wait("spend"); return { cols: ["now", "day", "month"], rows: [[1000, 0, 0]], rowcount: 1 } }
		if (stmt.startsWith("INSERT INTO doc.search_interpretations")) await wait("interpretation")
		if (stmt.includes("'estimate'")) await wait("estimate")
		return { cols: [], rows: [], rowcount: 1 }
	}, new SearchCoordination(() => ({ eval: async () => { await wait("redis"); return "ok" } }) as unknown as SearchRedis), Buffer.alloc(32, 1))
	const pending = store.claim({ ...claim, scopes: gates.scopes.promise.then(() => ["global"]), timings })
	const settle = () => new Promise<void>(resolve => setImmediate(resolve))
	await settle(); assert.deepEqual(started, ["control", "spend"])
	now = 11; gates.control.release(); await settle(); assert.equal(timings.claimControl, 11)
	assert.equal(timings.claimSpend, undefined)
	now = 31; gates.spend.release(); await settle(); assert.deepEqual(started, ["control", "spend"])
	now = 36; gates.scopes.release(); await settle(); assert.equal(timings.claimScopes, 5)
	now = 43; gates.redis.release(); await settle(); assert.deepEqual(started.slice(-2), ["interpretation", "estimate"])
	now = 52; gates.interpretation.release(); await settle(); assert.equal(timings.claimInterpretationInsert, 9)
	now = 67; gates.estimate.release(); assert.equal((await pending).kind, "claimed")
	assert.deepEqual(timings, { claimControl: 11, claimSpend: 31, claimScopes: 5, claimRedis: 7, claimInterpretationInsert: 9, claimEstimateInsert: 24 })
})

for (const failed of ["control", "redis", "interpretation", "estimate"] as const) {
	test(`claim retains ${failed} duration when its gate rejects`, async (t) => {
		let now = 0
		t.mock.method(performance, "now", () => now)
		const failedGate = gate(), timings: Record<string, number> = {}
		const rejectGate = async () => { await failedGate.promise; throw new Error("gated failure") }
		const store = new SearchStore(async (stmt) => {
			if (stmt.startsWith("SELECT halted")) { if (failed === "control") await rejectGate(); return { cols: ["halted"], rows: [[false]], rowcount: 1 } }
			if (stmt.startsWith("SELECT CURRENT_TIMESTAMP")) return { cols: ["now", "day", "month"], rows: [[1000, 0, 0]], rowcount: 1 }
			if (failed === "interpretation" && stmt.startsWith("INSERT INTO doc.search_interpretations")) await rejectGate()
			if (failed === "estimate" && stmt.includes("'estimate'")) await rejectGate()
			return { cols: [], rows: [], rowcount: 1 }
		}, new SearchCoordination(() => ({ eval: async () => { if (failed === "redis") await rejectGate(); return "ok" } }) as unknown as SearchRedis), Buffer.alloc(32, 1))
		const pending = store.claim({ ...claim, timings }).then(value => value, () => null)
		await new Promise<void>(resolve => setImmediate(resolve)); now = 19; failedGate.release()
		const result = await pending
		assert.equal(result?.kind ?? "rejected", failed === "redis" ? "basic" : "rejected")
		const timing = { control: "claimControl", redis: "claimRedis", interpretation: "claimInterpretationInsert", estimate: "claimEstimateInsert" }[failed]
		assert.equal(timings[timing], 19)
	})
}

for (const failed of ["control", "account"] as const) {
	test(`runtime forwards claim timings and retains aggregate duration on ${failed} rejection`, async (t) => {
		const originalKey = process.env.TYPESAFE_API_KEY
		process.env.TYPESAFE_API_KEY = "test-key"
		t.after(() => { if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = originalKey })
		const paid = t.mock.method(TypeSafeClient.prototype, "systemOne", async () => { throw new Error("Unexpected paid call") })
		let now = 0
		t.mock.method(performance, "now", () => now)
		const waiting = gate(), timings: Record<string, number> = {}
		const store = new SearchStore(async (stmt) => {
			if (stmt.startsWith("SELECT halted")) {
				if (failed === "control") { await waiting.promise; throw new Error("control unavailable") }
				return { cols: ["halted"], rows: [[false]], rowcount: 1 }
			}
			if (stmt.startsWith("SELECT CURRENT_TIMESTAMP")) return { cols: ["now", "day", "month"], rows: [[1000, 0, 0]], rowcount: 1 }
			return { cols: [], rows: [], rowcount: 1 }
		}, new SearchCoordination(() => ({ get: async () => null, eval: async () => { throw new Error("Unexpected admission") } }) as unknown as SearchRedis), Buffer.alloc(32, 1))
		const pending = executeJevStage(store, {
			requestText: "quiet movies", questionVersion: "test", language: { mode: "english", version: "test" },
			requests: [{ state: {}, questions: {} }, { state: {}, questions: {} }],
			visitor: { accountId: failed === "account" ? waiting.promise.then(() => { throw new Error("session unavailable") }) : null, networkIdentity: "test" },
			timings,
		})
		await new Promise<void>(resolve => setImmediate(resolve)); now = 21; waiting.release()
		assert.equal((await pending).kind, "basic")
		assert.equal(timings.claim, 21)
		assert.equal(timings[failed === "control" ? "claimControl" : "claimAccount"], 21)
		if (failed === "account") assert.equal(timings.claimScopes, 21)
		assert.equal(paid.mock.callCount(), 0)
	})
}

test("dispatch uses the known cache key without reading the reservation", async (t) => {
	const { store, statements } = fixture(() => null)
	const dispatched = t.mock.method(SearchCoordination.prototype, "dispatch", async () => {})
	await store.dispatch("attempt", "known-key")
	assert.deepEqual(dispatched.mock.calls[0].arguments, ["attempt", "known-key"])
	assert.deepEqual(statements, [])
})

for (const blocked of ["halted", "day", "month"] as const) {
	test(`${blocked} prevents admission after prefetched checks`, async () => {
		const statements: string[] = []
		const store = new SearchStore(async stmt => {
			statements.push(stmt)
			if (stmt.startsWith("SELECT halted")) return { cols: ["halted"], rows: [[blocked === "halted"]], rowcount: 1 }
			return { cols: ["now", "day", "month"], rows: [[1000, blocked === "day" ? 1_000_000_000 : 0, blocked === "month" ? 5_000_000_000 : 0]], rowcount: 1 }
		}, new SearchCoordination(() => { throw new Error("Unexpected admission") }), Buffer.alloc(32, 1))
		const checks = store.claimChecks()
		assert.deepEqual(await store.claim({ ...claim, checks }), { kind: "basic", reason: "budget" })
		assert.equal(statements.length, 2)
		assert.ok(statements.every(stmt => stmt.startsWith("SELECT")))
	})
}

test("a Redis hit runs no Crate reads, no admission and no inserts", async () => {
	const statements: string[] = []
	const store = new SearchStore(async stmt => {
		statements.push(stmt)
		return { cols: [], rows: [], rowcount: 0 }
	}, new SearchCoordination(() => ({ get: async () => store.seal([{}, {}]), eval: async () => { throw new Error("Unexpected admission") } }) as unknown as SearchRedis), Buffer.alloc(32, 1))
	const outcome = await executeJevStage(store, {
		requestText: "quiet movies", questionVersion: "test", language: { mode: "english", version: "test" },
		requests: [{ state: {}, questions: {} }, { state: {}, questions: {} }], visitor: { accountId: null, networkIdentity: "test" },
	})
	assert.equal(outcome.kind, "cached")
	assert.deepEqual(statements, [])
})

for (const fail of [false, true]) {
	test(`a Crate hit discards ${fail ? "failed" : "pending"} checks without admission or inserts`, async () => {
		const waiting = gate(), lookup = gate(), started: string[] = [], statements: string[] = []
		const store: InstanceType<typeof SearchStore> = new SearchStore(async stmt => {
			statements.push(stmt)
			if (stmt.includes("search_interpretations")) {
				started.push("lookup")
				await lookup.promise
				return { cols: ["status", "ciphertext"], rows: [["ready", store.seal([{}, {}])]], rowcount: 1 }
			}
			started.push(stmt.startsWith("SELECT halted") ? "control" : "spend")
			await waiting.promise
			if (fail) throw new Error("discarded read failure")
			return { cols: [], rows: [], rowcount: 0 }
		}, new SearchCoordination(() => ({ get: async () => null, set: async () => "OK", eval: async () => { throw new Error("Unexpected admission") } }) as unknown as SearchRedis), Buffer.alloc(32, 1))
		const pending = executeJevStage(store, {
			requestText: "quiet movies", questionVersion: "test", language: { mode: "english", version: "test" },
			requests: [{ state: {}, questions: {} }, { state: {}, questions: {} }], visitor: { accountId: null, networkIdentity: "test" },
		})
		await new Promise(resolve => setImmediate(resolve))
		assert.deepEqual(started, ["control", "spend", "lookup"])
		lookup.release()
		assert.equal((await pending).kind, "cached")
		assert.equal(statements.length, 3)
		assert.ok(statements.every(stmt => stmt.startsWith("SELECT")))
		waiting.release()
		await new Promise(resolve => setImmediate(resolve))
	})
}

for (const cost of [840, null, JEV_RESERVE_NANO + 1]) {
	test(`finish retains durable accounting and cache behavior for cost ${cost}`, async (t) => {
		const { store, statements } = fixture(() => null)
		const cache = t.mock.method(SearchCoordination.prototype, "cache", async () => {})
		const release = t.mock.method(SearchCoordination.prototype, "release", async () => {})
		await store.finish("attempt", cost, [{}, {}])
		const settlement = statements.find(({ stmt }) => stmt.includes("'settlement'"))
		assert.equal(release.mock.callCount(), 1)
		assert.equal(statements.some(({ stmt }) => stmt.startsWith("SELECT cache_key, budget_at, amount_nano")), true)
		assert.equal(statements.some(({ stmt }) => stmt.startsWith("UPDATE doc.search_control")), cost !== null && cost > JEV_RESERVE_NANO)
		if (cost === null) {
			assert.equal(settlement, undefined) // Unknown usage never creates a refund.
			assert.equal(cache.mock.callCount(), 0)
		} else {
			assert.deepEqual(settlement?.args, ["attempt:settled", "attempt", "key", 1000, cost - JEV_RESERVE_NANO, null])
			assert.equal(cache.mock.callCount(), cost <= JEV_RESERVE_NANO ? 1 : 0)
		}
		assert.equal(statements.some(({ stmt }) => stmt.includes("status = 'ready'")), cost !== null && cost <= JEV_RESERVE_NANO)
	})
}

// Pay only when a person acts: a guest's web search that arrived in the URL buys no reading.
const origin = (trigger: SearchAttribution["trigger"], actor_kind: SearchAttribution["actor_kind"], consumer: SearchAttribution["consumer"] = "web"): SearchAttribution =>
	({ ...attribution, consumer, trigger, actor_kind, surface: "discover" })
for (const [name, label, paid] of [
	["guest navigation", origin("navigation", "guest"), false],
	["guest typing", origin("typing_pause", "guest"), true],
	["guest Enter", origin("enter", "guest"), true],
	["guest in-app tag link", origin("link", "guest"), true],
	["member navigation", origin("navigation", "member"), true],
	["MCP", origin("api", "external", "mcp"), true],
] as const)
	test(`claim: ${name} ${paid ? "may buy" : "buys no"} reading`, async (t) => {
		t.mock.method(SearchCoordination.prototype, "release", async () => {})
		let admissions = 0
		const { store, statements } = fixture(() => ({ eval: async () => { admissions++; return "ok" } }) as unknown as SearchRedis)
		const result = await store.claim({ ...claim, attribution: async () => label })
		assert.deepEqual(result, paid ? { kind: "claimed", id: (result as { id: string }).id } : { kind: "basic", reason: "navigation" })
		assert.equal(admissions, paid ? 1 : 0)
		assert.equal(statements.some(({ stmt }) => stmt.startsWith("INSERT")), paid, "no estimate without a claim")
	})

test("guest navigation: a cached reading still serves, a miss is basic with no paid call", async (t) => {
	const originalKey = process.env.TYPESAFE_API_KEY
	process.env.TYPESAFE_API_KEY = "test-key"
	t.after(() => { if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = originalKey })
	const paid = t.mock.method(TypeSafeClient.prototype, "systemOne", async () => { throw new Error("Unexpected paid call") })
	const input: Parameters<typeof executeJevStage>[1] = {
		requestText: "quiet movies", questionVersion: "test", language: { mode: "english", version: "test" },
		requests: [{ state: {}, questions: {} }, { state: {}, questions: {} }],
		visitor: { accountId: null, networkIdentity: "test", attribution: { consumer: "web", surface: "discover", trigger: "navigation", reported_by: "client" } },
	}
	for (const hit of [true, false]) {
		const statements: string[] = []
		const store: InstanceType<typeof SearchStore> = new SearchStore(async stmt => {
			statements.push(stmt)
			if (stmt.startsWith("SELECT halted")) return { cols: ["halted"], rows: [[false]], rowcount: 1 }
			if (stmt.startsWith("SELECT CURRENT_TIMESTAMP")) return { cols: ["now", "day", "month"], rows: [[1000, 0, 0]], rowcount: 1 }
			return { cols: [], rows: [], rowcount: 0 }
		}, new SearchCoordination(() => ({ get: async () => hit ? store.seal([{}, {}]) : null, eval: async () => { throw new Error("Unexpected admission") } }) as unknown as SearchRedis), Buffer.alloc(32, 1))
		const outcome = await executeJevStage(store, input)
		assert.deepEqual(hit ? outcome.kind : outcome, hit ? "cached" : { kind: "basic", reason: "navigation", message: "Showing basic search results.", chargedNano: 0 })
		assert.ok(statements.every(stmt => stmt.startsWith("SELECT")), "no estimate is written")
	}
	assert.equal(paid.mock.callCount(), 0)
})

test("a reading reserves its requests' bytes plus the template allowance, at most the input bound per request", async (t) => {
	t.mock.method(SearchCoordination.prototype, "release", async () => {})
	const request = (bytes: number) => {
		const shell = { state: { text: "" }, questions: {} }
		return { ...shell, state: { text: "x".repeat(bytes - Buffer.byteLength(JSON.stringify(shell))) } }
	}
	// The typical production pair: 12,373 + 19,585 bytes (attribute, fingerprint) for "submarine standoff with a mutiny".
	const typical = [request(12_373), request(19_585)]
	assert.equal(jevReserveNano(typical), (12_373 + 1024 + 19_585 + 1024) * 42)
	assert.equal(jevReserveNano(typical), 1_428_252)
	assert.ok(jevReserveNano(typical) < JEV_RESERVE_NANO / 3.8)
	// Never more than the old fixed reservation, the most a reading can cost.
	assert.equal(jevReserveNano([request(100_000), request(100_000)]), 2 * JEV_INPUT_BOUND * 42)
	assert.equal(jevReserveNano([request(100_000), request(100_000)]), JEV_RESERVE_NANO)
	// The claim's estimate row carries it.
	const originalKey = process.env.TYPESAFE_API_KEY
	process.env.TYPESAFE_API_KEY = "test-key"
	t.after(() => { if (originalKey === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = originalKey })
	t.mock.method(TypeSafeClient.prototype, "systemOne", async () => { throw new Error("provider down") })
	t.mock.method(SearchCoordination.prototype, "dispatch", async () => {})
	const { store, statements } = fixture(() => ({ get: async () => null, eval: async () => "ok" }) as unknown as SearchRedis)
	const outcome = await executeJevStage(store, {
		requestText: "quiet movies", questionVersion: "test", language: { mode: "english", version: "test" },
		requests: typical as never, visitor: { accountId: null, networkIdentity: "test" },
	})
	// Sized as sent: the runtime pins the model on each request.
	const sent = jevReserveNano(typical.map(request => ({ ...request, model: JEV_MODEL })))
	assert.equal(sent, 1_430_016)
	assert.deepEqual(outcome, { kind: "basic", reason: "provider", message: "Showing basic search results.", chargedNano: sent })
	const estimate = statements.find(({ stmt }) => stmt.includes("'estimate'"))!
	assert.equal(estimate.args[5], sent)
})

test("stale estimates without a settlement are settled at a bound, once, in their own budget period", async () => {
	const statements: { stmt: string; args: unknown[] }[] = []
	const taken = new Set(["b:settled"]) // b got its settlement after the lone read: the insert is a no-op.
	const store = new SearchStore(async (stmt, args = []) => {
		statements.push({ stmt, args })
		if (stmt.includes("GROUP BY attempt_id"))
			return { cols: ["attempt_id"], rows: [["a"], ["b"], ["c"]], rowcount: 3 }
		if (stmt.includes("id = ANY(?)"))
			return {
				cols: ["attempt_id", "cache_key", "budget_at", "amount_nano", "price_version", "attribution"],
				rows: [
					["a", "ka", 100, JEV_RESERVE_NANO, JEV_PRICE_VERSION, attribution],
					["b", "kb", 200, JEV_RESERVE_NANO, JEV_PRICE_VERSION, null],
					["c", "kc", 300, 250_000, "openrouter-nano-2026-09-21-100-400-v1", null],
				],
				rowcount: 3,
			}
		if (stmt.includes("'expiry'")) {
			const fresh = !taken.has(args[0] as string)
			taken.add(args[0] as string)
			return { cols: [], rows: [], rowcount: fresh ? 1 : 0 }
		}
		throw new Error(`Unexpected statement ${stmt}`)
	}, new SearchCoordination(() => null), Buffer.alloc(32, 1))
	const before = Date.now()
	assert.equal(await store.expireStaleEstimates(expiredCost), 2)
	const cutoff = statements[0].args[0] as number
	assert.ok(cutoff >= before - 15 * 60_000 && cutoff <= Date.now() - 15 * 60_000, "only estimates older than 15 minutes")
	assert.deepEqual(statements[1].args, [["a:estimate", "b:estimate", "c:estimate"]])
	const expiry = statements.filter(({ stmt }) => stmt.includes("'expiry'")).map(({ args }) => args)
	assert.deepEqual(expiry, [
		// A Jev reading counts JEV_EXPIRED_NANO (430,080) instead of its 5,505,024 reservation.
		["a:settled", "a", "ka", 100, JEV_EXPIRED_NANO - JEV_RESERVE_NANO, attribution],
		["b:settled", "b", "kb", 200, JEV_EXPIRED_NANO - JEV_RESERVE_NANO, null],
		// Another price (translation) keeps its own reservation: settled at zero adjustment.
		["c:settled", "c", "kc", 300, 0, null],
	])
	assert.equal(JEV_EXPIRED_NANO, 430_080)
	// The bound never raises an estimate.
	assert.equal(expiredCost({ price_version: JEV_PRICE_VERSION, amount_nano: 90_048 }), 90_048)
	// A second sweep finds every attempt settled.
	assert.equal(await store.expireStaleEstimates(expiredCost), 0)
})
