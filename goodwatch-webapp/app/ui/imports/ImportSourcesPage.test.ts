import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"

type Past = { name: string; date: string; line: string }
type Mark = { name: string; logo?: string; tile?: string }
type Step = { step: string; current: boolean; done: boolean; note: string }
type Answer = { text: string; pressed: string | null; suggested: boolean }
type Run = {
	opened: string | null
	history: Past[]
	text: string
	closed: string
	sent: { url: string; body: unknown }[]
	marks: Mark[]
	steps: Step[]
}
const step = (steps: Step[]) => steps.find((item) => item.current)?.step
const ticked = (steps: Step[]) =>
	steps.filter((item) => item.done).map((item) => item.step)

const runs = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/imports/imports-page-interaction.test-support.tsx",
		],
		{ encoding: "utf8" },
	)
		.split("__IMPORTS_PAGE__")
		.at(-1) ?? "",
) as Record<string, Run>

test("Bring shows the accounts to connect, then every file source most common first, each with its own logo", () => {
	assert.deepEqual(runs.list.marks, [
		{ name: "TMDB", logo: "tmdb.svg" },
		{ name: "Plex", logo: "plex.png" },
		{ name: "MDBList", logo: "mdblist.svg" },
		{ name: "IMDb", logo: "imdb.svg" },
		{ name: "Letterboxd", logo: "letterboxd.svg" },
		{ name: "Trakt", logo: "trakt.svg" },
		{ name: "TV Time", logo: "tvtime.svg" },
		{ name: "MyAnimeList / Kitsu", logo: "myanimelist.svg" },
		{ name: "Kodi", logo: "kodi.png" },
		{ name: "MovieLens", logo: "movielens.png" },
		{ name: "Watcharr / wishlist file", logo: "wishlist.png" },
		{ name: "Generic CSV", logo: "csv.svg" },
	])
	assert.equal(runs.list.opened, null)
	assert.doesNotMatch(runs.list.text, /Simkl|Jellyfin|coming later/i)
	// The file sources and the history wait in folds until the member opens them.
	assert.match(runs.list.closed, /Or connect an account/)
	assert.match(runs.list.closed, /Where do I get my file\?Past imports \(3\)/)
	assert.doesNotMatch(runs.list.closed, /Right away/)
})

test("the stepper starts on Bring, with nothing ticked", () => {
	assert.equal(step(runs.list.steps), "Bring")
	assert.deepEqual(ticked(runs.list.steps), [])
	assert.deepEqual(
		runs.list.steps.map((item) => item.step),
		["Bring", "Choose", "Import", "Done"],
	)
})

test("the history lists every import so far, newest first, undone ones included", () => {
	assert.deepEqual(runs.list.history, [
		{
			name: "Letterboxd",
			date: "· October 11, 2026",
			line: "1 added, 0 updated",
		},
		{ name: "Trakt", date: "· October 11, 2026", line: "Undone" },
		{ name: "IMDb", date: "· October 2, 2026", line: "1 rating added" },
	])
})

test("a history row opens its source on that import", () => {
	assert.equal(runs.historyOpened.opened, "Letterboxd")
	assert.match(runs.historyOpened.text, /Undo this import/)
	assert.match(runs.historyOpened.text, /Import another export/)
	assert.equal(step(runs.historyOpened.steps), "Done")
	assert.ok(
		runs.historyOpened.steps.find((item) => item.step === "Done")?.done,
		"nothing waits on the member, so Done is ticked",
	)
})

test("TV Time members learn which saved files the TV Time import reads, and that a Trakt move also works", () => {
	assert.match(
		runs.tvTime.text,
		/Coming from TV Time\? TV Time closed on July 15, 2026\. Upload the export you saved: TV Time's own gdpr-data\.zip, or a file from the TV Time Liberator or TV Time Out extension\. If you already moved your history to Trakt, import your Trakt export instead\./,
	)
	assert.doesNotMatch(runs.tvTime.text, /import it on Trakt/)
	assert.equal(runs.tvTimeOpened.opened, "TV Time")
	assert.match(runs.tvTimeOpened.text, /Upload your TV Time export/)
	assert.match(runs.tvTimeOpened.text, /gdpr-data\.zip/)
	assert.match(runs.tvTimeOpened.text, /password/)
	assert.equal(runs.tvTimeTrakt.opened, "Trakt")
	assert.match(runs.tvTimeTrakt.text, /Upload your Trakt export/)
})

