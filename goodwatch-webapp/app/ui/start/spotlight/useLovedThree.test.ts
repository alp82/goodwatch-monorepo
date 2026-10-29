// useLovedThree.ts in React: For you waits for the beat and the picks of the three loved now, never the ones before.
import "../../../server/title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { Window } from "happy-dom"

const browser = new Window({ url: "http://localhost/" })
for (const key of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"Node",
	"Event",
	"localStorage",
	"sessionStorage",
])
	Object.defineProperty(globalThis, key, {
		configurable: true,
		writable: true,
		value: (browser as unknown as Record<string, unknown>)[key],
	})
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const { act, createElement } = await import("react")
const { createRoot } = await import("react-dom/client")
const { useLovedThree } = await import("./useLovedThree.ts")
type State = ReturnType<typeof useLovedThree>

const card = (id: number) =>
	({
		key: 1e12 + id,
		media_type: "movie",
		tmdb_id: id,
		title: `Title ${id}`,
		poster_path: `/p${id}.jpg`,
		backdrop_path: `/b${id}.jpg`,
	}) as unknown as Parameters<State["toggle"]>[0]

/** The featured pick's id, once the picks are ready. */
const topId = (s: State) =>
	s.picks?.status === "ready" ? s.picks.pick.top?.tmdb_id : undefined

test("undo and the same third title again: no picks of the round before, a fresh request", async (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	// Each round's picks lead with a different title; the second round's answer waits until released.
	let requests = 0
	let release = () => {}
	const held = new Promise<void>((r) => {
		release = r
	})
	t.mock.method(globalThis, "fetch", async (url: string) => {
		if (url.startsWith("/api/guest-recommendations")) {
			const round = ++requests
			if (round > 1) await held
			return Response.json({
				recommendations: [
					{ media_type: "movie", tmdb_id: 100 + round, match_percentage: 90 },
				],
			})
		}
		const id = Number(/movie:(\d+)/.exec(url)?.[1])
		return Response.json({ cards: [card(id)] })
	})

	let state = null as unknown as State
	function Probe() {
		state = useLovedThree()
		return null
	}
	const root = createRoot(document.createElement("div"))
	await act(() => root.render(createElement(Probe)))
	const flush = () => act(async () => {})

	for (const id of [1, 2, 3]) await act(() => void state.toggle(card(id)))
	await act(() => t.mock.timers.tick(450))
	await flush()
	assert.equal(state.done, true)
	assert.equal(topId(state), 101)

	await act(() => void state.toggle(card(3)))
	assert.equal(state.done, false)
	await act(() => void state.toggle(card(3)))
	assert.equal(state.done, false, "the beat runs again for the new three")
	assert.equal(state.picks, null)

	await act(() => t.mock.timers.tick(450))
	await flush()
	assert.equal(state.done, true)
	assert.deepEqual(
		state.picks,
		{ status: "loading" },
		"the old picks never show while the new ones load",
	)
	assert.equal(requests, 2, "a fresh request for the new three")

	release()
	await flush()
	await flush()
	assert.equal(topId(state), 102)
	await act(() => root.unmount())
})
