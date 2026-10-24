import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"

const rendered = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/imports/import-result-render.test-support.tsx",
		],
		{ encoding: "utf8" },
	)
		.split("__IMPORT_RESULT_RENDER__")
		.at(-1) ?? "",
) as { imported: string; undone: string }
/** The words a reader sees, in order. */
const text = (html: string) =>
	html
		.replace(/<[^>]+>/g, " ")
		.replace(/&#x27;/g, "'")
		.replace(/&amp;/g, "&")
		.replace(/\s+/g, " ")
		.replace(/ ([.,)])/g, "$1")
		.trim()
const headings = (html: string) =>
	[...html.matchAll(/<h4[^>]*>(.*?)<\/h4>/g)].map((match) => text(match[1]))

test("title by title, an import's changes are one list per kind of change", () => {
	const page = text(rendered.imported)
	assert.deepEqual(headings(rendered.imported), [
		"Ratings added 1",
		"Ratings replaced 1",
		"Watches added 5",
		"Added to Want to See 1",
		"Taken off your lists 2",
		"Kept as it was 1",
		"Not imported 30",
	])
	assert.match(page, /Dune: Part Two · 2024 Rated 9/)
	assert.match(page, /Arrival · 2016 Your 7 is now 9/)
	assert.match(page, /Dune: Part Two · 2024 Mar 9, 2024/)
	assert.match(page, /Past Lives · 2023 Date unknown/)
	assert.match(
		page,
		/The Bear · 2022 · Show 3 episodes \(S1 E1–E3\) · Jun 23 – 24, 2023 · now Watching/,
	)
	assert.match(
		page,
		/Off Want to See, because you watched it\. Undo won't put it back\./,
	)
	assert.match(
		page,
		/Off Not interested, because you added it to Want to See\. Undo won't put it back\./,
	)
	assert.match(page, /Parasite · 2019 Rating: Already the same in GoodWatch\./)
	assert.match(
		page,
		/Kurzfilmnacht Vol\. 3 \(2021\) · Rating · row 12 This title could not be matched/,
	)
	assert.match(
		page,
		/more skipped/,
		"a section with more rows than it shows offers the rest",
	)
	assert.doesNotMatch(page, /more ratings_added/)
	assert.match(rendered.imported, /href="\/movie\/693134-dune-part-two"/)
	assert.match(rendered.imported, /href="\/show\/136315-the-bear"/)
	assert.match(
		rendered.imported,
		/src="https:\/\/image\.tmdb\.org\/t\/p\/w92\/dune\.jpg"/,
	)
})

test("title by title after Undo: what could not be put back comes first with its put-back buttons, then what Undo did", () => {
	const page = text(rendered.undone)
	assert.deepEqual(headings(rendered.undone), [
		"Not put back 3",
		"Ratings removed 1",
		"Ratings put back 1",
		"Watches removed 3",
		"Removed from Want to See 1",
		"Left as you changed it 1",
	])
	assert.match(
		page,
		/Dune: Part Two · 2024 Was on Want to See before the import put back Dune: Part Two on want_to_see/,
	)
	assert.match(
		page,
		/Anora · 2024 Was on Not interested before the import put back Anora on not_interested/,
	)
	assert.match(
		page,
		/Past Lives · 2023 Undo couldn't put your earlier rating back, so the import's stays\./,
	)
	assert.doesNotMatch(page, /put back Past Lives/)
	assert.match(page, /Dune: Part Two · 2024 Your 9 is gone/)
	assert.match(page, /Arrival · 2016 Back to 7 \(the import set 9\)/)
	assert.match(
		page,
		/3 episodes \(S1 E1–E3\) · Jun 23 – 24, 2023 · back to Not started/,
	)
	assert.match(
		page,
		/Shōgun · 2024 · Show Your rating stays: you changed it after the import\./,
	)
	assert.ok(page.indexOf("Not put back") < page.indexOf("Ratings removed"))
})

