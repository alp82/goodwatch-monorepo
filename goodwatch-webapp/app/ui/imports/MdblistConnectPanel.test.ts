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
	assert.match(rendered.start, /https:\/\/mdblist.com\/preferences\//)
	assert.match(rendered.start, /full access/)
	assert.match(rendered.start, /dropped shows, and your lists/)
	assert.match(rendered.start, /doesn’t\s+save the key/)
	assert.match(rendered.start, /Preview MDBList import/)
	assert.doesNotMatch(rendered.start, /type="file"|method="get"/i)
	assert.match(rendered.busy, /disabled=""/)
	assert.match(rendered.busy, /Reading MDBList/)
	assert.match(rendered.failed, /role="alert"/)
})

test("the key field is empty after every submission, accepted or refused, and keeps typing between them", () => {
	const output = execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/imports/mdblist-connect-interaction.test-support.tsx",
		],
		{ encoding: "utf8" },
	)
	const values = JSON.parse(output.split("__MDBLIST_FORM__").at(-1) ?? "")
	assert.deepEqual(values, {
		typed: "synthetic-key-0001",
		whileReading: "",
		afterRefusal: "",
		afterSecond: "",
		typingKept: "synthetic-key-0003",
	})
})

test("after a submission no router, fetcher or page state holds the key, accepted or refused", () => {
	const output = execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/imports/mdblist-panel-interaction.test-support.tsx",
		],
		{ encoding: "utf8" },
	)
	const { accepted, refused } = JSON.parse(
		output.split("__MDBLIST_PANEL__").at(-1) ?? "",
	)
	for (const run of [accepted, refused]) {
		// One script post to GoodWatch, the key sent once, and nothing kept afterwards.
		assert.deepEqual(run.posts, [
			{
				url: "/api/imports/mdblist",
				method: "POST",
				body: "has key",
				accept: "application/json",
				keyCount: 1,
			},
		])
		assert.equal(run.field, "")
		assert.equal(run.navigationFormData, false)
		assert.equal(run.fetcherFormData, false)
		assert.equal(run.keyInRouterState, false)
		assert.equal(run.keyInPage, false)
		// Without a script, the same form still posts to GoodWatch.
		assert.equal(run.formAction, "/api/imports/mdblist")
	}
	assert.equal(
		accepted.path,
		"/settings/imports?source=mdblist&import=00000000-0000-4000-8000-000000000001",
	)
	assert.equal(accepted.alert, null)
	assert.equal(refused.path, "/settings/imports?source=mdblist")
	assert.equal(refused.alert, "MDBList didn't accept this API key.")
})
