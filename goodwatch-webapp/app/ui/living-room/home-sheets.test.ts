// The start page's style sheets (home-sheets.ts).
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { staticImportGraph } from "../../utils/static-imports.test-support.ts"

test("every style sheet of the start page's first load is in HOME_SHEETS, none a side-effect import", () => {
	// A side-effect `import "./x.css"` in the route's static graph becomes a route sheet that Remix links without
	// `crossorigin` and that the 103 response doesn't name: the browser opens a second connection to the static
	// hostname for it, and the first paint waits for that (#236). The start page's sheets are `?url` imports in
	// home-sheets.ts instead, which _index.tsx links and early-hints.server.ts names. Modules loaded on demand
	// (`import()`, such as the intro film) bring their sheets after the paint, and aren't walked.
	const { modules, imports } = staticImportGraph("app/routes/_index.tsx")
	assert.ok(modules.size > 50, `walked ${modules.size} modules`)
	assert.deepEqual(
		imports
			.filter(({ spec }) => /\.css$/.test(spec))
			.map(({ from, spec }) => `${from}: ${spec}`),
		[],
	)
	assert.match(
		readFileSync("app/ui/living-room/home-sheets.ts", "utf8"),
		/start-row\/start-row\.css\?url"/,
	)
})
