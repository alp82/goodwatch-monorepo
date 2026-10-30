import assert from "node:assert/strict"
import { test } from "node:test"
import {
	type DocBlock,
	cutOpening,
	markRuns,
	openingLead,
	pageHref,
	parseDescriptionDoc,
	plainBlocks,
	tropeOpening,
} from "./trope-opening.ts"

const WIKI = "https://tvtropes.org/pmwiki/pmwiki.php/"
const p = (length: number, mark = "x"): DocBlock => ({
	kind: "p",
	text: mark.repeat(length),
})
const list = (...lengths: number[]): DocBlock => ({
	kind: "list",
	items: lengths.map((n) => ({ depth: 0, text: "i".repeat(n) })),
})
const heading: DocBlock = { kind: "heading", text: "Examples" }
const doc = (blocks: unknown[], extra: Record<string, unknown> = {}) =>
	JSON.stringify({ v: 1, source: "archive", blocks, ...extra })

test("a description up to 1,800 characters shows whole, lists and headings included", () => {
	const blocks = [p(600), list(300, 300), heading, p(592)] // 1,800 with the heading
	assert.deepEqual(cutOpening(blocks), { head: blocks, rest: [] })
	assert.equal(tropeOpening(doc(blocks), "plain")?.more, 0)
	const over = [p(600), list(300, 300), heading, p(593)]
	assert.notEqual(cutOpening(over).rest.length, 0)
})

test("a longer one takes whole paragraphs to at least 1,000 characters", () => {
	const blocks = [p(400), p(400), p(400), p(400), p(400), p(400)]
	const { head, rest } = cutOpening(blocks)
	assert.equal(head.length, 3) // 1,200: reached 1,000, stop
	assert.equal(rest.length, 3)
	assert.equal(tropeOpening(doc(blocks), null)?.more, 3)
})

test("the opening never goes past 1,400 once one paragraph is in", () => {
	const { head } = cutOpening([p(900), p(600), p(300), p(300), p(300)])
	assert.equal(head.length, 1) // 900 + 600 would pass 1,400
	// The first paragraph always shows, however long.
	const long = cutOpening([p(3000), p(10), p(10)])
	assert.equal(long.head.length, 1)
})

test("the opening stops at the first list or heading; a list counts as one, headings not at all", () => {
	const blocks = [p(300), list(900, 900), p(300), heading, p(300)]
	const opening = tropeOpening(doc(blocks), null)
	assert.equal(opening?.blocks.length, 1)
	assert.equal(opening?.more, 3)
	const atHeading = cutOpening([p(300), heading, p(900), p(900)])
	assert.equal(atHeading.head.length, 1)
})

test("never exactly one more paragraph: the last opening paragraph moves after the cut", () => {
	const { head, rest } = cutOpening([p(500), p(600), p(800)])
	assert.equal(head.length, 1)
	assert.equal(rest.length, 2)
	// A list after the cut is the one block left: same move.
	const withList = tropeOpening(doc([p(500), p(600), list(800)]), null)
	assert.equal(withList?.blocks.length, 1)
	assert.equal(withList?.more, 2)
	// With only one opening paragraph there is nothing to move: up to 2,400 characters the whole text shows...
	const single = tropeOpening(doc([p(1500), p(400)]), null)
	assert.equal(single?.blocks.length, 2)
	assert.equal(single?.more, 0)
	// ...and past that, one more it is (the link shows no count).
	const long = tropeOpening(doc([p(1500), p(1000)]), null)
	assert.equal(long?.blocks.length, 1)
	assert.equal(long?.more, 1)
})

test("a short reader note before the first paragraph is skipped, unless nothing else is left", () => {
	const note = {
		kind: "p",
		text: "For added atmosphere, play this video while reading on.",
	}
	const opening = tropeOpening(doc([note, p(300)]), null)
	assert.equal(opening?.blocks.length, 1)
	assert.equal((opening?.blocks[0] as { text: string }).text, "x".repeat(300))
	assert.equal(tropeOpening(doc([note]), null)?.blocks.length, 1)
	// A heading before the note stays; the note goes, so the teaser starts at the definition.
	const labelled = tropeOpening(doc([heading, note, p(300)]), null)
	assert.deepEqual(
		labelled?.blocks.map((b) => b.kind),
		["heading", "p"],
	)
	assert.equal(openingLead(labelled), "x".repeat(300))
	// Plain text gets the same treatment.
	const plain = tropeOpening(
		null,
		`(For the proper reading experience, play the music from this video while reading this page.)\n\n${"y".repeat(50)}`,
	)
	assert.equal(plain?.blocks.length, 1)
	// Definitions that mention playing or listening stay.
	for (const text of [
		"Many writers listen to music while writing. And, hey, why not have built-in background music in your story?",
		"The children decide they want a new mother/father. Now if only they can get their parent to listen to them.",
		"A plot about a child being toilet trained. There are two reasons the writers might want to play this trope.",
	])
		assert.equal(
			tropeOpening(doc([{ kind: "p", text }, p(300)]), null)?.blocks.length,
			2,
			text,
		)
})

