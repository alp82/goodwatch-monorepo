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
const { act, createElement: h, useRef } = await import("react")
const { createRoot } = await import("react-dom/client")
const { SnapSheet } = await import("~/ui/filter-bar/SnapSheet")
const { radioKeys } = await import("~/ui/filter-bar/controls")
const { useModalDialog } = await import("~/ui/filter-bar/useModalDialog")
const { PhoneSheet } = await import("./PhoneSheet")
// happy-dom has no layout; make displayed controls visible to the trap, as a browser would.
Object.defineProperty(window.HTMLElement.prototype, "offsetParent", {
	configurable: true,
	get() {
		return this.parentElement
	},
})
const container = document.createElement("div")
const outside = document.createElement("button")
outside.textContent = "Outside"
document.body.append(outside, container)
const root = createRoot(container)
const render = async (element: React.ReactNode) => {
	await act(async () => {
		root.render(element)
	})
	await act(async () => {
		await new Promise((resolve) => requestAnimationFrame(resolve))
	})
}
const key = async (key: string, shiftKey = false) => {
	const event = new window.KeyboardEvent("keydown", {
		key,
		shiftKey,
		bubbles: true,
		cancelable: true,
	})
	await act(async () => {
		document.activeElement?.dispatchEvent(event as unknown as Event)
	})
	return event.defaultPrevented
}
const button = (text: string, tabIndex = 0) =>
	h("button", { key: text, tabIndex }, text)
const results: Record<string, boolean> = {}

// Watch next's rejected Best match selection leaves focus on its negative-tabindex radio.
await render(
	h(
		SnapSheet,
		{
			index: 0,
			onIndex: () => {},
			label: "Sort",
			footer: button("Show"),
		},
		h(
			"div",
			{
				role: "radiogroup",
				onKeyDown: (event: React.KeyboardEvent<HTMLElement>) =>
					radioKeys(event, () => {}),
			},
			h(
				"button",
				{
					role: "radio",
					"aria-checked": false,
					"aria-disabled": true,
					tabIndex: -1,
				},
				"Best match",
			),
			h(
				"button",
				{ role: "radio", "aria-checked": true, tabIndex: 0 },
				"Waiting longest",
			),
		),
	),
)
const [best, waiting, show] = Array.from(container.querySelectorAll("button"))
waiting.focus()
await key("ArrowLeft")
assert.equal(document.activeElement, best)
assert.equal(best.tabIndex, -1)
assert.equal(waiting.getAttribute("aria-checked"), "true")
assert.equal(await key("Tab", true), true)
assert.equal(document.activeElement, show)
best.focus()
assert.equal(await key("Tab"), true)
assert.equal(document.activeElement, waiting)
results.unavailableRadio = true
waiting.focus()
assert.equal(await key("Tab", true), true)
assert.equal(document.activeElement, show)
assert.equal(await key("Tab"), true)
assert.equal(document.activeElement, waiting)
// Interior stops use the browser's normal Tab behavior.
assert.equal(await key("Tab"), false)
results.wrap = true

function Dialog({ empty = false }: { empty?: boolean }) {
	const panel = useRef<HTMLDivElement>(null)
	useModalDialog({ open: true, onClose: () => {}, container: panel })
	return h(
		"div",
		{ ref: panel, role: "dialog" },
		!empty && [
			button("First"),
			button("Middle", -1),
			button("Last"),
			button("After", -1),
		],
	)
}
await render(h(Dialog))
const [first, middle, last, after] = Array.from(
	container.querySelectorAll("button"),
)
middle.focus()
assert.equal(await key("Tab", true), true)
assert.equal(document.activeElement, first)
middle.focus()
assert.equal(await key("Tab"), true)
assert.equal(document.activeElement, last)
after.focus()
assert.equal(await key("Tab"), true)
assert.equal(document.activeElement, first)
after.focus()
assert.equal(await key("Tab", true), true)
assert.equal(document.activeElement, last)
results.domOrder = true
await render(null)
await render(h(Dialog, { empty: true }))
const dialog = container.querySelector('[role="dialog"]')
assert.equal(document.activeElement, dialog)
for (const shift of [false, true]) {
	outside.focus()
	assert.equal(await key("Tab", shift), true)
	assert.equal(document.activeElement, dialog)
	assert.equal(dialog?.getAttribute("tabindex"), "-1")
}
results.empty = true
await render(null)
assert.equal(dialog?.hasAttribute("tabindex"), false)

const html = document.documentElement
const body = document.body
html.style.overflowX = "clip"
html.style.overflowY = "scroll"
html.style.scrollbarGutter = "auto"
body.style.overflow = "auto"
body.style.color = "red"
const before = [html.style.cssText, body.style.cssText]
let position = { left: 12, top: 480 }
Object.defineProperties(window, {
	scrollX: { configurable: true, get: () => position.left },
	scrollY: { configurable: true, get: () => position.top },
	scrollTo: {
		configurable: true,
		value: (options: ScrollToOptions) => {
			position = {
				left: options.left ?? position.left,
				top: options.top ?? position.top,
			}
		},
	},
})
const sheet = (open: boolean) =>
	h(PhoneSheet, { open, onClose: () => {}, label: "Filters" }, button("Filter"))
await render(sheet(false))
assert.deepEqual([html.style.cssText, body.style.cssText], before)
for (const unmount of [false, true]) {
	position = { left: 12, top: 480 }
	await render(sheet(true))
	assert.equal(html.style.overflow, "hidden")
	assert.equal(body.style.overflow, "hidden")
	assert.equal(html.style.scrollbarGutter, "stable")
	assert.deepEqual(position, { left: 12, top: 480 })
	// Simulate a viewport/scroll change while the modal owns the page.
	position = { left: 0, top: 0 }
	await render(unmount ? null : sheet(false))
	assert.equal(html.style.overflowX, "clip")
	assert.equal(html.style.overflowY, "scroll")
	assert.equal(body.style.overflow, "auto")
	assert.equal(body.style.color, "red")
	assert.equal(html.style.scrollbarGutter, "auto")
	assert.deepEqual(position, { left: 12, top: 480 })
}
results.scroll = true
await act(async () => root.unmount())
process.stdout.write(`__MODAL_TESTS__${JSON.stringify(results)}`)
process.exit(0)
