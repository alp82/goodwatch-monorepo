// A NULL timestamp reaches the app as null. node-crate builds every timestamp column with `new Date(value)`, and
// `new Date(null)` is 1 January 1970, so the client builds the rows itself. Against a real HTTP answer in Crate's
// format, because the conversion sits in the driver, behind anything a fake client could replace.
import assert from "node:assert/strict"
import { createServer } from "node:http"
import { test } from "node:test"
import { execute, getCrateClient, query, setCrateClientForTest, timestampsAsMillis } from "./crate.ts"

const TIMESTAMPTZ = 11
const TIMESTAMP = 15
const BIGINT = 10
const TEXT = 4
const ARRAY = 100

test("a NULL timestamp is null, a stored one a Date, and no other type is touched", async (t) => {
	const answer = {
		cols: ["dismissed_at", "air_date", "watched_at", "updated_at", "zero_at", "n", "name", "days"],
		col_types: [TIMESTAMPTZ, TIMESTAMP, TIMESTAMPTZ, TIMESTAMP, TIMESTAMPTZ, BIGINT, TEXT, [ARRAY, TIMESTAMPTZ]],
		rows: [
			[null, null, 1791438939443, 1700000000000, 0, null, null, [null, 1700000000000]],
			[1791438939443, 1700000000000, null, null, null, 0, "", null],
		],
		rowcount: 2,
		duration: 1,
	}
	const server = createServer((req, res) => {
		req.resume()
		req.on("end", () => {
			res.setHeader("Content-Type", "application/json")
			res.end(JSON.stringify(answer))
		})
	})
	const previous = { ...process.env }
	t.after(async () => {
		for (const key of ["CRATE_HOSTS", "CRATE_PORT", "CRATE_USER", "CRATE_PASS"]) {
			if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]
		}
		setCrateClientForTest(null)
		server.closeAllConnections()
		await new Promise((resolve) => server.close(resolve))
	})
	for (const method of ["log", "error", "trace", "warn"] as const) t.mock.method(console, method, () => {})
	await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve) })
	const address = server.address()
	assert.ok(address && typeof address !== "string")
	Object.assign(process.env, { CRATE_HOSTS: "127.0.0.1", CRATE_PORT: String(address.port), CRATE_USER: "", CRATE_PASS: "" })
	setCrateClientForTest(null)

	const expected = [
		{
			dismissed_at: null,
			air_date: null,
			watched_at: new Date(1791438939443),
			updated_at: new Date(1700000000000),
			// A stored 0 is a stored value: only NULL is null.
			zero_at: new Date(0),
			n: null,
			name: null,
			days: [null, 1700000000000],
		},
		{
			dismissed_at: new Date(1791438939443),
			air_date: new Date(1700000000000),
			watched_at: null,
			updated_at: null,
			zero_at: null,
			n: 0,
			name: "",
			days: null,
		},
	]
	assert.deepStrictEqual(await query("SELECT a_row"), expected)
	assert.deepStrictEqual((await execute("SELECT a_row")).json, expected)
	const selected = await getCrateClient().select("SELECT a_row")
	assert.deepStrictEqual(selected.result, expected)
	// The raw answer is still there for a reader that wants it.
	assert.deepStrictEqual(selected.rows, answer.rows)
	assert.deepStrictEqual(selected.cols, answer.cols)

	// For a reader that works in epoch milliseconds: equal moments are equal numbers, and NULL stays null.
	assert.deepStrictEqual(timestampsAsMillis(expected)[0], {
		...expected[0],
		watched_at: 1791438939443,
		updated_at: 1700000000000,
		zero_at: 0,
	})
})
