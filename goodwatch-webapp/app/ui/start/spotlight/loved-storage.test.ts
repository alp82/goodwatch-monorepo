// Loved titles in the guest's stored progress (useLovedThree.ts guestLovedStore, utils/guest-progress.ts): saved in
// `onboarding_ratings` as a 9, gone on undo, kept when a new choice starts the three over.
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

const steps = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/start/spotlight/loved-storage.test-support.ts",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__LOVED_STORAGE__")
		.at(-1) ?? "",
)

test("a loved title is saved in onboarding_ratings as a 9 and leaves it on undo", () => {
	assert.deepEqual(steps.loved, ["movie:603:score:9", "show:1396:score:9"])
	assert.deepEqual(steps.undone, ["show:1396:score:9"])
})

test("undo puts back what the guest had marked before", () => {
	assert.deepEqual(steps.overMark, ["movie:7:score:9"])
	assert.deepEqual(steps.markBack, ["movie:7:plan:"])
})

test("a new choice after three empties the slots and keeps the scores", () => {
	assert.equal(steps.afterChoice.slots, 0)
	assert.deepEqual(steps.afterChoice.stored.slice(-3), [
		"movie:1:score:9",
		"movie:2:score:9",
		"movie:3:score:9",
	])
})

test("past the guest's 20 ratings the title isn't loved and the limit prompt shows", () => {
	assert.equal(steps.refused, "refused")
	assert.equal(steps.limitShown, 1)
})