test("TV Time's official export dropped in the one box goes to the TV Time preview", () => {
	const run = runs.oneBoxTvTime
	assert.deepEqual(previews(run), [
		{
			url: "/api/imports/preview",
			body: { source: "tvtime", file: "file:gdpr-data.zip" },
		},
	])
	assert.deepEqual(openRows(run), ["TV Time"])
})

test("streaming services are named as not importable yet, with where to import from instead", () => {
	assert.match(
		runs.list.text,
		/Netflix, Prime Video, Disney\+ and other streaming services don't give you a file of your list yet\. If you also keep a watchlist on Trakt, TMDB, Plex, or MDBList, or your anime on MyAnimeList or Kitsu, import it from there\./,
	)
})

const previews = (run: Run) =>
	run.sent.filter((call) => call.url.endsWith("/preview"))

test("a file in the one box is recognized, opens its source, and goes to that source's preview", () => {
	const run = runs.oneBoxTrakt
	assert.deepEqual(previews(run), [
		{
			url: "/api/imports/preview",
			body: { source: "trakt", file: "file:trakt-export-alp82.zip" },
		},
	])
	assert.deepEqual(openRows(run), ["Trakt"])
	assert.match(run.text, /What should come in\?/)
	assert.equal(step(run.steps), "Choose")
	assert.deepEqual(ticked(run.steps), ["Bring"])
	assert.equal(run.steps[0].note, "Trakt")
})

const openRows = (run: Run) => (run.opened ? [run.opened] : [])

test("an IMDb ratings export in the one box goes to the IMDb import", () => {
	const run = runs.oneBoxImdb
	assert.deepEqual(
		previews(run).map((call) => call.url),
		["/api/imdb-import/preview"],
	)
	assert.deepEqual(previews(run)[0].body, {
		fileName: "ratings.csv",
		csv: "Const,Your Rating,Date Rated,Title,URL,Title Type,Year\ntt0133093,9,2024-01-01,The Matrix,https://www.imdb.com/title/tt0133093/,Movie,1999\n",
	})
	assert.deepEqual(openRows(run), ["IMDb"])
})

test("a file the one box doesn't recognize is never sent, and the member learns why", () => {
	const run = runs.oneBoxUnknown
	assert.deepEqual(previews(run), [])
	assert.deepEqual(openRows(run), [])
	assert.match(
		run.text,
		/GoodWatch doesn't know this file ?NetflixViewingHistory\.csv ?Its columns don't match an export GoodWatch reads\./,
	)
	assert.match(run.text, /Where do I get my file\?/)
})

test("a file both TV Time and the generic import read goes to the source the member chose", () => {
	assert.deepEqual(previews(runs.chosenGeneric), [
		{
			url: "/api/imports/preview",
			body: { source: "csv", file: "file:mine.csv" },
		},
	])
	assert.doesNotMatch(runs.chosenGeneric.text, /looks like/)
})

test("a source's own box holds back a file from another source and offers to import it as that source", () => {
	assert.deepEqual(previews(runs.caught), [])
	assert.match(
		runs.caught.text,
		/trakt-export-alp82\.zip looks like a Trakt export, not a Letterboxd file\.Import it as TraktChoose another file/,
	)
	assert.deepEqual(previews(runs.importedAs), [
		{
			url: "/api/imports/preview",
			body: { source: "trakt", file: "file:trakt-export-alp82.zip" },
		},
	])
	assert.deepEqual(openRows(runs.importedAs), ["Trakt"])
	assert.match(runs.importedAs.text, /What should come in\?/)
})

test("a MovieLens file in the one box waits in the MovieLens upload for its partner file", () => {
	const run = runs.oneBoxMovieLens
	assert.deepEqual(previews(run), [])
	assert.deepEqual(openRows(run), ["MovieLens"])
	assert.match(
		run.text,
		/Recognized MovieLens ratings: movielens-ratings\.csv\. Add your wishlist file if you have one, then continue\./,
	)
})

test("focus follows a file the one box routes, so the opened source is announced", () => {
	assert.equal(runs.oneBoxTraktFocus as unknown as string, "Trakt")
})

test("a second MovieLens file fills the empty slot instead of replacing the first", () => {
	assert.deepEqual(previews(runs.movielensBoth), [])
	assert.match(runs.movielensBoth.text, /Chosen: movielens-ratings\.csv/)
	assert.match(runs.movielensBoth.text, /Chosen: movielens-wishlist\.csv/)
	assert.deepEqual(previews(runs.movielensBothSent), [
		{
			url: "/api/imports/preview",
			body: {
				source: "movielens",
				file: "file:movielens-ratings.csv",
				wishlist: "file:movielens-wishlist.csv",
			},
		},
	])
})

