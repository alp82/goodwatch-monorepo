import assert from "node:assert/strict"
import { test } from "node:test"
import { hasExpectedMediaScript } from "./media-script.ts"

test("non-Latin locales require native letters, with mixed names and neutral titles allowed", () => {
	for (const locale of ["ar-SA", "ru", "ja-JP", "ko", "zh-Hans", "zh-Hant"]) {
		assert.equal(
			hasExpectedMediaScript("Sword Art Online", locale),
			false,
			locale,
		)
		assert.equal(hasExpectedMediaScript("86 / 007", locale), true, locale)
	}
	assert.equal(hasExpectedMediaScript("Sword Art Online ١٢", "ar"), false)
	for (const [locale, text] of [
		["ar", "سورد آرت أونلاين"],
		["ar", "Sword Art Online: البداية"],
		["ru", "Матрица"],
		["ja", "ソードアート・オンライン"],
		["ja", "千と千尋の神隠し"],
		["ko", "기생충"],
		["zh-Hans", "千与千寻"],
		["zh-Hant", "千與千尋"],
	]) {
		assert.equal(
			hasExpectedMediaScript(text, locale),
			true,
			`${locale}: ${text}`,
		)
	}
	assert.equal(hasExpectedMediaScript("Amélie", "fr"), true)
})
