// The episode grid's part of a show page's server HTML stays bounded, whatever the show's length. Googlebot reads
// the first 2 MB of a page; the grid sits before the cast, related titles and questions.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

type Shape = {
	bytes: number
	kept: boolean
	seasons: number[]
	notice: string | null
	button: string | null
}

const rendered = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/details/episode-grid/grid-size-render.test-support.tsx",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__GRID_SIZE__")
		.at(-1) ?? "",
) as Record<string, Shape>

// The whole page stays under 1 MB with a title page's other content of about 400 KB.
const GRID_HTML_LIMIT = 560_000

test("a long show's grid renders its newest part within the limit", () => {
	for (const [name, shape] of Object.entries(rendered)) {
		assert.ok(shape.bytes < GRID_HTML_LIMIT, `${name}: ${shape.bytes} bytes`)
	}
})

test("a part says what it shows and offers the rest", () => {
	assert.equal(rendered.soap.notice, "Showing episodes 11,000 to 11,599")
	assert.equal(rendered.soap.button, "Show all 195 episodes")
	assert.deepEqual(rendered.lateNight.seasons, [30, 31])
	assert.equal(rendered.lateNight.notice, "Showing the latest 2 of 31 seasons")
	assert.equal(rendered.lateNight.button, "Show all 31 seasons")
	assert.deepEqual(
		rendered.cartoon.seasons,
		[25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38],
	)
	assert.equal(rendered.cartoon.notice, "Showing the latest 14 of 38 seasons")
})

test("a short show's grid is kept whole, without a notice", () => {
	assert.equal(rendered.short.kept, true)
	assert.equal(rendered.short.notice, null)
	assert.equal(rendered.short.button, null)
})
