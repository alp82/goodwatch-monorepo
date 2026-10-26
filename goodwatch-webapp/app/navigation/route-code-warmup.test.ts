// A phone's first page change to a title or a person: the route's code is ready before the tap (#753).
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

const out = execFileSync(
	"node_modules/.bin/vite-node",
	[
		"--config",
		"app/ui/imports/source-import-test-vite.config.ts",
		"app/navigation/route-code-warmup.test-support.ts",
	],
	{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
)
const rendered = JSON.parse(out.split("__WARMUP__").at(-1) ?? "") as Record<
	"first" | "afterOneLoad" | "afterPress" | "startPage" | "slow",
	string[]
>

test("what a phone shows warms its page type's code once, at low priority, three files at a time", () => {
	// Two title links on screen: one set of the title route's six files, not two, and only three loading at once.
	// Chrome can't raise a request that is already loading, so little may be in flight when the reader taps.
	assert.deepEqual(rendered.first, [
		"/assets/movie.js low",
		"/assets/details-0.js low",
		"/assets/details-1.js low",
	])
	assert.deepEqual(rendered.afterOneLoad.slice(3), ["/assets/details-2.js low"])
})

test("a press takes the files still waiting at normal priority, at once", () => {
	assert.deepEqual(rendered.afterPress.slice(4), [
		"/assets/details-3.js auto",
		"/assets/details-4.js auto",
	])
})

test("the start page and a 3G connection warm no code", () => {
	assert.deepEqual(rendered.startPage, [])
	assert.deepEqual(rendered.slow, [])
})
