import "./loader.test-support.ts"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, before, test } from "node:test"
import { setCrateClientForTest } from "../../utils/crate.ts"
import type { Param } from "./store.server.ts"

const { claimImport, getImportRow, refreshItems, run, select } = await import(
	"./store.server.ts"
)
const {
	holdQuestions,
	questionProcessed,
	questionTotal,
	recountQuestions,
	saveConsent,
	transitionConflict,
} = await import("./apply.server.ts")

const url = new URL(process.env.IMPORTS_TEST_CRATE_URL ?? "http://invalid")
if (
	url.protocol !== "http:" ||
	!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
	url.username ||
	url.password
)
	throw Error("IMPORTS_TEST_CRATE_URL must name a throwaway local Crate")

const schema = `imdb_question_test_${randomUUID().replace(/-/g, "")}`
async function sql(stmt: string, args: unknown[] = []) {
	const response = await fetch(new URL("/_sql", url), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			stmt: stmt.replace(/\bdoc\./g, `${schema}.`),
			args,
		}),
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
		"CREATE TABLE doc.user_import (id TEXT PRIMARY KEY, user_id TEXT, source TEXT, status TEXT, file_name TEXT, conflict_choice TEXT, counts TEXT, processed BIGINT, total BIGINT, added BIGINT, updated BIGINT, kept BIGINT, failed BIGINT, without_fingerprint BIGINT, error TEXT, created_at TIMESTAMP, updated_at TIMESTAMP, confirmed_at TIMESTAMP, finished_at TIMESTAMP, options TEXT) WITH (number_of_replicas=0)",
	)
	await sql(
		"CREATE TABLE doc.user_import_item (import_id TEXT, row_index INTEGER, outcome TEXT, apply_state TEXT, applied_at TIMESTAMP, reason TEXT, payload TEXT, PRIMARY KEY(import_id,row_index)) WITH (number_of_replicas=0)",
	)
	setCrateClientForTest({
		async execute(stmt, args) {
			const result = await sql(stmt, args)
			return {
				rowcount: result.rowcount,
				json: result.rows.map((row) =>
					Object.fromEntries(result.cols.map((key, i) => [key, row[i]])),
				),
			}
		},
	})
})
after(async () => {
	setCrateClientForTest(null)
	await sql("DROP TABLE IF EXISTS doc.user_import_item")
	await sql("DROP TABLE IF EXISTS doc.user_import")
})

test("real Crate holds IMDb conflicts, transitions answers, persists bulk consent, recounts and fences finishing", async () => {
	const id = "questions"
	const user = "member"
	const counts = JSON.stringify({ new: 1, update: 1, conflict: 3 })
	await sql(
		"INSERT INTO doc.user_import (id,user_id,source,status,counts,options,created_at,updated_at) VALUES (?,?,'imdb','running',?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
		[id, user, counts, JSON.stringify({ ask: true })],
	)
	for (const [index, outcome] of [
		"conflict",
		"conflict",
		"conflict",
		"unchanged",
		"new",
		"update",
	].entries())
		await sql(
			"INSERT INTO doc.user_import_item (import_id,row_index,outcome,payload) VALUES (?,?,?,?)",
			[id, index, outcome, JSON.stringify({ fixture: index })],
		)
	await refreshItems()
	await holdQuestions(user, id)
	await holdQuestions(user, id)
	const items = () =>
		select<{
			row_index: number
			apply_state: string | null
			payload: string
			reason: string | null
			applied_at: number | null
		}>(
			"SELECT row_index, apply_state, payload, reason, applied_at FROM doc.user_import_item WHERE import_id = ? ORDER BY row_index",
			[id],
		)
	assert.deepEqual(
		(await items()).map((item) => item.apply_state),
		[
			"waiting:conflict",
			"waiting:conflict",
			"waiting:conflict",
			null,
			null,
			null,
		],
	)
	assert.equal(await questionTotal(id, counts), 5)
	assert.equal(await questionProcessed(id), 3)
	const stale = await getImportRow(user, id)
	assert.equal(await transitionConflict(id, "imdb", [0, 1]), 2)
	await refreshItems()
	assert.equal(await questionProcessed(id), 1)
	assert.equal(await transitionConflict(id, "keep"), 1)
	await refreshItems()
	assert.equal(await transitionConflict(id, "imdb", [0, 1]), 0)
	const answered = await items()
	assert.deepEqual(
		answered.map((item) => item.apply_state),
		["approved:conflict", "approved:conflict", "kept", null, null, null],
	)
	assert.ok(answered.slice(0, 3).every((item) => item.applied_at !== null))
	assert.equal(answered[2].reason, "You chose to keep what GoodWatch has.")

	await recountQuestions(id, counts, { heartbeat: false })
	const recounted = await getImportRow(user, id)
	assert.equal(recounted.updated_at, stale.updated_at)
	assert.equal(recounted.total, 5)
	assert.equal(recounted.processed, 1)
	const finishSet =
		"status = ?, error = ?, total = ?, processed = ?, added = ?, updated = ?, kept = ?, failed = ?, without_fingerprint = ?, finished_at = ?, updated_at = ?"
	const finishedAt = new Date()
	const finishParams: Param[] = [
		"done",
		null,
		5,
		5,
		1,
		3,
		1,
		0,
		null,
		finishedAt,
		finishedAt,
	]
	assert.equal(await claimImport(stale, finishSet, finishParams), false)

	// Execute the production multi-WHEN CASE with JSON strings bound to a TEXT
	// column. Preserve other payload fields and leave rows outside the batch alone.
	await saveConsent(
		id,
		answered,
		new Map([
			[0, "failed"],
			[1, "failed"],
		]),
	)
	await refreshItems()
	const consent = await items()
	for (const index of [0, 1])
		assert.deepEqual(JSON.parse(consent[index].payload), {
			fixture: index,
			_answer: { conflict: "imdb" },
		})
	assert.deepEqual(JSON.parse(consent[2].payload), { fixture: 2 })
	await run(
		"UPDATE doc.user_import_item SET apply_state = ?, applied_at = CURRENT_TIMESTAMP WHERE import_id = ? AND row_index IN (?,?) AND (apply_state IS NULL OR apply_state = 'failed' OR apply_state LIKE 'approved:%')",
		["failed", id, 0, 1],
	)
	await refreshItems()
	assert.equal(await questionTotal(id, counts), 5)
	assert.equal(await questionProcessed(id), 3)
	await recountQuestions(id, counts, { heartbeat: false })
	assert.equal((await getImportRow(user, id)).failed, 2)
	await run(
		"UPDATE doc.user_import_item SET apply_state = ?, applied_at = CURRENT_TIMESTAMP WHERE import_id = ? AND row_index IN (?,?) AND (apply_state IS NULL OR apply_state = 'failed' OR apply_state LIKE 'approved:%')",
		["updated", id, 0, 1],
	)
	await run(
		"UPDATE doc.user_import_item SET apply_state = ? WHERE import_id = ? AND row_index = ?",
		["added", id, 4],
	)
	await run(
		"UPDATE doc.user_import_item SET apply_state = ? WHERE import_id = ? AND row_index = ?",
		["updated", id, 5],
	)
	await recountQuestions(id, counts, { heartbeat: false })
	assert.equal(await questionTotal(id, counts), 5)
	assert.equal(await questionProcessed(id), 5)
	assert.equal(
		await claimImport(await getImportRow(user, id), finishSet, finishParams),
		true,
	)
	const finished = await getImportRow(user, id)
	assert.equal(finished.status, "done")
	assert.equal(finished.finished_at, finishedAt.getTime())
	assert.equal(finished.processed, finished.total)
})
