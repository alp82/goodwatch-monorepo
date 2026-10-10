import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import {
	CrateTimeoutError,
	insertRows,
	setCrateClientForTest,
} from "./crate.ts"

interface Sent {
	sql: string
	params: unknown[]
}

function fake(answer: (sent: Sent, index: number) => number = () => -1) {
	const sent: Sent[] = []
	setCrateClientForTest({
		async execute(raw, params = []) {
			const statement = { sql: raw.trim().replace(/\s+/g, " "), params }
			sent.push(statement)
			const rowcount = answer(statement, sent.length - 1)
			return {
				json: [],
				rowcount: rowcount < 0 ? params.length / 3 : rowcount,
			}
		},
	})
	return sent
}

afterEach(() => setCrateClientForTest(null))

const COLUMNS = ["user_id", "watch_id", "pass"]
const rows = (count: number) =>
	Array.from({ length: count }, (_, index) => ["member", `w-${index}`, 1])

test("327 rows are one statement that names every row and ignores the ones already there", async () => {
	const sent = fake()
	const result = await insertRows("user_watch_log", COLUMNS, rows(327), {
		conflict: ["user_id", "watch_id"],
	})
	assert.equal(sent.length, 1)
	assert.ok(
		sent[0].sql.startsWith(
			'INSERT INTO user_watch_log ("user_id", "watch_id", "pass") VALUES (?, ?, ?), (?, ?, ?)',
		),
		sent[0].sql,
	)
	assert.ok(
		sent[0].sql.endsWith('ON CONFLICT ("user_id", "watch_id") DO NOTHING'),
		sent[0].sql,
	)
	assert.equal(sent[0].sql.split("(?, ?, ?)").length - 1, 327)
	assert.equal(sent[0].params.length, 327 * 3)
	assert.deepEqual(sent[0].params.slice(0, 6), [
		"member",
		"w-0",
		1,
		"member",
		"w-1",
		1,
	])
	assert.deepEqual(result, { rowcount: 327, statements: 1 })
})

test("rows are sent 500 to a statement, in order", async () => {
	const sent = fake()
	const result = await insertRows("user_watch_log", COLUMNS, rows(1200), {
		conflict: ["user_id", "watch_id"],
	})
	assert.deepEqual(
		sent.map((s) => s.params.length / 3),
		[500, 500, 200],
	)
	assert.equal(sent[1].params[1], "w-500")
	assert.equal(sent[2].params[1], "w-1000")
	assert.deepEqual(result, { rowcount: 1200, statements: 3 })
})

test("the chunk size can be set, and the count is what Crate says it inserted", async () => {
	const sent = fake((_, index) => (index === 0 ? 2 : 0))
	const result = await insertRows("user_watch_log", COLUMNS, rows(5), {
		conflict: ["user_id", "watch_id"],
		chunk: 2,
	})
	assert.equal(sent.length, 3)
	assert.deepEqual(result, { rowcount: 2, statements: 3 })
})

test("no rows is no statement", async () => {
	const sent = fake()
	assert.deepEqual(
		await insertRows("user_watch_log", COLUMNS, [], {
			conflict: ["user_id", "watch_id"],
		}),
		{ rowcount: 0, statements: 0 },
	)
	assert.equal(sent.length, 0)
})

test("a row that does not have one value per column is refused before anything is sent", async () => {
	const sent = fake()
	await assert.rejects(
		insertRows("user_watch_log", COLUMNS, [["member", "w-1"]], {
			conflict: ["user_id", "watch_id"],
		}),
		/3 columns/,
	)
	assert.equal(sent.length, 0)
})

test("after a timeout the same statement is sent again, because every key was fixed before the write", async () => {
	const sent: Sent[] = []
	let calls = 0
	setCrateClientForTest({
		async execute(raw, params = []) {
			sent.push({ sql: raw, params })
			calls += 1
			if (calls === 1) throw new CrateTimeoutError(10)
			return { json: [], rowcount: 0 }
		},
	})
	const result = await insertRows("user_watch_log", COLUMNS, rows(2), {
		conflict: ["user_id", "watch_id"],
	})
	assert.equal(sent.length, 2)
	assert.deepEqual(sent[1], sent[0])
	assert.deepEqual(result, { rowcount: 0, statements: 1 })
})

test("a second timeout, and any other failure, reach the caller", async () => {
	setCrateClientForTest({
		async execute() {
			throw new CrateTimeoutError(10)
		},
	})
	await assert.rejects(
		insertRows("user_watch_log", COLUMNS, rows(1), {
			conflict: ["user_id", "watch_id"],
		}),
		CrateTimeoutError,
	)
	let calls = 0
	setCrateClientForTest({
		async execute() {
			calls += 1
			throw new Error("refused")
		},
	})
	await assert.rejects(
		insertRows("user_watch_log", COLUMNS, rows(1), {
			conflict: ["user_id", "watch_id"],
		}),
		/refused/,
	)
	assert.equal(calls, 1)
})
