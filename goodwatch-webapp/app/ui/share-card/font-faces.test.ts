import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { DESIGN_FONTS, cardFontCss, titleFontPreload } from "./font-faces.ts"
import { FONT_SLICES } from "./font-slices.ts"
import { CARD_FONTS } from "./fonts.ts"

const designDir = join(import.meta.dirname, "designs")
const publicDir = join(import.meta.dirname, "../../../public")
const designKeys = readdirSync(designDir).map((file) => file.replace(/\.tsx$/, ""))

test("every design lists the font families its source names, plus Gabarito for the shared parts", () => {
	assert.deepEqual(Object.keys(DESIGN_FONTS).sort(), designKeys.sort())
	for (const key of designKeys) {
		const source = readFileSync(join(designDir, `${key}.tsx`), "utf8")
		assert.match(source, new RegExp(`key: "${key}"`))
		const named = [...source.matchAll(/fontFamily: "([^"]+)"/g)].map((match) => match[1])
		assert.deepEqual(DESIGN_FONTS[key].families, [...new Set([...named, "Gabarito"])].sort(), key)
	}
})

test("no design names a font outside an inline fontFamily string", () => {
	// The fallback rules find a card's fonts by that string in the style attribute.
	for (const key of designKeys) {
		const source = readFileSync(join(designDir, `${key}.tsx`), "utf8")
		assert.equal(source.match(/fontFamily:/g)?.length, source.match(/fontFamily: "[^",]+"/g)?.length, key)
	}
})

test("every card font has its slices as files, and each rule points at one", () => {
	for (const font of CARD_FONTS) assert.ok(FONT_SLICES[font.file]?.rest, font.file)
	const urls = [...cardFontCss().matchAll(/url\("([^"]+)"\)/g)].map((match) => match[1])
	assert.equal(urls.length, Object.values(FONT_SLICES).flatMap(Object.keys).length)
	for (const url of urls) assert.ok(existsSync(join(publicDir, url)), url)
})

test("a page with one design gets that design's fonts, and Gabarito's Latin characters from the brand font", () => {
	const css = cardFontCss("podium")
	assert.match(css, /Anton-Regular\.latin\.woff2/)
	assert.match(css, /Gabarito-Black\.rest\.woff2/)
	assert.doesNotMatch(css, /Gabarito-[A-Za-z]+\.latin/)
	assert.doesNotMatch(css, /SpaceMono|Playfair/)
	assert.match(css, /\[style\*='font-family:Anton'\]/)
	assert.match(cardFontCss(), /\[style\*='font-family: "Space Mono"'\]/)
	assert.equal(cardFontCss("no-such-design"), cardFontCss())
})

test("a design's title font is preloaded as its Latin slice, except Gabarito", () => {
	assert.equal(titleFontPreload("podium"), "/fonts/share-card/Anton-Regular.latin.woff2")
	assert.equal(titleFontPreload("bento"), null)
	for (const key of designKeys) {
		const url = titleFontPreload(key)
		if (url) assert.ok(existsSync(join(publicDir, url)), url)
	}
})
