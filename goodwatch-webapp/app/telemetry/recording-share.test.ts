import assert from "node:assert/strict"
import { test } from "node:test"

const { anonymousRecordingBlocked } = await import("./recording-share.ts")

const never = () => assert.fail("no draw needed")

test("no share set leaves the decision to the PostHog project", () => {
	assert.equal(anonymousRecordingBlocked(null, never), false)
})

test("a share of 0 blocks every anonymous visitor, and 1 blocks none", () => {
	assert.equal(anonymousRecordingBlocked(0, never), true)
	assert.equal(anonymousRecordingBlocked(1, never), false)
})

test("a share in between admits the visitors whose draw falls inside it", () => {
	assert.equal(
		anonymousRecordingBlocked(0.1, () => 0.05),
		false,
	)
	assert.equal(
		anonymousRecordingBlocked(0.1, () => 0.1),
		true,
	)
	assert.equal(
		anonymousRecordingBlocked(0.1, () => 0.9),
		true,
	)
})