test("a text that opens with a list shows its first items; a leading heading stays with its paragraph", () => {
	const { head, rest } = cutOpening([list(700, 600, 600, 600), p(100)])
	assert.deepEqual(
		head.map((b) => (b.kind === "list" ? b.items.length : -1)),
		[2],
	)
	assert.equal(rest.length, 2)
	const labelled = cutOpening([heading, p(1200), p(1500)])
	assert.equal(labelled.head.length, 2)
	assert.equal(labelled.head[0].kind, "heading")
})

test("without a valid document, the plain text splits on blank lines under the same rules", () => {
	assert.deepEqual(plainBlocks("One.\n\n  Two.\n \nThree.\nstill three."), [
		{ kind: "p", text: "One." },
		{ kind: "p", text: "Two." },
		{ kind: "p", text: "Three.\nstill three." },
	])
	const text = ["a".repeat(600), "b".repeat(600), "c".repeat(600), "d"].join(
		"\n\n",
	)
	const opening = tropeOpening("{not json", text)
	assert.equal(opening?.blocks.length, 2)
	assert.equal(opening?.more, 2)
	assert.ok(opening?.blocks.every((b) => b.kind === "p" && !b.links))
	assert.equal(tropeOpening(null, "   "), null)
	assert.equal(tropeOpening(null, null), null)
})

test("an invalid document falls back to the plain text, never renders unchecked", () => {
	const fallback = tropeOpening(
		doc([{ kind: "p", text: "Bad", links: [[0, 3, "https://evil.test/x"]] }]),
		"Plain.",
	)
	assert.deepEqual(fallback, {
		blocks: [{ kind: "p", text: "Plain." }],
		more: 0,
	})
})

test("the validator mirrors the stored contract", () => {
	const ok = {
		kind: "p",
		text: "Jerkass",
		links: [[0, 7, `${WIKI}Main/Jerkass`]],
	}
	assert.ok(parseDescriptionDoc(doc([ok])))
	assert.ok(parseDescriptionDoc(JSON.parse(doc([ok]))))
	const bad: unknown[][] = [
		[], // no blocks
		[{ kind: "p", text: "  " }],
		[{ kind: "p", text: "x", extra: 1 }],
		[{ kind: "quote", text: "x" }],
		[{ kind: "p", text: "abc", em: [[1, 1]] }], // empty range
		[{ kind: "p", text: "abc", em: [[0, 4]] }], // past the end
		[
			{
				kind: "p",
				text: "abc",
				em: [
					[0, 2],
					[1, 3],
				],
			},
		], // overlap within a kind
		[
			{
				kind: "p",
				text: "abc",
				em: [
					[2, 3],
					[0, 1],
				],
			},
		], // unsorted
		[{ kind: "p", text: "abc", em: [[0.5, 2]] }],
		[{ kind: "p", text: "abc", spoilers: [[0, 2, "x"]] }],
		[{ kind: "p", text: "a😀b", em: [[0, 2]] }], // inside a surrogate pair
		[{ kind: "p", text: "a\ud800b" }], // lone surrogate
		[{ kind: "p", text: "abc", links: [[0, 3, `${WIKI}Administrivia/X`]] }],
		[{ kind: "p", text: "abc", links: [[0, 3, `${WIKI}Main/X?a=1`]] }],
		[
			{
				kind: "p",
				text: "abc",
				links: [[0, 3, "http://tvtropes.org/pmwiki/pmwiki.php/Main/X"]],
			},
		],
		[{ kind: "list", items: [] }],
		[{ kind: "list", items: [{ text: "x" }] }], // no depth
		[{ kind: "list", items: [{ text: "x", depth: -1 }] }],
		[{ kind: "list", items: [{ text: "x", depth: 0 }], text: "x" }],
	]
	for (const blocks of bad)
		assert.equal(parseDescriptionDoc(doc(blocks)), null, JSON.stringify(blocks))
	// Overlap across kinds is fine; touching ranges within a kind are too.
	assert.ok(
		parseDescriptionDoc(
			doc([
				{
					kind: "p",
					text: "abcd",
					em: [
						[0, 2],
						[2, 4],
					],
					spoilers: [[1, 3]],
				},
			]),
		),
	)
	assert.equal(parseDescriptionDoc(doc([ok], { v: 2 })), null)
	assert.equal(parseDescriptionDoc(doc([ok], { source: "html" })), null)
	assert.equal(parseDescriptionDoc(doc([ok], { extra: true })), null)
	assert.equal(parseDescriptionDoc(null), null)
	assert.equal(parseDescriptionDoc("[]"), null)
})

