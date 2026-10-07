// PROTOTYPE (issue #368). Checks that the playground's cases can show what they claim: every set-up plays, and
// every switch entry gives an outcome that differs from the settled rules somewhere in the presses of its case.
import assert from "node:assert/strict"
import { test } from "node:test"
import { CASES, RECOMMENDED, outcomeLine, play, withEntry } from "./cases.ts"
import { SETTLED } from "./rules.ts"

const outcomes = (found: (typeof CASES)[number], rules: typeof SETTLED) =>
	found.setups.map((setup) => {
		const actions = [...setup.done, ...setup.steps.map((s) => s.action)]
		return play(setup.start, actions, rules)
			.steps.map((s) => `${outcomeLine(s.view)} | ${s.note}`)
			.join("\n")
	})

test("there are 27 questions, r1 to r27, each with one recommended option", () => {
	const questions = CASES.flatMap((c) => c.questions)
	assert.deepEqual(
		questions.map((q) => q.number).sort((a, b) => a - b),
		Array.from({ length: 27 }, (_, i) => i + 1),
	)
	for (const q of questions)
		assert.equal(q.options.filter((o) => o.recommended).length, 1, q.id)
	assert.equal(CASES.filter((c) => c.group === "wording").length, 8)
})

for (const found of CASES) {
	test(`${found.id}: every set-up plays under the settled and the recommended rules`, () => {
		assert.equal(new Set(found.setups.map((s) => s.key)).size, found.setups.length)
		assert.equal(found.setups[0].key, "")
		outcomes(found, SETTLED)
		outcomes(found, RECOMMENDED)
	})
	for (const ruleSwitch of found.switches)
		for (const entry of ruleSwitch.entries) {
			if (Object.keys(entry.rules).length === 0) continue
			test(`${found.id}: "${entry.label}" gives another outcome than the settled rules`, () => {
				assert.notDeepEqual(
					outcomes(found, withEntry(SETTLED, ruleSwitch, entry)),
					outcomes(found, SETTLED),
				)
			})
		}
}
