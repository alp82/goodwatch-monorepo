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

/** The client root.tsx makes in the browser: answers stay fresh for a minute, so a remount reads them from the cache. */
const productionClient = () => new QueryClient({ defaultOptions: { queries: { staleTime: 60 * 1000 } } })

/** Mounts the hook; `fetch` answers each request with `answer()` and records the label it carried. */
function mount(
	t: { after: (fn: () => void) => void },
	answer: (init: RequestInit) => Response | Promise<Response>,
	client = new QueryClient(),
) {
	const triggers: string[] = []
	const original = globalThis.fetch
	globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
		triggers.push(JSON.parse(String(init.body)).attribution?.trigger ?? "none")
		return answer(init)
	}) as typeof fetch
	const container = document.createElement("div")
	document.body.append(container)
	let root = createRoot(container)
	let hook!: Hook
	function Probe(props: Props) {
		hook = useDiscoverSearch(props)
		return null
	}
	const settle = async () => {
		// Let the stream, the query, and any effect it sets off settle.
		for (let i = 0; i < 20; i++) await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
	}
	const render = async (props: Props) => {
		await act(async () => root.render(createElement(QueryClientProvider, { client }, createElement(Probe, props))))
		await settle()
	}
	/** Discover leaves and comes back (a title page's tag link): a new mount on the same query cache. */
	const remount = async (props: Props) => {
		await act(async () => root.unmount())
		root = createRoot(container)
		await render(props)
	}
	t.after(() => {
		root.unmount()
		client.clear()
		globalThis.fetch = original
	})
	return { triggers, render, remount, hook: () => hook }
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

test("a remount on a cached withheld answer: a title tag's link reads once, back/forward reads nothing", async (t) => {
	const { triggers, render, remount, hook } = mount(t, withheld, productionClient())
	await render({ ...base, attribution: { surface: "discover", trigger: "navigation" } })
	// Back to Discover by back/forward within the freshness window: the cached basic results, no request.
	await remount({ ...base, attribution: { surface: "discover", trigger: "navigation" } })
	assert.deepEqual(triggers, ["navigation"])
	assert.equal(hook().current?.readingWithheld, true)
	// The person clicks a title page's tag that links to the same search: the cached answer was asked by no action.
	await remount({ ...base, attribution: { surface: "title_tag", trigger: "link" } })
	assert.deepEqual(triggers, ["navigation", "link"])
	// The answer to that action is cached as asked by one: withheld again, it is kept, on this mount and the next.
	await render({ ...base, attribution: { surface: "title_tag", trigger: "link" } })
	await remount({ ...base, attribution: { surface: "title_tag", trigger: "link" } })
	await remount({ ...base, attribution: { surface: "discover", trigger: "navigation" } })
	assert.deepEqual(triggers, ["navigation", "link"], "once per withheld answer")
	assert.equal(hook().error, null)
})

test("A, then B, then cached A: returning by navigation reads nothing, an action on A reads once", async (t) => {
	const { triggers, render, hook } = mount(t, withheld, productionClient())
	const a = { ...base, q: "heist movies" }
	const b = { ...base, q: "space operas" }
	await render({ ...a, attribution: { surface: "discover", trigger: "navigation" } })
	await render({ ...b, attribution: { surface: "discover", trigger: "navigation" } })
	await render({ ...a, attribution: { surface: "discover", trigger: "navigation" } })
	assert.deepEqual(triggers, ["navigation", "navigation"], "A comes from the cache")
	assert.equal(hook().current?.q, "heist movies")
	// The person presses Enter on A's words.
	await render({ ...a, attribution: { surface: "discover", trigger: "enter" } })
	assert.deepEqual(triggers, ["navigation", "navigation", "enter"])
	// Back to B and forward to A again: both cached, A's answer now asked by an action.
	await render({ ...b, attribution: { surface: "discover", trigger: "navigation" } })
	await render({ ...a, attribution: { surface: "discover", trigger: "navigation" } })
	await render({ ...a, attribution: { surface: "discover", trigger: "enter" } })
	assert.deepEqual(triggers, ["navigation", "navigation", "enter"])
})

