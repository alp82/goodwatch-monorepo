import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { test } from "node:test"
import ts from "typescript"
import { TypeSafeClient } from "@typesafe-ai/sdk"
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
const { executeJevStage, JEV_RESERVE_NANO } = await import("./runtime.server.ts")

function fixture(client: () => SearchRedis | null) {
	const statements: { stmt: string; args: unknown[] }[] = []
	const store = new SearchStore(async (stmt, args = []) => {
		statements.push({ stmt, args })
		if (stmt.startsWith("SELECT halted"))
			return { cols: ["halted"], rows: [[false]], rowcount: 1 }
		if (stmt.startsWith("SELECT CURRENT_TIMESTAMP"))
			return { cols: ["now", "day", "month"], rows: [[1000, 0, 0]], rowcount: 1 }
		if (stmt.startsWith("SELECT cache_key, budget_at, amount_nano"))
			return { cols: ["cache_key", "budget_at", "amount_nano"], rows: [["key", 1000, JEV_RESERVE_NANO]], rowcount: 1 }
		return { cols: [], rows: [], rowcount: 1 }
	}, new SearchCoordination(client), Buffer.alloc(32, 1))
	return { store, statements }
}
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
			message: "Showing basic search results.", chargedNano: stage === "claim" ? 0 : JEV_RESERVE_NANO,
		})
		assert.equal(paid.mock.callCount(), 0)
		// A failed claim reserves nothing. A lease lost after the claim keeps its estimate, which errs on the safe side.
		const inserts = statements.filter(({ stmt }) => stmt.startsWith("INSERT"))
		assert.equal(inserts.length, stage === "claim" ? 0 : 2)
	})
}
