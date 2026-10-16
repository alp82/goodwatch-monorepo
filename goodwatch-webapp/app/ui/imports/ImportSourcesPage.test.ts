import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"

type Row = { name: string; label: string | null; open: boolean }
type Mark = { name: string; logo?: string; tile?: string; className?: string }
type Run = {
	rows: Row[]
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

test("the page lists every live source, most common first, and hides sources not built yet", () => {
	assert.deepEqual(
		runs.list.rows.map((row) => row.name),
		[
			"IMDb",
			"Letterboxd",
			"Trakt",
			"TMDB",
			"Plex",
			"MyAnimeList / Kitsu",
			"Kodi",
			"MovieLens",
			"Generic CSV",
		],
	)
	assert.ok(runs.list.rows.every((row) => !row.open))
	assert.doesNotMatch(runs.list.text, /Netflix|Simkl|Jellyfin|coming later/i)
})

test("a source with a finished import says when; an undone import doesn't count", () => {
	const label = (name: string) =>
		runs.list.rows.find((row) => row.name === name)?.label
	assert.equal(label("IMDb"), "Imported October 2, 2026")
	assert.equal(label("Letterboxd"), "Imported October 11, 2026")
	assert.equal(label("Trakt"), null)
	assert.equal(label("TMDB"), "Connect")
	assert.equal(label("Plex"), "Connect")
})

test("TV Time members are pointed to Trakt, which imports a saved TV Time file", () => {
	assert.deepEqual(
		runs.tvTime.rows.map((row) => row.name),
		["Trakt"],
	)
	assert.match(
		runs.tvTime.text,
		/Coming from TV Time\? TV Time closed on July 15, 2026\. Trakt imports a saved TV Time file: import it on Trakt, then upload your Trakt export here\./,
	)
	assert.deepEqual(
		runs.tvTimeOpened.rows.find((row) => row.name === "Trakt")?.open,
		true,
	)
	assert.match(runs.tvTimeOpened.text, /Upload your Trakt export/)
})

test("a search with no source says what to try instead", () => {
	assert.deepEqual(runs.noMatch.rows, [])
	assert.match(
		runs.noMatch.text,
		/No source called "Blockbuster"\. If your site can save a CSV file, try Generic CSV\./,
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
	assert.deepEqual(
		run.rows.filter((row) => row.open).map((row) => row.name),
		["Trakt"],
	)
	assert.match(run.text, /Check before you import/)
})

const openRows = (run: Run) =>
	run.rows.filter((row) => row.open).map((row) => row.name)

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

test("only IMDb, Trakt, and TMDB show a logo; every other source has the same neutral letter tile", () => {
	assert.deepEqual(
		runs.list.marks.filter((mark) => mark.logo).map((mark) => mark.logo),
		["imdb.svg", "trakt.svg", "tmdb.svg"],
	)
	const tiles = runs.list.marks.filter((mark) => !mark.logo)
	assert.deepEqual(
		tiles.map((mark) => `${mark.name}: ${mark.tile}`),
		[
			"Letterboxd: Lb",
			"Plex: Px",
			"MyAnimeList / Kitsu: MAL",
			"Kodi: K",
			"MovieLens: ML",
			"Generic CSV: CSV",
		],
	)
	assert.equal(new Set(tiles.map((mark) => mark.className)).size, 1)
})

test("the notices cover every logo in the list, TMDB's included", () => {
	assert.match(
		runs.list.text,
		/This product uses the TMDB API but is not endorsed or certified by TMDB\./,
	)
})

test("the box's help names the sources from the list itself", () => {
	assert.match(
		runs.list.text,
		/Reads files from IMDb, Letterboxd, Trakt, MyAnimeList \/ Kitsu, Kodi, MovieLens, and Generic CSV\. To bring TMDB or Plex, open it in the list and connect your account\./,
	)
})

test("the server's HTML says Imported without a date, which only the member's browser knows the time zone of", () => {
	const markup = runs.serverMarkup as unknown as string
	assert.match(markup, /data-source-label="[^"]*"[^>]*>Imported<\/span>/)
	assert.doesNotMatch(markup, /October/)
})

test("a return from Plex opens Plex's connection, and no other connect source takes its state", () => {
	assert.deepEqual(openRows(runs.plexReturn), ["Plex"])
	assert.match(runs.plexReturn.text, /Return from Plex/)
	assert.deepEqual(openRows(runs.plexReturnThenTmdb), ["TMDB"])
	assert.match(runs.plexReturnThenTmdb.text, /Connect TMDB/)
	assert.doesNotMatch(runs.plexReturnThenTmdb.text, /Return from TMDB/)
})
