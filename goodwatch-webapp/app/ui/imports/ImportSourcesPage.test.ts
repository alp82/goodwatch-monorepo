import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"

type Past = { name: string; date: string; line: string }
type Mark = { name: string; logo?: string; tile?: string }
type Run = {
	opened: string | null
	history: Past[]
	text: string
	sent: { url: string; body: unknown }[]
	marks: Mark[]
}

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

test("the logo row shows every live source, most common first, each with its own logo", () => {
	assert.deepEqual(runs.list.marks, [
		{ name: "IMDb", logo: "imdb.svg" },
		{ name: "Letterboxd", logo: "letterboxd.svg" },
		{ name: "Trakt", logo: "trakt.svg" },
		{ name: "TMDB", logo: "tmdb.svg" },
		{ name: "Plex", logo: "plex.png" },
		{ name: "TV Time", logo: "tvtime.svg" },
		{ name: "MyAnimeList / Kitsu", logo: "myanimelist.svg" },
		{ name: "Kodi", logo: "kodi.png" },
		{ name: "MovieLens", logo: "movielens.png" },
		{ name: "Watcharr / wishlist file", logo: "wishlist.png" },
		{ name: "Generic CSV", logo: "csv.svg" },
	])
	assert.equal(runs.list.opened, null)
	assert.doesNotMatch(runs.list.text, /Simkl|Jellyfin|coming later/i)
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
	assert.match(runs.historyOpened.text, /Import another file|Undo import/)
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
		/Netflix, Prime Video, Disney\+ and other streaming services don't give you a file of your list yet\. If you also keep a watchlist on Trakt, TMDB, or Plex, or your anime on MyAnimeList or Kitsu, import it from there\./,
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
	assert.match(run.text, /Check before you import/)
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
		/GoodWatch doesn't recognize NetflixViewingHistory\.csv\. Its columns don't match an export GoodWatch reads\./,
	)
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
	assert.match(runs.importedAs.text, /Check before you import/)
})

test("a MovieLens file in the one box waits in the MovieLens upload for its partner file", () => {
	const run = runs.oneBoxMovieLens
	assert.deepEqual(previews(run), [])
	assert.deepEqual(openRows(run), ["MovieLens"])
	assert.match(
		run.text,
		/Recognized MovieLens ratings: movielens-ratings\.csv\. Add your wishlist file if you have one, then preview\./,
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

test("a wishlist preview adds seen titles only when the member chooses Want to rewatch", () => {
	const confirms = runs.wishlistRewatch.sent.filter((call) =>
		call.url.endsWith("/confirm"),
	)
	assert.deepEqual(
		confirms.map((call) => call.body),
		[{ kinds: ["want"], conflictChoice: "source", watchDates: "preserve" }],
	)
})

test("Undo of a wishlist import says what it takes back and that Not interested isn't put back", () => {
	assert.match(
		runs.wishlistUndo.text,
		/Undo this import\? GoodWatch takes the titles this import added off Want to See\. Titles you changed since then stay as you left them\. Titles the import took off Not interested aren't marked Not interested again\. The result lists them so you can put them back\./,
	)
	assert.match(runs.wishlistUndo.text, /Import another file/)
})
