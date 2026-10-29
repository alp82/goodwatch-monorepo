import assert from "node:assert/strict"
import { test } from "node:test"
import { TASTE_GROUPS_FIXTURE_ID, tasteGroupsKey } from "./taste-groups-key.ts"

test("taste groups cache separates members, guests, languages, and fixtures", () => {
	const identities = ["member-a", "member-b", null, TASTE_GROUPS_FIXTURE_ID]
	const keys = identities.flatMap((id) =>
		["en", "de"].map((language) =>
			JSON.stringify(tasteGroupsKey(language, id)),
		),
	)
	assert.equal(new Set(keys).size, keys.length)
	assert.deepEqual(tasteGroupsKey("en", "member-a"), [
		"discover-panel",
		"taste",
		"en",
		"member-a",
	])
})
