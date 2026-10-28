// The shelf cover's flip (cover-flip.ts) in a browser-like DOM: a change taken back during the first half-flip turns
// the cover back to face the guest instead of leaving it edge-on.
import assert from "node:assert/strict"
import { test } from "node:test"
import { Window } from "happy-dom"

const browser = new Window()
for (const key of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"Node",
	"requestAnimationFrame",
	"cancelAnimationFrame",
]) {
	Object.defineProperty(globalThis, key, {
		configurable: true,
		writable: true,
		value: (browser as unknown as Record<string, unknown>)[key],
	})
}
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const { act, createElement } = await import("react")
const { createRoot } = await import("react-dom/client")
const { HALF_FLIP_MS, keyOf, useCoverFlip } = await import("./cover-flip.ts")

type T = { media_type: string; tmdb_id: number }
const A: T = { media_type: "movie", tmdb_id: 1 }
const B: T = { media_type: "movie", tmdb_id: 2 }

let seen: { shown: string | null; flip: string | null } = {
	shown: null,
	flip: null,
}
function Cover({ title }: { title: T }) {
	const { shown, flip } = useCoverFlip(title, 0, () => null)
	seen = { shown: keyOf(shown), flip }
	return null
}

test("A → B → A during the first half-flip leaves the cover facing out with A", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	const root = createRoot(document.createElement("div"))
	await act(() => root.render(createElement(Cover, { title: A })))
	assert.deepEqual(seen, { shown: "movie:1", flip: null })

	await act(() => root.render(createElement(Cover, { title: B })))
	// The flip starts 60 ms in (order 0): edge-on, still showing A.
	await act(() => t.mock.timers.tick(60))
	assert.deepEqual(seen, { shown: "movie:1", flip: "out" })

	// Taken back before the swap.
	await act(() => root.render(createElement(Cover, { title: A })))
	await act(() => t.mock.timers.tick(HALF_FLIP_MS * 4))
	assert.deepEqual(seen, { shown: "movie:1", flip: null })
	await act(() => root.unmount())
})

test("A → B flips through and lands on B", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	const root = createRoot(document.createElement("div"))
	await act(() => root.render(createElement(Cover, { title: A })))
	await act(() => root.render(createElement(Cover, { title: B })))
	await act(() => t.mock.timers.tick(60 + HALF_FLIP_MS))
	assert.equal(seen.shown, "movie:2")
	await act(() => root.unmount())
})
