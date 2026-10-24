import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"

const rendered = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/imports/wishlist-import-render.test-support.tsx",
		],
		{ encoding: "utf8" },
	)
		.split("__WISHLIST_RENDER__")
		.at(-1) ?? "",
) as Record<string, string>

const text = (html: string) =>
	html
		.replace(/<[^>]+>/g, " ")
		.replace(/&#x27;/g, "'")
		.replace(/&amp;/g, "&")
		.replace(/\s+/g, " ")

type Screen = {
	counter: string | null
	heading: string
	highlighted: string[]
	answers: { text: string; pressed: string | null; suggested: boolean }[]
}
type Answered = {
	choose: string
	screens: Screen[]
	sent: Record<string, unknown> | null
	after: string
}
const watcharr = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/imports/watcharr-import-interaction.test-support.tsx",
		],
		{ encoding: "utf8" },
	)
		.split("__WATCHARR_CHOICES__")
		.at(-1) ?? "",
) as {
	runs: {
		conflictChoice: string
		rewatch: boolean
		sent: {
			wishlistRewatch?: boolean
			conflictChoice: string
			watchDates: string
		}
	}[]
	questions: Record<string, Answered>
}

test("a wishlist's Choose step lists Want to See with one Import button, without the general import's choices", () => {
	const page = text(rendered.mixed)
	assert.match(page, /What should come in\?/)
	assert.match(page, /Want to See 7/)
	assert.doesNotMatch(
		page,
		/watch dates|When GoodWatch already has different data/i,
	)
	assert.match(rendered.mixed, /<button[^>]*>Import<\/button>/)
	assert.doesNotMatch(page, /Start import|Add to Want to See/)
})

test("titles already seen stay Seen unless the member answers yes to Want to rewatch", () => {
	const [mixed] = watcharr.questions.mixed.screens
	assert.equal(mixed.counter, "Question 1 of 1")
	assert.equal(
		mixed.heading,
		"2 titles in your Watcharr file are already Seen. Add them to Want to rewatch?",
	)
	assert.deepEqual(mixed.highlighted, ["Seen", "Want to rewatch"])
	assert.deepEqual(mixed.answers, [
		{ text: "Yes, add to Want to rewatch", pressed: "false", suggested: false },
		{ text: "No, leave them as Seen", pressed: "false", suggested: true },
	])
	const [one] = watcharr.questions.oneSeen.screens
	assert.equal(
		one.heading,
		"1 title in your Watcharr file is already Seen. Add it to Want to rewatch?",
	)
	assert.equal(one.answers[1].text, "No, leave it as Seen")
	assert.equal(watcharr.questions.sourceSeen.sent?.wishlistRewatch, true)
	assert.equal(watcharr.questions.sourceSeen.sent?.conflictChoice, "source")
})

test("the file's coverage note stays on Choose", () => {
	assert.match(
		text(rendered.mixed),
		/This file may hold only part of your list\./,
	)
})

