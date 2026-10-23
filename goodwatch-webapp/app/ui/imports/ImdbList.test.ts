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
	assert.deepEqual(result.initiallySelected, [])
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

it("explains a legacy file may be Ratings or Watchlist and sends the selected Ratings meaning", () => {
	const output = execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/imports/imdb-list-interaction.test-support.tsx",
		],
		{
			encoding: "utf8",
			env: { ...process.env, IMDB_UI_LEGACY: "1", IMDB_UI_CHOICE: "Ratings" },
		},
	)
	const result = JSON.parse(output.split("__IMDB_LIST_UI__").at(-1) ?? "")
	assert.equal(result.before, 0)
	assert.deepEqual(result.initiallySelected, [])
	assert.match(result.chooserText, /old ratings or Watchlist export/i)
	assert.equal(result.sent[0].body.listKind, "ratings")
})

it("preselects My Watchlist for filenames containing watchlist in any case, including legacy exports, without submitting automatically", () => {
	for (const legacy of [false, true]) {
		const output = execFileSync(
			"node_modules/.bin/vite-node",
			[
				"--config",
				"app/ui/imports/source-import-test-vite.config.ts",
				"app/ui/imports/imdb-list-interaction.test-support.tsx",
			],
			{
				encoding: "utf8",
				env: {
					...process.env,
					IMDB_UI_FILENAME: "IMDb_WaTcHlIsT_2026.csv",
					IMDB_UI_LEGACY: legacy ? "1" : "",
				},
			},
		)
		const result = JSON.parse(output.split("__IMDB_LIST_UI__").at(-1) ?? "")
		assert.equal(result.before, 0)
		assert.equal(result.initiallySelected.length, 1)
		assert.match(result.initiallySelected[0], /^My Watchlist/)
		assert.equal(result.sent[0].body.listKind, "watchlist")
	}
})

it("custom-list uploads keep the source list title from the filename in an editable name field and send it to preview", () => {
	const output = execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/imports/imdb-list-interaction.test-support.tsx",
		],
		{
			encoding: "utf8",
			env: {
				...process.env,
				IMDB_UI_FILENAME: "My source discoveries.csv",
				IMDB_UI_CHOICE: "A custom list",
			},
		},
	)
	const result = JSON.parse(output.split("__IMDB_LIST_UI__").at(-1) ?? "")
	assert.equal(result.customListName, "My source discoveries")
	assert.equal(result.sent[0].body.listName, "My source discoveries")
	assert.equal(result.sent[0].body.listKind, "custom-list")
})
