import assert from "node:assert/strict"
import { test } from "node:test"
import { candidateCatalogReader } from "./build-reader.ts"

test("candidate queries serialize independently and release the lane after failure", async () => {
	const calls: string[] = []
	let finish: () => void = () => {}
	const read = candidateCatalogReader(async (sql) => {
		calls.push(sql)
		if (sql === "first") {
			await new Promise<void>((resolve) => {
				finish = resolve
			})
			throw Error("timeout")
		}
		return []
	})
	const first = read("first", [])
	const rejection = assert.rejects(first, /timeout/)
	const second = read("second", [])
	await new Promise((resolve) => setImmediate(resolve))
	assert.deepEqual(calls, ["first"])
	finish()
	await rejection
	await second
	assert.deepEqual(calls, ["first", "second"])
})
