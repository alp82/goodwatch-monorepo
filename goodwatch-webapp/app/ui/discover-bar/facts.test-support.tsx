import assert from "node:assert/strict"
import { Window } from "happy-dom"

const desktop = false
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

// Every unexpected request fails: these are isolated UI unit tests.
globalThis.fetch = (() => {
	throw new Error("Unexpected network request")
}) as typeof fetch
const { act, createElement: h } = await import("react")
const { createRoot } = await import("react-dom/client")
const { defaultFilterState, filterStateFromParams, filterStateToParams } =
	await import("~/domain/filter-state")
const { useBarData } = await import("./useBarData")
const { BudgetTab } = await import("./watch/BudgetTab")
const { ShowsTab } = await import("./watch/ShowsTab")
const { MarkChip } = await import("./watch/glyph-tiles")
const { subTabBadge, tabBadge } = await import("./tabs")
import type { SubTabView } from "./DiscoverControls"
import type { FilterBarCounts } from "~/ui/filter-bar/types"
import type { FilterStateBinding } from "~/ui/filter-bar/useFilterState"

const state = {
	...defaultFilterState({ onMyServices: false, notSeenYet: false }),
	budget: { min: 100 },
	boxOffice: { min: 100 },
	returns: "hit" as const,
	seasons: { min: 1, max: 1 },
	showStatus: "running" as const,
	hours: { min: 100 },
	votes: { min: 100000 },
}
const filters: FilterStateBinding = {
	state,
	update: () => {},
	sort: "popular",
	defaults: { onMyServices: false, notSeenYet: false },
	searching: false,
	secondaryCount: 7,
	query: "",
	set: () => {},
	setSort: () => {},
	drop: () => {},
	clearSecondary: () => {},
}
let counts: FilterBarCounts | null = null
let data: ReturnType<typeof useBarData>
function Harness() {
	data = useBarData({ filters, counts, member: true, query: null })
	// These tabs read only the filter binding, data, counts and phone width.
	const view = { filters, data, counts, phone: true } as SubTabView
	return (
		<>
			<BudgetTab view={view} />
			<ShowsTab view={view} />
		</>
	)
}
const container = document.createElement("div")
document.body.append(container)
const root = createRoot(container)
const render = async (next: FilterBarCounts | null) => {
	counts = next
	await act(async () => root.render(h(Harness)))
}
const response = (facts?: boolean): FilterBarCounts => ({
	facts,
	total: 100,
	hidden: 0,
	recoveries: [],
	optionCounts: {
		services: {},
		notSeenYet: {},
		type: {},
		anime: {},
		moods: {},
		themes: {},
		styles: {},
		genres: {},
		minScore: {},
		minMatch: {},
		released: {},
		similarTo: {},
		people: {},
		legacy: {},
		loved: {},
		disliked: {},
		ageLimit: {},
		content: {},
		wishlist: {},
		tasteGroups: {},
	},
})
const check = (available: boolean) => {
	assert.equal(
		container.querySelectorAll('[aria-pressed="true"]').length,
		available ? 6 : 0,
	)
	assert.equal(data.chips.length, available ? 7 : 1)
	assert.equal(subTabBadge("budget", state, data.context), available ? 3 : 0)
	assert.equal(subTabBadge("shows", state, data.context), available ? 3 : 0)
	assert.equal(tabBadge("watch", state, data.context), available ? 7 : 1)
	assert.equal(data.clearCount, available ? 7 : 1)
	assert.equal(data.values.watch.badge, available ? 7 : 1)
	assert.equal(data.values.watch.value?.includes("$100M"), available)
}
const url = filterStateToParams(state, {
	onMyServices: false,
	notSeenYet: false,
}).toString()
await render(null)
check(true) // Unknown availability preserves the existing default.
await render(response(false))
check(false)
await render(null)
check(false) // No flash of applied choices while the next response is pending.
await render(response(true))
check(true)
await render(null)
check(true)
await render(response(false))
check(false)
await render(response())
check(true) // An omitted facts property on a new response replaces the last false.
assert.equal(
	filterStateToParams(state, {
		onMyServices: false,
		notSeenYet: false,
	}).toString(),
	url,
)
const restored = filterStateFromParams(new URLSearchParams(url), {
	onMyServices: false,
	notSeenYet: false,
})
for (const field of [
	"budget",
	"boxOffice",
	"returns",
	"seasons",
	"showStatus",
	"hours",
] as const)
	assert.deepEqual(restored[field], state[field])

// A fixed slot and hidden placeholder remain identical for unknown, zero and large counts.
let slotMarkup: string | undefined
for (const count of [null, 0, 123, 12345, 1_234_567]) {
	await act(async () =>
		root.render(
			h(MarkChip, {
				label: "Running",
				status: "running",
				count,
				active: false,
				onClick: () => {},
			}),
		),
	)
	const placeholder = container.querySelector('[aria-hidden="true"].invisible')
	assert.ok(placeholder)
	const slot = placeholder.parentElement!
	assert.ok(slot.classList.contains("w-[6ch]"))
	assert.ok(slot.classList.contains("shrink-0"))
	const geometry = `${slot.className}:${placeholder.outerHTML}`
	if (slotMarkup !== undefined) assert.equal(geometry, slotMarkup)
	slotMarkup = geometry
	assert.equal(slot.children.length, 2)
}
await act(async () => root.unmount())
await window.happyDOM.close()
