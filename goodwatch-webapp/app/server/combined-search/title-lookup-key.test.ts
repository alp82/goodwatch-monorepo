import assert from "node:assert/strict"
import { test } from "node:test"
import { titleLookupKey } from "./title-lookup-key.server.ts"

test("the title lookup cache key carries the alias rules version", () => {
	const key = titleLookupKey("Der Pate", false, 1)
	assert.equal(titleLookupKey(" der pate ", false, 1), key, "the same text")
	assert.notEqual(
		titleLookupKey("Der Pate", false, 0),
		key,
		"a build without aliases",
	)
	assert.notEqual(titleLookupKey("Der Pate", false, 2), key, "new alias rules")
	assert.notEqual(titleLookupKey("Der Pate", true, 1), key, "the adult policy")
	assert.doesNotMatch(key, /pate/i, "a digest, never the text")
})
