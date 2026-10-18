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
