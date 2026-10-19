import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"

type Sent = { method: string; url: string; body: unknown }
type Run = {
	text: string
	sent: Sent[]
	buttons: string[]
	radios: string[]
	startDisabled: boolean
}

const runs = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/imports/tvtime-import-interaction.test-support.tsx",
		],
		{ encoding: "utf8" },
	)
		.split("__TVTIME_IMPORT__")
		.at(-1) ?? "",
) as Record<string, Run>

const PARENT = "00000000-0000-4000-8000-0000000000a1"
const CHILD = "00000000-0000-4000-8000-0000000000b2"
const urls = (run: Run) => run.sent.map((item) => `${item.method} ${item.url}`)

test("a TV Time preview keeps its data-type and watch-date choices and adds a movie match section", () => {
	const { text, sent } = runs.closed
	assert.match(text, /What should GoodWatch import\?/)
	assert.match(text, /Movies to match/)
	assert.match(
		text,
		/TV Time's export names this movie but has no catalog ID for it, so GoodWatch didn't add it on its own\./,
	)
	// Nothing loads until the member opens the section, and the wishlist-only preview isn't used.
	assert.ok(!sent.some((item) => item.url.includes("/matches")))
	assert.doesNotMatch(text, /Add to Want to See/)
})

test("the match panel lists TV Time movies with what TV Time has and what a match adds, without suggestions", () => {
	const { text, sent } = runs.opened
	assert.ok(
		urls(runs.opened).includes(`GET /api/imports/${PARENT}/matches?offset=0`),
	)
	assert.ok(!sent.some((item) => item.url.includes("/suggestions")))
	assert.match(text, /Die Spielzeuggeschichte/)
	assert.match(text, /November 22, 1995 · 2 watches · For later/)
	assert.match(
		text,
		/Matching adds 1 watch and 1 rewatch\. For later isn't added: a watch comes first\./,
	)
	assert.match(
		text,
		/When a watch and a For later entry match the same movie, GoodWatch adds the watch and leaves the movie off Want to See\./,
	)
	assert.doesNotMatch(text, /ID m1/)
})

test("the search for a TV Time movie looks for movies only and offers no type choice", () => {
	const { text, radios } = runs.editor
	assert.ok(
		urls(runs.editor).includes(
			`GET /api/imports/${PARENT}/matches?index=2&q=Die+Spielzeuggeschichte&type=movie`,
		),
	)
	assert.ok(!radios.some((label) => /Movies and shows|^Shows$/.test(label)))
	assert.match(text, /TypeMovie/)
	assert.match(text, /ReleasedNovember 22, 1995/)
	assert.match(text, /Which GoodWatch movie is "Die Spielzeuggeschichte"\?/)
})

test("a match not yet in the preview holds back Start import", () => {
	assert.equal(runs.chosen.startDisabled, true)
	assert.match(runs.chosen.text, /Your matches aren't in this preview yet\./)
})

test("the child preview replaces the parent, so only the child can be imported", () => {
	const resolve = runs.child.sent.find((item) => item.url.endsWith("/resolve"))
	assert.deepEqual(resolve, {
		method: "POST",
		url: `/api/imports/${PARENT}/resolve`,
		body: {
			choices: [{ index: 2, target: { mediaType: "movie", tmdbId: 862 } }],
		},
	})
	assert.match(
		runs.child.text,
		/Updated with your matches\. This preview replaces the earlier one, and the counts include your matches\./,
	)
	assert.match(runs.child.text, /Movies to match 1 of 1 matched/)
	assert.match(
		runs.child.text,
		/You matched the movie\. Change the match if it's wrong\./,
	)
	assert.equal(
		runs.child.buttons.filter((name) => name === "Start import").length,
		1,
	)
	const confirms = runs.confirmed.sent.filter((item) =>
		item.url.endsWith("/confirm"),
	)
	assert.deepEqual(
		confirms.map((item) => item.url),
		[`/api/imports/${CHILD}/confirm`],
	)
})

test("a preview that reached its lookup limit says so and runs the same file again", () => {
	const { text, buttons } = runs.limit
	assert.match(
		text,
		/This preview reached its lookup limit\. Run the import again to match more\.2,400 rows aren't matched yet\./,
	)
	assert.match(
		text,
		/Run it again before you match movies: a new run starts without your matches\./,
	)
	assert.ok(buttons.includes("Run the import again"))
	const previews = runs.rerun.sent.filter((item) =>
		item.url.endsWith("/preview"),
	)
	assert.deepEqual(
		previews.map((item) => item.body),
		[
			{ source: "tvtime", file: "file:gdpr-data.zip" },
			{ source: "tvtime", file: "file:gdpr-data.zip" },
		],
	)
	assert.match(
		runs.rerun.text,
		/Ran the import again with the same file\. This preview replaces the earlier one\./,
	)
	assert.doesNotMatch(runs.rerun.text, /reached its lookup limit/)
})

test("without the file in memory, the lookup limit offers to choose the file again", () => {
	assert.match(runs.limitNoFile.text, /reached its lookup limit/)
	assert.match(runs.limitNoFile.text, /1 row isn't matched yet\./)
	assert.ok(!runs.limitNoFile.buttons.includes("Run the import again"))
	assert.ok(runs.limitNoFile.buttons.includes("Choose the file again"))
})

test("a lookup outage reads as an outage, not as the lookup limit", () => {
	const { text } = runs.outage
	assert.match(
		text,
		/TMDB's TVDB lookup is unavailable; retry this import later\.2 rows aren't matched yet\./,
	)
	assert.doesNotMatch(text, /lookup limit/)
	assert.doesNotMatch(text, /Movies to match/)
})

test("an outage rerun warns about matches too, since a new run starts without them", () => {
	const { text } = runs.outageWithMatches
	assert.match(text, /TMDB's TVDB lookup is unavailable/)
	assert.match(
		text,
		/Run it again before you match movies: a new run starts without your matches\./,
	)
	assert.doesNotMatch(text, /lookup limit/)
})
