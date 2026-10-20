import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"
const output = execFileSync(
	"node_modules/.bin/vite-node",
	[
		"--config",
		"app/ui/imports/source-import-test-vite.config.ts",
		"app/ui/imports/import-notes-render.test-support.tsx",
	],
	{ encoding: "utf8" },
)
const runs = JSON.parse(output.split("__NOTES__").at(-1) ?? "") as Record<
	string,
	{ empty: string; short: string; long: string; mixed: string }
>

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

test("three unreachable Plex servers keep Remote Access instructions visible beside RSS information", () => {
	const { mixed } = JSON.parse(
		output.split("__PLEX_NOTES__")[1].split("__END_PLEX__")[0],
	)
	const visible = mixed.replace(/<details[\s\S]*?<\/details>/g, "")
	assert.equal((visible.match(/Enable Plex Remote Access/g) ?? []).length, 3)
	assert.match(visible, /feed may not include your complete watchlist/)
})

test("every source keeps actionable warnings outside the information disclosure", () => {
	for (const run of Object.values(runs)) {
		const visible = run.mixed.replace(/<details[\s\S]*?<\/details>/g, "")
		assert.equal((visible.match(/Reconnect source \d/g) ?? []).length, 4)
		assert.doesNotMatch(visible, /Export detail/)
		assert.match(run.mixed, /\(52\)/)
	}
})

test("TV Time keeps unread history visible, bulk-date context informational and known ancillary files silent", () => {
	const { mixed } = JSON.parse(
		output.split("__TVTIME_NOTES__")[1].split("__END_TVTIME__")[0],
	)
	const visible = mixed.replace(/<details[\s\S]*?<\/details>/g, "")
	assert.match(visible, /TV Time history file not imported: episodes.csv/)
	assert.match(visible, /1 TV Time watch has an invalid date or bulk mark/)
	assert.doesNotMatch(mixed, /access_token|watched_on_episode|ratings-3-prod/)
})
