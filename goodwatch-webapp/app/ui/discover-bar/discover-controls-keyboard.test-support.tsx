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
const heldSignals: AbortSignal[] = []
globalThis.fetch = (async (input: string, init?: RequestInit) => {
	const url = new URL(String(input), "https://goodwatch.app")
	if (
		["Waiting", "Never"].includes(
			url.searchParams.get("query") ?? url.searchParams.get("text") ?? "",
		)
	) {
		const signal = init?.signal
		if (signal) heldSignals.push(signal)
		return new Promise<Response>((_resolve, reject) => {
			signal?.addEventListener("abort", () => reject(new Error("aborted")), {
				once: true,
			})
		})
	}
	if (url.pathname === "/api/cast")
		return new Response(
			JSON.stringify({
				castMembers: [
					{
						tmdb_id: 10,
						name: "A person",
						profile_path: null,
						known_for_department: "Acting",
					},
				],
			}),
			{
				headers: { "Content-Type": "application/json" },
			},
		)
	return new Response(
		String(input).includes("streaming-providers")
			? "[]"
			: String(input).includes("part=titles")
				? JSON.stringify({
						part: "titles",
						cards: [
							{
								key: "movie:42",
								title: "A title",
								release_year: 2020,
								poster_path: null,
							},
						],
					})
				: String(input).includes("/api/search?")
					? JSON.stringify({
							more: true,
							searchResults: Array.from({ length: 18 }, (_, id) => ({
								id,
								media_type: "movie",
								title: `Title ${id}`,
							})),
						})
					: "{}",
		{
			status: 200,
			headers: { "Content-Type": "application/json" },
		},
	)
}) as typeof fetch

const { act, createElement: h } = await import("react")
const { createRoot } = await import("react-dom/client")
const { QueryClient, QueryClientProvider } = await import(
	"@tanstack/react-query"
)
const { MemoryRouter } = await import("react-router-dom")
const { useFilterState } = await import("~/ui/filter-bar/useFilterState")
const { useDiscoverBar } = await import("./useDiscoverBar")
const { DiscoverControls } = await import("./DiscoverControls")
const { TitlesTab } = await import("./search/TitlesTab")
const { FindResults } = await import("./find/FindResults")
const { useQuickTitles } = await import("~/ui/filter-bar/FilterPickers")
const { moreCount } = await import("./search/search-tab")
let quickTitles: ReturnType<typeof useQuickTitles>
function QuickTitlesProbe() {
	quickTitles = useQuickTitles("Dune")
	return null
}

