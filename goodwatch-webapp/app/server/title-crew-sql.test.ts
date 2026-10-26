import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { test } from "node:test"
import {
	crewPeople,
	selectedCrewCTEs,
	type CrewRole,
} from "./title-crew-sql.ts"

// Exercise the actual SQL predicate, grouping and ordering offline. Crate-specific
// ARRAY/object projections are outside this standard SQL selection; production
// Crate comparisons cover those projections as well.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite")
type Row = [
	number,
	string | null,
	string,
	string,
	string | null,
	number | null,
	number | null,
]
function select(role: CrewRole, rows: Row[], limit: 3 | 5 = 3) {
	const db = new DatabaseSync(":memory:")
	try {
		db.exec(
			"CREATE TABLE crew_rows (id INTEGER, credit_id TEXT, name TEXT, job TEXT, department TEXT, episode_count_total INTEGER, popularity REAL)",
		)
		const insert = db.prepare(
			"INSERT INTO crew_rows VALUES (?, ?, ?, ?, ?, ?, ?)",
		)
		for (const row of rows) insert.run(...row)
		// Replace only Crate's object/ARRAY projection with an id projection.
		// Keep the production CTEs, ordering and renderer-specific limits intact.
		const selection = crewPeople(role, limit)
			.slice("ARRAY(".length, -1)
			.replace("{id = id, credit_id = credit_id, name = name}", "id")
		return db
			.prepare(`WITH ${selectedCrewCTEs} ${selection}`)
			.all()
			.map((row: { id: number }) => row.id)
	} finally {
		db.close()
	}
}

test("exact director, producer and composer jobs beat popular department colleagues without filling spare slots", () => {
	for (const [role, job, department] of [
		["directors", "Director", "Directing"],
		["producers", "Producer", "Production"],
		["composers", "Original Music Composer", "Sound"],
	] as const) {
		assert.deepEqual(
			select(role, [
				[1, "a", "Assistant", "Assistant", department, 100, 100],
				[2, "b", "Credited person", job, null, null, 1],
			]),
			[2],
		)
	}
})

test("Written by accepts Writer, Screenplay, Story and Novel without department noise", () => {
	assert.deepEqual(
		select("writers", [
			[1, "a", "Other", "Script Consultant", "Writing", 100, 100],
			[2, "b", "Writer", "Writer", null, 4, 1],
			[3, "c", "Screenwriter", "Screenplay", null, 3, 1],
			[4, "d", "Story author", "Story", null, 2, 1],
			[5, "e", "Novelist", "Novel", null, 1, 1],
		]),
		[2, 3, 4],
	)
	assert.deepEqual(
		select("writers", [[5, "e", "Novelist", "Novel", null, 1, 1]]),
		[5],
	)
})

test("Music is an exact composer job even without a Sound department", () => {
	assert.deepEqual(
		select("composers", [
			[1, "a", "Mixer", "Sound Mixer", "Sound", 100, 100],
			[2, "b", "Composer", "Music", null, null, 1],
		]),
		[2],
	)
})

test("Music Director and Co-Director beat department fallback without requiring a department", () => {
	for (const [role, job, department] of [
		["composers", "Music Director", "Sound"],
		["directors", "Co-Director", "Directing"],
	] as const) {
		assert.deepEqual(
			select(role, [
				[1, "a", "Department colleague", "Assistant", department, 100, 100],
				[2, "b", "Credited person", job, null, 1, 1],
			]),
			[2],
		)
	}
})

test("director and composer credits keep five people while page lines keep the same first three", () => {
	for (const [role, job] of [
		["directors", "Director"],
		["composers", "Music Director"],
	] as const) {
		const rows: Row[] = [6, 4, 2, 5, 3, 1].map((id) => [
			id,
			`credit-${id}`,
			`Person ${id}`,
			job,
			null,
			10 - id,
			1,
		])
		assert.deepEqual(select(role, rows), [1, 2, 3])
		assert.deepEqual(select(role, rows, 5), [1, 2, 3, 4, 5])
	}
})

test("department fallback applies only when no accepted job exists", () => {
	for (const [role, department] of [
		["directors", "Directing"],
		["writers", "Writing"],
		["producers", "Production"],
		["composers", "Sound"],
	] as const) {
		assert.deepEqual(
			select(role, [
				[1, "a", "Assistant", "Assistant", department, 2, 1],
				[2, "b", "Supervisor", "Supervisor", department, 1, 100],
				[3, "c", "Other", "Other", "Camera", 100, 100],
			]),
			[1, 2],
		)
	}
	assert.deepEqual(
		select("composers", [[3, "c", "Creator", "Creator", null, null, 100]]),
		[],
	)
})

test("show aggregate jobs rank by episodes before popularity; Creator is a distinct job", () => {
	assert.deepEqual(
		select("directors", [
			[1, "a", "Creator", "Creator", null, null, 1000],
			[2, "b", "Guest director", "Director", null, 1, 100],
			[3, "c", "Regular director", "Director", null, 20, 1],
		]),
		[3, 2],
	)
})

test("multiple writing jobs name a person once before the three-person limit", () => {
	assert.deepEqual(
		select("writers", [
			[1, "a", "Author", "Writer", null, 10, 10],
			[1, "b", "Author", "Screenplay", null, 10, 10],
			[1, "c", "Author", "Story", null, 10, 10],
			[2, "d", "Other author", "Novel", null, 5, 5],
		]),
		[1, 2],
	)
})

test("ties including null credit IDs have the same selection regardless of input order", () => {
	const rows: Row[] = [4, 2, 3, 1].map((id) => [
		id,
		null,
		`Person ${id}`,
		"Director",
		null,
		null,
		null,
	])
	assert.deepEqual(select("directors", rows), [1, 2, 3])
	assert.deepEqual(select("directors", [...rows].reverse()), [1, 2, 3])
})

test("credit order remains ahead of person id when episode count and popularity tie", () => {
	assert.deepEqual(
		select("directors", [
			[1, null, "Missing credit", "Director", null, 2, 1],
			[2, "b", "Second credit", "Director", null, 2, 1],
			[3, "a", "First credit", "Director", null, 2, 1],
		]),
		[3, 2, 1],
	)
})
