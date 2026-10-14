import assert from "node:assert/strict"
import { test } from "node:test"
import {
	onlySideChanged,
	openingSide,
	requestedSide,
	withSide,
} from "./side-address.ts"

const sides = [{ id: "side-1" }, { id: "side-2" }, { id: "side-3" }]
const url = (path: string) => new URL(path, "https://goodwatch.app")

test("the address asks for a side by its id, or for none", () => {
	assert.equal(requestedSide(new URLSearchParams("side=side-2")), "side-2")
	assert.equal(requestedSide(new URLSearchParams("")), null)
	assert.equal(requestedSide(new URLSearchParams("side=")), null)
})

test("the page opens on the side asked for when the person has it", () => {
	assert.equal(openingSide(sides, "side-3", "side-2"), "side-3")
})

test("without a side, or with one the person does not have, the page opens as it always did", () => {
	assert.equal(openingSide(sides, null, "side-2"), "side-2")
	assert.equal(openingSide(sides, "side-9", "side-2"), "side-2")
	assert.equal(openingSide(sides, "side-9", null), "side-1")
	assert.equal(openingSide([], "side-1", null), "")
})

test("a side picked on the page takes the address's place, and the rest of the address stays", () => {
	assert.equal(
		withSide(new URLSearchParams("side=side-1&utm=tv"), "side-2").toString(),
		"side=side-2&utm=tv",
	)
	assert.equal(withSide(new URLSearchParams("side=side-9"), null).toString(), "")
	assert.equal(withSide(new URLSearchParams(""), "side-1").toString(), "side=side-1")
})

test("a change of side alone keeps the page's data; anything else is another page", () => {
	assert.equal(onlySideChanged(url("/taste"), url("/taste?side=side-2")), true)
	assert.equal(onlySideChanged(url("/taste?side=side-1"), url("/taste?side=side-2")), true)
	assert.equal(onlySideChanged(url("/taste?side=side-1"), url("/taste")), true)
	assert.equal(onlySideChanged(url("/taste?side=side-1"), url("/taste/everyone")), false)
	assert.equal(onlySideChanged(url("/taste"), url("/taste?services=8")), false)
})
