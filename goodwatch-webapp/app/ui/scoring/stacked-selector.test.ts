import assert from "node:assert/strict"
import { test } from "node:test"
import postcss from "postcss"
import selectorParser from "postcss-selector-parser"
import {
	compiledStackedCSS,
	currentStackedVariant,
	stackedCandidates,
} from "./stacked-css.test-support.ts"

test("production CSS minifiers retain named status-frame anchors instead of broad descendant :has invalidation", async () => {
	const candidates = stackedCandidates()
	assert.ok(candidates.length > 20, "exercise every stacked face utility")
	const css = await compiledStackedCSS(currentStackedVariant(), candidates)
	let checked = 0
	postcss.parse(css).walkRules((rule) => {
		if (!rule.selector.includes(".stacked\\:")) return
		selectorParser((selectors) => {
			selectors.each((selector) => {
				selector.walkPseudos((pseudo) => {
					if (pseudo.value !== ":has") return
					assert.equal(
						pseudo.parent?.parent?.type,
						"root",
						"the owner must be outside :is(... *)",
					)
					const nodes = selector.nodes
					const index = nodes.indexOf(pseudo)
					let start = index
					while (start > 0 && nodes[start - 1].type !== "combinator") start--
					assert.ok(
						nodes
							.slice(start, index)
							.some(
								(node) =>
									node.type === "attribute" &&
									node.attribute === "data-seen-score",
							),
						"each :has is directly anchored to its status frame",
					)
					let specificity = 0
					selector.walk((node) => {
						if (node.type === "attribute" || node.type === "class")
							specificity++
					})
					assert.equal(
						specificity,
						selector.toString().includes("[data-big]") ? 4 : 3,
						"self and descendant selectors retain their original specificity",
					)
					checked++
				})
			})
		}).processSync(rule.selector)
	})
	assert.equal(
		checked,
		candidates.length * 4,
		"both width thresholds keep both the frame and its descendants",
	)
})
