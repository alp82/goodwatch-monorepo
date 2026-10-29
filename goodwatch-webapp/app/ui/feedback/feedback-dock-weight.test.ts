// What the Feedback drawer brings with it (FeedbackDock.tsx). FeedbackTab.tsx loads the drawer at the first
// interaction with any page, so its modules are part of nearly every visit.
import assert from "node:assert/strict"
import { test } from "node:test"
import { staticImportGraph } from "../../utils/static-imports.test-support.ts"

test("the Feedback drawer doesn't bring the animation library", () => {
	// framer-motion is 35 KB compressed and 119 KB of script to run; the drawer animates with CSS. It came with the
	// sign-in card's button (ui/auth/kit.tsx imports AuthScene.tsx) until the button got a module of its own (#236).
	const { imports } = staticImportGraph("app/ui/feedback/FeedbackDock.tsx")
	assert.deepEqual(
		imports
			.filter(({ spec }) => /^(framer-motion|motion)(\/|$)/.test(spec))
			.map(({ from, spec }) => `${from}: ${spec}`),
		[],
	)
})
