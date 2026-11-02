import assert from "node:assert/strict"
import { test } from "node:test"
import { evaluateCase } from "./evaluate.mjs"

const result = (filters = {}, residual = "", warnings = []) => ({
	filters: { services: "all", unseen: "0", ...filters },
	residual,
	warnings,
})
test("a missing constraint makes the evaluator fail", () => {
	assert.equal(
		evaluateCase({ expect: { score: "80" } }, result()).status,
		"Mismatch",
	)
})
test("strict negative cases catch unwanted positive filters", () => {
	assert.equal(
		evaluateCase({ expect: {}, exact: true }, result({ genres: "Horror" }))
			.status,
		"Mismatch",
	)
})
test("leftover connector words make residual assertions fail", () => {
	assert.equal(
		evaluateCase({ residualEquals: "" }, result({}, "similar but")).status,
		"Mismatch",
	)
})
test("required explanations and forbidden errors are asserted", () => {
	assert.equal(
		evaluateCase({ warningContains: "unsupported" }, result()).status,
		"Mismatch",
	)
	assert.equal(
		evaluateCase(
			{ noWarningContains: "Unresolved person" },
			result({}, "", ["Unresolved person: bad scores"]),
		).status,
		"Mismatch",
	)
})
test("list order is immaterial but missing people are failures", () => {
	assert.equal(
		evaluateCase({ expect: { people: "31,287" } }, result({ people: "287,31" }))
			.status,
		"Matches expectations",
	)
	assert.equal(
		evaluateCase({ expect: { people: "31,287" } }, result({ people: "31" }))
			.status,
		"Mismatch",
	)
})
test("errors and unasserted probes are never counted as passed cases", () => {
	assert.equal(evaluateCase({}, result()).status, "Review probe")
	assert.equal(
		evaluateCase({ expect: {} }, { error: "Invalid request" }).status,
		"Error",
	)
})
