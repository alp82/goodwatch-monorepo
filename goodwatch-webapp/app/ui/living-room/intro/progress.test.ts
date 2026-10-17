// The intro never starts over in a tab that has seen it (progress.ts). These tests hold its rules.
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
	BOOT_SEEN_SCRIPT,
	PROGRESS_KEY,
	introStart,
	parseProgress,
} from "./progress.ts"

const base = { tapped: false, member: false, quizScene: 10, scenes: 11 }

describe("introStart", () => {
	it("gives a new tab's guest the boot screen, then the film from its first scene", () => {
		assert.deepEqual(introStart({ ...base, progress: null }), {
			kind: "film",
			scene: 0,
			boot: true,
		})
	})
	it("gives a new tab's member the boot screen and the TV's home", () => {
		assert.deepEqual(introStart({ ...base, member: true, progress: null }), {
			kind: "home",
			boot: true,
		})
	})
	it("goes on from the scene a guest was at, without the boot screen", () => {
		assert.deepEqual(introStart({ ...base, progress: { scene: 3 } }), {
			kind: "film",
			scene: 3,
			boot: false,
		})
	})
	it("shows the TV's home without the boot screen once the visitor left the film", () => {
		assert.deepEqual(introStart({ ...base, progress: { left: true } }), {
			kind: "home",
			boot: false,
		})
		assert.deepEqual(
			introStart({ ...base, member: true, progress: { left: true } }),
			{ kind: "home", boot: false },
		)
	})
	it("shows the quiz as left when it holds taps", () => {
		assert.deepEqual(
			introStart({ ...base, tapped: true, progress: { scene: 4 } }),
			{ kind: "film", scene: 10, boot: false },
		)
	})
	it("never shows the quiz for taps of a visitor who left the film", () => {
		assert.deepEqual(
			introStart({ ...base, tapped: true, progress: { left: true } }),
			{ kind: "home", boot: false },
		)
	})
	it("plays the film from its first scene for What is GoodWatch?, for anyone, without the boot screen", () => {
		for (const progress of [null, { left: true as const }, { scene: 6 }])
			for (const member of [false, true])
				assert.deepEqual(
					introStart({ ...base, member, progress, replay: true }),
					{ kind: "film", scene: 0, boot: false },
				)
	})
	it("starts a scene it doesn't know from the first", () => {
		assert.deepEqual(introStart({ ...base, progress: { scene: 42 } }), {
			kind: "film",
			scene: 0,
			boot: false,
		})
		assert.deepEqual(introStart({ ...base, progress: { scene: -1 } }), {
			kind: "film",
			scene: 0,
			boot: false,
		})
	})
})

describe("parseProgress", () => {
	it("reads what writeProgress keeps", () => {
		assert.deepEqual(parseProgress(JSON.stringify({ scene: 2 })), { scene: 2 })
		assert.deepEqual(parseProgress(JSON.stringify({ left: true })), {
			left: true,
		})
	})
	it("reads nothing from nothing or from something else", () => {
		for (const raw of [
			null,
			"",
			"{",
			"[]",
			"1",
			JSON.stringify({ scene: "2" }),
			JSON.stringify({ left: 1 }),
		])
			assert.equal(parseProgress(raw), null)
	})
})

describe("the start page's inline script", () => {
	it("marks the page when the tab has progress, and nothing else", () => {
		assert.match(
			BOOT_SEEN_SCRIPT,
			new RegExp(`sessionStorage\\.getItem\\("${PROGRESS_KEY}"\\)`),
		)
		assert.match(BOOT_SEEN_SCRIPT, /data-gw-intro","seen"/)
		assert.ok(BOOT_SEEN_SCRIPT.length < 200)
	})
})
