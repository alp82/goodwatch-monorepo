import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { it } from "node:test"
it("stores large collection metadata without the CrateDB indexed/column-store text limit in both schema paths", () => {
	const migration = readFileSync(
		new URL(
			"../../../../docs/implementation/share-lists/imported-lists-migration.sql",
			import.meta.url,
		),
		"utf8",
	)
	const schema = readFileSync(
		new URL(
			"../../../../goodwatch-flows/windmill/f/sync/models/crate_schemas.py",
			import.meta.url,
		),
		"utf8",
	)
	assert.match(
		migration,
		/ADD COLUMN collection_metadata TEXT INDEX OFF STORAGE WITH \(columnstore = false\)/,
	)
	assert.match(
		schema,
		/"collection_metadata": "TEXT INDEX OFF STORAGE WITH \(columnstore = false\)"/,
	)
})
