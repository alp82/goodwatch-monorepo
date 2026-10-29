// The opening's gate (boot-gate.ts): once per browser session, decided before the first paint, and a tap that skips
// to the hand-off. The inline script runs here in a bare context with the browser parts it uses.
import assert from "node:assert/strict"
import { test } from "node:test"
import { runInNewContext } from "node:vm"
import {
	BOOT_SEEN_KEY,
	GATE_MARK,
	GATE_SCRIPT,
	HANDOFF_MS,
	HANDOFF_REDUCED_MS,
	bootDecision,
	skipOnClientMount,
} from "./boot-gate.ts"

function memoryStore(initial: Record<string, string> = {}) {
	const data = new Map(Object.entries(initial))
	return {
		data,
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => void data.set(key, value),
	}
}

test("the session's first load plays the opening and notes the visit; later loads skip it", () => {
	const store = memoryStore()
	assert.equal(
		bootDecision(() => store),
		"play",
	)
	assert.equal(store.data.get(BOOT_SEEN_KEY), "1")
	assert.equal(
		bootDecision(() => store),
		"skip",
	)
	assert.equal(
		bootDecision(() => store),
		"skip",
	)
})

test("without storage the opening plays", () => {
	assert.equal(
		bootDecision(() => null),
		"play",
	)
	assert.equal(
		bootDecision(() => {
			throw new Error("blocked")
		}),
		"play",
	)
	const full = {
		getItem: () => null,
		setItem: () => {
			throw new Error("quota")
		},
	}
	assert.equal(
		bootDecision(() => full),
		"play",
	)
})

test("a client-side visit never plays it and counts the session as seen; a box the script decided stays", () => {
	const store = memoryStore()
	const box = { checked: false } as HTMLInputElement
	skipOnClientMount(box, () => store)
	assert.equal(box.checked, true)
	assert.equal(store.data.get(BOOT_SEEN_KEY), "1")

	const played = {
		checked: false,
		[GATE_MARK]: "play",
	} as unknown as HTMLInputElement
	skipOnClientMount(played, () => store)
	assert.equal(played.checked, false)
	skipOnClientMount(null, () => store)
})

type FakeAnimation = { animationName: string; currentTime: number | null }

function runGate({
	storage,
	reduced = false,
	animations = [],
	getAnimations = true,
}: {
	storage: ReturnType<typeof memoryStore> | null
	reduced?: boolean
	animations?: FakeAnimation[]
	getAnimations?: boolean
}) {
	const box: Record<string, unknown> = { checked: false }
	const listeners = new Map<string, () => void>()
	const timers: (() => void)[] = []
	const window = {
		matchMedia: (q: string) => ({
			matches: reduced && q.includes("reduce"),
		}),
		addEventListener: (type: string, fn: () => void, capture: boolean) => {
			assert.equal(capture, true)
			listeners.set(type, fn)
		},
		removeEventListener: (type: string, fn: () => void) => {
			if (listeners.get(type) === fn) listeners.delete(type)
		},
	}
	const document = {
		currentScript: { previousElementSibling: box },
		...(getAnimations ? { getAnimations: () => animations } : {}),
	}
	runInNewContext(GATE_SCRIPT, {
		window,
		document,
		setTimeout: (fn: () => void) => timers.push(fn),
		get sessionStorage() {
			if (!storage) throw new Error("blocked")
			return storage
		},
	})
	return { box, listeners, timers }
}

test("the inline script decides as bootDecision does, on the box before it", () => {
	const store = memoryStore()
	const first = runGate({ storage: store })
	assert.equal(first.box.checked, false)
	assert.equal(first.box[GATE_MARK], "play")
	assert.equal(store.data.get(BOOT_SEEN_KEY), "1")

	const again = runGate({ storage: store })
	assert.equal(again.box.checked, true)
	assert.equal(again.box[GATE_MARK], "skip")
	// A returning visitor has nothing to skip.
	assert.equal(again.listeners.size, 0)

	const blocked = runGate({ storage: null })
	assert.equal(blocked.box.checked, false)
	assert.equal(blocked.box[GATE_MARK], "play")
})

test("a tap or a key moves the opening's animations to the hand-off, never back, and only once", () => {
	const animations: FakeAnimation[] = [
		{ animationName: "start-open-header-slide", currentTime: 300 },
		{ animationName: "boot-turn", currentTime: 300 },
		{ animationName: "start-open-camera", currentTime: null },
		{ animationName: "start-open-boot-out", currentTime: 1700 },
		// Not the opening's: the page's own animations go on as they are.
		{ animationName: "shelf-flip", currentTime: 300 },
	]
	const run = runGate({ storage: memoryStore(), animations })
	assert.deepEqual([...run.listeners.keys()].sort(), ["keydown", "pointerdown"])
	run.listeners.get("pointerdown")?.()
	assert.deepEqual(
		animations.map((a) => a.currentTime),
		[HANDOFF_MS, HANDOFF_MS, null, 1700, 300],
	)
	assert.equal(run.listeners.size, 0)
})

test("with reduced motion the skip goes to the shorter hand-off; the listeners end after the opening", () => {
	const animations: FakeAnimation[] = [
		{ animationName: "start-open-boot-out", currentTime: 100 },
	]
	const run = runGate({ storage: memoryStore(), reduced: true, animations })
	run.listeners.get("keydown")?.()
	assert.equal(animations[0].currentTime, HANDOFF_REDUCED_MS)

	const late = runGate({ storage: memoryStore() })
	assert.equal(late.listeners.size, 2)
	for (const fn of late.timers) fn()
	assert.equal(late.listeners.size, 0)
})

test("a browser without getAnimations plays the opening without the skip", () => {
	const run = runGate({ storage: memoryStore(), getAnimations: false })
	assert.equal(run.box.checked, false)
	assert.equal(run.listeners.size, 0)
})
