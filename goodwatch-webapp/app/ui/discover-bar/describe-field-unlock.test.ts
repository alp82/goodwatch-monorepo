// A guest who opened /discover?q=… got the basic results (the page load is "navigation", which buys no reading). Enter
// and the Search button on the same words are actions: each must send one request with its label. The field and the
// search run in happy-dom (describe-field-unlock.test-support.tsx).
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"

const run = (submit: "enter" | "button") =>
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
