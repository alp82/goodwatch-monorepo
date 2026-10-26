import assert from "node:assert/strict"
import { test } from "node:test"
import { priorityStatement } from "./priority-statement.ts"

test("opened source folds aliases and simultaneous poster demand into a single atomic monotonic upsert", () => {
	const statement = priorityStatement([
		{ media_type: "movie", tmdb_id: 162483 },
		{ media_type: "movie", tmdb_id: 10679, source_kind: "poster" },
		{ media_type: "movie", tmdb_id: 162483, source_kind: "opened" },
	])!
	assert.deepEqual(statement.args, ["movie", 10679, 2])
	assert.match(statement.sql, /GREATEST\(COALESCE\(last_opened_at, excluded.last_opened_at\), excluded.last_opened_at\)/)
	assert.match(statement.sql, /CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP/)
	const update = statement.sql.split("DO UPDATE SET")[1]
	assert.doesNotMatch(update, /acknowledged_demand|claimed_demand|last_success_at|lease/)
})

test("ordinary poster demand preserves existing opened time and cannot alter metadata acknowledgment", () => {
	const statement = priorityStatement([{ media_type: "show", tmdb_id: 162483 }])!
	assert.deepEqual(statement.args, ["show", 162483, 1])
	assert.match(statement.sql, /CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL/)
	assert.match(statement.sql, /WHEN excluded.last_opened_at IS NULL THEN last_opened_at/)
	assert.equal(priorityStatement([]), null)
	assert.throws(() => priorityStatement([{ media_type: "movie", tmdb_id: 0 }]))
})
