// Exercise the real committed router state and ScrollRestoration, without loading any application route or service.
import assert from "node:assert/strict"
import { Window } from "happy-dom"
const browser = new Window({ url: "https://goodwatch.app/" })
for (const key of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"Element",
	"Node",
	"sessionStorage",
])
	Object.defineProperty(globalThis, key, {
		configurable: true,
		value: browser[key as keyof Window],
	})
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const frames = new Map<number, FrameRequestCallback>()
let next = 0
let scrollY = 400
let flushes = 0
let rootStyleWrites = 0
const mutations = new browser.MutationObserver((records) => {
	rootStyleWrites += records.length
})
mutations.observe(browser.document.documentElement, {
	attributes: true,
	attributeFilter: ["style"],
})
const calls: { kind: string; y?: number; behavior: string }[] = []
Object.assign(globalThis, {
	requestAnimationFrame: (callback: FrameRequestCallback) => {
		const id = ++next
		frames.set(id, callback)
		return id
	},
	cancelAnimationFrame: (id: number) => {
		frames.delete(id)
	},
	getComputedStyle: (element: Element) => {
		flushes++
		return browser.getComputedStyle(element as never)
	},
})
Object.defineProperty(browser, "scrollY", { get: () => scrollY })
Object.defineProperty(browser, "scrollTo", {
	value: (_x: number, y: number) => {
		calls.push({
			kind: "position",
			y,
			behavior: document.documentElement.style.scrollBehavior,
		})
		scrollY = y
	},
})
Object.defineProperty(browser.HTMLElement.prototype, "scrollIntoView", {
	value: () => {
		calls.push({
			kind: "hash",
			behavior: document.documentElement.style.scrollBehavior,
		})
	},
})
const { act } = await import("react")
const { createRoot } = await import("react-dom/client")
const { createMemoryRouter, RouterProvider, ScrollRestoration, Outlet } =
	await import("react-router-dom")
const { InstantRouteScroll } = await import("./InstantRouteScroll")
function Layout() {
	return (
		<>
			<InstantRouteScroll />
			<ScrollRestoration />
			<div id="target" />
			<Outlet />
		</>
	)
}
const router = createMemoryRouter(
	[
		{
			element: <Layout />,
			children: [
				{ path: "/", element: <p>Start page</p> },
				{ path: "/other", element: <p>Another page</p> },
			],
		},
	],
	{ initialEntries: ["/"] },
)
const host = document.createElement("div")
document.body.append(host)
const root = createRoot(host)
const frame = () =>
	act(() => {
		const pending = [...frames.values()]
		frames.clear()
		for (const callback of pending) callback(performance.now())
	})
const rest = async () => {
	await frame()
	await frame()
}
const navigate = async (
	to: string | number,
	options?: { replace?: boolean; preventScrollReset?: boolean },
) => {
	await act(async () => {
		if (typeof to === "number") await router.navigate(to)
		else await router.navigate(to, options)
	})
}
try {
	await act(() => root.render(<RouterProvider router={router} />))
	calls.length = 0
	flushes = 0
	rootStyleWrites = 0
	scrollY = 400
	await navigate("/?q=first", { replace: true, preventScrollReset: true })
	await navigate("/?q=second", { replace: true, preventScrollReset: true })
	assert.equal(
		flushes,
		0,
		"preserving query replacements never write/flush the root style",
	)
	assert.equal(
		rootStyleWrites,
		0,
		"preserving query replacements emit no root style mutations",
	)
	assert.deepEqual(calls, [], "the router keeps the existing scroll")
	assert.equal(scrollY, 400)
	assert.equal(frames.size, 0)

	await navigate("/?q=reset")
	assert.equal(flushes, 1)
	assert.deepEqual(calls.at(-1), { kind: "position", y: 0, behavior: "auto" })
	await rest()
	assert.equal(document.documentElement.style.scrollBehavior, "")

	// Two distinct history entries can have exactly the same path/query. POP must still restore their offsets.
	scrollY = 250
	await navigate("/?q=reset", { preventScrollReset: true })
	scrollY = 750
	calls.length = 0
	await navigate(-1)
	assert.deepEqual(calls.at(-1), { kind: "position", y: 250, behavior: "auto" })
	await rest()

	const beforeHash = flushes
	calls.length = 0
	await navigate("/?q=reset#target")
	assert.equal(
		flushes,
		beforeHash,
		"hash-only navigation keeps smooth scrolling",
	)
	assert.deepEqual(calls.at(-1), { kind: "hash", behavior: "" })
	await navigate("/?q=changed#target", { preventScrollReset: true })
	assert.deepEqual(
		calls.at(-1),
		{ kind: "hash", behavior: "auto" },
		"a query navigation with a hash still jumps to its target",
	)
	await rest()

	await navigate("/other", { preventScrollReset: true })
	assert.equal(
		document.documentElement.style.scrollBehavior,
		"auto",
		"a real route keeps its arrival effects instant",
	)
	await frame()
	assert.equal(frames.size, 1)
	await navigate("/?q=rapid")
	assert.equal(
		frames.size,
		1,
		"rapid navigation cancels the previous nested restoration frame",
	)
	await frame()
	assert.equal(
		document.documentElement.style.scrollBehavior,
		"auto",
		"the old frame cannot clear the new route's override",
	)
	await rest()
	assert.equal(document.documentElement.style.scrollBehavior, "")

	document.documentElement.style.setProperty(
		"scroll-behavior",
		"smooth",
		"important",
	)
	await navigate("/other")
	assert.equal(document.documentElement.style.scrollBehavior, "auto")
	await frame()
	await act(() => root.unmount())
	assert.equal(frames.size, 0, "unmount cancels both restoration frames")
	assert.equal(document.documentElement.style.scrollBehavior, "smooth")
	assert.equal(
		document.documentElement.style.getPropertyPriority("scroll-behavior"),
		"important",
	)
	console.log("__INSTANT_ROUTE_SCROLL_OK__")
} finally {
	mutations.disconnect()
	router.dispose()
	await browser.happyDOM.close()
}
