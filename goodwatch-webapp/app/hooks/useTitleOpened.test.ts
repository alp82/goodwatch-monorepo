import "../server/title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { Window } from "happy-dom"

const browser = new Window({ url: "https://goodwatch.app/movie/10679-test" })
for (const key of ["window", "document", "navigator", "HTMLElement", "Node", "sessionStorage"]) {
	Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: (browser as unknown as Record<string, unknown>)[key] })
}
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const { act, createElement } = await import("react")
const { createRoot } = await import("react-dom/client")
const { useTitleOpened } = await import("./useTitleOpened.ts")

function Title({ id, active = true }: { id: number; active?: boolean }) {
	useTitleOpened("movie", id, active)
	return createElement("h1", null, "Title without a poster")
}

test("mounted title without a poster sends opened demand; covered/prefetched titles do not; collection failure leaves browsing intact", async t => {
	t.mock.timers.enable({ apis: ["setTimeout", "Date"] })
	const calls: unknown[] = []
	t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
		calls.push(JSON.parse(String(options.body)))
		throw new TypeError("offline")
	})
	Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
	const container = document.createElement("div")
	document.body.append(container)
	const root = createRoot(container)
	await act(() => root.render(createElement(Title, { id: 10679, active: false })))
	t.mock.timers.tick(10000)
	assert.equal(calls.length, 0, "loading an obscured or inactive TV title is not opening it")
	await act(() => root.render(createElement(Title, { id: 10679 })))
	t.mock.timers.tick(999)
	assert.equal(calls.length, 0)
	t.mock.timers.tick(1)
	t.mock.timers.tick(1000)
	assert.deepEqual((calls[0] as { items: unknown }).items, [{ media_type: "movie", tmdb_id: 10679, source_kind: "opened" }])
	await act(() => root.render(createElement(Title, { id: 10679, active: false })))
	t.mock.timers.tick(30 * 60 * 1000)
	await act(() => root.render(createElement(Title, { id: 10679 })))
	t.mock.timers.tick(1000)
	t.mock.timers.tick(1000)
	assert.equal(calls.length, 2, "reopening after thirty minutes is accepted")
	assert.equal(container.textContent, "Title without a poster", "a failed demand request leaves the title visible")
	await act(() => root.render(createElement(Title, { id: 658039 })))
	t.mock.timers.tick(900)
	await act(() => root.unmount())
	t.mock.timers.tick(2000)
	assert.equal(calls.length, 2, "a view left before one second cannot count")
})
