// Run by related-map-cleanup.test.ts through vite-node: the real RelatedMap in happy-dom, under a memory data router whose
// loader answers with a late map (no picture, the browser asks for the pack). A test IntersectionObserver reports the
// section near at once; fetch records each request and never answers. Real timers: afterNavigationWork's first wait
// settles 400 ms (scrolls unwatched).
import { Window } from "happy-dom"

const window = new Window({ url: "https://goodwatch.app/movie/1" })
for (const key of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"Node",
	"Event",
	"MouseEvent",
	"getComputedStyle",
])
	Object.defineProperty(globalThis, key, {
		configurable: true,
		writable: true,
		value: (window as unknown as Record<string, unknown>)[key],
	})
;(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true
const fetched: string[] = []
const fetchStub = (url: unknown) => {
	fetched.push(String(url))
	return new Promise(() => {})
}
;(globalThis as Record<string, unknown>).fetch = fetchStub
;(window as unknown as Record<string, unknown>).fetch = fetchStub
class NearAtOnce {
	constructor(
		private readonly callback: (entries: { isIntersecting: boolean }[]) => void,
	) {}
	observe() {
		setTimeout(() => this.callback([{ isIntersecting: true }]), 0)
	}
	disconnect() {}
}
;(globalThis as Record<string, unknown>).IntersectionObserver = NearAtOnce
;(window as unknown as Record<string, unknown>).IntersectionObserver =
	NearAtOnce

const { act } = await import("react")
const { createRoot } = await import("react-dom/client")
const { createMemoryRouter, RouterProvider, useParams } = await import(
	"react-router-dom"
)
const { default: RelatedMap } = await import("./RelatedMap")

const media = (id: number) =>
	({
		mediaType: "movie",
		details: {
			tmdb_id: id,
			title: `Title ${id}`,
			canonical_title: `Title ${id}`,
			presentation: { title: { language: "en" } },
		},
	}) as unknown as Parameters<typeof RelatedMap>[0]["media"]
function Page() {
	const { id } = useParams()
	return <RelatedMap media={media(Number(id))} />
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const asked = (id: number) =>
	fetched.filter((url) => url.includes(`key=m${id}&`)).length

async function mount(id: number) {
	const router = createMemoryRouter(
		[
			{
				path: "/movie/:id",
				loader: () => ({
					relatedMap: { script: null, late: true, language: "en" },
				}),
				Component: Page,
			},
		],
		{ initialEntries: [`/movie/${id}`] },
	)
	const host = document.createElement("div")
	document.body.appendChild(host)
	const root = createRoot(host)
	await act(async () => {
		root.render(<RouterProvider router={router} />)
		await sleep(50)
	})
	return { router, root }
}

// Each change in its own act(), so that React applies it at once; the waiting happens outside.
// 1. Another title during the wait: no request for the first, one for the second.
const a = await mount(1)
await sleep(100)
await act(async () => {
	await a.router.navigate("/movie/2")
})
await sleep(1200)
const titleChange = { first: asked(1), second: asked(2) }

/** A reader's scroll: the waits that follow settle 400 ms after it. */
const scroll = () => document.dispatchEvent(new Event("scroll"))

// 2. The section goes during the wait (held by a scroll): no request.
scroll()
const b = await mount(3)
await sleep(100)
await act(async () => {
	b.root.unmount()
})
await sleep(1200)
const unmount = { asked: asked(3) }

// 3. The engine's wait (window.__gwRelatedMapDefer, held by a scroll) handed over on one title ends with the next
// title: it never runs.
scroll()
const c = await mount(5)
scroll()
let engineRan = 0
;(
	window as unknown as { __gwRelatedMapDefer: (run: () => void) => void }
).__gwRelatedMapDefer(() => {
	engineRan++
})
await sleep(100)
await act(async () => {
	await c.router.navigate("/movie/6")
})
await sleep(1200)
const engine = { ran: engineRan }

console.log(`__CLEANUP__${JSON.stringify({ titleChange, unmount, engine })}`)
