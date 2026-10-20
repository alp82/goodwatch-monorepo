import { KEY_ITEMS } from "./tv-browse.ts"
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
/** The search screens have no Search key: the person is there. */
const BAR = ["bar:back", "bar:menu"]
const EDITIONS = ["desktop", "phone"] as const

test("Recovered keyboard markup follows machine order in both editions, with letters, digits and editing actions", () => {
	for (const screen of Object.values(rendered.question))
		for (const edition of EDITIONS) {
			assert.deepEqual(ids(screen[edition]), screen.items)
			assert.deepEqual(screen.items, [...KEY_ITEMS, ...BAR])
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
	for (const screen of Object.values(rendered.results))
		for (const edition of EDITIONS)
			assert.deepEqual(ids(screen[edition]), screen.items)
	for (const edition of EDITIONS) {
		assert.match(
			rendered.results.found[edition],
			/“heist” · Page 1 of 1 · 4 matches/,
		)
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
		assert.deepEqual(focused(rendered.question.empty[edition]), ["key:q"])
		assert.deepEqual(focused(rendered.question.onBar[edition]), ["bar:menu"])
	}
})
test("Phone keyboard scrolls while the input and action row stay outside it; keys are touch targets", () => {
	for (const phone of rendered.phones) {
		assert.match(phone.question, /data-tv-scroll/)
		assert.match(phone.question, /overflow-y-auto/)
		for (const id of [
			"key:q",
			"key:0",
			"go",
			"key:clear",
			"key:delete",
			"key:space",
		]) {
			const height = Number(
				/height:([\d.]+)px/.exec(tag(phone.question, id))?.[1],
			)
			assert.ok(height * phone.scale >= 44, `${phone.phone} ${id}: ${height}`)
		}
		assert.ok(phone.bar * phone.scale >= 44)
	}
})
test("Before interaction the server renders only the search bar, with no eager keyboard or input", () => {
	assert.deepEqual(ids(rendered.first.question), BAR)
	assert.deepEqual(ids(rendered.first.results), ["expand", ...BAR])
	for (const html of Object.values(rendered.first))
		assert.equal(count(html, "<input"), 0)
})
