import assert from "node:assert/strict"
import { test } from "node:test"
import { PROFILE_PUBLIC_SINCE, owesProfilesStrip } from "./profile.ts"

test("the profiles strip goes to members whose handle predates profiles, until they confirm", () => {
	assert.equal(owesProfilesStrip("2025-03-01T10:00:00.000Z", false), true)
	assert.equal(owesProfilesStrip("2025-03-01T10:00:00.000Z", true), false)
})

test("members who claim a handle after the release, or have none, never get it", () => {
	assert.equal(owesProfilesStrip(PROFILE_PUBLIC_SINCE, false), false)
	assert.equal(owesProfilesStrip("2026-11-02T08:00:00.000Z", false), false)
	assert.equal(owesProfilesStrip(null, false), false)
})