const DEFAULTS = { onMyServices: false, notSeenYet: false }
let observedState: unknown
function Page() {
	const filters = useFilterState({ defaults: DEFAULTS, member: false })
	observedState = filters.state
	const bar = useDiscoverBar(filters.state)
	return h(DiscoverControls, {
		bar,
		filters,
		counts: null,
		member: false,
		query: null,
		page: {
			scope: { country: "US", services: [] },
			ranked: null,
			cards: [],
			countsFresh: false,
			guest: null,
		},
		onSearch: () => {},
		onClearSearch: () => {},
		sort: { options: [], value: "popularity", onChange: () => {} },
		renderFind: (text, view, controls) =>
			h(FindResults, { text, view, controls }),
		renderSubTab: (id, view) =>
			id === "titles" ? h(TitlesTab, { view }) : undefined,
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
			h(
				MemoryRouter,
				{ initialEntries: ["/dev/discover-bar"] },
				h(Page),
				h(QuickTitlesProbe),
			),
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
const checkCombobox = async () => {
	const input = $("input[data-discover-search]")!
	await act(async () => input.focus())
	const gridId = input.getAttribute("aria-controls")
	const grid = gridId ? document.getElementById(gridId) : null
	const snapshot = () => {
		const id = input.getAttribute("aria-activedescendant")
		const row = id ? document.getElementById(id) : null
		return {
			id,
			role: row?.getAttribute("role"),
			selected: row?.getAttribute("aria-selected"),
			inGrid: Boolean(row && grid?.contains(row)),
			focused: document.activeElement === input,
		}
	}
	const before = snapshot()
	await press("ArrowDown")
	const first = snapshot()
	await press("ArrowDown")
	const second = snapshot()
	await press("ArrowUp")
	const back = snapshot()
	const toggles = Array.from(
		grid?.querySelectorAll<HTMLButtonElement>("button[aria-pressed]") ?? [],
	)
	results.combobox = {
		role: input.getAttribute("role"),
		expanded: input.getAttribute("aria-expanded"),
		popup: input.getAttribute("aria-haspopup"),
		gridRole: grid?.getAttribute("role"),
		before,
		first,
		second,
		back,
		togglesReachable:
			toggles.length === 3 &&
			toggles.every((button) => button.tabIndex === 0 && !button.disabled),
	}
}

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
	await checkCombobox()
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
	await checkCombobox()

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

// Find keeps ownership of both keyboard handling and ARIA after the outgoing animated tab leaves.
if (desktop) await click($('.lg\\:block [data-tab="mood"] button'))
else {
	await click($('.lg\\:hidden [data-tab="mood"]'))
	await click($('button[aria-label="Find in every tab"]'))
}
const findInput = () =>
	$('input[aria-label="Find in every tab"]') as HTMLInputElement
const typeFind = async (text: string) => {
	await act(async () => {
		const input = findInput()
		input.focus()
		Object.getOwnPropertyDescriptor(
			window.HTMLInputElement.prototype,
			"value",
		)!.set!.call(input, text)
		input.dispatchEvent(
			new window.Event("input", { bubbles: true }) as unknown as Event,
		)
	})
}
await typeFind("Netflix")
await wait()
if (desktop) await click($('.lg\\:block [data-tab="watch"] button'))
else await click($('[role=dialog] [role=tab][data-tab="watch"]'))
await wait()
const find = findInput()
await act(async () => find.focus())
await press("ArrowDown", find)
const findGrid = document.getElementById(
	find.getAttribute("aria-controls") ?? "",
)
const findRow = document.getElementById(
	find.getAttribute("aria-activedescendant") ?? "",
)
await press("Enter", find)
results.findAcrossTabs = {
	text: find.value,
	expanded: find.getAttribute("aria-expanded"),
	grid: findGrid?.getAttribute("role"),
	activeInGrid: Boolean(findRow && findGrid?.contains(findRow)),
	picked: Boolean(findRow?.querySelector('[aria-pressed="true"]')),
}

// The old query's rows are unavailable both before debounce and while the next request is pending.
await typeFind("Dune")
await wait()
await wait(60)
const hasSearchRows = () => {
	const grid = document.getElementById(
		findInput().getAttribute("aria-controls") ?? "",
	)
	return {
		title: Boolean(grid?.textContent?.includes("Title 0")),
		person: Boolean(grid?.textContent?.includes("A person")),
	}
}
const previousRowsShown = hasSearchRows()
const beforeStaleEnter = JSON.stringify(observedState)
await typeFind("Waiting")
const rowsDuringDebounce = hasSearchRows()
await press("Enter", findInput())
const debounceEnterUnchanged =
	JSON.stringify(observedState) === beforeStaleEnter
const rowsDuringLoad = hasSearchRows()
await press("ArrowDown", findInput())
await press("Enter", findInput())
const loadingEnterUnchanged = JSON.stringify(observedState) === beforeStaleEnter
await typeFind("Never")
await wait()
await typeFind("Resolved")
await wait()
await wait(60)
results.findFreshness = {
	previousRowsShown,
	rowsDuringDebounce,
	rowsDuringLoad,
	debounceEnterUnchanged,
	loadingEnterUnchanged,
	freshRowsShown: hasSearchRows(),
	obsoleteRequests: heldSignals.length,
	allAborted:
		heldSignals.length === 4 && heldSignals.every((signal) => signal.aborted),
}

results.quickTitles = {
	found: quickTitles!.found.length,
	full: quickTitles!.full,
	count: moreCount(4, quickTitles!.found.length, quickTitles!.full),
}
await act(async () => root.unmount())
process.stdout.write(`__DISCOVER_KEYS__${JSON.stringify(results)}`)
process.exit(0)
