// Search as it is drawn: the items in the markup are the machine's, in its order, in both editions; the line is
// one real input, which is not an item; the results name the focused title in the list every app uses; and on
// every phone of the room's table the keys are touch targets with the Expand key's corner free.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

type Editions = { desktop: string; phone: string }
type Drawn = Editions & { items: string[] }
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
/** The machine's items that a slice has drawn: all but the Expand key, which is slice 11's. */
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
/** The search screens have no Search key: the person is there. */
const BAR = ["bar:back", "bar:menu"]
const EDITIONS = ["desktop", "phone"] as const

test("the question screen's items in the markup are the machine's, in reading order, in both editions", () => {
	for (const screen of Object.values(rendered.question))
		for (const edition of EDITIONS)
			assert.deepEqual(ids(screen[edition]), screen.items)
	assert.deepEqual(rendered.question.empty.items, [...IDEAS, ...BAR])
	// What is typed has its key from the first character on, in an idea's place.
	for (const screen of [rendered.question.one, rendered.question.typed])
		assert.deepEqual(screen.items, ["go", ...IDEAS.slice(0, 3), ...BAR])
	// It has no page to grow into: no Expand key, and no place kept for one.
	for (const edition of EDITIONS) {
		assert.ok(!rendered.question.empty.items.includes("expand"))
		assert.equal(count(rendered.question.empty[edition], "data-tv-expand"), 0)
	}
})

test("the line is one real input that asks the question, and it is not an item", () => {
	const { empty, typed } = rendered.question
	for (const edition of EDITIONS) {
		assert.equal(count(empty[edition], "<input"), 1)
		const input = line(empty[edition])
		assert.match(input, /data-tv-input=""/)
		assert.match(input, /type="text"/)
		assert.match(input, /placeholder="What are you looking for\?"/)
		assert.match(input, /value=""/)
		// A phone's keyboard shows a search key and does not correct what is typed.
		assert.match(input, /enterKeyHint="search"/i)
		assert.match(input, /inputMode="search"/i)
		assert.match(input, /autoComplete="off"/i)
		assert.match(input, /autoCapitalize="none"/i)
		assert.match(input, /spellCheck="false"/i)
		assert.match(input, /maxLength="512"/i)
		assert.ok(!/data-tv-item/.test(input))
		// It is named for a screen reader by the screen's own word, and described by the line under it.
		assert.match(input, /aria-label="Search"/)
		const hint = /aria-describedby="([^"]+)"/.exec(input)?.[1]
		assert.ok(hint)
		assert.match(empty[edition], new RegExp(`<span id="${hint}"`))
		// The word, the line and the hint are one label: a tap on any of them gives the line the focus.
		const label = /<label[^>]*>(.*?)<\/label>/s.exec(empty[edition])?.[1] ?? ""
		assert.match(label, />Search<\/span><input/)
		assert.match(label, new RegExp(`<span id="${hint}"[^>]*>[^<]+<\\/span>$`))
		assert.equal(count(empty[edition], "<label"), 1)
		// What is typed is in it as typed.
		assert.match(line(typed[edition]), /value="heist "/)
	}
	// The two editions are in the HTML together before the window is measured: their hints have ids of their own.
	assert.notEqual(
		/aria-describedby="([^"]+)"/.exec(line(empty.desktop))?.[1],
		/aria-describedby="([^"]+)"/.exec(line(empty.phone))?.[1],
	)
})

test("the line under the question says what to do, for what is typed", () => {
	const { empty, one, typed } = rendered.question
	assert.match(empty.desktop, />Type on the keyboard, or pick one\.</)
	assert.match(empty.phone, />Tap the line to type, or pick one\.</)
	for (const edition of EDITIONS) {
		assert.match(one[edition], />Two letters or more\.</)
		assert.match(typed[edition], />OK searches for it\.</)
	}
})

test("the ideas say their words, and the key for what is typed names it", () => {
	const { empty, one, typed, long } = rendered.question
	for (const edition of EDITIONS) {
		for (const idea of IDEAS)
			assert.equal(
				count(empty[edition], `>${idea.slice("idea:".length)}</span>`),
				1,
				idea,
			)
		assert.match(one[edition], />Search “h”</)
		assert.match(typed[edition], />Search “heist”</)
		assert.ok(!typed[edition].includes("mind-bending thriller"))
		// A long query stays on two lines of its key.
		assert.match(
			long[edition],
			/<span class="line-clamp-2 break-words">Search “a long evening/,
		)
	}
})

test("the focus is where the machine says: on the key for what is typed, on an idea, on the bar", () => {
	const { empty, typed, onIdea, onBar } = rendered.question
	for (const edition of EDITIONS) {
		assert.deepEqual(focused(empty[edition]), ["idea:cozy mystery"])
		assert.deepEqual(focused(typed[edition]), ["go"])
		assert.deepEqual(focused(onIdea[edition]), ["idea:space adventure"])
		assert.deepEqual(focused(onBar[edition]), ["bar:menu"])
	}
})

test("the results' items in the markup are the machine's, in reading order, in both editions", () => {
	for (const screen of Object.values(rendered.results))
		for (const edition of EDITIONS)
			assert.deepEqual(ids(screen[edition]), drawn(screen.items))
	assert.deepEqual(rendered.results.found.items, [
		"title:movie-161",
		"title:movie-388",
		"title:show-1399",
		"title:movie-120",
		"expand",
		...BAR,
	])
	assert.deepEqual(drawn(rendered.results.two.items), [
		"title:movie-161",
		"title:movie-388",
		...BAR,
	])
	assert.deepEqual(drawn(rendered.results.none.items), BAR)
	// No line to type on here.
	for (const edition of EDITIONS)
		assert.equal(count(rendered.results.found[edition], "<input"), 0)
})

