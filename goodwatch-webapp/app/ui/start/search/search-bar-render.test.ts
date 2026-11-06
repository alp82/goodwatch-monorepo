// The start page's search bar in the server's HTML (StartSearchBar.tsx): one line in a pill, one example at a time
// under it while the field is empty, the reading's box only while a search is on.
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

const examples = (html: string) =>
	[...html.matchAll(/<button type="button"[^>]*>Try “([^”]+)”<\/button>/g)].map(
		([, text]) => text,
	)

test("the field is one line: an input with its label, Discover's placeholder, private text, no heading", () => {
	for (const html of Object.values(rendered)) {
		assert.match(html, /<form role="search"/)
		assert.match(
			html,
			/<input [^>]*type="search"[^>]*aria-label="Search by mood, plot, or title"/,
		)
		assert.match(html, /placeholder="Describe what you want to watch"/)
		assert.match(html, /class="search-private ph-no-capture sentry-mask"/)
		assert.doesNotMatch(html, /<textarea/)
		assert.doesNotMatch(html, /Shift \+ Enter/)
		assert.doesNotMatch(html, /<h[1-6]\b/)
	}
})

test("one example shows while the field is empty; typed text makes it inert", () => {
	assert.equal(examples(rendered.empty).length, 1)
	assert.match(rendered.empty, /<div class="start-pill-examples">/)
	assert.match(rendered.typing, /<div class="start-pill-examples" inert="">/)
	assert.match(rendered.typing, /<div class="start-pill-field" data-filled="">/)
})

test("Clear shows once there is text; Search always", () => {
	assert.doesNotMatch(rendered.empty, /aria-label="Clear the search"/)
	for (const name of ["typing", "reading", "read", "unread", "mix"] as const)
		assert.match(rendered[name], /aria-label="Clear the search"/)
	for (const html of Object.values(rendered))
		assert.match(html, /<button type="submit" aria-label="Search"/)
})

test("the reading's box is there only while a search is on", () => {
	for (const name of ["empty", "typing"] as const)
		assert.doesNotMatch(rendered[name], /class="start-reading"/)
	for (const name of ["reading", "read", "unread", "mix"] as const)
		assert.match(rendered[name], /class="start-reading"/)
})
