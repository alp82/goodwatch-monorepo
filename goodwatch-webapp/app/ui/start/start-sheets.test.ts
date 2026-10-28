// The start page's style sheets (start-sheets.ts).
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { staticImportGraph } from "../../utils/static-imports.test-support.ts"

test("every style sheet of the start page's first load is in START_SHEETS, none a side-effect import", () => {
	// A side-effect `import "./x.css"` in the route's static graph becomes a route sheet that Remix links without
	// `crossorigin` and that the 103 response doesn't name (#236). The start page's sheets are `?url` imports in
	// start-sheets.ts instead, which _index.tsx links. Modules loaded on demand (`import()`) bring their sheets after
	// the paint, and aren't walked.
	const { modules, imports } = staticImportGraph("app/routes/_index.tsx")
	assert.ok(
		modules.has("app/ui/start/start-sheets.ts"),
		`walked ${modules.size} modules`,
	)
	assert.deepEqual(
		imports
			.filter(({ spec }) => /\.css$/.test(spec))
			.map(({ from, spec }) => `${from}: ${spec}`),
		[],
	)
	assert.match(
		readFileSync("app/ui/start/start-sheets.ts", "utf8"),
		/start\/start\.css\?url"/,
	)
	// Nothing of the old TV home is in the start page's first load.
	for (const path of modules)
		assert.doesNotMatch(path, /ui\/living-room\/(tv|intro)\//, path)
})
