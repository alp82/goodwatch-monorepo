import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"
test("MDBList controls take a hidden, unsaved key field, post it to GoodWatch only and explain its access", () => {
	const output = execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/imports/mdblist-connect-render.test-support.tsx",
		],
		{ encoding: "utf8" },
	)
	const rendered = JSON.parse(output.split("__MDBLIST_RENDER__").at(-1) ?? "")
	assert.match(rendered.start, /type="password"/)
	assert.match(rendered.start, /name="apiKey"/)
	assert.match(rendered.start, /autoComplete="off"|autocomplete="off"/)
	assert.match(
		rendered.start,
		/formAction="\/api\/imports\/mdblist"|formaction="\/api\/imports\/mdblist"/,
	)
	assert.match(rendered.start, /https:\/\/mdblist.com\/preferences\//)
	assert.match(rendered.start, /full access/)
	assert.match(rendered.start, /doesn’t\s+save the key/)
	assert.match(rendered.start, /Preview MDBList import/)
	assert.doesNotMatch(rendered.start, /type="file"|method="get"/i)
	assert.match(rendered.busy, /disabled=""/)
	assert.match(rendered.busy, /Reading MDBList/)
	assert.match(rendered.failed, /role="alert"/)
})
