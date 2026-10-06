import assert from "node:assert/strict"
import { test } from "node:test"
import type { SnapshotRow } from "../title-snapshot/format.server"
import type {
	TitleFacts,
	TitleSnapshot,
} from "../title-snapshot/snapshot.server"
import "../title-filter/test-alias.ts"

const { encodeSnapshot, joinChunks } = await import(
	"../title-snapshot/format.server.ts"
)
const { buildSnapshot } = await import("../title-snapshot/snapshot.server.ts")
const { VALID_FINGERPRINT_KEYS } = await import("../utils/fingerprint.ts")
const { selectCandidateRows } = await import("./pool-select.server.ts")

function title(
	pointId: number,
	changes: Partial<SnapshotRow> = {},
): SnapshotRow {
	return {
		pointId,
		genres: ["comedy"],
		releaseDay: 19000,
		votes: 20000,
		popularity: 2,
		fingerprint: new Uint8Array(74).fill(5),
		score: 80,
		origin: "US",
		hasPoster: true,
		hasBackdrop: true,
		adult: false,
		anime: false,
		...changes,
	}
}

function snapshotOf(rows: SnapshotRow[]) {
	const { manifest, chunks } = encodeSnapshot({
		version: "pool-select-test",
		builtAt: new Date("2026-01-01"),
		keyOrder: VALID_FINGERPRINT_KEYS,
		rows,
	})
	return buildSnapshot(manifest, joinChunks(manifest, chunks))
}

function reference(snapshot: TitleSnapshot) {
	const rules = {
		movie: { minVotes: 800, size: 9000 },
		show: { minVotes: 200, size: 3000 },
	}
	type Candidate = { row: number; facts: TitleFacts }
	const found = { movie: [] as Candidate[], show: [] as Candidate[] }
	snapshot.forEach((_, row) => {
		const facts = snapshot.factsAt(row)
		if (
			facts.hasPoster &&
			facts.hasBackdrop &&
			!facts.adult &&
			facts.votes >= rules[facts.mediaType].minVotes
		)
			found[facts.mediaType].push({ row, facts })
	})
	const top = (list: Candidate[], size: number) =>
		list
			.sort((a, b) => b.facts.votes - a.facts.votes || a.row - b.row)
			.slice(0, size)
			.map(({ row }) => row)
	return {
		movie: top(found.movie, rules.movie.size),
		show: top(found.show, rules.show.size),
	}
}

test("column selection matches facts for thresholds, flags and tied votes without reading facts", (t) => {
	const snapshot = snapshotOf(
		[1e12, 2e12].flatMap((base) => {
			const minVotes = base === 1e12 ? 800 : 200
			return [
				title(base + 1, { votes: minVotes - 1 }),
				title(base + 2, { votes: minVotes }),
				title(base + 3, { hasPoster: false }),
				title(base + 4, { hasBackdrop: false }),
				title(base + 5, { adult: true }),
				title(base + 6, { votes: minVotes + 1 }),
				title(base + 7, { votes: minVotes + 1, anime: true }),
				title(base + 8, { votes: minVotes + 2 }),
			]
		}),
	)
	const expected = reference(snapshot)
	assert.deepStrictEqual(expected, {
		movie: [7, 5, 6, 1],
		show: [15, 13, 14, 9],
	})
	t.mock.method(snapshot, "factsAt", () => {
		throw new Error("Selection must not materialize facts.")
	})
	assert.deepStrictEqual(selectCandidateRows(snapshot), expected)
})

test("column selection matches the reference at both pool size limits", () => {
	const snapshot = snapshotOf(
		[1e12, 2e12].flatMap((base) =>
			Array.from({ length: base === 1e12 ? 9002 : 3002 }, (_, i) =>
				title(base + i + 1, { votes: i % 2 === 0 ? 1000 : 2000 }),
			),
		),
	)
	const selected = selectCandidateRows(snapshot)
	assert.deepStrictEqual(selected, reference(snapshot))
	assert.equal(selected.movie.length, 9000)
	assert.equal(selected.show.length, 3000)
})

test("column selection returns empty lists for an empty snapshot", () => {
	const snapshot = snapshotOf([])
	assert.deepStrictEqual(selectCandidateRows(snapshot), reference(snapshot))
	assert.deepStrictEqual(selectCandidateRows(snapshot), { movie: [], show: [] })
})
