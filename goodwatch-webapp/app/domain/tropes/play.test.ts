import assert from "node:assert/strict"
import { test } from "node:test"
import { isPlay, playOf } from "./play.ts"

test("playOf reads the opening words of a write-up", () => {
	assert.equal(playOf("Subverted: the hero dies."), "subverted")
	assert.equal(playOf("Double subverted when she comes back."), "subverted")
	assert.equal(playOf("Partially averted, since nobody notices."), "averted")
	assert.equal(playOf('"Inverted" with the villain.'), "inverted")
	assert.equal(playOf("Lampshaded by the narrator."), "lampshaded")
	assert.equal(playOf("Zig-zagged throughout the series."), "played-with")
	assert.equal(playOf("  Exaggerated to absurd levels."), "exaggerated")
	assert.equal(playOf("Downplayed: only one scene."), "downplayed")
})

test("playOf treats everything else as played straight", () => {
	assert.equal(playOf("Ripley is the lone survivor."), "straight")
	assert.equal(playOf(""), "straight")
	assert.equal(playOf("The subverted expectations come later."), "straight")
})

test("isPlay accepts only known plays", () => {
	assert.equal(isPlay("averted"), true)
	assert.equal(isPlay("twisted"), false)
	assert.equal(isPlay(3), false)
})
