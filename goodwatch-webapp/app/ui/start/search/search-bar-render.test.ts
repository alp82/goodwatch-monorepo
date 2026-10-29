// The start page's search bar in the server's HTML (StartSearchBar.tsx): the same boxes in every state, so the bar
// never changes height between the presets and the reading.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

const rendered = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/start/search/search-bar-render.test-support.tsx",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__START_SEARCH_BAR__")
		.at(-1) ?? "",
) as Record<"empty" | "typing" | "reading" | "read" | "unread" | "mix", string>

/** The classes of every element whose class sets a height, in order: the bar's boxes. */
const boxes = (html: string) =>
	[...html.matchAll(/class="([^"]*\bh-\[[^"]*)"/g)].map(([, c]) => c)
const rows = (html: string) =>
	[...html.matchAll(/<div class="start-bar-row"([^>]*)>/g)].map(([, a]) => a)

test("the bar's boxes are the same in every state", () => {
	const states = Object.values(rendered)
	for (const html of states) {
		assert.deepEqual(boxes(html), boxes(rendered.empty))
		assert.equal(
			rows(html).length,
			2,
			"both layers of the second row are mounted",
		)
	}
	assert.ok(
		boxes(rendered.empty).some(
			(c) =>
				c.includes("h-[58px]") &&
				c.includes("sm:h-[70px]") &&
				c.includes("lg:h-[74px]"),
		),
	)
	assert.ok(
		boxes(rendered.empty).some(
			(c) => c.includes("h-[42px]") && c.includes("sm:h-[44px]"),
		),
	)
})

test("the presets show until a search is on; then the reading, and the presets are out of reach", () => {
	for (const name of ["empty", "typing"] as const) {
		const [presets, reading] = rows(rendered[name])
		assert.doesNotMatch(presets, /data-off/)
		assert.match(reading, /data-off="" inert=""/)
	}
	for (const name of ["reading", "read", "unread"] as const) {
		const [presets, reading] = rows(rendered[name])
		assert.match(presets, /data-off="" inert=""/)
		assert.doesNotMatch(reading, /data-off/)
	}
	for (const phrase of [
		"cheer me up",
		"rainy day whodunit",
		"severance but funny",
		"twist ending",
		"space adventure",
		"grown up cartoons",
	])
		assert.match(
			rendered.empty,
			new RegExp(`<button type="button"[^>]*>${phrase}</button>`),
		)
})

test("the reading row: Reading… first, then Read as with the picks, else the text", () => {
	assert.match(rendered.reading, /Reading…/)
	assert.match(rendered.read, /Read as/)
	assert.match(rendered.read, /Mystery/)
	assert.match(rendered.read, /Funny/)
	assert.doesNotMatch(rendered.read, /Reading…/)
	assert.match(rendered.unread, /“zzzz”/)
	// A whole mix by its name, then the other words.
	assert.match(rendered.mix, /Warm, easy comedies[\s\S]*Slow burn/)
	assert.doesNotMatch(rendered.mix, /Cozy/)
})

test("the field: its label, the wide placeholder from the server, private text, no heading", () => {
	const html = rendered.empty
	assert.match(html, /<form role="search"/)
	assert.match(html, /<input [^>]*aria-label="Search by mood, plot, or title"/)
	assert.match(html, /placeholder="Describe a mood, a plot, or a title…"/)
	assert.match(html, /class="[^"]*search-private ph-no-capture sentry-mask/)
	assert.doesNotMatch(html, /<h[1-6]\b/)
	for (const preset of ["cheer me up", "twist ending"])
		assert.doesNotMatch(html, new RegExp(`placeholder="[^"]*${preset}`))
})
