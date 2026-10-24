import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"
import "../../server/title-filter/test-alias.ts"
import {
	IMPORT_MAX_BYTES,
	IMPORT_SHOW_STATUS_LABELS,
} from "../../domain/imports.ts"

const { buildSourceImportUpload } = await import("./SourceImportUpload.ts")
const { sourceOptions } = await import("./import-flow-model.ts")

test("buildSourceImportUpload sends the selected source and untouched ZIP file", () => {
	const file = new File(["archive"], "letterboxd-export.zip", {
		type: "application/zip",
	})
	const body = buildSourceImportUpload("letterboxd", file)

	assert.equal(body.get("source"), "letterboxd")
	assert.equal(body.get("file"), file)
})

test("watch dates are never asked: an import always keeps the source's own dates", () => {
	const summary = {
		source: "letterboxd",
		kinds: {
			rating: 1,
			watch: 12,
			want: 0,
			favorite: 0,
			review: 0,
			show_status: 0,
		},
		counts: {
			new: 1,
			unchanged: 0,
			conflict: 0,
			unmatched: 0,
			unsupported: 0,
			invalid: 0,
			rows: 13,
		},
	} as never
	assert.equal(sourceOptions(summary, ["rating"], {}).watchDates, "preserve")
	assert.equal(
		sourceOptions(summary, ["rating", "watch"], {}).watchDates,
		"preserve",
	)
})

test("Choose lists every kind with its count, all in, without a watch-date question, fine print, or busy/error states lost", () => {
	const output = execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/imports/source-import-preview-render.test-support.tsx",
		],
		{ encoding: "utf8" },
	)
	const rendered = JSON.parse(
		output.split("__SOURCE_IMPORT_RENDER__").at(-1) ?? "",
	) as {
		letterboxdUpload: string
		traktUpload: string
		csvUpload: string
		movielensUpload: string
		malUpload: string
		malReceipt: string
		kodiUpload: string
		statusOnly: string
		ratingOnly: string
		withWatches: string
		plexWatches: string
		plexSeasonScore: string
		freshWatches: string
		mdblistShowChoice: string
	}

	assert.match(rendered.malUpload, /Export my: Anime List/)
	assert.match(rendered.malUpload, /Export My List/)
	assert.match(rendered.malUpload, /panel.php\?go=export/)
	assert.match(rendered.malUpload, /Kitsu.*Settings → Export/)
	assert.match(rendered.malUpload, /not available to every member/)
	assert.match(rendered.malUpload, /Kitsu watches are always undated/)
	assert.match(rendered.malUpload, /accept="[^"]*\.xml[^"]*\.gz/)
	assert.doesNotMatch(rendered.malUpload, /Sign in to Trakt/)
	assert.match(
		rendered.malReceipt,
		/href="https:\/\/github.com\/Anime-Lists\/anime-lists"[^>]*>Anime-Lists/,
	)
	assert.match(
		rendered.malReceipt,
		/href="https:\/\/github.com\/Fribb\/anime-lists"[^>]*>Fribb/,
	)
	assert.match(rendered.malReceipt, /Comments and tags are not imported/)
	assert.match(
		rendered.malReceipt,
		/score is kept for its own episodes, such as S1 E1–12/,
	)
	assert.match(rendered.statusOnly, /Show statuses/)
	assert.doesNotMatch(rendered.statusOnly, /watch dates/i)
	// The preview's fine print is gone; Undo says what it does when the member asks for it.
	assert.doesNotMatch(rendered.statusOnly, /Undo restores/)
	assert.equal(IMPORT_SHOW_STATUS_LABELS.completed, "Completed → Seen")
	assert.match(rendered.kodiUpload, /Advanced/)
	assert.match(rendered.kodiUpload, /Choose Kodi export XML or ZIP file/)
	assert.match(rendered.kodiUpload, /Choose XML or ZIP file/)
	assert.match(
		rendered.kodiUpload,
		/Settings → Media → Library → Export library → Single file/,
	)
	assert.match(rendered.kodiUpload, /videodb\.xml/)
	assert.match(rendered.kodiUpload, /accept="[^"]*\.xml[^"]*\.zip/)
	assert.doesNotMatch(rendered.kodiUpload, /Sign in to Trakt/)
	assert.match(rendered.csvUpload, /Letterboxd import format/)
	assert.match(
		rendered.csvUpload,
		/Drop your CSV file here, or choose it from your device/,
	)
	assert.match(rendered.letterboxdUpload, /Choose Letterboxd export ZIP file/)
	assert.match(rendered.traktUpload, /Choose Trakt export ZIP file/)
	assert.match(rendered.movielensUpload, /MovieLens ratings CSV/)
	assert.match(rendered.movielensUpload, /MovieLens wishlist CSV/)
	assert.match(rendered.movielensUpload, /optional/i)
	assert.match(rendered.movielensUpload, />Continue</)
	assert.match(rendered.ratingOnly, /What should come in\?/)
	assert.match(rendered.ratingOnly, /type="checkbox"[^>]*checked=""/)
	assert.match(rendered.ratingOnly, /Scores/)
	assert.doesNotMatch(rendered.ratingOnly, /watch dates/i)
	assert.match(rendered.ratingOnly, /Preview could not start/)
	assert.match(rendered.withWatches, /Watches<\/span><span[^>]*>2</)
	assert.doesNotMatch(rendered.withWatches, /type="radio"/)
	assert.doesNotMatch(rendered.plexWatches, /Undo restores|How rows compare/)
	assert.match(rendered.plexSeasonScore, /S4/)
	assert.match(rendered.plexSeasonScore, /Source 8.5/)
	assert.match(rendered.withWatches, /Starting import/)
	assert.match(
		rendered.withWatches.match(/<button[^>]*>Starting import/)?.[0] ?? "",
		/disabled=""/,
	)
	// Fewest steps (owner rule): no watch-date question, so Import works right away.
	assert.match(rendered.freshWatches, />Import</)
	assert.doesNotMatch(
		rendered.freshWatches.match(/<button[^>]*>Import</)?.[0] ?? "missing",
		/disabled=""/,
	)
	// The whole-show choice is a question after Choose, so Choose has no box for it.
	assert.doesNotMatch(rendered.mdblistShowChoice, /name="wishlist-shows"/)
	assert.match(rendered.mdblistShowChoice, /Want to See<\/span><span[^>]*>2</)
})

