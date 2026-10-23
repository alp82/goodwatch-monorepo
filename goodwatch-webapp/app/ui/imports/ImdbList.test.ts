import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { it } from "node:test"
it("the existing IMDb upload asks list intent before sending and confirms shared Watchlist wants with separate rewatch consent", () => {
	const output = execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/imports/imdb-list-interaction.test-support.tsx",
		],
		{ encoding: "utf8" },
	)
	const result = JSON.parse(output.split("__IMDB_LIST_UI__").at(-1) ?? "")
	assert.equal(result.before, 0)
	assert.equal(result.sent[0].url, "/api/imdb-import/preview")
	assert.equal(result.sent[0].body.listKind, "watchlist")
	assert.equal(
		result.sent[1].url,
		"/api/imports/00000000-0000-4000-8000-000000000001/confirm",
	)
	assert.deepEqual(result.sent[1].body.kinds, ["rating", "want"])
	assert.equal(result.sent[1].body.wishlistRewatch, true)
	assert.equal(result.sent[1].body.conflictChoice, "keep")
})
