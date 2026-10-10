import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"
import "../../server/title-filter/test-alias.ts"
import { IMPORT_MAX_BYTES } from "../../domain/imports.ts"

const { buildSourceImportUpload } = await import("./SourceImportUpload.ts")
const { sourceImportRequirements } = await import(
	"./SourceImportPreviewModel.ts"
)

test("buildSourceImportUpload sends the selected source and untouched ZIP file", () => {
	const file = new File(["archive"], "letterboxd-export.zip", {
		type: "application/zip",
	})
	const body = buildSourceImportUpload("letterboxd", file)

	assert.equal(body.get("source"), "letterboxd")
	assert.equal(body.get("file"), file)
})

test("a rating-only selection can start without answering the watch-date question", () => {
	assert.deepEqual(sourceImportRequirements(12, ["rating"], null), {
		importsWatches: false,
		canImport: true,
		watchDates: "preserve",
	})
	assert.equal(
		sourceImportRequirements(12, ["rating", "watch"], null).canImport,
		false,
	)
	assert.equal(
		sourceImportRequirements(12, ["watch"], "unknown").canImport,
		true,
	)
})

test("the preview renders selected kinds, conditional date choice, and busy/error states", () => {
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
		ratingOnly: string
		withWatches: string
	}

	assert.match(rendered.ratingOnly, /type="checkbox"[^>]*checked=""/)
	assert.doesNotMatch(rendered.ratingOnly, /How should watch dates be handled/)
	assert.doesNotMatch(
		rendered.ratingOnly,
		/does not restore those earlier choices/,
	)
	assert.match(rendered.ratingOnly, /Preview could not start/)
	assert.match(rendered.withWatches, /How should watch dates be handled/)
	assert.match(rendered.withWatches, /does not restore those earlier choices/)
	assert.match(rendered.withWatches, /Starting import/)
	assert.match(rendered.withWatches, /disabled=""/)
})

test("buildSourceImportUpload rejects non-ZIP and oversized uploads before the request", () => {
	assert.throws(
		() => buildSourceImportUpload("trakt", new File(["csv"], "history.csv")),
		/ZIP file/i,
	)
	const oversized = new File(
		[new Uint8Array(IMPORT_MAX_BYTES + 1)],
		"export.zip",
	)
	assert.throws(() => buildSourceImportUpload("trakt", oversized), /20 MB/i)
})
