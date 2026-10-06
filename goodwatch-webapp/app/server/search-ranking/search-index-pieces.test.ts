// Exercise every index field through the actual transferable transport.
import assert from "node:assert/strict"
import { test } from "node:test"
import type { SearchIndex } from "./search-index.server.ts"
import {
	createAssembler,
	itemWeight,
	PIECE_WEIGHT,
	piecesOf,
	transferablesOf,
} from "./search-index-pieces.server.ts"

function fixture(): SearchIndex {
	const vectors = () => ({
		dim: 2,
		scale: new Float32Array([0.5, 1]),
		values: new Int8Array([-2, 3, 4, 5]),
	})
	return {
		buildId: "test",
		manifest: {
			format: 1,
			build_id: "test",
			created_at: "2026-01-01",
			previous_build_id: null,
			files: {},
			profiles: { collection: "test", points: 2 },
		},
		loadedAt: new Date("2026-01-01"),
		titleTable: {
			size: 2,
			pointIds: [10, 20],
			titles: ["A", "B"],
			originalTitles: ["AA", "BB"],
			years: new Int32Array([2000, 0]),
			votes: new Float64Array([10000, 20]),
			goodwatchScores: new Float64Array([NaN, 82]),
			popularity: new Float64Array([2, 3]),
			imdbIds: [null, "tt123"],
			flagNames: ["anime"],
			flags: new Int32Array([0, 1]),
			productionMethods: [null, "animation"],
			rowOf: new Map([
				[10, 0],
				[20, 1],
			]),
		},
		termStatistics: {
			n: 2,
			terms: ["z", "a"],
			ids: new Int32Array([9, 2]),
			df: new Int32Array([1, 2]),
			indexOf: new Map([
				["z", 0],
				["a", 1],
			]),
			sortedIds: new Int32Array([2, 9]),
			sortedIdTerm: new Int32Array([1, 0]),
		},
		words: {
			df: new Map([["abc", 2]]),
			spellVocabulary: ["abc"],
			spellByLength: new Map([[3, [0]]]),
		},
		collocations: new Set(["a b", "c d"]),
		names: {
			entityOf: new Map([["a name", 0]]),
			entities: [
				{
					id: "p:1",
					kind: "person",
					name: "A Name",
					members: ["p:1"],
					mass: 2,
					titles: new Map([
						[20, 0.5],
						[10, 1],
					]),
					codirected: [10],
					mention: ["a"],
				},
			],
			fullNames: ["a name"],
		},
		peers: {
			members: ["p:1"],
			fingerprints: new Float32Array([1, 2]),
			dim: 2,
			titles: [[20, 10]],
		},
		negationLabels: {
			titles: [[10], [], [20, 10]],
			labelsWithStem: new Map([["test", [2, 0]]]),
		},
		alternateCuts: new Map([[10, new Set([20, 10])]]),
		intents: {
			labels: ["fun"],
			dim: 2,
			vectors: new Float32Array([0.5, 0.75]),
		},
		mixVectors: { multilingual: vectors(), english: vectors() },
		referenceTitles: new Map([["a", 0]]),
		franchiseTitles: [{ row: 0, title: " a ", original: " aa " }],
		titleNames: [
			{ name: "a", row: 0 },
			{ name: "bb", row: 1 },
		],
		timings: { total: 42, title_table: 12 },
	}
}

test("all fields survive weighted pieces, structured cloning, and buffer transfer", () => {
	const assembler = createAssembler()
	for (const piece of piecesOf(fixture()))
		assembler.add(structuredClone(piece, { transfer: transferablesOf(piece) }))
	assert.deepStrictEqual(assembler.finish(), fixture())
})

test("large collections use bounded weights and missing pieces cannot finish", () => {
	const index = fixture()
	index.termStatistics.terms = Array.from({ length: 50_000 }, (_, i) =>
		String(i),
	)
	index.negationLabels.titles = Array.from({ length: 3_000 }, (_, i) =>
		Array.from({ length: i % 100 }, (_, j) => j),
	)
	index.names.entities[0].titles = new Map(
		Array.from({ length: PIECE_WEIGHT + 1 }, (_, i) => [i, i]),
	)
	const pieces = [...piecesOf(index)]
	for (const piece of pieces) {
		if (!piece.items) continue
		const weight = piece.items.reduce<number>(
			(n, item) => n + itemWeight(item),
			0,
		)
		assert.equal(piece.weight, weight)
		assert.ok(weight <= PIECE_WEIGHT || piece.items.length === 1)
	}
	const assembler = createAssembler()
	for (const piece of pieces.slice(0, -1)) assembler.add(piece)
	assert.throws(() => assembler.finish(), /Missing/)
	const omitted = createAssembler()
	assert.throws(() => {
		for (const [i, piece] of pieces.entries()) if (i !== 10) omitted.add(piece)
		omitted.finish()
	}, /Missing/)
})
