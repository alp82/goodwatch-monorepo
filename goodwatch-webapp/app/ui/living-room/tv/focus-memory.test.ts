import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
	FOCUS_STORAGE_KEY,
	type FocusStorage,
	MAX_ENTRIES,
	createFocusMemory,
	focusKey,
	tabFocusMemory,
} from "./focus-memory.ts"

/** A `sessionStorage` stand-in that counts its writes. */
function fakeStorage(initial: Record<string, string> = {}) {
	const values = new Map(Object.entries(initial))
	const storage = {
		writes: 0,
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => {
			storage.writes++
			values.set(key, value)
		},
	}
	return storage
}

const blocked: FocusStorage = {
	getItem: () => {
		throw new Error("blocked")
	},
	setItem: () => {
		throw new Error("full")
	},
}

describe("the focus of a history entry", () => {
	it("is given back for the entry it was remembered under", () => {
		const memory = createFocusMemory()
		memory.remember("a", "mood:funny")
		memory.remember("b", "expand")
		assert.equal(memory.recall("a"), "mood:funny")
		assert.equal(memory.recall("b"), "expand")
		assert.equal(memory.recall("c"), null)
	})

	it("is replaced by a later one, and forgotten with null", () => {
		const memory = createFocusMemory()
		memory.remember("a", "watch")
		memory.remember("a", "seen")
		assert.equal(memory.recall("a"), "seen")
		memory.remember("a", null)
		assert.equal(memory.recall("a"), null)
	})

	it("goes before the link's focus, which goes before nothing", () => {
		const memory = createFocusMemory()
		memory.remember("a", "expand")
		assert.equal(memory.recall("a", "watch"), "expand")
		assert.equal(memory.recall("b", "watch"), "watch")
		assert.equal(memory.recall("b", null), null)
	})
})

describe("a history entry's name", () => {
	it("is the router's key with the entry's query", () => {
		assert.equal(
			focusKey({ key: "k3f9a", search: "?tv=discover&mood=funny" }),
			"k3f9a?tv=discover&mood=funny",
		)
	})

	it("tells the first entries of two documents apart, which share the key `default`", () => {
		const memory = createFocusMemory()
		memory.remember(
			focusKey({ key: "default", search: "?tv=tonight" }),
			"expand",
		)
		assert.equal(
			memory.recall(focusKey({ key: "default", search: "?tv=discover" })),
			null,
		)
		assert.equal(
			memory.recall(focusKey({ key: "default", search: "?tv=tonight" })),
			"expand",
		)
	})
})

describe("in sessionStorage", () => {
	it("survives a reload: a new memory over the same storage recalls it", () => {
		const storage = fakeStorage()
		const before = createFocusMemory(storage)
		before.remember("a", "expand")
		before.remember("b", "title:movie-1")
		const after = createFocusMemory(storage)
		assert.equal(after.recall("a"), "expand")
		assert.equal(after.recall("b"), "title:movie-1")
	})

	it("writes once per remembered focus and never on a recall", () => {
		const storage = fakeStorage()
		const memory = createFocusMemory(storage)
		memory.recall("a")
		assert.equal(storage.writes, 0)
		memory.remember("a", "expand")
		memory.recall("a")
		assert.equal(storage.writes, 1)
		assert.deepEqual(JSON.parse(storage.getItem(FOCUS_STORAGE_KEY) ?? ""), [
			["a", "expand"],
		])
	})

	it("does not read the storage before its first use", () => {
		let reads = 0
		createFocusMemory({
			getItem: () => {
				reads++
				return null
			},
			setItem: () => {},
		})
		assert.equal(reads, 0)
	})

	it("remembers for the life of the page when the storage is blocked or full", () => {
		const memory = createFocusMemory(blocked)
		memory.remember("a", "expand")
		assert.equal(memory.recall("a"), "expand")
	})

	it("starts empty over a value it did not write", () => {
		for (const stored of [
			"not json",
			'{"a":"expand"}',
			"[1,2]",
			"null",
			'[["a",7]]',
		]) {
			const memory = createFocusMemory(
				fakeStorage({ [FOCUS_STORAGE_KEY]: stored }),
			)
			assert.equal(memory.recall("a"), null, stored)
			memory.remember("b", "watch")
			assert.equal(memory.recall("b"), "watch", stored)
		}
	})

	it("keeps the entries remembered last and lets the oldest go", () => {
		const storage = fakeStorage()
		const memory = createFocusMemory(storage)
		for (let n = 0; n < MAX_ENTRIES; n++) memory.remember(`e${n}`, "watch")
		// Remembered again, the first entry is the newest.
		memory.remember("e0", "seen")
		memory.remember("one-more", "expand")
		assert.equal(memory.recall("e0"), "seen")
		assert.equal(memory.recall("e1"), null)
		assert.equal(memory.recall("e2"), "watch")
		assert.equal(memory.recall("one-more"), "expand")
		assert.equal(
			JSON.parse(storage.getItem(FOCUS_STORAGE_KEY) ?? "").length,
			MAX_ENTRIES,
		)
	})
})

describe("the tab's memory", () => {
	const browser = globalThis as { window?: unknown }
	/** The module again, with its own shared memory: the tab's memory is made once per page. */
	const freshModule = (page: string) =>
		import(`./focus-memory.ts?${page}`) as Promise<
			typeof import("./focus-memory.ts")
		>

	it("on the server is empty for every caller", () => {
		tabFocusMemory().remember("a", "expand")
		assert.equal(tabFocusMemory().recall("a"), null)
	})

	it("in the browser is one memory over the tab's sessionStorage", async () => {
		const sessionStorage = fakeStorage()
		browser.window = { sessionStorage }
		try {
			const tab = await freshModule("tab")
			tab.tabFocusMemory().remember("a", "expand")
			assert.equal(tab.tabFocusMemory().recall("a"), "expand")
			assert.equal(sessionStorage.writes, 1)
		} finally {
			browser.window = undefined
		}
	})

	it("works where reading sessionStorage throws", async () => {
		browser.window = {
			get sessionStorage(): never {
				throw new Error("SecurityError")
			},
		}
		try {
			const tab = await freshModule("blocked")
			tab.tabFocusMemory().remember("a", "expand")
			assert.equal(tab.tabFocusMemory().recall("a"), "expand")
		} finally {
			browser.window = undefined
		}
	})
})