const run = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/imports/import-result-interaction.test-support.tsx",
		],
		{ encoding: "utf8" },
	)
		.split("__IMPORT_RESULT_INTERACTION__")
		.at(-1) ?? "",
) as {
	sent: { url: string; body: unknown }[]
	undone: string
	buttons: string[]
	afterPutBack: string
	afterMore: string
	plexPrompts: string[]
	done: {
		heading: string
		tiles: {
			tile: string
			text: string
			added: string | null
			removed: string | null
		}[]
		text: string
		answers: { text: string; pressed: string | null; suggested: boolean }[]
		undo: boolean
		lockedPressed: string[]
		afterPutAll: string
		putAllSent: { url: string; body: unknown }[]
		noUndo: boolean
	}
}

test("Done: tiles show the new total per kind with what came in and what came off, then what stayed and what couldn't come in", () => {
	const { done } = run
	assert.equal(done.heading, "5 titles are in GoodWatch")
	assert.deepEqual(done.tiles, [
		{
			tile: "scores",
			text: "3Scores+1 added",
			added: "+1 added",
			removed: null,
		},
		{
			tile: "want",
			text: "1Want to See+1 added−1 taken off",
			added: "+1 added",
			removed: "−1 taken off",
		},
		{
			tile: "notInterested",
			text: "1Not interested−1 taken off",
			added: null,
			removed: "−1 taken off",
		},
	])
	assert.match(done.text, /1 score now matches Trakt's\./)
	assert.match(done.text, /1 title you already had stayed the same\./)
	assert.match(done.text, /2 from your file couldn't come in/)
	assert.match(done.text, /See your scores/)
	assert.match(done.text, /See your taste/)
	assert.match(done.text, /Changed your mind\?/)
	assert.ok(done.undo, "a done import the server can undo offers Undo")
	assert.ok(done.noUndo, "without canUndo there is no Undo")
})

test("Done asks once about titles the import took off a list: nothing preselected, No suggested, and Yes puts them back", () => {
	const { done } = run
	assert.match(
		done.text,
		/2 titles came off Want to See and Not interested because of this import\. Put them back\?/,
	)
	assert.deepEqual(done.answers, [
		{ text: "Yes, put them back", pressed: "false", suggested: false },
		{ text: "No, leave them offSuggested", pressed: "false", suggested: true },
	])
	assert.match(
		done.heading,
		/^5 titles are in GoodWatch$/,
		"no Done. while it waits",
	)
	assert.deepEqual(done.lockedPressed, ["true", "false"])
	assert.deepEqual(done.putAllSent, [
		{
			url: "/api/update-wishlist",
			body: { tmdb_id: 5, media_type: "movie", action: "add" },
		},
		{
			url: "/api/update-not-interested",
			body: { tmdb_id: 6, media_type: "movie", action: "add" },
		},
	])
	assert.match(done.afterPutAll, /Back on Want to See and Not interested/)
	assert.match(done.afterPutAll, /Done\. 5 titles are in GoodWatch/)
})

test("Undone: the page says so, and put-back buttons write to the list and say so; a title back on its list has none", () => {
	assert.match(
		run.undone,
		/Undone ?GoodWatch is back to how it was before this Trakt import\./,
	)
	assert.match(run.undone, /2 list choices could not be put back/)
	assert.deepEqual(
		run.buttons.filter((label) => /back|Again|again/.test(label)),
		["Add back to Want to See"],
	)
	assert.deepEqual(
		run.sent.filter((call) => call.url === "/api/update-wishlist").at(-1)?.body,
		{ tmdb_id: 693134, media_type: "movie", action: "add" },
	)
	assert.match(run.afterPutBack, /Back on Want to See/)
})

test("every change, title by title: Show all loads the rest of a long section", () => {
	assert.ok(
		run.sent.some(
			(call) =>
				call.url ===
				"/api/imports/kept-id/items?by=title&section=kept&offset=25&limit=100",
		),
	)
	assert.match(run.afterMore, /Interstellar/)
	assert.doesNotMatch(run.afterMore, /Show all/)
})

test("Undo asks first, in the words of the source", () => {
	assert.match(run.plexPrompts[0], /Choices cleared by watches are restored/)
	assert.match(run.plexPrompts[0], /Undo of Want to See does not restore/)
	assert.doesNotMatch(
		run.plexPrompts[1],
		/Choices cleared by watches are restored/,
	)
})
