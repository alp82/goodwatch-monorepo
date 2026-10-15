import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"

type Row = { name: string; label: string | null; open: boolean }
type Run = { rows: Row[]; text: string; sent: { url: string; body: unknown }[] }

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
			"MyAnimeList / Kitsu",
			"Kodi",
			"MovieLens",
			"Any other site (CSV)",
		],
	)
	assert.ok(runs.list.rows.every((row) => !row.open))
	assert.doesNotMatch(runs.list.text, /Netflix|Simkl|Plex|coming later/i)
})

test("a source with a finished import says when; an undone import doesn't count", () => {
	const label = (name: string) =>
		runs.list.rows.find((row) => row.name === name)?.label
	assert.equal(label("IMDb"), "Imported October 2, 2026")
	assert.equal(label("Letterboxd"), "Imported October 11, 2026")
	assert.equal(label("Trakt"), null)
	assert.equal(label("TMDB"), "Connect")
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
		/No source called "Plex"\. If your site can save a CSV file, try Any other site \(CSV\)\./,
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
