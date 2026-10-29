// How it works on the start page (HowItWorksCorner.tsx): what a crawler reads in the server's HTML, that the intro's
// code stays off the page's first load, and Try it's hand-off (the support file asserts it in happy-dom).
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"
import { staticImportGraph } from "../../../utils/static-imports.test-support.ts"

const { html } = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/start/how/how-render.test-support.tsx",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 },
	)
		.split("__HOW_RENDER__")
		.at(-1) ?? "",
) as { html: string }

test("an H2 section with a real link to /how-it-works and no H1", () => {
	assert.doesNotMatch(html, /<h1\b/)
	assert.match(html, /<section aria-labelledby="start-how-heading"[^>]*>/)
	assert.match(
		html,
		/<h2 id="start-how-heading"[^>]*>How GoodWatch works<\/h2>/,
	)
	assert.match(html, /<a [^>]*href="\/how-it-works"[^>]*>Read how it works/)
	for (const title of [
		"One score from all the big sites",
		"Search by mood or anything",
		"Picks for your taste",
	])
		assert.ok(html.includes(title), title)
})

test("the TV corner is one button named Watch the intro, its picture lazy", () => {
	const buttons = html.match(/<button\b[^>]*>/g) ?? []
	assert.equal(buttons.length, 1)
	assert.match(buttons[0], /type="button"/)
	assert.match(
		html,
		/<button[^>]*>[\s\S]*Watch the intro<\/span><\/span><\/button>/,
	)
	const img = html.match(/<img\b[^>]*>/g) ?? []
	assert.equal(img.length, 1)
	assert.match(img[0], /loading="lazy"/)
	assert.match(img[0], /tv-corner[^"]*\.webp/)
	assert.match(img[0], /width="1536" height="1024"/)
	assert.match(
		html,
		/<source type="image\/avif" srcSet="[^"]*tv-corner[^"]*\.avif"/,
	)
})

test("the film's code and intro.css load only on press", () => {
	const { modules, imports } = staticImportGraph("app/routes/_index.tsx")
	assert.ok(modules.has("app/ui/start/how/HowItWorksCorner.tsx"))
	assert.ok(!modules.has("app/ui/start/how/IntroTheater.tsx"))
	// The guest's opening reuses the old TV's boot screen (start-sheets.test.ts); nothing else of the TV home loads.
	for (const path of modules)
		if (!/^app\/ui\/living-room\/intro\/boot\.(tsx|css)$/.test(path))
			assert.doesNotMatch(path, /ui\/living-room\//, path)
	assert.ok(!imports.some(({ spec }) => spec.includes("intro.css")))
})
