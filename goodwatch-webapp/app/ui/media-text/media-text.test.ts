import assert from "node:assert/strict"
import { test } from "node:test"
import { mediaTextAttributes } from "./media-text.ts"

test("a left-to-right language carries only its tag", () => {
	for (const lang of [
		"en",
		"de",
		"fr",
		"es",
		"it",
		"pt-BR",
		"pt-PT",
		"pl",
		"ru",
		"ja",
		"ko",
		"zh-Hans",
		"zh-Hant",
	])
		assert.deepEqual(mediaTextAttributes(lang), { lang }, lang)
})

test("Arabic runs right to left and gets room for its marks", () => {
	assert.deepEqual(mediaTextAttributes("ar"), {
		lang: "ar",
		dir: "rtl",
		"data-media-script": "tall",
	})
	assert.deepEqual(mediaTextAttributes("ar-SA"), {
		lang: "ar-SA",
		dir: "rtl",
		"data-media-script": "tall",
	})
})

test("an unknown or malformed language lets the text decide its direction", () => {
	for (const lang of [undefined, null, "", "  ", "x", "not a tag", "en_US"])
		assert.deepEqual(mediaTextAttributes(lang), { dir: "auto" }, String(lang))
})
