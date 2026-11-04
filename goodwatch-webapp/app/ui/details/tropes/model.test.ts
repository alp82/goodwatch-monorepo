import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const { commonness, letterId, letterOf, openText, rowId, snippet } =
	await import("./model.ts")
const { safeTeaser } = await import("./excerpt.ts")

test("letters sort past leading quotes, digits under #", () => {
	assert.equal(letterOf('"Bringer of War" Music'), "B")
	assert.equal(letterOf("2001 Effect"), "#")
	assert.equal(letterOf("Élan"), "#")
	assert.equal(letterOf("zany"), "Z")
	assert.equal(letterId("#"), "tropes-letter-0")
	assert.equal(letterId("Q"), "tropes-letter-Q")
})

test("a row id is a safe DOM id", () => {
	assert.equal(
		rowId("https://tvtropes.org/pmwiki/pmwiki.php/Main/BigBad"),
		"trope-https-tvtropes-org-pmwiki-pmwiki-php-Main-BigBad",
	)
	assert.ok(rowId(`label:${"x".repeat(200)}`).length <= 86)
})

test("the open text never shows a spoiler", () => {
	assert.equal(
		openText([
			[{ text: "Paul rides a worm." }, { text: "He wins.", spoiler: true }],
			[{ text: "Then more." }],
		]),
		"Paul rides a worm. …  Then more.",
	)
	assert.equal(openText(undefined), "")
})

test("a find snippet starts at a word a little before the match", () => {
	const text =
		"Early in the novels, long before the war, the Fremen ride the great sandworms across the open desert at night."
	const at = text.indexOf("sandworms")
	const s = snippet(text, at, 9)
	assert.equal(
		s,
		"…before the war, the Fremen ride the great sandworms across the open desert at night.",
	)
	assert.equal(snippet(text, 6, 2).startsWith("Early in"), true)
})

test("commonness is a log-scale fill between a sliver and full", () => {
	assert.ok(Math.abs(commonness(1) - 0.07) < 0.001)
	assert.equal(commonness(20_000), 1)
	assert.equal(commonness(1_000_000), 1)
	assert.ok(commonness(100) < commonness(1000))
})

test("the teaser is the first spoiler-free sentences", () => {
	assert.equal(
		safeTeaser([
			[{ text: "Spoiled.", spoiler: true }],
			[
				{ text: "Chani serves as the audience surrogate for the film. " },
				{ text: "She leaves.", spoiler: true },
			],
		]),
		"Chani serves as the audience surrogate for the film.",
	)
	assert.equal(safeTeaser([[{ text: "Short." }]]), null)
})
