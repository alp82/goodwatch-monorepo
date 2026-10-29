// The film the start page plays (film.ts, FILM_ENDING_ON_YOUR_TURN): the TV's film with the quiz swapped for the
// Your turn end card, which counts as a chapter, and whose Try it hands the visitor to the page.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

test("the start page's film ends on Your turn, the TV's on its quiz, and Try it and Next leave the film", () => {
	const result = execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/living-room/intro/your-turn-film.test-support.tsx",
		],
		{ encoding: "utf8", timeout: 30000 },
	)
	assert.match(result, /__YOUR_TURN_PASSED__/)
})