test("a MovieLens file in the wrong box is offered to the other box, and the wishlist box catches other sources too", () => {
	assert.match(
		runs.movielensSwap.text,
		/movielens-wishlist\.csv is your MovieLens wishlist, not your ratings\.Use it as the wishlist/,
	)
	assert.doesNotMatch(runs.movielensSwap.text, /Chosen: movielens-wishlist/)
	assert.match(
		runs.movielensSwapped.text,
		/MovieLens wishlist CSV \(optional\)Chosen: movielens-wishlist\.csv/,
	)
	assert.match(
		runs.movielensWishlistCaught.text,
		/trakt-export-alp82\.zip looks like a Trakt export, not a MovieLens file\.Import it as Trakt/,
	)
	assert.deepEqual(previews(runs.movielensWishlistCaught), [])
})

test("a Kitsu library caught in another source's box is offered as Kitsu", () => {
	assert.match(
		runs.kitsuCaught.text,
		/kitsu-alp82-anime\.xml looks like a Kitsu anime library, not a Trakt file\.Import it as Kitsu/,
	)
})

test("the notices cover the logos that ask for one: IMDb, Kodi and TMDB", () => {
	assert.match(
		runs.list.text,
		/trademarks of IMDb\.com, Inc\. or its affiliates\./,
	)
	assert.match(
		runs.list.text,
		/Kodi® is a registered trademark of the Kodi Foundation\./,
	)
	assert.match(
		runs.list.text,
		/This product uses the TMDB API but is not endorsed or certified by TMDB\./,
	)
})

test("the drop zone says the file is read on the device before anything changes", () => {
	assert.match(
		runs.list.text,
		/GoodWatch works out where it's from and reads it on your device first\. Nothing changes until you check it\./,
	)
})

test("the server's HTML says Imported without a date, which only the member's browser knows the time zone of", () => {
	const markup = runs.serverMarkup as unknown as string
	assert.match(markup, /data-import-date="[^"]*"[^>]*>· Imported<\/span>/)
	assert.doesNotMatch(markup, /October/)
})

test("a return from Plex opens Plex's connection, and no other connect source takes its state", () => {
	assert.deepEqual(openRows(runs.plexReturn), ["Plex"])
	assert.match(runs.plexReturn.text, /Return from Plex/)
	assert.deepEqual(openRows(runs.plexReturnThenTmdb), ["TMDB"])
	assert.match(runs.plexReturnThenTmdb.text, /Connect TMDB/)
	assert.doesNotMatch(runs.plexReturnThenTmdb.text, /Return from TMDB/)
})

test("MDBList opens on its key form, never on another source's connection state, and its imports reopen", () => {
	assert.deepEqual(openRows(runs.mdblistOpen), ["MDBList"])
	assert.match(runs.mdblistOpen.text, /Connect MDBList/)
	assert.match(runs.mdblistOpen.text, /MDBList API key/)
	assert.doesNotMatch(runs.mdblistOpen.text, /Return from/)
	assert.deepEqual(openRows(runs.mdblistDone), ["MDBList"])
	assert.match(runs.mdblistDone.text, /Connect MDBList again/)
})

test("an MDBList Watchlist season is added as the whole show only when the member answers yes", () => {
	const run = runs.mdblistShows as unknown as {
		text: string
		confirms: unknown[]
	}
	assert.match(
		run.text,
		/Question 1 of 1Your MDBList account lists seasons or episodes of 1 show\. Add the whole show to Want to See\?/,
	)
	assert.deepEqual(run.confirms, [
		{
			kinds: ["watch", "want"],
			conflictChoice: "keep",
			watchDates: "preserve",
			wishlistRewatch: false,
			wishlistShows: true,
		},
	])
})

test("a Watcharr export in the one box goes to the wishlist import's preview", () => {
	const run = runs.oneBoxWatcharr
	assert.deepEqual(previews(run), [
		{
			url: "/api/imports/preview",
			body: { source: "wishlist", file: "file:watcharr-export.json" },
		},
	])
	assert.deepEqual(openRows(run), ["Watcharr / wishlist file"])
})

