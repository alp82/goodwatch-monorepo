import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"
const runs = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/imports/import-notes-render.test-support.tsx",
		],
		{ encoding: "utf8" },
	)
		.split("__NOTES__")
		.at(-1) ?? "",
) as Record<string, { empty: string; short: string; long: string }>

test("every source keeps long preview notes in a counted, closed disclosure", () => {
	for (const [source, run] of Object.entries(runs)) {
		assert.match(run.long, /<details[ >]/, source)
		assert.doesNotMatch(run.long, /<details[^>]*open/, source)
		assert.match(run.long, /<summary[^>]*>[^<]*\(52\)<\/summary>/, source)
		assert.equal(
			(run.long.match(/Export detail \d+/g) ?? []).length,
			52,
			source,
		)
		assert.doesNotMatch(run.long, /bg-amber|role="(?:alert|status)"/, source)
	}
})

test("short preview notes stay visible and empty notes take no space", () => {
	for (const run of Object.values(runs)) {
		assert.match(run.short, /One note/)
		assert.doesNotMatch(run.short, /<details/)
		assert.doesNotMatch(run.empty, /<details/)
	}
})
