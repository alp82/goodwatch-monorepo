// A guest who opened /discover?q=… got the basic results (the page load is "navigation", which buys no reading). Enter
// and the Search button on the same words are actions: each must send one request with its label. The field and the
// search run in happy-dom (describe-field-unlock.test-support.tsx).
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"

const run = (submit: string) =>
	JSON.parse(
		execFileSync(
			"node_modules/.bin/vite-node",
			[
				"--config",
				"app/ui/discover-bar/discover-controls-test-vite.config.ts",
				"app/ui/discover-bar/describe-field-unlock.test-support.tsx",
			],
			{
				encoding: "utf8",
				env: { ...process.env, SUBMIT: submit },
				stdio: ["ignore", "pipe", "ignore"],
			},
		)
			.split("__DESCRIBE_UNLOCK__")
			.at(-1) ?? "",
	) as Record<string, unknown>

for (const [submit, label] of [
	["enter", "enter"],
	["button", "search_button"],
] as const)
	test(`a link's withheld search, then ${submit === "enter" ? "Enter" : "the Search button"} on the same words: one request labeled ${label}`, () => {
		const r = run(submit)
		assert.deepEqual(
			r.afterLoad,
			["navigation"],
			"the page load buys no reading",
		)
		assert.equal(r.withheldAfterLoad, true)
		assert.deepEqual(
			r.afterSamePause,
			["navigation"],
			"a typing pause on the same words sends nothing",
		)
		assert.deepEqual(r.afterSubmit, ["navigation", label])
		assert.deepEqual(
			r.afterSecondSubmit,
			["navigation", label],
			"an answer to an action is never asked again",
		)
	})

for (const [scenario, how] of [
	["programmatic", "form.requestSubmit() with no key press or click"],
	["untrusted", "a script's Enter keydown, requestSubmit and button.click()"],
	[
		"stale",
		"an Enter that submitted nothing, then a script's submit in a later task",
	],
] as const)
	test(`${how} on a link's withheld search buys no reading`, () => {
		const r = run(scenario)
		assert.deepEqual(r.afterLoad, ["navigation"])
		assert.deepEqual(
			r.afterSubmit,
			["navigation"],
			"no request without the person's press",
		)
		assert.deepEqual(r.afterSecondSubmit, ["navigation"])
	})

test("an input method's composition: a pause mid-composition sends nothing; the confirming Enter is no submit; the committed words search after a pause", () => {
	const r = run("composition")
	assert.deepEqual(
		r.afterComposingPause,
		["navigation"],
		"unfinished composition sends nothing",
	)
	assert.deepEqual(
		r.afterCommit,
		["navigation"],
		"the confirming Enter sends nothing",
	)
	assert.deepEqual(r.afterCommitPause, ["navigation", "typing_pause"])
})

test("Safari's composition order: the 229 Enter after compositionend is no Enter", () => {
	const r = run("composition-safari")
	assert.deepEqual(r.afterComposingPause, ["navigation"])
	assert.ok(
		!(r.afterCommitPause as string[]).includes("enter"),
		`labels: ${r.afterCommitPause}`,
	)
})
