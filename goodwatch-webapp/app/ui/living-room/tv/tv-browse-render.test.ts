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
