import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

const rendered = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/scoring/score-control.test-support.tsx",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__SCORE_CONTROL__")
		.at(-1)!,
) as { library: string; faces: string[]; empty: string; scored: string[]; busy: string }
const buttons = (html: string) =>
	[...html.matchAll(/<button\b[^>]*>/g)].map((match) => match[0])

test("every score, including no score, offers four words and all ten numbers", () => {
	for (const html of [rendered.empty, ...rendered.scored]) {
		for (const [word, n] of [
			["Bad", 3],
			["Mediocre", 5],
			["Good", 7],
			["Excellent", 9],
		])
			assert.ok(html.includes(`aria-label="${word}, ${n}"`))
		assert.equal(buttons(html).filter((b) => /data-give=/.test(b)).length, 10)
	}
})

test("each saved exact score and its coarse group are independently marked; numerals remain white", () => {
	for (const [i, html] of rendered.scored.entries()) {
		const marked = buttons(html).filter((b) =>
			b.includes('aria-pressed="true"'),
		)
		assert.equal(marked.length, 2)
		const exact = marked.find((b) => b.includes(`data-give="${i + 1}"`))
		assert.ok(exact)
		assert.match(exact, /color:#fff/)
		assert.match(exact, /box-shadow:inset/)
	}
})

test("pending submission disables every score button and Clear for keyboard as well as pointer", () => {
	assert.equal(buttons(rendered.busy).length, 15)
	for (const button of buttons(rendered.busy))
		assert.match(button, /disabled=""/)
	assert.match(rendered.busy, /<fieldset disabled=""/)
})

test("saved-score faces render every number in white on the shared selected fill", () => {
	assert.equal(rendered.faces.length, 10)
	for (const html of rendered.faces) {
		assert.match(html, /color:#fff/)
		assert.match(html, /42%, #181b20/)
	}
})


test("library row and bulk picker share words, exact scores and the comparison dot", () => {
	assert.equal(buttons(rendered.library).length, 14)
	assert.match(rendered.library, /aria-label="Good, 7"/)
	assert.match(rendered.library, /aria-label="Your score for Dune"/)
	assert.match(buttons(rendered.library).find((b) => b.includes('data-give="7"'))!, /color:#fff/)
	assert.match(rendered.library, /bottom-1 h-1 w-1/)
})
