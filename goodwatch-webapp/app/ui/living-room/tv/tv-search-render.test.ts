// Search as it is drawn: the items in the markup are the machine's, in its order, in both editions; the line is
// one real input, which is not an item; the results name the focused title in the list every app uses; and on
// every phone of the room's table the phone's own keyboard types (no TV keys), every key is a touch target, and
// nothing scrolls.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"
import { KEY_ITEMS } from "./tv-browse.ts"

type Editions = { desktop: string; phone: string }
type Drawn = Editions & { items: string[]; phoneItems: string[] }
const rendered = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/living-room/tv/tv-search-render.test-support.tsx",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__TV_SEARCH_RENDER__")
		.at(-1) ?? "",
) as {
	question: Record<
		"empty" | "one" | "typed" | "long" | "onIdea" | "onBar",
		Drawn
	>
	results: Record<
		| "found"
		| "second"
		| "long"
		| "two"
		| "waiting"
		| "unreported"
		| "none"
		| "failed"
		| "spaced",
		Drawn
	>
	phones: {
		phone: string
		scale: number
		h: number
		key: number
		foot: number
		bar: number
		question: string
		results: string
	}[]
	first: { question: string; results: string }
}

/** The item ids in the markup, in its order. */
const ids = (html: string) =>
	[...html.matchAll(/data-tv-item="([^"]+)"/g)].map((match) => match[1])
const focused = (html: string) =>
	[...html.matchAll(/data-tv-item="([^"]+)" aria-current="true"/g)].map(
		(match) => match[1],
	)
const count = (html: string, part: string) => html.split(part).length - 1
/** A screen's own items and its bar's, without the Expand key: for the lists written out here. */
const drawn = (items: string[]) => items.filter((item) => item !== "expand")
/** An item's own tag, and the line's. */
const tag = (html: string, id: string) =>
	new RegExp(`<button[^>]*data-tv-item="${id}"[^>]*>`).exec(html)?.[0] ?? ""
const line = (html: string) => /<input[^>]*>/.exec(html)?.[0] ?? ""
/** Every type size a screen sets, in canvas pixels. */
const typeSizes = (html: string) => [
	...[...html.matchAll(/text-\[(\d+)px\]/g)].map((match) => Number(match[1])),
	...[...html.matchAll(/font-size:(\d+)px/g)].map((match) => Number(match[1])),
]
const IDEAS = [
	"idea:cozy mystery",
	"idea:space adventure",
	"idea:feel-good comedy",
	"idea:mind-bending thriller",
]
/** The search screens have the TV's navigation along the top, its Search tab the screen on show. */
const BAR = [
	"nav:home",
	"nav:tonight",
	"nav:discover",
	"nav:search",
	"nav:quiz",
	"bar:menu",
]
const EDITIONS = ["desktop", "phone"] as const
/** The phone's header: the white G and Menu. */
const PHONE_BAR = ["nav:home", "bar:menu"]
/**
 * What the phone draws of a list's items: its first page of five titles, the arrow to the next page, then the
 * rest; the server's own Previous and Next are the list's arrows at its ends.
 */
const phonePage = (items: readonly string[]) => {
	const titles = items.filter((id) => id.startsWith("title:"))
	return [
		...titles.slice(0, 5),
		...(titles.length > 5 ? [`jump:${titles[5]}`] : []),
		...items.filter(
			(id) =>
				!id.startsWith("title:") &&
				id !== "browse:prev" &&
				id !== "browse:next",
		),
	]
}