test("a wishlist preview adds seen titles only when the member answers yes to Want to rewatch", () => {
	const asked = runs.wishlistRewatchAsked as unknown as {
		counter: string
		answers: Answer[]
		highlighted: string[]
	}
	assert.equal(asked.counter, "Question 1 of 1")
	assert.deepEqual(asked.answers, [
		{ text: "Yes, add to Want to rewatch", pressed: "false", suggested: false },
		{ text: "No, leave it as Seen", pressed: "false", suggested: true },
	])
	assert.deepEqual(asked.highlighted, ["Seen", "Want to rewatch"])
	const confirms = runs.wishlistRewatch.sent.filter((call) =>
		call.url.endsWith("/confirm"),
	)
	assert.deepEqual(
		confirms.map((call) => call.body),
		[
			{
				kinds: ["want"],
				conflictChoice: "source",
				watchDates: "preserve",
				wishlistRewatch: true,
			},
		],
	)
})

test("Undo of a wishlist import says what it takes back and that Not interested isn't put back", () => {
	assert.match(
		runs.wishlistUndo.text,
		/Undo this import\? GoodWatch takes the titles this import added off Want to See\. Titles you changed since then stay as you left them\. Titles the import took off Not interested aren't marked Not interested again\. The result lists them so you can put them back\./,
	)
	assert.match(runs.wishlistUndo.text, /Import another file/)
})

test("the TV Time logo is credited to its creator with its source, license, and the one change made", () => {
	assert.match(
		runs.list.text,
		/TV Time logo: "Logo TV Time" by Vegetapple \(opens in a new tab\), from Wikimedia Commons \(opens in a new tab\), licensed under CC BY-SA 4\.0 \(opens in a new tab\)\. Its styles were moved into its shapes; it looks the same\./,
	)
	const markup = runs.serverMarkup as unknown as string
	for (const href of [
		"https://commons.wikimedia.org/wiki/User:Vegetapple",
		"https://commons.wikimedia.org/wiki/File:Logo_TV_Time.svg",
		"https://creativecommons.org/licenses/by-sa/4.0/",
	])
		assert.ok(markup.includes(`href="${href}"`), href)
})

type Questions = {
	choose: {
		heading: string
		steps: Step[]
		highlighted: string[]
		html: string
	}
	first: {
		counter: string
		heading: string
		answers: Answer[]
		steps: Step[]
		posters: boolean
		examples: boolean
	}
	locking: { answers: Answer[]; locked: boolean }
	backed: { heading: string; counter: string | null }
	second: {
		counter: string
		heading: string
		answers: Answer[]
		highlighted: string[]
	}
	third: { counter: string; answers: Answer[] }
	beforeLock: number
	confirms: unknown[]
	after: string
	afterSteps: Step[]
}
const questions = runs.questions as unknown as Questions

test("questions come one per screen in order, with one counter, after Choose and before anything is imported", () => {
	assert.equal(questions.choose.heading, "What should come in?")
	assert.equal(step(questions.choose.steps), "Choose")
	assert.equal(questions.first.counter, "Question 1 of 3")
	assert.equal(
		questions.first.heading,
		"1 score in your MDBList account differs from yours in GoodWatch. Keep yours?",
	)
	assert.equal(step(questions.first.steps), "Import")
	assert.equal(
		questions.first.steps.find((item) => item.step === "Import")?.note,
		"3 to answer",
	)
	assert.ok(questions.first.posters, "an example shows its poster")
	assert.ok(questions.first.examples, "an example shows both scores")
	assert.equal(questions.second.counter, "Question 2 of 3")
	assert.equal(questions.third.counter, "Question 3 of 3")
	assert.deepEqual(questions.confirms, [
		{
			kinds: ["rating", "want"],
			conflictChoice: "keep",
			watchDates: "preserve",
			wishlistRewatch: false,
			wishlistShows: true,
		},
	])
	assert.equal(step(questions.afterSteps), "Import")
	assert.match(questions.after, /Your MDBList titles are moving in/)
	assert.match(questions.after, /Ready in a moment\./)
	assert.doesNotMatch(questions.after, /Done\./)
})

test("no answer is picked for the member; the suggested one only says so", () => {
	for (const screen of [questions.first, questions.second, questions.third])
		assert.deepEqual(
			screen.answers.map((answer) => answer.pressed),
			["false", "false"],
		)
	assert.deepEqual(
		questions.first.answers.map((answer) => [answer.text, answer.suggested]),
		[
			["Yes, keep my scores", true],
			["No, use MDBList's", false],
		],
	)
	assert.deepEqual(
		questions.third.answers.map((answer) => [answer.text, answer.suggested]),
		[
			["Yes, add the whole show", false],
			["No, leave it out", true],
		],
	)
})