test("the validator agrees with Python on null ranges and on what counts as blank text", () => {
	// Only an absent field defaults to no ranges; an explicit null breaks the contract, as in Python.
	for (const key of ["links", "spoilers", "em"])
		assert.equal(
			parseDescriptionDoc(doc([{ kind: "p", text: "abc", [key]: null }])),
			null,
			key,
		)
	assert.equal(
		parseDescriptionDoc(
			doc([{ kind: "list", items: [{ text: "abc", depth: 0, em: null }] }]),
		),
		null,
	)
	// str.isspace, not JavaScript's trim: U+0085 and U+001C-U+001F are blank, U+FEFF and U+200B are text.
	for (const blank of ["\u0085", "\u001c\u001f", "\u3000 \u00a0", "\t\v"])
		assert.equal(
			parseDescriptionDoc(doc([{ kind: "p", text: blank }])),
			null,
			JSON.stringify(blank),
		)
	for (const text of ["\ufeff", "\u200b", "\u0085x"])
		assert.ok(
			parseDescriptionDoc(doc([{ kind: "p", text }])),
			JSON.stringify(text),
		)
})

test("links travel as page paths and only rebuild to TV Tropes wiki pages", () => {
	const opening = tropeOpening(
		doc([
			{
				kind: "p",
				text: "See Jerkass.",
				links: [[4, 11, `${WIKI}Main/Jerkass`]],
				em: [],
			},
		]),
		null,
	)
	assert.deepEqual(opening?.blocks, [
		{ kind: "p", text: "See Jerkass.", links: [[4, 11, "Main/Jerkass"]] },
	])
	assert.equal(pageHref("Main/Jerkass"), `${WIKI}Main/Jerkass`)
	assert.equal(pageHref("Administrivia/X"), null)
	assert.equal(pageHref("//evil.test/x"), null)
	assert.equal(pageHref("Main/X/../Y"), null)
})

test("UTF-16 ranges: an emoji before a link still links the right words", () => {
	const text = "😀 is a Jerkass here"
	const start = text.indexOf("Jerkass")
	assert.equal(start, 8) // the emoji is two code units
	const runs = markRuns({ text, links: [[start, start + 7, "Main/Jerkass"]] })
	assert.equal(runs.length, 1)
	assert.deepEqual(
		runs[0].links.map((l) => [l.href, l.parts.map((p) => p.text).join("")]),
		[
			[null, "😀 is a "],
			[`${WIKI}Main/Jerkass`, "Jerkass"],
			[null, " here"],
		],
	)
})

test("a spoiler is one run, even when a link and emphasis cut through it", () => {
	const text = "He was the killer all along."
	const runs = markRuns({
		text,
		spoilers: [[7, 27]],
		links: [[11, 17, "Main/Killer"]],
		em: [[18, 21]],
	})
	assert.deepEqual(
		runs.map((r) => [
			r.spoiler,
			r.links.map((l) => l.parts.map((p) => p.text).join("")),
		]),
		[
			[false, ["He was "]],
			[true, ["the ", "killer", " all along"]],
			[false, ["."]],
		],
	)
	const inside = runs[1].links[2].parts
	assert.deepEqual(
		inside.map((p) => [p.text, p.em]),
		[
			[" ", false],
			["all", true],
			[" along", false],
		],
	)
	// Two spoilers side by side stay two taps.
	assert.equal(
		markRuns({
			text: "abcd",
			spoilers: [
				[0, 2],
				[2, 4],
			],
		}).length,
		2,
	)
})

test("the teaser line comes from the opening's first text", () => {
	assert.equal(
		openingLead({ blocks: [heading, { kind: "p", text: "First." }], more: 0 }),
		"First.",
	)
	assert.equal(openingLead({ blocks: [list(3)], more: 0 }), "iii")
	assert.equal(openingLead(null), null)
})

test("the teaser never shows a spoiler: each becomes an ellipsis, and a lead that is all spoiler shows nothing", () => {
	const text = "Vader is Luke's father. Then more."
	assert.equal(
		openingLead({
			blocks: [{ kind: "p", text, spoilers: [[9, 22]] }],
			more: 0,
		}),
		"Vader is …. Then more.",
	)
	assert.equal(
		openingLead({
			blocks: [
				{ kind: "list", items: [{ text, depth: 0, spoilers: [[0, 5]] }] },
			],
			more: 0,
		}),
		"… is Luke's father. Then more.",
	)
	assert.equal(
		openingLead({
			blocks: [{ kind: "p", text: "Vader dies.", spoilers: [[0, 10]] }],
			more: 0,
		}),
		null,
	)
})
