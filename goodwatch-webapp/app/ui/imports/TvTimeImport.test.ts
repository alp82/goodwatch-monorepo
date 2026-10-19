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
	bulkDisabled: boolean
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

test("the match panel lists TV Time movies with what TV Time has and what a match adds, with manual matching when no suggestion is available", () => {
	const { text, sent } = runs.opened
	assert.ok(
		urls(runs.opened).includes(`GET /api/imports/${PARENT}/matches?offset=0`),
	)
	assert.ok(sent.some((item) => item.url.includes("/suggestions")))
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

const NEXT = "00000000-0000-4000-8000-0000000000e5"
const BULK = "00000000-0000-4000-8000-0000000000d4"

test("while matching runs, the preview shows a calm progress line and that the member can leave", () => {
	const { text, buttons } = runs.progress
	assert.match(text, /Matching shows and episodes…/)
	assert.match(text, /Checked 2,400 of 8,088 rows\. 1,900 matched so far\./)
	assert.match(
		text,
		/You can leave this page\. Matching keeps going, and your preview is here when you open TV Time again\./,
	)
	assert.ok(!buttons.includes("Run the import again"))
})

test("when the run publishes a replacement, the page moves to it with the replacement notice", () => {
	assert.ok(
		runs.replaced.sent.some((item) => item.url === `/api/imports/${NEXT}`),
	)
	assert.match(
		runs.replaced.text,
		/GoodWatch finished matching\. This preview replaces the earlier one\. Check your choices before you import\./,
	)
	assert.doesNotMatch(runs.replaced.text, /Checked 2,400/)
})

test("an early Confirm says it imports only what's matched so far and stops matching", () => {
	assert.match(
		runs.early.text,
		/GoodWatch is still matching\. Importing now brings in only what's matched so far, and matching stops\./,
	)
	assert.ok(runs.early.buttons.includes("Import what's matched so far"))
	const confirms = runs.earlyConfirmed.sent.filter((item) =>
		item.url.endsWith("/confirm"),
	)
	assert.deepEqual(
		confirms.map((item) => item.url),
		[`/api/imports/${PARENT}/confirm`],
	)
})

test("discarding during a run cancels it on the server and never follows its replacement", () => {
	const urls = runs.discarded.sent.map((item) => `${item.method} ${item.url}`)
	assert.ok(urls.includes(`POST /api/imports/${PARENT}/discard`))
	assert.ok(!urls.some((url) => url.includes(NEXT)))
	assert.match(runs.discarded.text, /Upload your TV Time export/)
})

test("matches not yet in the preview hold back a published replacement until the member loads it", () => {
	assert.ok(!runs.held.sent.some((item) => item.url === `/api/imports/${NEXT}`))
	assert.match(
		runs.held.text,
		/GoodWatch finished matching\. Update the preview or discard your changes, then load the latest preview\./,
	)
	assert.ok(runs.held.buttons.includes("Load the latest preview"))
})

test("suggested movies show their evidence in plain words and can all be accepted at once", () => {
	const { text, buttons, sent } = runs.suggested
	assert.match(
		text,
		/Suggested: Toy Story \(1995\) · Movie · Same title and release date on TMDB/,
	)
	assert.ok(buttons.includes("Accept all 2 suggestions"))
	assert.ok(buttons.some((name) => name.startsWith("Reject")))
	assert.ok(
		sent.some((item) =>
			item.url.includes(`/api/imports/${PARENT}/suggestions?offset=0`),
		),
	)
	const bulk = runs.bulk.sent.find((item) =>
		item.url.endsWith("/accept-suggestions"),
	)
	assert.deepEqual(bulk, {
		method: "POST",
		url: `/api/imports/${PARENT}/accept-suggestions`,
		body: { token: "token-1" },
	})
	assert.ok(
		runs.bulk.sent.some((item) => item.url === `/api/imports/${BULK}`) ||
			/Accepted 2 suggestions/.test(runs.bulk.text),
	)
	assert.match(
		runs.bulk.text,
		/Accepted 2 suggestions\. This preview replaces the earlier one\. Nothing is imported until you start the import\./,
	)
})

test("rejecting a suggestion sends no target for that movie, through the manual matching path", () => {
	assert.match(
		runs.rejected.text,
		/Suggestion turned down · Not in this preview yet/,
	)
	const resolve = runs.rejectSent.sent.find((item) =>
		item.url.endsWith("/resolve"),
	)
	assert.deepEqual(resolve?.body, { choices: [{ index: 2, target: null }] })
})

test("a busy refusal shows the server's words and when to try again", () => {
	assert.match(
		runs.busyGlobal.text,
		/Two imports are already matching\. Try again after one finishes\. Matching a large export can take about 15 minutes\./,
	)
	assert.match(
		runs.busyMember.text,
		/You already have an import matching\. Wait for it to finish or discard it\. Open it to follow its progress, or discard it to start again\./,
	)
	assert.ok(runs.busyMember.buttons.includes("Open the import that's matching"))
})

test("opening TV Time again brings back an unconfirmed preview", () => {
	assert.match(runs.resumed.text, /Checked 2,400 of 8,088 rows/)
})

test("a limited run says so without a rerun button; choosing the file again starts a new run", () => {
	const { text, buttons } = runs.limited
	assert.match(
		text,
		/This preview reached its lookup limit\. Run the import again to match more\.3 rows aren't matched yet\./,
	)
	assert.ok(!buttons.includes("Run the import again"))
	assert.match(
		text,
		/To run it again, discard this preview and choose the file again\./,
	)
})

test("a lookup outage reads as an outage, not as the lookup limit", () => {
	const { text, buttons } = runs.outage
	assert.match(
		text,
		/TMDB's TVDB lookup is unavailable; retry this import later\.2 rows aren't matched yet\./,
	)
	assert.doesNotMatch(text, /lookup limit/)
	assert.ok(!buttons.includes("Run the import again"))
})

test("accepting one suggestion waits for Update preview and prevents bulk acceptance from dropping that choice", () => {
	assert.equal(runs.individualAccepted.startDisabled, true)
	assert.equal(runs.individualAccepted.bulkDisabled, true)
	assert.match(
		runs.individualAccepted.text,
		/Your match: Toy Story \(1995\) · Movie · Accepted/,
	)
	const resolve = runs.individualSent.sent.find((item) =>
		item.url.endsWith("/resolve"),
	)
	assert.deepEqual(resolve?.body, {
		choices: [{ index: 2, target: { mediaType: "movie", tmdbId: 862 } }],
	})
	assert.match(runs.individualSent.text, /Updated with your matches/)
})

test("an expired or changed bulk snapshot can be refreshed without losing the preview", () => {
	assert.match(
		runs.stale.text,
		/These suggestions have changed. Review them again./,
	)
	assert.ok(runs.stale.buttons.includes("Refresh suggestions"))
	assert.equal(
		runs.refreshed.sent.filter((item) =>
			item.url.endsWith("/suggestions?offset=0"),
		).length,
		2,
	)
})

test("a failed discard keeps the preview open and offers the discard again", () => {
	assert.match(runs.discardFailed.text, /Discard could not finish. Try again./)
	assert.match(runs.discardFailed.text, /Checked 2,400 of 8,088 rows/)
	assert.ok(
		runs.discardFailed.buttons.includes("Discard and choose another file"),
	)
})
