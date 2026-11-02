import "./title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
const { recommendationFingerprint } = await import(
	"./recommendation-fingerprint.ts"
)
const { VALID_FINGERPRINT_KEYS } = await import("./utils/fingerprint.ts")
test("short fingerprint descriptions exclude missing scores and craft, and keep the strongest three", () => {
	const fp = new Uint8Array(VALID_FINGERPRINT_KEYS.length)
	const set = (key: string, value: number) =>
		(fp[
			VALID_FINGERPRINT_KEYS.indexOf(
				key as (typeof VALID_FINGERPRINT_KEYS)[number],
			)
		] = value)
	set("acting", 10)
	set("scare", 255)
	set("tension", 9)
	set("wonder", 8)
	set("mystery", 7)
	set("romance", 6)
	assert.deepEqual(recommendationFingerprint(fp), [
		"tension",
		"wonder",
		"mystery",
	])
	assert.deepEqual(recommendationFingerprint(null), [])
	assert.deepEqual(recommendationFingerprint(new Uint8Array(74)), [])
})
