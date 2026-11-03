// The episode grid's part of a show page stays within its budget, whatever the show's length, and a scripted show
// renders whole. Googlebot reads the first 2 MB of a page; the grid sits before the cast, related titles and
// questions.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

type Shape = {
	wholeBytes: number
	wholeEstimate: number
	bytes: number
	estimate: number
	kept: boolean
	seasons: number[]
	shownEpisodes: number
	gapCells: number
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

// EPISODE_GRID_BUDGET: with the rest of a show page (about 450 KB), the page stays under about 1.5 MB.
const BUDGET = 1_000_000

test("the estimate is within 10% of the rendered HTML and loader data", () => {
	for (const [name, shape] of Object.entries(rendered)) {
		const off =
			Math.abs(shape.wholeBytes - shape.wholeEstimate) / shape.wholeBytes
		assert.ok(
			off < 0.1,
			`${name}: ${shape.wholeBytes} rendered, ${shape.wholeEstimate} estimated`,
		)
	}
})

test("every grid the page renders is within the budget", () => {
	for (const [name, shape] of Object.entries(rendered)) {
		assert.ok(shape.estimate <= BUDGET, `${name}: ${shape.estimate} estimated`)
		assert.ok(shape.bytes <= BUDGET, `${name}: ${shape.bytes} rendered`)
	}
})

test("scripted runs and long anime render whole", () => {
	for (const name of [
		"simpsons",
		"greys",
		"svu",
		"ncis",
		"onePiece",
		"short",
	]) {
		assert.equal(rendered[name].kept, true, name)
		assert.equal(rendered[name].notice, null, name)
	}
	assert.equal(rendered.simpsons.seasons.length, 38)
})

test("a sparse soap renders only its 162 cataloged episodes", () => {
	assert.equal(rendered.soap.kept, true)
	assert.equal(rendered.soap.shownEpisodes, 162)
	// 11,599 numbers, 162 rated: no empty cells for the missing numbers.
	assert.equal(rendered.soap.gapCells, 0)
	assert.ok(rendered.soap.bytes < 300_000, `${rendered.soap.bytes}`)
})

test("an extreme show keeps its newest seasons or its latest episodes, and offers the rest", () => {
	assert.equal(rendered.dailyNews.kept, false)
	assert.equal(rendered.dailyNews.seasons.at(-1), 40)
	assert.equal(
		rendered.dailyNews.notice,
		`Showing the latest ${rendered.dailyNews.seasons.length} of 40 seasons`,
	)
	assert.equal(rendered.dailyNews.button, "Show all 40 seasons")
	// A season a row makes thirty seasons of late night small enough to render whole, and a soap too.
	assert.equal(rendered.lateNight.kept, true)
	assert.equal(rendered.lateNight.shownEpisodes, 31 * 140)
	assert.equal(rendered.ratedSoap.kept, true)
	assert.equal(rendered.ratedSoap.shownEpisodes, 1572)
})
