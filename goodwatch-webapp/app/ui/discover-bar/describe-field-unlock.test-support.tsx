// Discover's search field over Discover's search, as a guest who opened a link to /discover?q=…: the page load searches
// as "navigation" and the answer comes back without a reading. Enter or the Search button on the same words is the
// person's action; it must reach the search with its label so the reading runs, once. A typing pause on the same
// words sends nothing. The wiring is DiscoverPage's: the words and the label go into the URL's history state
// (searchNavigationState), the label is read back with navigationSearchOrigin. SUBMIT picks "enter" or "button".
// Prints the labels the requests carried.
import { Window } from "happy-dom"

const window = new Window({
	url: "https://goodwatch.app/discover?q=heist+movies",
})
const matchMedia = (query: string) => ({
	matches: query.includes("prefers-reduced-motion"),
	media: query,
	addEventListener: () => {},
	removeEventListener: () => {},
	addListener: () => {},
	removeListener: () => {},
	onchange: null,
	dispatchEvent: () => false,
})
Object.defineProperty(window, "matchMedia", { value: matchMedia })
for (const key of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"HTMLInputElement",
	"HTMLButtonElement",
	"HTMLFormElement",
	"Element",
	"SVGElement",
	"Node",
	"Event",
	"KeyboardEvent",
	"MouseEvent",
	"getComputedStyle",
	"requestAnimationFrame",
	"cancelAnimationFrame",
	"matchMedia",
])
	Object.defineProperty(globalThis, key, {
		configurable: true,
		writable: true,
		value: (window as unknown as Record<string, unknown>)[key],
	})
;(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

// Every search answers without a reading, as the store does for a guest asked without an action. A reading bought by
// the action may come back withheld too (here it always does): nothing may ask again after that.
const triggers: string[] = []
globalThis.fetch = (async (_input: string, init?: RequestInit) => {
	triggers.push(
		JSON.parse(String(init?.body ?? "{}")).attribution?.trigger ?? "none",
	)
	const batch = {
		rows: [{ key: "movie:603" }],
		reading: [],
		errors: [],
		readingUnavailable: "navigation",
	}
	return new Response(`${JSON.stringify({ kind: "batch", batch })}\n`, {
		headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
	})
}) as typeof fetch

const { act, createElement: h } = await import("react")
const { createRoot } = await import("react-dom/client")
const { QueryClient, QueryClientProvider } = await import(
	"@tanstack/react-query"
)
const { MemoryRouter, useLocation, useNavigationType, useSearchParams } =
	await import("react-router-dom")
const { searchText } = await import("~/domain/discover-search")
const { navigationSearchOrigin, searchNavigationState } = await import(
	"~/ui/search/search-attribution"
)
const { useDiscoverSearch } = await import("~/ui/discover/useDiscoverSearch")
const { DescribeField } = await import("./DescribeField")
type SearchTrigger = import("~/domain/search-attribution").SearchTrigger

let withheld: boolean | undefined
function Page() {
	const [params, setParams] = useSearchParams()
	const typed = searchText(params.get("q"))
	const location = useLocation()
	const navigation = useNavigationType()
	const attribution = navigationSearchOrigin(typed, location.state, navigation)
	const search = useDiscoverSearch({
		q: typed,
		filters: {},
		allTitles: false,
		enabled: true,
		attribution,
	})
	withheld = search.current?.readingWithheld
	// DiscoverPage's onSearch, for a search already in the URL.
	const onSearch = (text: string, trigger: SearchTrigger) =>
		setParams(
			(previous) => {
				const out = new URLSearchParams(previous)
				out.set("q", text)
				return out
			},
			{
				replace: true,
				preventScrollReset: true,
				state: searchNavigationState(text, "discover", trigger),
			},
		)
	return h(DescribeField, {
		typed: typed ?? "",
		onSearch,
		onClear: () => {},
		flatBottom: false,
		ready: null,
	})
}

const settle = async (ms = 0) => {
	await act(async () => new Promise((resolve) => setTimeout(resolve, ms)))
	for (let i = 0; i < 20; i++)
		await act(() => new Promise((resolve) => setTimeout(resolve, 0)))
}
const container = document.createElement("div")
document.body.appendChild(container)
const root = createRoot(container)
const client = new QueryClient({
	defaultOptions: { queries: { staleTime: 60 * 1000 } },
})
// The MemoryRouter's first entry is a POP, as a page load is.
await act(async () => {
	root.render(
		h(
			QueryClientProvider,
			{ client },
			h(
				MemoryRouter,
				{ initialEntries: ["/discover?q=heist+movies"] },
				h(Page),
			),
		),
	)
})
await settle()
const results: Record<string, unknown> = {
	afterLoad: [...triggers],
	withheldAfterLoad: withheld,
}

const input = document.querySelector<HTMLInputElement>("input[type=search]")!
const form = document.querySelector<HTMLFormElement>("form[role=search]")!
const button = document.querySelector<HTMLButtonElement>("button[type=submit]")!
// React tracks the input's value itself: set it through the native setter so onChange sees the change.
const typeText = async (value: string) => {
	await act(async () => {
		Object.getOwnPropertyDescriptor(
			window.HTMLInputElement.prototype,
			"value",
		)!.set!.call(input, value)
		input.dispatchEvent(
			new window.Event("input", { bubbles: true }) as unknown as Event,
		)
	})
}
// A typing pause on the same words: an edit and back, then the pause.
await typeText("heist movie")
await typeText("heist movies")
await settle(700)
results.afterSamePause = [...triggers]

const submit = async () => {
	await act(async () => {
		if (process.env.SUBMIT === "button") button.click()
		else {
			input.dispatchEvent(
				new window.KeyboardEvent("keydown", {
					key: "Enter",
					bubbles: true,
				}) as unknown as Event,
			)
			// Enter in a field submits through the form's default button (implicit submission).
			form.requestSubmit(button)
		}
	})
	await settle()
}
await submit()
results.afterSubmit = [...triggers]
results.withheldAfterSubmit = withheld
// The action's answer came back withheld again: a second submit is the same action, nothing reads again.
await submit()
results.afterSecondSubmit = [...triggers]

await act(async () => root.unmount())
process.stdout.write(`__DESCRIBE_UNLOCK__${JSON.stringify(results)}`)
process.exit(0)
