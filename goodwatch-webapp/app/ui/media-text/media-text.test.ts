import assert from "node:assert/strict"
import { test } from "node:test"
import { mediaTextAttributes, presentedText } from "./media-text.ts"

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

test("und says the language is unknown and lets the text choose its direction", () => {
	assert.deepEqual(mediaTextAttributes("und"), { lang: "und", dir: "auto" })
})

test("a presented field reads its own language; without metadata it is canonical English", () => {
	const media = {
		presentation: {
			title: { language: "ar-SA" },
			tagline: { language: "en" },
		},
	}
	assert.deepEqual(presentedText(media, "title", "المخطوفة"), {
		text: "المخطوفة",
		lang: "ar-SA",
	})
	assert.deepEqual(presentedText(media, "tagline", "Believe."), {
		text: "Believe.",
		lang: "en",
	})
	assert.deepEqual(presentedText({}, "overview", null), { text: "", lang: "en" })
})
