import assert from "node:assert/strict"
import { test } from "node:test"
import { pillParts } from "./pill-parts.ts"

test("in a card, your score alone below 11rem, GoodWatch beside it from there", () => {
	const parts = pillParts("auto", true, true, false)
	assert.equal(parts.gw, "hidden @min-[11rem]/card:inline-flex")
	assert.equal(parts.mark, "hidden")
	assert.equal(parts.logo, "hidden")
})

test("in a card without your score, GoodWatch always and the icon from 7.5rem", () => {
	const parts = pillParts("auto", false, true, true)
	assert.equal(parts.gw, "")
	assert.equal(parts.mark, "hidden @min-[7.5rem]/card:inline-flex")
	assert.equal(parts.logo, "hidden", "no logo beside the icon")
	assert.equal(
		pillParts("auto", false, true, false).logo,
		"hidden h-3 @min-[8rem]/card:inline",
	)
})

test("a card's pill with only an icon goes under 7.5rem", () => {
	assert.equal(
		pillParts("auto", false, false, true).pill,
		"hidden @min-[7.5rem]/card:inline-flex",
	)
	assert.equal(pillParts("auto", true, false, false).pill, "")
})

test("a card hides the you label visually under 6.5rem, a fixed size never", () => {
	assert.equal(
		pillParts("auto", true, true, false).label,
		"sr-only @min-[6.5rem]/card:not-sr-only",
	)
	assert.equal(pillParts("M", true, true, true).label, "")
})

test("fixed sizes keep every part, S one number and no icon", () => {
	assert.deepEqual(pillParts("L", true, true, true), {
		gw: "",
		mark: "",
		label: "",
		logo: "h-3.5",
		pill: "",
	})
	const s = pillParts("S", true, true, true)
	assert.equal(s.gw, "hidden")
	assert.equal(s.mark, "hidden")
})
