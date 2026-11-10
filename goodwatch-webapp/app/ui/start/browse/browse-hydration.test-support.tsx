// Force the same React selective-hydration path as an early pointerdown; measure no timings in happy-dom.
import assert from "node:assert/strict"
import { Window } from "happy-dom"
import type { To } from "react-router-dom"
import type { StartBrowseData } from "./browse-data"
const browser = new Window({ url: "https://goodwatch.app/" })
browser.matchMedia = ((media: string) => ({
	matches: false,
	media,
})) as typeof browser.matchMedia
const { act } = await import("react")
const { hydrateRoot } = await import("react-dom/client")
const { renderToString } = await import("react-dom/server")
const { MemoryRouter, Router, createPath } = await import("react-router-dom")
const serverNavigator = {
	createHref: (to: To) => (typeof to === "string" ? to : createPath(to)),
	go() {},
	push() {},
	replace() {},
}
const { StartBrowse } = await import("./StartBrowse")
const { EMPTY_BROWSE } = await import("./browse-data")
let reads = 0
let handled = 0
const data: StartBrowseData = {
	...EMPTY_BROWSE,
	get top() {
		reads++
		return EMPTY_BROWSE.top
	},
	genres: { movie: [{ name: "Drama", path: "drama", titles: [] }], show: [] },
}
function Page({ server = false }: { server?: boolean }) {
	const content = (
		<>
			<input aria-label="Search" onPointerDown={() => handled++} />
			<StartBrowse data={data} />
		</>
	)
	return server ? (
		<Router location="/" navigator={serverNavigator} static>
			{content}
		</Router>
	) : (
		<MemoryRouter>{content}</MemoryRouter>
	)
}
const html = renderToString(<Page server />)
for (const key of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"Element",
	"Node",
	"requestAnimationFrame",
	"cancelAnimationFrame",
])
	Object.defineProperty(globalThis, key, {
		configurable: true,
		value: browser[key as keyof Window],
	})
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const host = document.createElement("div")
document.body.append(host)
assert.match(html, /Where to start/)
assert.match(html, /href="\/movies\/genres\/drama"/)
assert.match(html, /href="\/discover"/)
host.innerHTML = html
const section = host.querySelector(".sb")
const genre = host.querySelector<HTMLAnchorElement>(
	'a[href="/movies/genres/drama"]',
)
const search = host.querySelector<HTMLInputElement>("input")
assert.ok(section && genre && search)
const serverReads = reads
const recoveries: unknown[] = []
let root: ReturnType<typeof hydrateRoot> | undefined
try {
	// Dispatch before yielding to React's hydration scheduler, as an early user event can do.
	await act(() => {
		root = hydrateRoot(host, <Page />, {
			onRecoverableError: (error) => recoveries.push(error),
		})
		search.dispatchEvent(
			new browser.PointerEvent("pointerdown", {
				bubbles: true,
			}) as unknown as Event,
		)
		assert.equal(handled, 1, "the search's actual React handler runs")
		assert.equal(
			reads,
			serverReads,
			"the search event leaves Browse's dehydrated boundary alone",
		)
		assert.equal(
			host.querySelector(".sb"),
			section,
			"server Browse content stays in place",
		)
	})
	await act(async () => {})
	assert.ok(reads > serverReads, "Browse hydrates independently afterwards")
	assert.equal(host.querySelector(".sb"), section)
	await act(async () => genre.click())
	assert.ok(
		genre.hasAttribute("data-on"),
		"hydrated Browse's genre control works",
	)
	assert.deepEqual(recoveries, [])
	await act(async () => root?.unmount())
	console.log("__BROWSE_HYDRATION_PASSED__")
} finally {
	await browser.happyDOM.close()
}
