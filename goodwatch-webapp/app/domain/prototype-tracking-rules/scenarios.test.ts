// PROTOTYPE (issue #368). Runs every scenario and asserts the outcomes written next to its steps, under the
// settled rules and under the compared reading. Also checks that the committed report is what the module prints.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { renderReport, run } from "./report.ts"
import { SETTLED } from "./rules.ts"
import { SCENARIOS } from "./scenarios.ts"
import { SURPRISES } from "./surprises.ts"
import { REPORT_PATH } from "./write-report.ts"

for (const scenario of SCENARIOS) {
	test(`${scenario.title}: the settled rules`, () => {
		const lines = run(scenario)
		scenario.steps.forEach((step, index) => {
			const { row, note } = lines[index + 1]
			for (const [key, expected] of Object.entries(step.expect ?? {}))
				assert.equal(
					row[key as keyof typeof row],
					expected,
					`"${step.label}": ${key} (${note})`,
				)
		})
	})

	const compare = scenario.compare
	if (!compare) continue
	test(`${scenario.title}: ${compare.label}`, () => {
		const lines = run(scenario, { ...SETTLED, ...compare.rules })
		scenario.steps.forEach((step, index) => {
			const { row } = lines[index + 1]
			for (const [key, expected] of Object.entries(step.expectAlt ?? {}))
				assert.equal(
					row[key as keyof typeof row],
					expected,
					`"${step.label}": ${key}`,
				)
		})
	})
}

test("every surprise points at scenarios that exist, and every scenario key is unique", () => {
	const keys = SCENARIOS.map((s) => s.key)
	assert.equal(new Set(keys).size, keys.length)
	for (const surprise of SURPRISES) {
		assert.ok(surprise.scenarios.length > 0, surprise.title)
		for (const key of surprise.scenarios)
			assert.ok(keys.includes(key), `${surprise.title}: ${key}`)
	}
})

test("the committed report is what the module prints", () => {
	assert.equal(
		readFileSync(REPORT_PATH, "utf8"),
		renderReport(SCENARIOS, SURPRISES),
		"run: node app/domain/prototype-tracking-rules/write-report.ts",
	)
})
