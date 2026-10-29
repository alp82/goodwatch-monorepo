// The room lighting's mapping (grades.ts): every picker word and every reading key lights the room, picks lead, a
// typed search grades when its reading arrives.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"

const {
	COLOR_STRONG,
	GRADES,
	GRADE_KEYS,
	GRADE_OF_KEY,
	GRADE_OF_WORD,
	REST_DIM,
	gradeOfReading,
	gradeOfWord,
	layersOf,
	roomGrade,
} = await import("./grades.ts")
const { WORDS, WORD_BY_ID } = await import("~/domain/taste-picker")
const { FP_KEYS } = await import("~/domain/for-you-page/contract")
const { MOOD_BY_KEY } = await import("~/domain/moods")
const { querySignature } = await import("../stage/start-query.ts")
const { pickMix } = await import("../moods/mixes.ts")

const BLENDS = [
	"soft-light",
	"screen",
	"multiply",
	"saturation",
	"color",
	"overlay",
]

test("every grade has layers with a known blend and an opacity in (0, 1]", () => {
	for (const key of GRADE_KEYS) {
		assert.ok(GRADES[key].length > 0, key)
		for (const layer of [...GRADES[key], ...REST_DIM]) {
			assert.ok(BLENDS.includes(layer.blend), `${key} ${layer.blend}`)
			assert.ok(layer.o > 0 && layer.o <= 1, `${key} ${layer.o}`)
		}
	}
	assert.equal(GRADES.mystery, GRADES.crime)
})

test("the spec's values, exactly: crime multiplies at 0.37, the bright moods lift gently", () => {
	assert.deepEqual(
		GRADES.crime.map((l) => [l.blend, l.o]),
		[
			["saturation", 0.72],
			["color", 0.5],
			["multiply", 0.37],
		],
	)
	assert.deepEqual(
		GRADES.feelgood.map((l) => l.o),
		[0.4, 0.09],
	)
	assert.deepEqual(
		GRADES.action.map((l) => [l.blend, l.o]),
		[
			["overlay", 0.46],
			["soft-light", 0.85],
		],
	)
	assert.equal(GRADES.funny[0].bg, MOOD_BY_KEY.funny.hue)
	assert.deepEqual(REST_DIM, [
		{ bg: "rgb(24 28 40)", blend: "multiply", o: 0.2 },
		{ bg: "#808080", blend: "saturation", o: 0.14 },
	])
	assert.equal(COLOR_STRONG, 0.72)
})

test("every picker word lights the room: a mood its own grade, a theme or style its grade or its own color", () => {
	for (const word of WORDS) {
		const grade = gradeOfWord(word.id)
		assert.ok(grade, word.id)
		if (word.kind === "mood") assert.equal(grade, word.key)
		else assert.ok(word.id in GRADE_OF_WORD, `${word.id} is mapped`)
		assert.ok(layersOf(grade).length > 0, word.id)
	}
	// The table names only picker words.
	for (const id of Object.keys(GRADE_OF_WORD)) assert.ok(WORD_BY_ID[id], id)
	assert.equal(gradeOfWord("t:crime"), "crime")
	assert.equal(gradeOfWord("s:slow"), "heavy")
	const documentary = gradeOfWord("s:documentary")
	assert.equal(documentary, `color:${WORD_BY_ID["s:documentary"].hue}`)
	assert.deepEqual(layersOf(documentary ?? "funny"), [
		{
			bg: WORD_BY_ID["s:documentary"].hue,
			blend: "soft-light",
			o: COLOR_STRONG,
		},
	])
	assert.equal(gradeOfWord("m:nope"), null)
})

test("every reading key is a title analysis key with a grade", () => {
	for (const [key, grade] of Object.entries(GRADE_OF_KEY)) {
		assert.ok((FP_KEYS as readonly string[]).includes(key), key)
		assert.ok(GRADE_KEYS.includes(grade), grade)
	}
})

test("a reading's grade: the most want chips win, the first seen on a tie; other chips don't count", () => {
	const want = (key: string) => ({ text: key, kind: "want" as const, key })
	assert.equal(gradeOfReading(null), null)
	assert.equal(gradeOfReading([]), null)
	assert.equal(
		gradeOfReading([want("mystery"), want("wit_wordplay"), want("intrigue")]),
		"mystery",
	)
	assert.equal(gradeOfReading([want("romance"), want("scare")]), "romance")
	assert.equal(
		gradeOfReading([
			{ text: "funny", kind: "avoid", key: "wit_wordplay" },
			{ text: "space", kind: "phrase" },
			want("unknown_key"),
		]),
		null,
	)
})

test("what lights the room: the picks' lead word, else the reading once it arrives, else nothing", () => {
	const want = (key: string) => ({ text: key, kind: "want" as const, key })
	const results = (
		query: { text: string; picks: string[] },
		status: "idle" | "loading" | "ready" | "error",
		reading: { text: string; kind: "want"; key: string }[] | null,
	) => ({ signature: querySignature(query), status, reading })

	const none = { text: "", picks: [] }
	assert.equal(roomGrade(none, results(none, "idle", null)), null)

	// A mix leads with its first part, over a search's reading.
	const mixed = { text: "rainy day whodunit", picks: pickMix([], "g8") }
	assert.equal(
		roomGrade(mixed, results(mixed, "ready", [want("mystery")])),
		"worlds",
	)

	// A typed search: undefined (keep the last grade) until its reading arrives.
	const typed = { text: "rainy day whodunit", picks: [] }
	assert.equal(roomGrade(typed, results(none, "idle", null)), undefined)
	assert.equal(roomGrade(typed, results(typed, "loading", null)), undefined)
	assert.equal(
		roomGrade(typed, results(typed, "loading", [want("mystery")])),
		"mystery",
	)
	// Results for another query don't light this one.
	const other = { text: "cheer me up", picks: [] }
	assert.equal(
		roomGrade(typed, results(other, "ready", [want("wholesome")])),
		undefined,
	)
	// Answered without a reading, or failed: the resting room.
	assert.equal(roomGrade(typed, results(typed, "ready", null)), null)
	assert.equal(roomGrade(typed, results(typed, "error", null)), null)
	assert.equal(
		roomGrade(typed, results(typed, "ready", [want("unknown_key")])),
		null,
	)
})
