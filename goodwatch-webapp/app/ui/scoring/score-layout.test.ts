import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

const drawn = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/scoring/score-layout.test-support.tsx",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__SCORE_LAYOUT__")
		.at(-1) ?? "",
) as Record<"unset" | "grid" | "band", string>
const order = (html: string) =>
	[...html.matchAll(/data-id="([^"]+)"/g)].map((m) => m[1])
const levels = ["level:3", "level:5", "level:7", "level:9"]
const scores = Array.from({ length: 10 }, (_, i) => `score:${i + 1}`)

test("the web's grid is the default: the levels, then the ten scores, in two rows", () => {
	assert.equal(drawn.unset, drawn.grid)
	assert.deepEqual(order(drawn.grid), [...levels, ...scores])
	assert.match(drawn.grid, /class="grid grid-cols-10 gap-1 @lg:gap-1.5 "/)
})

test("the band keeps the grid's order and spans, with no gap between its two rows", () => {
	assert.deepEqual(order(drawn.band), order(drawn.grid))
	assert.match(drawn.band, /gap-x-1 gap-y-0/)
	assert.match(drawn.band, /grid-column:span 4/)
})
