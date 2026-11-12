// Discover's search hook and the label each request carries. A guest's search buys a reading only with an action label
// (domain/search-attribution.ts paidReadingAllowed): the hook must not invent one from a key change, and a search
// answered without a reading must degrade to its basic results, with no error and no request loop.
import assert from "node:assert/strict"
import { test } from "node:test"
import { Window } from "happy-dom"
import "../../server/title-filter/test-alias.ts"
import { streamAnswer } from "../search/search-test-answers.ts"

const browser = new Window({ url: "https://goodwatch.app/discover?q=heist+movies" })
for (const key of ["window", "document", "navigator", "HTMLElement", "Node"])
	Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: (browser as unknown as Record<string, unknown>)[key] })
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const { act, createElement } = await import("react")
const { createRoot } = await import("react-dom/client")
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query")
const { useDiscoverSearch } = await import("./useDiscoverSearch.ts")

type Props = Parameters<typeof useDiscoverSearch>[0]
type Hook = ReturnType<typeof useDiscoverSearch>

/** Mounts the hook; `fetch` answers each request with `answer()` and records the label it carried. */
function mount(t: { after: (fn: () => void) => void }, answer: () => Response) {
	const triggers: string[] = []
	const original = globalThis.fetch
	globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
		triggers.push(JSON.parse(String(init.body)).attribution?.trigger ?? "none")
		return answer()
	}) as typeof fetch
	const client = new QueryClient()
	const container = document.createElement("div")
	document.body.append(container)
	const root = createRoot(container)
	let hook!: Hook
	function Probe(props: Props) {
		hook = useDiscoverSearch(props)
		return null
	}
	const render = async (props: Props) => {
		await act(async () => root.render(createElement(QueryClientProvider, { client }, createElement(Probe, props))))
		// Let the stream, the query, and any effect it sets off settle.
		for (let i = 0; i < 20; i++) await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
	}
	t.after(() => {
		root.unmount()
		client.clear()
		globalThis.fetch = original
	})
	return { triggers, render, hook: () => hook }
}

const withheld = () =>
	streamAnswer({ kind: "batch", batch: { rows: [{ key: "movie:603" }], reading: [], errors: [], readingUnavailable: "navigation" } })
const read = () => streamAnswer({ kind: "batch", batch: { rows: [{ key: "movie:603" }], reading: [], errors: [] } })
const base = { q: "heist movies", filters: {}, allTitles: false, enabled: true } satisfies Props

test("hydration: a page loaded with ?q= searches as navigation and shows the basic results, once, with no error", async (t) => {
	const { triggers, render, hook } = mount(t, withheld)
	// What DiscoverPage passes on a page load: navigationSearchOrigin has no state of this page lifetime.
	await render({ ...base, attribution: { surface: "discover", trigger: "navigation" } })
	assert.deepEqual(triggers, ["navigation"])
	assert.equal(hook().current?.ranked.length, 1)
	assert.equal(hook().current?.readingWithheld, true)
	assert.equal(hook().error, null)
	assert.equal(hook().loading, false)
	// Renders that follow (the reading plan settling, the results arriving) ask nothing again.
	await render({ ...base, attribution: { surface: "discover", trigger: "navigation" } })
	await render({ ...base })
	assert.deepEqual(triggers, ["navigation"], "no retry loop on a withheld reading")
})

test("back/forward to an entry with other filters stays navigation; only the filter handlers' label is filter_change", async (t) => {
	const { triggers, render } = mount(t, withheld)
	await render({ ...base, attribution: { surface: "discover", trigger: "typing_pause" } })
	// POP: same words, other filters, and navigationSearchOrigin answers "navigation" for a POP.
	await render({ ...base, filters: { type: "movie" }, attribution: { surface: "discover", trigger: "navigation" } })
	// An automatic key change (here the read preferences) with the page's navigation label.
	await render({ ...base, filters: { type: "movie" }, preferences: { counted: ["years"] }, attribution: { surface: "discover", trigger: "navigation" } })
	// The person changes a filter: useFilterState's write puts filter_change in the history state.
	await render({ ...base, filters: { type: "show" }, attribution: { surface: "discover", trigger: "filter_change" } })
	assert.deepEqual(triggers, ["typing_pause", "navigation", "navigation", "filter_change"])
})

test("Enter on the words a link brought reads again once; a second withheld answer is kept", async (t) => {
	const { triggers, render, hook } = mount(t, withheld)
	await render({ ...base, attribution: { surface: "discover", trigger: "navigation" } })
	await render({ ...base, attribution: { surface: "discover", trigger: "enter" } })
	assert.deepEqual(triggers, ["navigation", "enter"])
	await render({ ...base, attribution: { surface: "discover", trigger: "enter" } })
	assert.deepEqual(triggers, ["navigation", "enter"], "once per search")
	assert.equal(hook().error, null)
	assert.equal(hook().current?.ranked.length, 1)
})

test("a guest who acted gets the reading's answer without a second request", async (t) => {
	const { triggers, render, hook } = mount(t, read)
	await render({ ...base, attribution: { surface: "discover", trigger: "enter" } })
	assert.deepEqual(triggers, ["enter"])
	assert.equal(hook().current?.readingWithheld, undefined)
})