test("hydration with the production client: a cached answer from a link stays basic until the person acts", async (t) => {
	const { triggers, render, remount } = mount(t, withheld, productionClient())
	await render({ ...base, attribution: { surface: "discover", trigger: "navigation" } })
	await remount({ ...base, attribution: { surface: "discover", trigger: "unknown" } })
	assert.deepEqual(triggers, ["navigation"], "an unknown label is no action")
})

test("the unlock is the cached answer's: A, Enter on A, B, A expires, a fresh withheld A by navigation, Enter on A reads once", async (t) => {
	const client = productionClient()
	const { triggers, render, hook } = mount(t, withheld, client)
	const a = { ...base, q: "heist movies" }
	const b = { ...base, q: "space operas" }
	await render({ ...a, attribution: { surface: "discover", trigger: "navigation" } })
	await render({ ...a, attribution: { surface: "discover", trigger: "enter" } })
	await render({ ...b, attribution: { surface: "discover", trigger: "navigation" } })
	assert.deepEqual(triggers, ["navigation", "enter", "navigation"])
	// A's answer leaves the cache: its garbage collection time passed.
	client.removeQueries({ predicate: (query) => String(query.queryKey[1]).includes("heist movies") })
	await render({ ...a, attribution: { surface: "discover", trigger: "navigation" } })
	assert.deepEqual(triggers, ["navigation", "enter", "navigation", "navigation"], "the fresh answer is asked by navigation")
	assert.equal(hook().current?.readingWithheld, true)
	await render({ ...a, attribution: { surface: "discover", trigger: "enter" } })
	assert.deepEqual(triggers, ["navigation", "enter", "navigation", "navigation", "enter"], "Enter on the fresh answer reads")
	await render({ ...a, attribution: { surface: "discover", trigger: "enter" } })
	assert.equal(triggers.length, 5, "once per answer")
	assert.equal(hook().error, null)
})

test("a canceled unlock: Enter on A, B before it answers, back to A by navigation reads nothing, Enter on A reads again", async (t) => {
	// The action's request never answers until it is canceled; every other request answers withheld.
	const answer = (init: RequestInit) => {
		const trigger = JSON.parse(String(init.body)).attribution?.trigger
		if (trigger !== "enter" || hanging++ > 0) return withheld()
		return new Promise<Response>((_resolve, reject) =>
			init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))),
		)
	}
	let hanging = 0
	const { triggers, render, hook } = mount(t, answer, productionClient())
	const a = { ...base, q: "heist movies" }
	const b = { ...base, q: "space operas" }
	await render({ ...a, attribution: { surface: "discover", trigger: "navigation" } })
	await render({ ...a, attribution: { surface: "discover", trigger: "enter" } })
	assert.deepEqual(triggers, ["navigation", "enter"])
	assert.equal(hook().loading, true)
	await render({ ...b, attribution: { surface: "discover", trigger: "navigation" } })
	await render({ ...a, attribution: { surface: "discover", trigger: "navigation" } })
	assert.deepEqual(triggers, ["navigation", "enter", "navigation"], "the cached withheld A, by navigation: no request")
	assert.equal(hook().current?.readingWithheld, true)
	await render({ ...a, attribution: { surface: "discover", trigger: "enter" } })
	assert.deepEqual(triggers, ["navigation", "enter", "navigation", "enter"], "the person's Enter reads")
	await render({ ...a, attribution: { surface: "discover", trigger: "enter" } })
	assert.equal(triggers.length, 4, "once per answer")
	assert.equal(hook().error, null)
})

test("an unlock that fails keeps the withheld answer and asks nothing again by itself", async (t) => {
	const answer = (init: RequestInit) =>
		JSON.parse(String(init.body)).attribution?.trigger === "enter" ? Promise.reject(new TypeError("offline")) : withheld()
	const { triggers, render, hook } = mount(t, answer, productionClient())
	await render({ ...base, attribution: { surface: "discover", trigger: "navigation" } })
	await render({ ...base, attribution: { surface: "discover", trigger: "enter" } })
	await render({ ...base, attribution: { surface: "discover", trigger: "enter" } })
	assert.deepEqual(triggers, ["navigation", "enter"], "no request loop on a failed unlock")
	assert.equal(hook().current?.readingWithheld, true)
})
