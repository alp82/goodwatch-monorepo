import "../tracking-loader.test-support.ts"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, before, test } from "node:test"
import type { Param } from "./store.server.ts"

const { setImportDbForTest } = await import("./store.server.ts")
const { resolutionStore } = await import("./resolution-store.server.ts")
const { createResolutionJobs, RESOLUTION_LIMITS } = await import(
	"./resolution-job.server.ts"
)

// Run explicitly against a throwaway local Crate, never the app's configured DB:
// IMPORTS_TEST_CRATE_URL=http://127.0.0.1:44219 node --test app/server/imports/resolution-store.integration.ts
const url = new URL(process.env.IMPORTS_TEST_CRATE_URL ?? "http://invalid")
if (
	url.protocol !== "http:" ||
	!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
	url.username ||
	url.password
)
	throw Error("IMPORTS_TEST_CRATE_URL must name a throwaway local Crate")
const schema = `resolution_test_${randomUUID().replace(/-/g, "")}`
async function sql(stmt: string, args: Param[] = []) {
	const response = await fetch(new URL("/_sql", url), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ stmt: stmt.replace(/doc\./g, `${schema}.`), args }),
	})
	const result = (await response.json()) as {
		cols: string[]
		rows: unknown[][]
		rowcount: number
		error?: { message: string }
	}
	if (!response.ok) throw Error(result.error?.message ?? "Local Crate failed")
	return result
}
before(async () => {
	await sql(
		"CREATE TABLE doc.user_import_item (import_id TEXT, row_index INTEGER, user_id TEXT, kind TEXT, source_key TEXT, payload TEXT INDEX OFF STORAGE WITH (columnstore = false), outcome TEXT, PRIMARY KEY (import_id,row_index)) WITH (number_of_replicas=0)",
	)
	await sql(
		"CREATE TABLE doc.user_import (id TEXT PRIMARY KEY, user_id TEXT, status TEXT) WITH (number_of_replicas=0)",
	)
	setImportDbForTest({
		run: sql,
		async select<T extends {}>(stmt: string, args: Param[]) {
			const result = await sql(stmt, args)
			return result.rows.map((row) =>
				Object.fromEntries(result.cols.map((key, i) => [key, row[i]])),
			) as T[]
		},
	})
})
after(async () => {
	setImportDbForTest()
	await sql("DROP TABLE IF EXISTS doc.user_import_item")
	await sql("DROP TABLE IF EXISTS doc.user_import")
})

test("a queued TV Time job is claimed and advances on real Crate; its slot can be reused", async () => {
	const jobs = createResolutionJobs({
		store: resolutionStore,
		step: async (ctx) => ({
			done: true,
			processed: ctx.job.phase === "episodes" ? 1 : 0,
			matched: ctx.job.phase === "episodes" ? 1 : 0,
			held: 0,
			failed: {},
		}),
		publish: async () => "matched-preview",
	})
	for (const root of ["first", "second"]) {
		await sql(
			"INSERT INTO doc.user_import (id,user_id,status) VALUES (?,?,'preview')",
			[root, "member"],
		)
		await jobs.admit("member", root, 1)
		assert.equal((await jobs.read(root))?.state, "queued")
		if (root === "first") await jobs.run(root)
		else await jobs.reconcile()
		const job = await jobs.read(root)
		assert.equal(
			job?.state,
			"completed",
			"Matching must leave Waiting to start",
		)
		assert.equal(job.processed, 1)
		assert.equal(job.matched, 1)
		assert.equal(job.replacementId, "matched-preview")
	}
})

test("recovery after the admission deadline publishes a limited preview without starting lookups", async () => {
	let clock = Date.now()
	let steps = 0
	const jobs = createResolutionJobs({
		store: resolutionStore,
		now: () => clock,
		step: async () => {
			steps++
			return { done: true, processed: 1, matched: 1, held: 0, failed: {} }
		},
		publish: async () => "limited-preview",
	})
	await sql(
		"INSERT INTO doc.user_import (id,user_id,status) VALUES ('expired','member','preview')",
	)
	await jobs.admit("member", "expired", 1)
	clock += RESOLUTION_LIMITS.deadlineMs + 1
	await jobs.reconcile()
	const job = await jobs.read("expired")
	assert.equal(job?.state, "limited")
	assert.equal(job.failed.tvtime_lookup_budget_exhausted, 1)
	assert.equal(job.replacementId, "limited-preview")
	assert.equal(steps, 0)
})

test("real Crate rejects stale checkpoint versions and preserves non-resolution rows", async () => {
	const key = "enrich/synthetic/0"
	assert.equal(await resolutionStore.cas(key, null, { processed: 0 }), true)
	const first = await resolutionStore.read(key)
	assert.ok(first)
	assert.equal(
		await resolutionStore.cas(key, first.version, { processed: 1 }),
		true,
	)
	assert.equal(
		await resolutionStore.cas(key, first.version, { processed: 999 }),
		false,
	)
	assert.deepEqual((await resolutionStore.read(key))?.value, { processed: 1 })
	await sql(
		"INSERT INTO doc.user_import_item (import_id,row_index,kind,payload) VALUES ('resolution:unrelated',-1,'watch','{}')",
	)
	assert.equal(await resolutionStore.read("unrelated"), null)
	assert.equal(await resolutionStore.cas("unrelated", null, {}), false)
})
