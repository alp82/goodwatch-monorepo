import assert from "node:assert/strict"
import { test } from "node:test"
import { hideBucket, hideText } from "./hide-count.ts"

test("hide counts round down into buckets", () => {
	assert.deepEqual(hideBucket(6), { text: "6", lossy: false })
	assert.deepEqual(hideBucket(86), { text: "80", lossy: true })
	assert.deepEqual(hideBucket(880), { text: "800", lossy: true })
	assert.deepEqual(hideBucket(1000), { text: "1k", lossy: false })
	assert.deepEqual(hideBucket(23_753), { text: "23k", lossy: true })
	assert.deepEqual(hideBucket(2_400_000), { text: "2M", lossy: true })
})

test("~ marks an estimate or a bucket that lost precision", () => {
	assert.equal(hideText(86, true), "~80")
	assert.equal(hideText(6, true), "~6")
	assert.equal(hideText(21_674), "~21k")
	assert.equal(hideText(1000), "1k")
	assert.equal(hideText(0, true), "~0")
	assert.equal(hideText(0), "0")
})