test("buildSourceImportUpload rejects non-ZIP and oversized uploads before the request", () => {
	assert.throws(
		() => buildSourceImportUpload("trakt", new File(["csv"], "history.csv")),
		{ message: "Choose the ZIP file you downloaded from Letterboxd or Trakt." },
	)
	const oversized = new File(
		[new Uint8Array(IMPORT_MAX_BYTES + 1)],
		"export.zip",
	)
	assert.throws(() => buildSourceImportUpload("trakt", oversized), {
		message: `That file is larger than ${Math.round(IMPORT_MAX_BYTES / 1024 / 1024)} MB. Choose a smaller export ZIP file.`,
	})
})

test("generic CSV upload uses the existing multipart endpoint and rejects archives", () => {
	const file = new File(["Title,Rating\nExample,4"], "export.csv")
	const body = buildSourceImportUpload("csv", file)
	assert.equal(body.get("source"), "csv")
	assert.equal(body.get("file"), file)
	assert.throws(
		() => buildSourceImportUpload("csv", new File(["zip"], "export.zip")),
		{ message: "Choose a CSV export file." },
	)
})

test("MovieLens uploads ratings with an optional wishlist under one combined limit", () => {
	const ratings = new File(["ratings"], "movielens-ratings.csv")
	const wishlist = new File(["wishlist"], "movielens-wishlist.csv")
	const body = buildSourceImportUpload("movielens", ratings, wishlist)
	assert.equal(body.get("source"), "movielens")
	assert.equal(body.get("file"), ratings)
	assert.equal(body.get("wishlist"), wishlist)
	assert.equal(
		buildSourceImportUpload("movielens", ratings).get("wishlist"),
		null,
	)
	assert.throws(
		() =>
			buildSourceImportUpload(
				"movielens",
				ratings,
				new File(["bad"], "archive.zip"),
			),
		{ message: "Choose a CSV export file." },
	)
	assert.throws(
		() =>
			buildSourceImportUpload(
				"movielens",
				ratings,
				new File([new Uint8Array(IMPORT_MAX_BYTES)], "wishlist.csv"),
			),
		{
			message: `The combined export is larger than ${Math.round(IMPORT_MAX_BYTES / 1024 / 1024)} MB. Choose a smaller export.`,
		},
	)
	assert.throws(() => buildSourceImportUpload("csv", ratings, wishlist), {
		message: "Only MovieLens accepts an optional wishlist file.",
	})
})

test("single ZIP uploads retain their original size error", () => {
	const file = new File([new Uint8Array(IMPORT_MAX_BYTES + 1)], "export.zip")
	for (const source of ["letterboxd", "trakt"] as const)
		assert.throws(() => buildSourceImportUpload(source, file), {
			message: `That file is larger than ${Math.round(IMPORT_MAX_BYTES / 1024 / 1024)} MB. Choose a smaller export ZIP file.`,
		})
})

test("Kodi upload sends XML or ZIP unchanged and rejects separate NFO files", () => {
	for (const name of ["videodb.xml", "kodi.zip"]) {
		const file = new File(["export"], name)
		const body = buildSourceImportUpload("kodi", file)
		assert.equal(body.get("source"), "kodi")
		assert.equal(body.get("file"), file)
	}
	assert.throws(
		() => buildSourceImportUpload("kodi", new File(["nfo"], "movie.nfo")),
		/Single file/,
	)
})

test("oversized Kodi uploads explain how to omit artwork", () => {
	assert.throws(
		() =>
			buildSourceImportUpload(
				"kodi",
				new File([new Uint8Array(IMPORT_MAX_BYTES + 1)], "kodi.zip"),
			),
		/Upload videodb\.xml by itself/,
	)
})