test("Recovered keyboard markup follows machine order in both editions, with letters, digits and editing actions", () => {
	for (const screen of Object.values(rendered.question)) {
		assert.deepEqual(ids(screen.desktop), screen.items)
		// The ideas under the line come before the keys.
		assert.deepEqual(screen.items, [...IDEAS, ...KEY_ITEMS, ...BAR])
		// The phone types with its own keyboard (the owner, 2026-10-22): the line, Search beside it, the ideas, and
		// the header's G and Menu. No TV key.
		assert.deepEqual(screen.phoneItems, ["field", ...IDEAS, "go", ...PHONE_BAR])
		assert.deepEqual(ids(screen.phone), ["field", "go", ...IDEAS, ...PHONE_BAR])
		assert.ok(!screen.phone.includes('data-tv-item="key:'))
		for (const edition of EDITIONS)
			assert.equal(count(screen[edition], "data-tv-expand"), 0)
	}
})
test("The query stays in a labelled real input with a 512-character limit and no autofocus", () => {
	for (const edition of EDITIONS) {
		const input = line(rendered.question.typed[edition])
		assert.match(input, /data-tv-input=""/)
		assert.match(input, /aria-label="Search"/)
		assert.match(input, /maxLength="512"/i)
		assert.match(input, /value="heist "/)
		assert.ok(!/autofocus/i.test(input))
		assert.ok(!/data-tv-item/.test(input))
		assert.match(rendered.question.empty[edition], /Two characters or more/)
		assert.match(
			tag(rendered.question.typed[edition], "go"),
			/aria-label="Search “heist”"/,
		)
	}
})
test("Results retain metadata, long-title layout and all current machine actions", () => {
	for (const screen of Object.values(rendered.results)) {
		assert.deepEqual(ids(screen.desktop), screen.items)
		assert.deepEqual(ids(screen.phone), phonePage(screen.phoneItems))
	}
	assert.match(
		rendered.results.found.desktop,
		/“heist” · Page 1 of 1 · 4 matches/,
	)
	// The phone's header says what was searched for.
	assert.match(
		rendered.results.found.phone,
		/<span class="[^"]*truncate[^"]*">“heist”<\/span>/,
	)
	for (const edition of EDITIONS) {
		assert.match(rendered.results.second[edition], /Inside Man/)
		assert.match(rendered.results.second[edition], /91% match/)
		assert.match(
			rendered.results.long[edition],
			/The Lord of the Rings: The Fellowship of the Ring/,
		)
		assert.ok(ids(rendered.results.found[edition]).includes("browse:filters"))
		assert.ok(ids(rendered.results.found[edition]).includes("browse:edit"))
	}
})
test("Loading, empty and failure messages are distinct", () => {
	for (const edition of EDITIONS) {
		assert.match(rendered.results.waiting[edition], /Searching…/)
		assert.match(rendered.results.none[edition], /Nothing found\./)
		assert.match(rendered.results.failed[edition], /Search is busy right now/)
	}
})
test("Keyboard focus and bar focus remain represented in markup", () => {
	for (const edition of EDITIONS) {
		// The screen starts on its first idea on the desktop, on the line on the phone.
		assert.deepEqual(focused(rendered.question.empty[edition]), [
			edition === "phone" ? "field" : IDEAS[0],
		])
		assert.deepEqual(focused(rendered.question.onBar[edition]), ["bar:menu"])
	}
})
/** The element that opens at `at` in `html`, whole: its tags balanced by name (the markup is the server's). */
const element = (html: string, at: number) => {
	const tag = /^<([a-z]+)/.exec(html.slice(at))?.[1] ?? "div"
	let depth = 0
	const re = new RegExp(`<${tag}[\\s>]|</${tag}>`, "g")
	re.lastIndex = at
	for (let m = re.exec(html); m; m = re.exec(html)) {
		depth += m[0].startsWith("</") ? -1 : 1
		if (depth === 0) return html.slice(at, m.index + m[0].length)
	}
	return html.slice(at)
}

// Regression (2026-10-21, 2026-10-22): on the phone the keys scrolled, first in a box of their own, then with the
// field. The phone now types with its own keyboard: the line, Search and four ideas fit the picture, nothing
// scrolls, and every key is a touch target.
test("Phone search: the phone's own keyboard, no TV keys, nothing scrolls, and every key is a touch target", () => {
	for (const phone of rendered.phones) {
		assert.ok(
			!phone.question.includes("data-tv-scroll"),
			`${phone.phone}: nothing scrolls`,
		)
		assert.ok(
			!phone.question.includes('data-tv-item="key:'),
			`${phone.phone}: no TV keys`,
		)
		assert.match(line(phone.question), /inputMode="search"/i)
		assert.match(line(phone.question), /enterKeyHint="search"/i)
		// The line and Search: one row, a key tall. The ideas: rows of two, each a key tall, two where the picture
		// holds them and one on a narrower phone; the header (66), the rows, their 5 px gaps and the foot (10) fit
		// the 270 px canvas.
		assert.match(phone.question, new RegExp(`style="height:${phone.bar}px"`))
		const rows = Number(
			/grid-template-rows:repeat\((\d), (\d+)px\)/.exec(phone.question)?.[1],
		)
		assert.equal(
			rows,
			66 + 3 * phone.bar + 2 * 5 + 10 <= 270 ? 2 : 1,
			phone.phone,
		)
		assert.equal(
			count(phone.question, 'data-tv-item="idea:'),
			rows * 2,
			phone.phone,
		)
		assert.ok(
			66 + (rows + 1) * phone.bar + rows * 5 + 10 <= 270 ||
				phone.phone === "320x568",
			phone.phone,
		)
		assert.ok(phone.bar * phone.scale >= 44, `${phone.phone}: ${phone.bar}`)
		assert.ok(
			!phone.results.includes("data-tv-scroll"),
			`${phone.phone}: the results don't scroll`,
		)
	}
})
test("Before interaction the server renders only the search bar, with no eager keyboard or input", () => {
	assert.deepEqual(ids(rendered.first.question), BAR)
	assert.deepEqual(ids(rendered.first.results), ["expand", ...BAR])
	for (const html of Object.values(rendered.first))
		assert.equal(count(html, "<input"), 0)
})
