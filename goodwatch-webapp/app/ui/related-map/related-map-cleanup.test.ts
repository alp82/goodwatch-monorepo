// RelatedMap's waits end with the title they were for (#753): a page change to another title or an unmount during the
// wait starts no request for the title the reader left.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

const out = execFileSync(
	"node_modules/.bin/vite-node",
	[
		"--config",
		"app/ui/imports/source-import-test-vite.config.ts",
		"app/ui/related-map/related-map-cleanup.test-support.tsx",
	],
	{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
)
const r = JSON.parse(out.split("__CLEANUP__").at(-1) ?? "") as {
	titleChange: { first: number; second: number }
	unmount: { asked: number }
	engine: { ran: number }
}

test("a page change to another title during the wait asks only for the new title", () => {
	assert.deepEqual(r.titleChange, { first: 0, second: 1 })
})

test("a section that goes during the wait asks for nothing", () => {
	assert.equal(r.unmount.asked, 0)
})

test("the engine's waits for the old title end with the page change", () => {
	assert.equal(r.engine.ran, 0)
})