test("with nothing new, Done says so as a success; with only Seen titles left as Seen, nothing starts", () => {
	const nothing = text(rendered.nothing)
	assert.match(nothing, /You're all caught up/)
	assert.match(
		nothing,
		/All 2 titles from this Watcharr file are already in GoodWatch\./,
	)
	assert.doesNotMatch(nothing, /What should come in/)
	assert.match(
		watcharr.questions.oneSeen.after,
		/Nothing changes with these answers/,
	)
	assert.equal(watcharr.questions.oneSeen.sent, null)
	assert.match(text(rendered.confirming), /Starting import/)
})

test("a wishlist row whose source gave no type says Type unknown, and an unmatched row offers a search in a new tab", () => {
	const unknown = text(rendered.unknownType)
	assert.match(unknown, /Dark & Light · Type unknown/)
	assert.match(
		rendered.unknownType,
		/<a href="\/discover\?q=Dark%20%26%20Light" target="_blank" rel="noopener noreferrer"[^>]*>Search<span class="sr-only"> for Dark &amp; Light \(new tab\)<\/span><\/a>/,
	)
	assert.match(text(rendered.show), /· Show/)
	assert.doesNotMatch(rendered.matched, /Search/)
	assert.doesNotMatch(rendered.generalUnmatched, /Search|Type unknown/)
})

test("the wishlist Done step offers another file, not another export, and Undo", () => {
	assert.match(text(rendered.receipt), /Import another file/)
	assert.doesNotMatch(text(rendered.receipt), /another export/)
	assert.match(rendered.receipt, /Undo this import/)
})

test("one upload takes Watcharr's own export and a wishlist file another tool saved", () => {
	const page = text(rendered.upload)
	assert.match(page, /Upload your Watcharr export or wishlist file/)
	assert.match(
		page,
		/From Watcharr: open Settings, choose Export, then choose Export in the Export Watched List window\. Upload the watcharr-export\.json file/,
	)
	assert.match(
		page,
		/From another tool: if a tool saved your list as a wishlist file for GoodWatch/,
	)
	assert.match(
		page,
		/ratings, season and episode scores, thoughts as reviews, watches, episode progress, and show statuses/,
	)
	assert.match(page, /Planned becomes Want to See; Finished becomes Seen/)
	assert.match(rendered.upload, /accept="\.json,application\/json"/)
	assert.match(page, /Choose JSON file/)
	assert.doesNotMatch(page, /format|version|schema|envelope/i)
})

type Focus = { tag: string; text: string; type: string | null } | null
type MatchRun = {
	text: string
	focus: Focus
	sent: { method: string; url: string; body: unknown }[]
	[extra: string]: unknown
}
const matching = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/imports/wishlist-match-interaction.test-support.tsx",
		],
		{ encoding: "utf8" },
	)
		.split("__WISHLIST_MATCH__")
		.at(-1) ?? "",
) as Record<string, MatchRun>
const urls = (run: MatchRun) => run.sent.map((item) => item.url)
const resolves = (run: MatchRun) =>
	run.sent.filter((item) => item.url.endsWith("/resolve"))

test("entries to match are the last question, asked only when the server counts some, and nothing loads until the member says yes", () => {
	assert.doesNotMatch(text(rendered.mixed), /Check them now/)
	const closed = matching.closed
	assert.match(closed.text, /What should come in\?/)
	assert.match(matching.rewatchAsked.text, /Question 1 of 2/)
	assert.ok(
		!urls(matching.rewatchAsked).some((url) => url.includes("/matches")),
	)
	const opened = matching.opened
	assert.match(
		opened.text,
		/Question 2 of 2Your file doesn't say whether 3 entries are movies or shows\. Check them now\?/,
	)
	assert.ok(urls(opened).some((url) => url.endsWith("/matches?offset=0")))
	assert.deepEqual(opened.focus, {
		tag: "h4",
		text: "Review matches",
		type: null,
	})
	assert.ok(!urls(opened).some((url) => /\/api\/(combined-)?search/.test(url)))
})

test("rows that share a source ID are one entry with one choice", () => {
	assert.equal(matching.opened.text.match(/Listed 3 times/g)?.length, 1)
	assert.match(
		matching.entry.text,
		/Listed 3 times in your file\. Your match applies to every one\."The Office""The Office \(U\.S\.\)"/,
	)
	const [office] = resolves(matching.failed)
	assert.deepEqual(office.body, {
		choices: [
			{ index: 4, target: { mediaType: "show", tmdbId: 2316 } },
			{ index: 9, target: null },
		],
	})
})

test("opening an entry searches the file's title once and checks nothing, even with one result", () => {
	const entry = matching.entry
	assert.ok(urls(entry).at(-1)?.endsWith("/matches?index=4&q=The+Office"))
	assert.deepEqual(entry.radios, [false])
	assert.equal(entry.useDisabled, true)
	assert.deepEqual(entry.focus, { tag: "input", text: "", type: "search" })
	assert.match(entry.text, /1 result\.Which GoodWatch title is "The Office"\?/)
	assert.match(entry.text, /Open on www\.netflix\.com \(new tab\)/)
	assert.equal(matching.picked.useDisabled, false)
	assert.equal(matching.picked.confirmDisabled, false)
})

test("Escape closes an entry without a choice and returns focus to its button", () => {
	assert.deepEqual(matching.escaped.focus, {
		tag: "button",
		text: "Find a match for The Office",
		type: "button",
	})
	assert.match(
		matching.escaped.text,
		/The OfficeType unknown · ID 70136120 · Listed 3 timesNot matched/,
	)
})

