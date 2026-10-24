import "../tracking-loader.test-support.ts"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, before, test } from "node:test"
import type { Param } from "./store.server.ts"
const { setImportDbForTest, getImportRow, itemRows, claim, run, refreshItems } =
	await import("./store.server.ts")
const { holdQuestions, recount } = await import("./apply.server.ts")
const url = new URL(process.env.IMPORTS_TEST_CRATE_URL ?? "http://invalid")
if (
	url.protocol !== "http:" ||
	!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
	url.username ||
	url.password
)
	throw Error("IMPORTS_TEST_CRATE_URL must name a throwaway local Crate")
const schema = `question_test_${randomUUID().replace(/-/g, "")}`
async function sql(stmt: string, args: Param[] = []) {
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
const db = {
	run: sql,
	async select<T extends {}>(stmt: string, args: Param[]) {
		const result = await sql(stmt, args)
		return result.rows.map((row) =>
			Object.fromEntries(result.cols.map((key, i) => [key, row[i]])),
		) as T[]
	},
}
before(async () => {
	await sql(
		"CREATE TABLE doc.user_import (id TEXT PRIMARY KEY, user_id TEXT, source TEXT, status TEXT, file_name TEXT, counts TEXT, processed BIGINT, total BIGINT, added BIGINT, updated BIGINT, kept BIGINT, failed BIGINT, error TEXT, created_at TIMESTAMP, updated_at TIMESTAMP, confirmed_at TIMESTAMP, finished_at TIMESTAMP, options TEXT, conflict_choice TEXT, warnings TEXT, kinds TEXT) WITH (number_of_replicas=0)",
	)
	await sql(
		"CREATE TABLE doc.user_import_item (import_id TEXT, row_index INTEGER, user_id TEXT, kind TEXT, source_key TEXT, payload TEXT, outcome TEXT, reason TEXT, tmdb_id BIGINT, media_type TEXT, current_score INTEGER, apply_state TEXT, applied_at TIMESTAMP, undo_outcome TEXT, PRIMARY KEY(import_id,row_index)) WITH (number_of_replicas=0)",
	)
	setImportDbForTest(db)
})
after(async () => {
	setImportDbForTest()
	await sql("DROP TABLE IF EXISTS doc.user_import_item")
	await sql("DROP TABLE IF EXISTS doc.user_import")
})
test("real Crate holds NULL rows, releases approvals, counts them, and fences finishing with the import version", async () => {
	const options = {
		kinds: ["rating"] as ["rating"],
		conflictChoice: "keep" as const,
		watchDates: "preserve" as const,
		ask: ["conflict"] as ["conflict"],
	}
	await sql(
		"INSERT INTO doc.user_import (id,user_id,source,status,options,created_at,updated_at) VALUES ('questions','member','letterboxd','running',?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
		[JSON.stringify({ ...options, direction: "apply" })],
	)
	await sql(
		"INSERT INTO doc.user_import_item (import_id,row_index,user_id,kind,payload,outcome,tmdb_id,media_type) VALUES ('questions',0,'member','rating',?,'conflict',42,'movie')",
		[JSON.stringify({ kind: "rating", title: "Fixture", score: 9 })],
	)
	await sql(
		"INSERT INTO doc.user_import_item (import_id,row_index,user_id,kind,payload,outcome,tmdb_id,media_type) VALUES ('questions',1,'member','rating',?,'unchanged',43,'movie')",
		[JSON.stringify({ kind: "rating", title: "Unchanged", score: 9 })],
	)
	await refreshItems()
	await holdQuestions("member", "questions", options)
	await holdQuestions("member", "questions", options)
	assert.equal(
		(await itemRows("member", "questions"))[0].applyState,
		"waiting:conflict",
	)
	assert.equal((await itemRows("member", "questions"))[1].applyState, null)
	assert.equal((await recount("questions")).processed, 1)
	const stale = await getImportRow("member", "questions")
	assert.equal(
		(
			await run(
				"UPDATE doc.user_import_item SET apply_state = ?, applied_at = CURRENT_TIMESTAMP WHERE import_id = ? AND apply_state = 'waiting:conflict'",
				["approved:conflict", "questions"],
			)
		).rowcount,
		1,
	)
	await refreshItems()
	await run(
		"UPDATE doc.user_import SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		["questions"],
	)
	assert.equal(
		await claim(
			stale,
			"status = ?, finished_at = COALESCE(finished_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP, error = ?",
			["done", null],
		),
		false,
	)
	await refreshItems()
	assert.equal(
		(await itemRows("member", "questions", true))[0].applyState,
		"approved:conflict",
	)
	assert.equal((await recount("questions")).processed, 0)
	await run(
		"UPDATE doc.user_import_item SET apply_state = ?, applied_at = CURRENT_TIMESTAMP WHERE import_id = ? AND row_index = ? AND (apply_state IS NULL OR apply_state = 'failed' OR apply_state LIKE 'approved:%')",
		["updated", "questions", 0],
	)
	const finish = async () =>
		claim(
			await getImportRow("member", "questions"),
			"status = ?, finished_at = COALESCE(finished_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP, error = ?",
			["done", null],
		)
	assert.equal(await finish(), true)
	const finished = (await getImportRow("member", "questions")).finished_at
	assert.equal(await finish(), true)
	assert.equal(
		(await getImportRow("member", "questions")).finished_at,
		finished,
	)
	assert.equal(
		await claim(
			await getImportRow("member", "questions"),
			"status = 'running', options = ?, conflict_choice = ?, confirmed_at = COALESCE(confirmed_at,CURRENT_TIMESTAMP), finished_at = NULL, updated_at = CURRENT_TIMESTAMP, error = NULL",
			[JSON.stringify({ ...options, direction: "apply" }), "keep"],
		),
		true,
	)
	assert.equal((await getImportRow("member", "questions")).finished_at, null)
})
