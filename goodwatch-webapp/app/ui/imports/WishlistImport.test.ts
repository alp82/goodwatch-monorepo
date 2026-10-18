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

test("a wishlist preview names the action and hides the general import's choices", () => {
	const page = text(rendered.mixed)
	assert.match(page, /Check before you import/)
	assert.doesNotMatch(page, /What should GoodWatch import\?/)
	assert.doesNotMatch(page, /When GoodWatch already has different data/)
	assert.doesNotMatch(page, /watch dates/)
	assert.match(rendered.mixed, /<button[^>]*>Add to Want to See<\/button>/)
	assert.doesNotMatch(page, /Start import/)
})

test("a wishlist preview says it only adds, and that Want to See takes titles off Not interested for good", () => {
	const page = text(rendered.mixed)
	assert.match(
		page,
		/Importing only adds titles to Want to See\. It never removes anything from your Wishlist\./,
	)
	assert.match(
		page,
		/Adding a title to Want to See takes it off Not interested\. Undo takes the title off Want to See but doesn't mark it Not interested again\./,
	)
	assert.match(text(rendered.nothing), /takes it off Not interested/)
})

test("titles already seen stay Seen unless the member chooses Want to rewatch", () => {
	const page = text(rendered.mixed)
	assert.match(page, /2 titles you've already seen/)
	assert.match(
		rendered.mixed,
		/<input type="radio"[^>]*checked=""[^>]*>.{0,200}Leave them as Seen/,
	)
	assert.match(page, /Add them as Want to rewatch/)
	assert.doesNotMatch(
		rendered.mixed,
		/<input type="radio"[^>]*checked=""[^>]*>.{0,200}Add them as Want to rewatch/,
	)
	assert.match(text(rendered.oneSeen), /1 title you've already seen/)
	assert.match(text(rendered.oneSeen), /Leave it as Seen/)
	assert.match(text(rendered.oneSeen), /Add it as Want to rewatch/)
	assert.doesNotMatch(text(rendered.nothing), /already seen/)
})

test("a wishlist preview counts rows in the Wishlist's words, and keeps the file's coverage note", () => {
	const page = text(rendered.mixed)
	for (const label of [
		"New to your Wishlist 3",
		"Nothing to change 1",
		"Seen in GoodWatch 2",
		"Not matched to a GoodWatch title 1",
		"Not added to Want to See 4",
		"Entries in your file 11",
	])
		assert.match(page, new RegExp(label))
	assert.match(page, /This file may hold only part of your list\./)
})

test("with nothing to add, the button is off and says why; a seen title can still be added as a rewatch", () => {
	assert.match(
		rendered.nothing,
		/<button type="button"[^>]*disabled=""[^>]*>Add to Want to See/,
	)
	assert.match(
		text(rendered.nothing),
		/Nothing to add\. GoodWatch already has the titles in this file, or can't add them\./,
	)
	assert.match(
		text(rendered.oneSeen),
		/Nothing new to add\. To add the title you've already seen, choose Add it as Want to rewatch\./,
	)
	assert.match(text(rendered.confirming), /Adding to Want to See/)
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

test("the wishlist receipt offers another file, not another export, and Undo", () => {
	assert.match(text(rendered.receipt), /Import another file/)
	assert.doesNotMatch(text(rendered.receipt), /another export/)
	assert.match(rendered.receipt, /Undo import/)
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
	assert.match(page, /only movies and shows marked Planned are added/)
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

test("the match block shows only when the server counts entries to match, and loads nothing until opened", () => {
	assert.doesNotMatch(text(rendered.mixed), /Titles GoodWatch couldn't match/)
	const closed = matching.closed
	assert.match(closed.text, /Titles GoodWatch couldn't match/)
	assert.match(closed.text, /these 3 entries are movies or shows/)
	assert.ok(!urls(closed).some((url) => url.includes("/matches")))
	const opened = matching.opened
	assert.ok(urls(opened).some((url) => url.endsWith("/matches?offset=0")))
	assert.deepEqual(opened.focus, {
		tag: "h4",
		text: "Match titles",
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

test("a choice waits in this preview until Update preview, and blocks Add to Want to See", () => {
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
	assert.equal(used.confirmReason, "wishlist-import-unapplied")
	assert.match(used.text, /Your matches aren't in this preview yet\./)
	assert.equal(resolves(used).length, 0)
})

test("Clear removes a match the preview holds, and hiding the panel keeps every change", () => {
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

test("a new preview replaces the old one on screen, says so, and resets the Seen choice", () => {
	const updated = matching.updated
	assert.deepEqual(updated.focus, {
		tag: "h3",
		text: "Check before you import",
		type: null,
	})
	assert.match(
		updated.text,
		/Updated with your changes\. The counts include them\. Your choice for titles you've already seen is back to Leave them as Seen\./,
	)
	assert.equal(updated.leaveChecked, true)
	assert.equal(updated.confirmDisabled, false)
	assert.match(updated.text, /New to your Wishlist2Seen in GoodWatch2/)
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

test("with every entry matched, the block stays and a matched row shows the file's evidence and Change", () => {
	assert.match(matching.allResolved.text, /Titles GoodWatch couldn't match/)
	assert.match(
		matching.matchedRow.text,
		/Game of Thrones · 2011 · Show · Matched by youChange the match for GoTFrom your file: GoT · Type unknown · ID 70305903/,
	)
	const changed = matching.changeFromRow
	assert.deepEqual(changed.focus, { tag: "input", text: "", type: "search" })
	assert.match(
		changed.text,
		/Your match: Game of Thrones \(2011\) · ShowFrom your file/,
	)
})

test("Change after Hide matching opens the row asked for, on another row and on the same row again", () => {
	const search = { tag: "input", text: "", type: "search" }
	const other = matching.changeAfterHide
	assert.deepEqual(other.focus, search)
	assert.match(other.text, /Your match: Narcos \(2015\) · ShowFrom your file/)
	assert.doesNotMatch(
		other.text,
		/Your match: Game of Thrones \(2011\) · ShowFrom your file/,
	)
	const same = matching.changeSameAfterHide
	assert.deepEqual(same.focus, search)
	assert.match(same.text, /Your match: Narcos \(2015\) · ShowFrom your file/)
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

test("Change on a row that repeats an entry asks the server for its entry and opens it, keeping other changes", () => {
	const leaf = matching.focusLeaf
	assert.ok(urls(leaf).some((url) => url.endsWith("/matches?entry=21")))
	assert.ok(!urls(leaf).some((url) => url.endsWith("offset=50")))
	assert.deepEqual(leaf.focus, { tag: "input", text: "", type: "search" })
	assert.match(
		leaf.text,
		/Your match: Narcos \(2015\) · ShowFrom your file.*Listed 2 times in your file/,
	)
	assert.match(
		leaf.text,
		/Your match: Dark \(2017\) · Show · Not in this preview yet/,
	)
	assert.match(leaf.text, /1 change isn't in this preview yet/)
})

test("Change on an entry whose page isn't loaded shows a failed lookup with Try again, then opens it once", () => {
	const failed = matching.focusFailed
	assert.match(
		failed.text,
		/We couldn't reach GoodWatch\. Check your connection and try again\.Try again/,
	)
	assert.deepEqual(failed.focus, {
		tag: "h4",
		text: "Match titles",
		type: null,
	})
	assert.match(failed.text, /1 change isn't in this preview yet/)
	const later = matching.focusLater
	assert.equal(
		urls(later).filter((url) => url.endsWith("/matches?entry=300")).length,
		2,
	)
	assert.ok(!urls(later).some((url) => url.endsWith("offset=50")))
	assert.deepEqual(later.focus, { tag: "input", text: "", type: "search" })
	assert.match(
		later.text,
		/Your match: Mindhunter \(2017\) · ShowFrom your file/,
	)
	assert.match(later.text, /Showing 51 of 51/)
	assert.match(later.text, /1 change isn't in this preview yet/)
	const merged = matching.focusMerged
	assert.ok(urls(merged).some((url) => url.endsWith("offset=50")))
	assert.equal(merged.text.match(/Your match: Mindhunter/g)?.length, 1)
	assert.match(merged.text, /Showing 51 of 51/)
})

test("while Add to Want to See runs, every match control is off and a click changes nothing", () => {
	const locked = matching.locked
	assert.match(locked.text, /Adding to Want to See/)
	assert.equal(locked.use, true)
	assert.equal(locked.search, true)
	assert.equal(locked.clear, true)
	assert.deepEqual(locked.change, [true, true])
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
