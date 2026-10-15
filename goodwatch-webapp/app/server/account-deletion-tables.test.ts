// Account deletion (#553) has to reach every CrateDB table that holds a member's rows. The repository's schemas
// (goodwatch-flows/windmill/f/sync/models/crate_schemas.py) are where a new table is declared, so a `user_*` table
// added there and missing from MEMBER_TABLES fails here. Tables created by hand at the auth cut-over, outside the daily
// schema initializer, are declared in their own SQL file and checked the same way.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { MEMBER_TABLES } from "./account-deletion-tables.ts"

const schemas = readFileSync(
	new URL(
		"../../../goodwatch-flows/windmill/f/sync/models/crate_schemas.py",
		import.meta.url,
	),
	"utf8",
)
const handCreated = readFileSync(
	new URL("../../../docs/implementation/mcp-write-tools-schema.sql", import.meta.url),
	"utf8",
)
const handCreatedTables = [...handCreated.matchAll(/^CREATE TABLE doc\.(user_[a-z_]+) \(([^;]+)\)/gm)]

test("account deletion covers every user_* table in the repository's CrateDB schemas", () => {
	const declared = [...schemas.matchAll(/^ {4}"(user_[a-z_]+)": \{/gm)]
		.map((m) => m[1])
		.concat(handCreatedTables.map((m) => m[1]))
		.sort()
	assert.ok(
		declared.length >= 15,
		"the schema file still declares the member tables",
	)
	assert.deepEqual([...MEMBER_TABLES].sort(), declared)
})

test("every member table is read and deleted by its user_id column", () => {
	for (const table of MEMBER_TABLES) {
		const sql = handCreatedTables.find((m) => m[1] === table)
		if (sql) {
			assert.match(sql[2], /^\s+user_id TEXT/m, `${table} has a user_id column`)
			continue
		}
		const start = schemas.indexOf(`    "${table}": {`)
		const body = schemas.slice(start, schemas.indexOf("\n    },", start))
		assert.match(body, /"user_id": "TEXT/, `${table} has a user_id column`)
	}
})