test("the results say what was searched for, and name the focused title with its facts", () => {
	const { found, second, spaced } = rendered.results
	for (const edition of EDITIONS) {
		assert.match(found[edition], />Search</)
		assert.match(found[edition], />“heist”</)
		assert.match(spaced[edition], />“cozy mystery”</)
		assert.deepEqual(focused(found[edition]), ["title:movie-161"])
		assert.match(found[edition], />Ocean&#x27;s Eleven</)
		assert.match(
			found[edition],
			/>2001 · Movie · 1h 56m · 82 score · On Netflix</,
		)
		assert.match(second[edition], />Inside Man</)
		assert.match(
			second[edition],
			/>2001 · Movie · 1h 56m · 82 score · 91% match · On Netflix</,
		)
		assert.ok(!second[edition].includes(">Ocean&#x27;s Eleven<"))
	}
})

test("the results' pictures: a poster per title, and the focused title's backdrop behind them", () => {
	const { found, second } = rendered.results
	for (const id of [161, 388, 1399, 120]) {
		assert.equal(count(found.desktop, `/t/p/w342/poster-${id}.jpg`), 1)
		assert.equal(count(found.phone, `/t/p/w185/poster-${id}.jpg`), 1)
	}
	assert.equal(count(found.desktop, "/t/p/w1280/backdrop-161.jpg"), 1)
	assert.equal(count(found.phone, "/t/p/w780/backdrop-161.jpg"), 1)
	assert.equal(count(second.desktop, "/t/p/w1280/backdrop-388.jpg"), 1)
	assert.equal(count(found.desktop, "<img"), 5)
	// A poster says its title to a screen reader.
	assert.match(tag(found.desktop, "title:movie-388"), /aria-label="Inside Man"/)
})

test("without titles the results say that the search runs, why it failed, or that it found nothing", () => {
	const { waiting, unreported, none, failed } = rendered.results
	for (const edition of EDITIONS) {
		assert.match(waiting[edition], />Searching…</)
		assert.match(unreported[edition], />Searching…</)
		assert.match(none[edition], />Nothing found\.</)
		assert.match(
			failed[edition],
			/>Search is busy right now\. Try again in a moment\.</,
		)
		for (const screen of [waiting, unreported, none, failed]) {
			// The way back has the focus.
			assert.deepEqual(focused(screen[edition]), ["bar:back"])
			assert.equal(count(screen[edition], "<img"), 0)
		}
	}
})

test("the Expand key's corner is reserved and empty on the results, in both editions", () => {
	for (const html of [
		rendered.results.found.desktop,
		rendered.results.found.phone,
	]) {
		assert.match(html, /<div data-tv-expand-place="true" class="[^"]*"><\/div>/)
		assert.ok(!ids(html).includes("expand"))
	}
	// On the desktop the band under the content is kept free for it; on the phone the last row ends before it.
	assert.match(rendered.results.found.desktop, /pb-\[120px\]/)
	assert.match(rendered.results.found.phone, /pr-\[158px\]/)
})

test("no type is under 20 canvas pixels on either screen, in either edition", () => {
	for (const screen of [
		...Object.values(rendered.question),
		...Object.values(rendered.results),
	])
		for (const edition of EDITIONS)
			for (const size of typeSizes(screen[edition]))
				assert.ok(size >= 20, `${edition}: ${size}`)
})

test("on every phone of the room's table the question's keys, the bar's and the results' last row are touch targets", () => {
	for (const phone of rendered.phones) {
		const at = `${phone.phone} at ${phone.scale.toFixed(3)}`
		for (const size of [phone.key, phone.foot, phone.bar])
			assert.ok(size * phone.scale >= 44, `${at}: ${size}`)
		// The four keys under the line are drawn at that height, two to a row.
		assert.deepEqual(ids(phone.question).slice(0, 4), [
			"go",
			...IDEAS.slice(0, 3),
		])
		for (const id of ["go", ...IDEAS.slice(0, 3)])
			assert.match(
				tag(phone.question, id),
				new RegExp(`style="height:${phone.key}px"`),
				`${at}: ${id}`,
			)
		assert.match(phone.question, /grid-cols-2/)
		assert.ok(
			count(phone.results, `pr-[158px]" style="height:${phone.foot}px"`) === 1,
			`${at}: the results' last row`,
		)
		// The question's column fits the picture: the word, the line, the line under it and two rows of keys under
		// the bar's 70 px, with 12 px under them.
		const column = 70 + 25 + 4 + 38 + 8 + 25 + 16 + 2 * phone.key + 10 + 12
		assert.ok(column <= phone.h, `${at}: the column is ${column} of ${phone.h}`)
	}
})

test("before its code is there the server draws search's bar alone: no line, and nothing typed or found", () => {
	for (const html of [rendered.first.question, rendered.first.results]) {
		assert.deepEqual(ids(html), BAR)
		assert.equal(count(html, "<input"), 0)
		assert.ok(!html.includes("heist"))
		assert.ok(!html.includes("Ocean"))
	}
})
