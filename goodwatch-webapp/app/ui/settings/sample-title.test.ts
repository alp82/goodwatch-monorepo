// The Show titles in tile shows its sample title only when that title is in the chosen language: a translation, the
// original title in its own language, or the English title for English. Production's answers for Spirited Away.
import assert from "node:assert/strict"
import { test } from "node:test"
import { titleIsIn } from "./sample-title.ts"

test("a translation is in its language, tagged with a region", () => {
	assert.equal(
		titleIsIn(
			{ language: "de-DE", source: "localized", fallback: false },
			"de",
		),
		true,
	)
	assert.equal(
		titleIsIn(
			{ language: "zh-CN", source: "localized", fallback: false },
			"zh-Hans",
		),
		true,
	)
	assert.equal(
		titleIsIn(
			{ language: "zh-TW", source: "localized", fallback: false },
			"zh-Hant",
		),
		true,
	)
	assert.equal(
		titleIsIn(
			{ language: "pt-BR", source: "localized", fallback: false },
			"pt-BR",
		),
		true,
	)
})

test("the original title counts for its own language, the English one for English", () => {
	assert.equal(
		titleIsIn({ language: "ja", source: "original", fallback: true }, "ja"),
		true,
	)
	assert.equal(
		titleIsIn({ language: "en", source: "canonical", fallback: true }, "en"),
		true,
	)
})

test("a title that fell back to another language isn't shown as the chosen one", () => {
	assert.equal(
		titleIsIn({ language: "en", source: "canonical", fallback: true }, "ko"),
		false,
	)
	assert.equal(
		titleIsIn({ language: "ja", source: "original", fallback: true }, "ko"),
		false,
	)
	assert.equal(titleIsIn(undefined, "de"), false)
})

test("Chinese and Portuguese are told apart by script and region", () => {
	assert.equal(titleIsIn({ language: "zh-TW", source: "original", fallback: true }, "zh-Hans"), false)
	assert.equal(titleIsIn({ language: "zh-TW", source: "original", fallback: true }, "zh-Hant"), true)
	assert.equal(titleIsIn({ language: "pt-PT", source: "original", fallback: true }, "pt-BR"), false)
	assert.equal(titleIsIn({ language: "pt-BR", source: "original", fallback: true }, "pt-BR"), true)
})