test("TMDB offers Connect and an explicit return/cancel step without a file input", () => {
	const output = execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/imports/tmdb-connect-render.test-support.tsx",
		],
		{ encoding: "utf8" },
	)
	const rendered = JSON.parse(output.split("__TMDB_RENDER__").at(-1) ?? "")
	assert.match(rendered.start, /Connect TMDB/)
	assert.match(rendered.start, /\/api\/imports\/tmdb\/start/)
	assert.match(rendered.start, /read and write/)
	assert.match(
		rendered.start,
		/This product uses the TMDB API but is not endorsed or certified by TMDB/,
	)
	assert.match(rendered.start, /alt="TMDB"/)
	assert.match(
		rendered.start,
		/src="https:\/\/static.goodwatch.test\/tmdb-logo.svg"/,
	)
	assert.doesNotMatch(rendered.start, /type="file"/)
	assert.match(rendered.returned, /Preview TMDB import/)
	assert.match(rendered.returned, /\/api\/imports\/tmdb\/return/)
	assert.match(rendered.returned, /\/api\/imports\/tmdb\/abandon/)
	assert.match(rendered.returned, /name="state" value="flow-id"/)
	assert.match(rendered.denied, /sign-in was denied/)
	assert.match(rendered.denied, /name="denied" value="true"/)
	assert.match(rendered.denied, /Close connection/)
	assert.match(rendered.busy, /disabled=""/)
	assert.match(rendered.failed, /role="alert"/)
	assert.match(rendered.failed, /Please try again/)
	assert.match(rendered.failed, /Start a new connection/)
	assert.doesNotMatch(rendered.preview, /export|Choose another file/i)
	assert.match(rendered.preview, /Check these import details/)
	assert.match(rendered.preview, /What should come in\?/)
	assert.match(rendered.filePreview, /Check these export details/)
	assert.match(rendered.failed, /\/api\/imports\/tmdb\/start/)
})

test("MAL and Kitsu uploads send the original XML or gzip and reject unrelated files", () => {
	for (const name of [
		"animelist_123.xml.gz",
		"animelist_123.gz",
		"animelist.xml",
		"kitsu-member-anime.xml",
	]) {
		const file = new File(["export"], name)
		const body = buildSourceImportUpload("myanimelist", file)
		assert.equal(body.get("source"), "myanimelist")
		assert.equal(body.get("file"), file)
	}
	assert.throws(
		() =>
			buildSourceImportUpload(
				"myanimelist",
				new File(["export"], "export.zip"),
			),
		/XML or gzip/,
	)
	assert.throws(
		() => buildSourceImportUpload("myanimelist", new File([], "export.xml")),
		/empty/,
	)
	assert.throws(
		() =>
			buildSourceImportUpload(
				"myanimelist",
				new File([new Uint8Array(IMPORT_MAX_BYTES + 1)], "export.gz"),
			),
		/20 MB/,
	)
})
test("background resolution keeps the existing preview poll active until it settles", async () => {
	const { sourceImportNeedsPolling } = await import(
		"./SourceImportPreviewModel.ts"
	)
	assert.equal(
		sourceImportNeedsPolling({
			status: "preview",
			resolution: { state: "running" },
		}),
		true,
	)
	assert.equal(
		sourceImportNeedsPolling({
			status: "preview",
			resolution: { state: "completed" },
		}),
		false,
	)
	assert.equal(sourceImportNeedsPolling({ status: "running" }), true)
})

test("custom lists come in as Lists, Done counts the lists made, and their entries keep source order, notes and the created-list link", () => {
	const output = execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/imports/source-import-preview-render.test-support.tsx",
		],
		{ encoding: "utf8" },
	)
	const rendered = JSON.parse(
		output.split("__SOURCE_IMPORT_RENDER__").at(-1) ?? "",
	)
	assert.match(rendered.keptListReceipt, /1 list could not be deleted/)
	assert.match(rendered.keptListReceipt, /Undone/)
	assert.match(
		rendered.keptListDetails,
		/This list changed after import. Undo kept it./,
	)
	assert.doesNotMatch(rendered.keptListDetails, /List deleted by Undo/)
	assert.match(rendered.keptListDetails, /href="\/lists\/AbCd012345"/)
	assert.match(rendered.listReceipt, /Done\. 1 list is in GoodWatch/)
	assert.match(rendered.listReceipt, /1<\/span><span[^>]*>Lists added/)
	assert.doesNotMatch(rendered.listReceipt, /Nothing in your library changed/)
	assert.match(rendered.listPreview, /Lists<\/span><span[^>]*>1</)
	assert.doesNotMatch(rendered.listPreview, /Keep yours\?/)
	assert.match(rendered.listDetails, /Source list/)
	assert.match(rendered.listDetails, /A list note, not a review\./)
	assert.match(rendered.listDetails, /value="2"/)
	assert.match(rendered.listDetails, /href="\/lists\/AbCd012345"/)
})
