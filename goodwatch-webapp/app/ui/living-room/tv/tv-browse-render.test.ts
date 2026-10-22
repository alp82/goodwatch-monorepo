import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

const rendered = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/living-room/tv/tv-browse-render.test-support.tsx",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__TV_BROWSE_RENDER__")
		.at(-1)!,
) as { name: string; scenario: string; edition: string; html: string }[]
for (const { name, scenario, edition, html } of rendered) {
	test(`${name} ${edition}: For you agrees with ${scenario} Best match state`, () => {
		// The phone shows four filters a page (nothing scrolls): with the focus on For you, its page, without Sort.
		if (edition === "phone") {
			assert.match(
				html,
				scenario === "entered" || scenario === "deep"
					? /For you: On/
					: /For you: Off/,
			)
			assert.doesNotMatch(
				html,
				scenario === "entered" || scenario === "deep"
					? /For you: Off/
					: /For you: On/,
			)
			assert.doesNotMatch(html, /data-tv-scroll/)
			return
		}
		if (scenario === "entered" || scenario === "deep") {
			assert.match(html, /Sort: Best match/)
			assert.match(html, /For you: On/)
			assert.doesNotMatch(html, /For you: Off/)
		} else {
			assert.match(
				html,
				scenario === "off" && name === "search"
					? /Sort: Relevance/
					: /Sort: Popular/,
			)
			assert.match(html, /For you: Off/)
			assert.doesNotMatch(html, /Sort: Best match/)
		}
	})
}
