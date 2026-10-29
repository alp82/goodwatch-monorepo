// The Discover controls in happy-dom, as a guest with a stand-in network: where focus goes when the panel or the
// phone sheet closes, and the tab lists' keys. DISCOVER_WIDTH picks desktop ("desktop") or phone ("phone"). Prints
// one result per check.
import { Window } from "happy-dom"

const desktop = process.env.DISCOVER_WIDTH !== "phone"
const window = new Window({ url: "https://goodwatch.app/dev/discover-bar" })
// Desktop width when asked; reduced motion so the panel and the sheet open and close without waiting on springs.
const matchMedia = (query: string) => ({
	matches: query.includes("min-width: 1024px")
		? desktop
		: query.includes("prefers-reduced-motion"),
	media: query,
	addEventListener: () => {},
	removeEventListener: () => {},
	addListener: () => {},
	removeListener: () => {},
	onchange: null,
	dispatchEvent: () => false,
})
Object.defineProperty(window, "matchMedia", { value: matchMedia })
// Motion runs its own frames instead of happy-dom's Web Animations, which reject when canceled.
for (const proto of [window.Element.prototype, window.HTMLElement.prototype])
	Reflect.deleteProperty(proto, "animate")
for (const key of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"HTMLInputElement",
	"HTMLButtonElement",
	"Element",
	"SVGElement",
	"Node",
	"MutationObserver",
	"IntersectionObserver",
	"Event",
	"KeyboardEvent",
	"MouseEvent",
	"PointerEvent",
	"getComputedStyle",
	"requestAnimationFrame",
	"cancelAnimationFrame",
	"ResizeObserver",
	"sessionStorage",
	"localStorage",
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
// Lists for the streaming services, an empty object for everything else.
globalThis.fetch = (async (input: string) =>
	new Response(String(input).includes("streaming-providers") ? "[]" : "{}", {
		status: 200,
		headers: { "Content-Type": "application/json" },
	})) as typeof fetch

const { act, createElement: h } = await import("react")
const { createRoot } = await import("react-dom/client")
const { QueryClient, QueryClientProvider } = await import(
	"@tanstack/react-query"
)
const { MemoryRouter } = await import("react-router-dom")
const { useFilterState } = await import("~/ui/filter-bar/useFilterState")
const { useDiscoverBar } = await import("./useDiscoverBar")
const { DiscoverControls } = await import("./DiscoverControls")

const DEFAULTS = { onMyServices: false, notSeenYet: false }
function Page() {
	const filters = useFilterState({ defaults: DEFAULTS, member: false })
	const bar = useDiscoverBar(filters.state)
	return h(DiscoverControls, {
		bar,
		filters,
		counts: null,
		member: false,
		query: null,
		onSearch: () => {},
		onClearSearch: () => {},
		sort: { options: [], value: "popularity", onChange: () => {} },
	})
}

const container = document.createElement("div")
document.body.appendChild(container)
const outside = document.createElement("button")
outside.textContent = "Outside"
document.body.appendChild(outside)
const root = createRoot(container)
const client = new QueryClient({
	defaultOptions: { queries: { retry: false } },
})
await act(async () => {
	root.render(
		h(
			QueryClientProvider,
			{ client },
			h(MemoryRouter, { initialEntries: ["/dev/discover-bar"] }, h(Page)),
		),
	)
})

const wait = (ms = 400) =>
	act(async () => new Promise((resolve) => setTimeout(resolve, ms)))
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
	document.querySelector<T>(selector)
const press = async (key: string, target = document.activeElement) => {
	await act(async () => {
		target?.dispatchEvent(
			new window.KeyboardEvent("keydown", {
				key,
				bubbles: true,
				cancelable: true,
			}) as unknown as Event,
		)
	})
	await wait()
}
const click = async (el: HTMLElement | null) => {
	await act(async () => {
		el?.focus()
		el?.click()
	})
	await wait()
}
/** What has focus, as a short description. */
const focused = () => {
	const el = document.activeElement as HTMLElement | null
	if (!el || el === document.body) return "body"
	const tab = el.closest<HTMLElement>("[data-tab]")?.dataset.tab
	return [
		el.tagName.toLowerCase(),
		el.getAttribute("role"),
		el.getAttribute("aria-label"),
		el.dataset.subTab && `sub:${el.dataset.subTab}`,
		tab && `tab:${tab}`,
		el.textContent?.trim().slice(0, 20),
	]
		.filter(Boolean)
		.join(" ")
}
/** The tab lists: every tab's tab stop, selection and the panel it controls. */
const tabList = (list: HTMLElement | null) =>
	Array.from(list?.querySelectorAll<HTMLElement>("[role=tab]") ?? []).map(
		(tab) => {
			const panel = tab.getAttribute("aria-controls")
			const target = panel ? document.getElementById(panel) : null
			return {
				id: tab.dataset.subTab ?? tab.dataset.tab,
				tabIndex: tab.tabIndex,
				selected: tab.getAttribute("aria-selected") === "true",
				panelRole: target?.getAttribute("role") ?? null,
				panelLabelledBy:
					target?.getAttribute("aria-labelledby") === tab.id ? "this" : null,
			}
		},
	)
const results: Record<string, unknown> = {}

if (desktop) {
	const pill = (tab: string) =>
		$(`.lg\\:block [data-tab="${tab}"] button`) as HTMLElement
	const panelOpen = () => Boolean($(".lg\\:block [role=dialog]"))

	// Escape returns focus to the pill that opened the panel.
	await click(pill("mood"))
	results.moodOpen = panelOpen()
	await press("Escape")
	results.escapeClosed = !panelOpen()
	results.afterEscape = focused()

	// Escape in the Search field returns focus to the Search segment.
	await click(pill("search"))
	await wait(60)
	results.searchFocus = focused()
	await press("Escape")
	results.searchClosed = !panelOpen()
	results.afterSearchEscape = focused()

	// Show returns focus to the pill of the open tab.
	await click(pill("watch"))
	const show = Array.from(
		document.querySelectorAll<HTMLElement>(".lg\\:block [role=dialog] button"),
	).find((b) => /^Show\b/.test(b.textContent?.trim() ?? ""))
	results.showFound = Boolean(show)
	await click(show ?? null)
	results.showClosed = !panelOpen()
	results.afterShow = focused()

	// A press outside keeps the pressed control's focus.
	await click(pill("you"))
	await act(async () => {
		outside.focus()
		outside.dispatchEvent(
			new window.PointerEvent("pointerdown", {
				bubbles: true,
			}) as unknown as Event,
		)
	})
	await wait()
	results.outsideClosed = !panelOpen()
	results.afterOutside = focused()

	// The sub-tabs: one tab stop, arrows move and open, each controls the tab panel.
	await click(pill("watch"))
	const list = $(".lg\\:block [role=dialog] [role=tablist]")
	results.subTabsBefore = tabList(list)
	const active = list?.querySelector<HTMLElement>('[tabindex="0"]')
	active?.focus()
	await press("ArrowRight")
	results.afterRight = focused()
	results.subTabsAfterRight = tabList(
		$(".lg\\:block [role=dialog] [role=tablist]"),
	)
	await press("End")
	results.afterEnd = focused()
	await press("Home")
	results.afterHome = focused()
	await press("ArrowLeft")
	results.afterLeft = focused()
	await press("Escape")
	results.afterTabsEscape = focused()
} else {
	const sheet = () => $('[role=dialog][aria-label="Filters"]')
	const sheetOpen = () => sheet()?.getAttribute("aria-hidden") === "false"
	const opener = $('.lg\\:hidden [data-tab="mood"]') as HTMLElement

	await click(opener)
	await wait(60)
	results.sheetOpen = sheetOpen()
	results.sheetFocus = focused()
	results.mainTabs = tabList(sheet()?.querySelector("[role=tablist]") ?? null)

	// The sheet's tabs: arrows move and open.
	await press("ArrowRight")
	results.afterRight = focused()
	await press("Home")
	results.afterHome = focused()

	// Phone Find: Cancel and Escape on an empty field return focus to the magnifier.
	const magnifier = () =>
		sheet()?.querySelector<HTMLElement>(
			'button[aria-label="Find in every tab"]',
		) ?? null
	await click(magnifier())
	await wait(60)
	results.findFocus = focused()
	const cancel = Array.from(
		sheet()?.querySelectorAll<HTMLElement>("button") ?? [],
	).find((b) => b.textContent?.trim() === "Cancel")
	await click(cancel ?? null)
	results.afterCancel = focused()
	await click(magnifier())
	await wait(60)
	results.findFocusAgain = focused()
	await press("Escape")
	results.afterFindEscape = focused()
	results.sheetStillOpen = sheetOpen()

	// Escape closes the sheet and returns focus to the bar button that opened it.
	await press("Escape")
	await wait(80)
	results.sheetClosed = !sheetOpen()
	results.afterSheetEscape = focused()
	results.openerWas = opener.dataset.tab
}

await act(async () => root.unmount())
process.stdout.write(`__DISCOVER_KEYS__${JSON.stringify(results)}`)
process.exit(0)
