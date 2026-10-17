// The intro never starts over in a tab that has seen it (progress.ts). These tests hold its rules.
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
	PROGRESS_KEY,
	TAPS_KEY,
	introStart,
	introStartScript,
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
	/** Runs the script in a fake browser: this tab's sessionStorage and how the page was loaded. */
	const run = (kept: Record<string, string>, navigation: string) => {
		const store = new Map(Object.entries(kept))
		const attrs: Record<string, string> = {}
		const sessionStorage = {
			getItem: (k: string) => store.get(k) ?? null,
			removeItem: (k: string) => store.delete(k),
		}
		const performance = { getEntriesByType: () => [{ type: navigation }] }
		const document = {
			documentElement: {
				setAttribute: (k: string, v: string) => {
					attrs[k] = v
				},
			},
		}
		new Function(
			"sessionStorage",
			"performance",
			"document",
			introStartScript(10),
		)(sessionStorage, performance, document)
		return {
			store: Object.fromEntries(store),
			seen: attrs["data-gw-intro"] === "seen",
		}
	}
	const mid = {
		[PROGRESS_KEY]: JSON.stringify({ scene: 4 }),
		[TAPS_KEY]: "[1]",
	}

	it("forgets an unfinished film on a reload, so it starts over with the boot screen", () => {
		assert.deepEqual(run(mid, "reload"), { store: {}, seen: false })
	})
	it("keeps a finished film on a reload: left, or at the quiz", () => {
		for (const kept of [{ left: true }, { scene: 10 }]) {
			const raw = { [PROGRESS_KEY]: JSON.stringify(kept) }
			assert.deepEqual(run(raw, "reload"), { store: raw, seen: true })
		}
	})
	it("keeps the film where it was when the visitor comes back, and hides the boot screen", () => {
		for (const navigation of ["back_forward", "navigate"])
			assert.deepEqual(run(mid, navigation), { store: mid, seen: true })
	})
	it("shows the boot screen in a new tab", () => {
		assert.deepEqual(run({}, "navigate"), { store: {}, seen: false })
		assert.deepEqual(run({}, "reload"), { store: {}, seen: false })
	})
	it("stays small", () => {
		assert.ok(introStartScript(10).length < 400)
	})
})