test("a choice waits in this preview until Update preview, and holds back leaving the rest out", () => {
	const used = matching.used
	assert.match(used.text, /Matched to The Office \(2005\), show\./)
	assert.match(
		used.text,
		/Your match: The Office \(2005\) · Show · Not in this preview yet/,
	)
	assert.deepEqual(used.focus, {
		tag: "button",
		text: "Change the match for The Office",
		type: "button",
	})
	assert.equal(used.confirmDisabled, true)
	assert.equal(used.confirmReason, "import-match-unapplied")
	assert.match(used.text, /Your matches aren't in this preview yet\./)
	assert.equal(resolves(used).length, 0)
})

test("Clear removes a match the preview holds, and going back from the question keeps every change", () => {
	assert.match(
		matching.cleared.text,
		/GoTType unknown · ID 70305903Match removed · Not in this preview yet/,
	)
	assert.match(matching.cleared.text, /Match cleared\./)
	assert.deepEqual(matching.cleared.focus, {
		tag: "button",
		text: "Find a match for GoT",
		type: "button",
	})
	assert.match(matching.reshown.text, /2 changes aren't in this preview yet/)
	assert.match(matching.reshown.text, /Your match: The Office \(2005\)/)
})

test("a failed update keeps the choices and lets the member try again", () => {
	const failed = matching.failed
	assert.match(
		failed.text,
		/We couldn't reach GoodWatch\. Check your connection and try again\./,
	)
	assert.match(
		failed.text,
		/Your match: The Office \(2005\) · Show · Not in this preview yet/,
	)
	assert.equal(failed.confirmDisabled, true)
	assert.equal(failed.updateDisabled, false)
	assert.equal(resolves(matching.updated).length, 2)
	assert.deepEqual(resolves(matching.updated)[1].body, resolves(failed)[0].body)
})

test("a new preview replaces the old one on screen, says so, and resets the Seen answer", () => {
	const updated = matching.updated
	assert.deepEqual(updated.focus, {
		tag: "h2",
		text: "What should come in?",
		type: null,
	})
	assert.match(
		updated.text,
		/Updated with your changes\. The counts include them\. Your answer about titles you've already seen was reset\./,
	)
	assert.equal(updated.confirmDisabled, false)
	assert.doesNotMatch(updated.text, /Not in this preview yet/)
	assert.ok(!urls(updated).some((url) => url.endsWith("/confirm")))
})

test("a preview that can't take matches shows GoodWatch's own message for the code and offers the file again", () => {
	assert.match(
		matching.restart.text,
		/This preview can't change anymore, because it was imported or is no longer a preview\. To match titles, choose the file again\./,
	)
	assert.doesNotMatch(matching.restart.text, /Server message|wishlist_/)
	assert.equal(matching.restart.chooseAgain, true)
	assert.match(matching.restart.text, /Your match: Dark \(2017\)/)
	assert.match(
		matching.restarted.text,
		/Upload your Watcharr export or wishlist file/,
	)
	assert.match(
		matching.oldPreview.text,
		/This preview was made before you could match titles yourself\. To match them, choose the file again\.Choose the file again/,
	)
	assert.doesNotMatch(matching.oldPreview.text, /Server message|wishlist_/)
	assert.doesNotMatch(matching.oldPreview.text, /Update preview/)
})

test("with every entry matched, the panel still shows the match and Change opens it", () => {
	assert.match(
		matching.allResolved.text,
		/GoTType unknown · ID 70305903Your match: Game of Thrones \(2011\) · ShowChange the match for GoT/,
	)
	const changed = matching.changeFromRow
	assert.deepEqual(changed.focus, { tag: "input", text: "", type: "search" })
	assert.match(
		changed.text,
		/Your match: Game of Thrones \(2011\) · ShowFrom your file/,
	)
})

test("search runs only when sent, and a type filter without results offers both types", () => {
	assert.equal(matching.typed.sentWhileTyping, 0)
	assert.ok(
		urls(matching.noResults)
			.at(-1)
			?.endsWith("index=7&q=Dark+Matter&type=show"),
	)
	assert.match(
		matching.noResults.text,
		/No GoodWatch titles match "Dark Matter"\./,
	)
	assert.equal(matching.noResults.widen, true)
	assert.match(matching.tooShort.text, /Type 2 to 100 characters to search\./)
	assert.equal(urls(matching.tooShort).length, urls(matching.noResults).length)
})

test("leaving the rest out starts the import: the panel goes, so no match can change while it starts", () => {
	const locked = matching.locked
	assert.match(locked.text, /Starting your import/)
	assert.equal(locked.use, false)
	assert.equal(locked.clear, false)
	assert.doesNotMatch(locked.text, /Not in this preview yet|Match cleared/)
	assert.equal(resolves(locked).length, 0)
})

test("at 100 changes, entries without a change can't Clear or Use, changed entries still can, and one update sends 100", () => {
	const full = matching.capFull as unknown as Record<string, unknown>
	assert.equal(full.changes, true)
	assert.equal(full.full, true)
	assert.equal(full.clear, true)
	assert.match(String(full.reason), /-full$/)
	assert.equal(full.discard, false)
	assert.deepEqual(matching.capBlocked, { use: true, full: true })
	assert.deepEqual(matching.capChanged, {
		use: false,
		changes: true,
		match: true,
	})
	assert.deepEqual(matching.capSent, {
		count: 100,
		first: { index: 1000, target: { mediaType: "movie", tmdbId: 20000 } },
		hasLast: false,
	})
})

test("opening the panel asks for GoodWatch's suggestions and shows each one next to the file's entry, counting nothing yet", () => {
	const run = matching.suggested
	assert.ok(!urls(matching.closed).some((url) => url.includes("/suggestions")))
	const asked = run.sent.filter((item) => item.url.includes("/suggestions"))
	assert.deepEqual(
		asked.map((item) => item.url),
		[
			`/api/imports/${"00000000-0000-4000-8000-0000000000a1"}/suggestions?offset=0`,
		],
	)
	assert.ok(asked.every((item) => (item as { signal?: boolean }).signal))
	assert.match(
		run.text,
		/The OfficeType unknown · ID 70136120 · Listed 3 timesSuggested: The Office \(2005\) · Show · Same Netflix ID as your file/,
	)
	assert.deepEqual(
		(run.posters as string[]).map((src) => src.includes("/office.jpg")),
		[true],
	)
	assert.match(run.text, /DarkType unknown · ID 80100172Not matched/)
	assert.equal(run.confirmDisabled, false)
	assert.doesNotMatch(run.text, /Not in this preview yet/)
})

test("Accept makes the suggestion a pending match that only Update preview counts", () => {
	const run = matching.accepted
	assert.match(
		run.text,
		/Your match: The Office \(2005\) · Show · Accepted · Not in this preview yet/,
	)
	assert.match(run.text, /Accepted The Office \(2005\), show\./)
	assert.deepEqual(run.focus, {
		tag: "button",
		text: "Change the match for The Office",
		type: "button",
	})
	assert.equal(run.confirmDisabled, true)
	assert.equal(resolves(run).length, 0)
	const [sentResolve] = resolves(matching.acceptedSent)
	assert.deepEqual(sentResolve.body, {
		choices: [{ index: 4, target: { mediaType: "show", tmdbId: 2316 } }],
	})
})

test("suggestions load a page of 10 at a time for the entries shown, each request cancellable", () => {
	const asked = matching.bulkBefore.sent.filter((item) =>
		item.url.includes("/suggestions"),
	)
	assert.deepEqual(
		asked.map((item) => item.url.replace(/.*\//, "")),
		["suggestions?offset=0", "suggestions?offset=10"],
	)
	assert.ok(asked.every((item) => (item as { signal?: boolean }).signal))
})

test("accepting every suggestion shown is one action that skips an entry the member already matched", () => {
	assert.match(
		matching.bulkBefore.text,
		/Each title shows what your file says next to the suggestion\. Check them before you accept\./,
	)
	const run = matching.bulkAccepted
	assert.match(
		run.text,
		/Accepted 11 suggestions\. They aren't in this preview yet\. 1 you changed stays as you set it\./,
	)
	assert.equal(run.keptFocus, true)
	assert.deepEqual(run.focus, {
		tag: "button",
		text: "Undo accept all",
		type: "button",
	})
	assert.match(
		run.text,
		/Your match: Dark \(2005\) · Movie · Not in this preview yet/,
	)
	assert.match(
		run.text,
		/Filler 9Type unknown · ID 91009Your match: Film 9 \(2001\) · Movie · Accepted · Not in this preview yet/,
	)
	assert.match(
		run.text,
		/12 changes aren't in this preview yet, 11 of them accepted suggestions\. Update the preview to count them\./,
	)
	assert.equal(run.confirmDisabled, true)
	assert.equal(resolves(run).length, 0)
})

test("Undo accept all takes back only the bulk accepts the member didn't change afterwards", () => {
	const run = matching.bulkUndone
	assert.match(run.text, /Took back 10 accepted suggestions\./)
	assert.equal(run.keptFocus, true)
	assert.deepEqual(run.focus, {
		tag: "button",
		text: "Accept the 10 suggestions shown",
		type: "button",
	})
	assert.match(
		run.text,
		/Your match: Dark \(2005\) · Movie · Not in this preview yet/,
	)
	assert.match(
		run.text,
		/Your match: Other film \(1999\) · Movie · Not in this preview yet/,
	)
	assert.match(
		run.text,
		/Filler 9Type unknown · ID 91009Suggested: Film 9 \(2001\) · Movie · Same Netflix ID as your file/,
	)
	assert.match(run.text, /2 changes aren't in this preview yet\./)
	const [sentResolve] = resolves(matching.bulkSent)
	assert.deepEqual(sentResolve.body, {
		choices: [
			{ index: 7, target: { mediaType: "movie", tmdbId: 9999 } },
			{ index: 100, target: { mediaType: "movie", tmdbId: 40000 } },
		],
	})
})

test("when the suggestions shown don't fit in the 100-change limit, bulk accept stays off, says why, and accepts none", () => {
	const run = matching.bulkCap
	assert.equal(run.bulk, true)
	assert.match(String(run.reason), /-bulk-full$/)
	assert.match(
		run.text,
		/There's room for 9 more changes in this update, so GoodWatch can't accept all 10\. Update the preview first, or accept them one at a time\./,
	)
	assert.match(run.text, /91 changes aren't in this preview yet\./)
	assert.doesNotMatch(run.text, /Accepted 10 suggestions|· Accepted ·/)
	const one = matching.bulkCapOne
	assert.match(
		one.text,
		/Your match: Film 3 \(2001\) · Movie · Accepted · Not in this preview yet/,
	)
	assert.match(
		one.text,
		/92 changes aren't in this preview yet, 1 of them accepted suggestion\./,
	)
})

test("a failed suggestion page says the titles weren't checked, never that nothing matched, without the server's words", () => {
	const run = matching.suggestFailed
	assert.match(
		run.text,
		/GoodWatch couldn't check some titles for a match right now\. You can still match them yourself\. 12 titles weren't checked\.Try again/,
	)
	assert.match(run.text, /DarkType unknown · ID 80100172Not checked yet/)
	assert.doesNotMatch(
		run.text,
		/ID \d+Not matched|Internal|exploded|Suggested:/,
	)
})

test("Try again asks only for unchecked pages, and the member's own match wins over a suggestion that arrives later", () => {
	const run = matching.suggestRetried
	const asked = (r: MatchRun) =>
		r.sent
			.filter((item) => item.url.includes("/suggestions"))
			.map((item) => item.url.replace(/.*\//, ""))
	assert.deepEqual(asked(run), [
		"suggestions?offset=0",
		"suggestions?offset=10",
		"suggestions?offset=0",
		"suggestions?offset=10",
	])
	assert.match(
		run.text,
		/DarkType unknown · ID 80100172Your match: Dark \(2005\) · Movie · Not in this preview yet/,
	)
	assert.match(run.text, /Filler 1Type unknown · ID 91001Not checked yet/)
	assert.match(run.text, /1 title wasn't checked\./)
	assert.match(
		run.text,
		/Filler 0Type unknown · ID 91000Suggested: Film 0 \(2001\)/,
	)
	assert.match(run.text, /Accept the 10 suggestions shown/)
	const again = matching.suggestRetriedAgain
	assert.deepEqual(asked(again).slice(4), ["suggestions?offset=0"])
	assert.match(again.text, /Filler 1Type unknown · ID 91001Suggested: Film 1/)
	assert.doesNotMatch(again.text, /weren't checked|wasn't checked/)
	assert.match(
		again.text,
		/Your match: Dark \(2005\) · Movie · Not in this preview yet/,
	)
})

test("while suggestions load, the panel says so and matching by hand still works", () => {
	const run = matching.suggestLoading
	assert.match(
		run.text,
		/Review matches(Loading\.\.\. )?Looking for matchesDark/,
	)
	assert.match(
		run.text,
		/DarkType unknown · ID 80100172Looking for a matchFind a match for Dark/,
	)
	assert.match(
		matching.suggestLoadingChosen.text,
		/Your match: Dark \(2017\) · Show · Not in this preview yet/,
	)
	const asked = matching.suggestLoadingChosen.sent.filter((item) =>
		item.url.includes("/suggestions"),
	)
	assert.equal(asked.length, 1)
})

test("a new preview cancels the open suggestion request and asks for no more pages until its panel opens", () => {
	const run = matching.suggestCancelled
	assert.match(
		run.text,
		/Updated with your changes\. The counts include them\./,
	)
	assert.deepEqual(
		(run.aborted as string[]).map((url) => url.replace(/.*\//, "")),
		["suggestions?offset=0"],
	)
	assert.deepEqual(
		run.sent
			.filter((item) => item.url.includes("/suggestions"))
			.map((item) => item.url.replace(/.*\//, "")),
		["suggestions?offset=0"],
	)
	assert.match(run.text, /What should come in\?/)
	assert.doesNotMatch(run.text, /Looking for matches/)
})

test("while Update preview runs, Accept, bulk accept, Undo accept, and Change are off and a tap changes nothing", () => {
	const run = matching.suggestLocked
	assert.equal(run.accept, true)
	assert.equal(run.bulk, true)
	assert.equal(run.undo, true)
	assert.equal(run.change, true)
	assert.match(run.text, /Updating preview/)
	assert.match(
		run.text,
		/DarkType unknown · ID 80100172Suggested: Dark \(2017\)/,
	)
	assert.doesNotMatch(run.text, /Accepted 2 suggestions|Accepted Dark/)
	assert.match(run.text, /1 accepted suggestion isn't in this preview yet\./)
})

test("Undo accept puts the suggestion back as it was, with focus on its Accept", () => {
	const run = matching.acceptUndone
	assert.match(
		run.text,
		/Listed 3 timesSuggested: The Office \(2005\) · Show · Same Netflix ID as your file/,
	)
	assert.match(run.text, /The Office isn't accepted anymore\./)
	assert.deepEqual(run.focus, {
		tag: "button",
		text: "Accept the suggestion for The Office",
		type: "button",
	})
	assert.equal(run.confirmDisabled, false)
	assert.doesNotMatch(run.text, /Not in this preview yet/)
})

test("Show more brings in the next page's suggestions", () => {
	const offsets = (run: MatchRun) =>
		run.sent
			.filter((item) => item.url.includes("/suggestions"))
			.map((item) => Number(item.url.replace(/.*offset=/, "")))
	assert.deepEqual(
		offsets(matching.bulkCap),
		Array.from({ length: 11 }, (_, at) => at * 10),
	)
})

test("loaded suggestions aren't asked for again when the tab regains focus or reconnects, open or hidden", () => {
	const run = matching.warmCache
	const asked = run.sent.filter((item) => item.url.includes("/suggestions"))
	assert.deepEqual(
		asked.map((item) => Number(item.url.replace(/.*offset=/, ""))),
		[0, 10, 20, 30, 40],
	)
	assert.ok(run.sent.length >= Number(run.before))
})

test("entries without a suggestion are named above the list, and each name opens that entry's search in place", () => {
	assert.match(
		matching.suggested.text,
		/1 title has no suggestion\. Match it yourself:Match Dark yourself/,
	)
	assert.doesNotMatch(
		matching.suggested.text,
		/Match The Office yourself|Match GoT yourself/,
	)
	assert.doesNotMatch(matching.bulkAccepted.text, /no suggestion/)
	const run = matching.exceptionOpened
	assert.deepEqual(run.focus, { tag: "input", text: "", type: "search" })
	assert.match(run.text, /Which GoodWatch title is "Dark"\?/)
	assert.match(
		run.text,
		/The OfficeType unknown · ID 70136120 · Listed 3 timesSuggested: The Office.*DarkType unknown · ID 80100172Not matched/,
	)
})

const suggestionOffsets = (run: MatchRun) =>
	run.sent
		.filter((item) => item.url.includes("/suggestions"))
		.map((item) => Number(item.url.replace(/.*offset=/, "")))

test("Try again on unchecked pages that aren't next to each other asks for the later one only after the earlier one answers", () => {
	assert.deepEqual(suggestionOffsets(matching.gapsChecked), [0, 10, 20])
	assert.match(matching.gapsChecked.text, /2 titles weren't checked\./)
	const run = matching.gapsRetrying
	assert.deepEqual(suggestionOffsets(run), [0, 10, 20, 0])
	assert.match(run.text, /Looking for matches/)
})

test("coming back to the page doesn't ask again for pages that failed; only Try again does, one page at a time", () => {
	assert.deepEqual(suggestionOffsets(matching.cachedFailed), [0, 10, 20])
	const back = matching.cachedRemounted
	assert.deepEqual(suggestionOffsets(back), [0, 10, 20])
	assert.match(back.text, /20 titles weren't checked\./)
	assert.match(back.text, /Thirty 0Type unknown · ID 97000Not checked yet/)
	assert.match(back.text, /Thirty 10Type unknown · ID 970010Not matched/)
	assert.deepEqual(suggestionOffsets(matching.cachedRetrying), [0, 10, 20, 0])
})

test("matching groups only label originally unknown types as Type unknown", () => {
	assert.doesNotMatch(matching.knownType_movie.text, /Type unknown/)
	assert.doesNotMatch(matching.knownType_show.text, /Type unknown/)
	assert.match(matching.opened.text, /Type unknown/)
})

test("a season choice asks about the whole show, nothing preselected, without describing it as Seen", () => {
	const [screen] = watcharr.questions.seasonChoice.screens
	assert.equal(
		screen.heading,
		"Your Watcharr file lists seasons or episodes of 1 show. Add the whole show to Want to See?",
	)
	assert.deepEqual(
		screen.answers.map((answer) => answer.pressed),
		["false", "false"],
	)
	assert.doesNotMatch(
		watcharr.questions.seasonChoice.after,
		/already Seen|Seen in GoodWatch/,
	)
})

test("source-Seen evidence asks about rewatch without claiming GoodWatch has a Seen status", () => {
	const [screen] = watcharr.questions.sourceSeen.screens
	assert.match(screen.heading, /in your Watcharr file is already Seen/)
	assert.doesNotMatch(screen.heading, /in GoodWatch/)
})

test("confirming a whole-show choice does not also opt into rewatch", () => {
	const confirms = matching.showChoiceConfirmed.sent.filter((item) =>
		item.url.endsWith("/confirm"),
	)
	assert.equal(confirms.length, 1)
	assert.deepEqual(confirms[0].body, {
		kinds: ["want"],
		conflictChoice: "keep",
		watchDates: "preserve",
		wishlistShows: true,
	})
})

test("a Watcharr library's Choose step offers every imported kind, with no watch-date choice", () => {
	const page = text(rendered.watcharrLibrary)
	assert.match(page, /What should come in\?/)
	for (const label of [
		"Scores",
		"Watches",
		"Reviews",
		"Show statuses",
		"Want to See",
	])
		assert.ok(page.includes(label), label)
	assert.doesNotMatch(page, /watch date/i)
})

test("a full Watcharr import sends the independent rewatch answer under either conflict answer, always with the file's dates", () => {
	assert.equal(watcharr.runs.length, 4)
	for (const run of watcharr.runs) {
		assert.equal(run.sent.wishlistRewatch, run.rewatch)
		assert.equal(run.sent.conflictChoice, run.conflictChoice)
		assert.equal(run.sent.watchDates, "preserve")
	}
})

test("a Watcharr file with only Want to See and season or episode scores offers the scores on Choose", () => {
	const page = text(rendered.plannedWithScores)
	assert.match(page, /What should come in\?/)
	assert.match(page, /Season and episode scores 2/)
	assert.match(rendered.plannedWithScores, /<button[^>]*>Import<\/button>/)
})
