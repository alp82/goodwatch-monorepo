import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"
test("Plex controls offer sign-in, optional personal RSS, preview and cancel without file or token inputs", () => {
	const output = execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/imports/plex-connect-render.test-support.tsx",
		],
		{ encoding: "utf8" },
	)
	const rendered = JSON.parse(output.split("__PLEX_RENDER__").at(-1) ?? "")
	assert.match(rendered.start, /Sign in with Plex/)
	assert.match(rendered.start, /\/api\/imports\/plex\/start/)
	assert.match(rendered.start, /public HTTPS/)
	assert.match(rendered.start, /library watched state and personal ratings/)
	assert.match(rendered.start, /Season and episode scores.*not applied/)
	assert.match(rendered.returned, /name="feed"/)
	assert.match(rendered.returned, /Plex Pass/)
	assert.match(rendered.returned, /personal/)
	assert.match(rendered.returned, /\/api\/imports\/plex\/return/)
	assert.match(rendered.returned, /\/api\/imports\/plex\/abandon/)
	assert.match(rendered.busy, /disabled=""/)
	assert.match(rendered.failed, /role="alert"/)
	assert.doesNotMatch(
		rendered.start + rendered.returned,
		/type="file"|name="token"/,
	)
})