test("a picked answer locks in before the next screen, and Back cancels the move", () => {
	assert.deepEqual(
		questions.locking.answers.map((answer) => answer.pressed),
		["true", "false"],
	)
	assert.ok(questions.locking.locked)
	assert.deepEqual(questions.backed, {
		heading: "What should come in?",
		counter: null,
	})
	assert.equal(
		questions.beforeLock,
		0,
		"the import starts only after the last answer locks in",
	)
})

test("state names stand out only inside a question", () => {
	assert.deepEqual(questions.second.highlighted, ["Seen", "Want to rewatch"])
	assert.deepEqual(questions.choose.highlighted, [])
	assert.doesNotMatch(questions.choose.html, /text-amber-200/)
})

test("a file with nothing new is a success: all caught up, and the stepper ticks Done as up to date", () => {
	const run = runs.caughtUp as unknown as { text: string; steps: Step[] }
	assert.match(run.text, /You're all caught up/)
	assert.match(
		run.text,
		/Everything in this Letterboxd file is already in GoodWatch\./,
	)
	assert.doesNotMatch(run.text, /couldn't come in/)
	assert.match(run.text, /See your scores/)
	assert.match(run.text, /Pick another file/)
	assert.equal(step(run.steps), "Done")
	const done = run.steps.find((item) => item.step === "Done")
	assert.ok(done?.done)
	assert.equal(done?.note, "Up to date")
	assert.doesNotMatch(run.text, /What should come in/)
})

test("Import waits while the file is checked, then a differing score is asked about even beside many Seen season wishes", () => {
	const run = runs.manyWishes as unknown as {
		checking: { busy: boolean; disabled: boolean; label: string | null }
		ready: boolean
		first: { counter: string; heading: string }
		confirms: unknown[]
	}
	assert.deepEqual(run.checking, {
		busy: true,
		disabled: true,
		label: "Checking your account…",
	})
	assert.equal(run.ready, false, "the button says Import once the check is in")
	assert.equal(run.first.counter, "Question 1 of 3")
	assert.equal(
		run.first.heading,
		"1 score in your MDBList account differs from yours in GoodWatch. Keep yours?",
	)
	assert.deepEqual(run.confirms, [
		{
			kinds: ["rating", "want"],
			conflictChoice: "source",
			watchDates: "preserve",
			wishlistRewatch: false,
			wishlistShows: false,
		},
	])
})

test("when the differing rows can't be counted, the score question is still asked, without a number", () => {
	const run = runs.conflictCountFailed as unknown as {
		counter: string
		heading: string
	}
	assert.equal(run.counter, "Question 1 of 3")
	assert.equal(
		run.heading,
		"If anything in your MDBList account differs from what you have in GoodWatch, keep yours?",
	)
})

test("a caught-up file still says which entries couldn't come in, with the list to download", () => {
	const run = runs.caughtUpSkipped as unknown as { text: string; csv: string }
	assert.match(run.text, /You're all caught up/)
	assert.match(
		run.text,
		/3 entries from your Letterboxd file couldn't come in\./,
	)
	assert.match(run.text, /Not matched to a GoodWatch title ?2/)
	assert.match(run.text, /Download the list with reasons \(CSV file\)/)
	assert.equal(
		run.csv,
		"/api/imports/00000000-0000-4000-8000-0000000000aa/skipped",
	)
	const imdb = runs.imdbCaughtUpSkipped as unknown as {
		text: string
		csv: string
	}
	assert.match(imdb.text, /You're all caught up/)
	assert.match(
		imdb.text,
		/4 titles from this IMDb file are already in GoodWatch\./,
	)
	assert.match(imdb.text, /2 entries from your IMDb file couldn't come in\./)
	assert.equal(
		imdb.csv,
		"/api/imdb-import/00000000-0000-4000-8000-0000000000aa/skipped",
	)
})

test("an import that stopped partway turns the strip red, says why first, and Continue picks it up with its options", () => {
	const run = runs.failed as unknown as {
		stopped: { text: string; strip: string; steps: Step[] }
		confirms: unknown[]
		after: string
		strip: string
	}
	assert.equal(run.stopped.strip, "stopped")
	assert.match(run.stopped.text, /Stopped at 62%/)
	assert.match(
		run.stopped.text,
		/Your import stopped ?GoodWatch restarted for an update while your import was running\. ?What came in so far is saved\./,
	)
	assert.equal(
		run.stopped.steps.find((item) => item.step === "Import")?.note,
		"Stopped",
	)
	assert.deepEqual(run.confirms, [
		{ kinds: ["rating"], conflictChoice: "keep", watchDates: "preserve" },
	])
	assert.equal(run.strip, "running")
	assert.match(run.after, /Your Letterboxd titles are moving in/)
})
