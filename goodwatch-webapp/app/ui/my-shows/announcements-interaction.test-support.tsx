import assert from "node:assert/strict"
import { Window } from "happy-dom"
const browser = new Window({ url: "https://goodwatch.app/watch" })
for (const name of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"HTMLFormElement",
	"HTMLButtonElement",
	"Node",
	"Event",
	"MouseEvent",
	"FormData",
	"localStorage",
	"getComputedStyle",
])
	Object.defineProperty(globalThis, name, {
		configurable: true,
		writable: true,
		value: name === "window" ? browser : browser[name as keyof Window],
	})
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const { createElement: h, act } = await import("react")
const { createRoot } = await import("react-dom/client")
const { QueryClient, QueryClientProvider } = await import(
	"@tanstack/react-query"
)
const { createMemoryRouter, RouterProvider, Link, Outlet } = await import(
	"react-router-dom"
)
const { AuthContext } = await import("~/utils/auth")
const { getQueryKeyUserData } = await import("~/routes/api.user-data")
const { MyShowsPage } = await import("./MyShowsPage")
const { useNewEpisodesData } = await import("~/ui/navigation/useNewEpisodes")
const show = {
	id: 402,
	title: "Returning show",
	token: "show_release:402:1:200001",
	episodes: 10,
}
let pending = true
let visits = 0
const userData = {
	scores: {},
	wishlist: {},
	favorites: {},
	skipped: {},
	notInterested: {},
	watchState: {
		"show-402": {
			state: "seen",
			count: 10,
			episodesWatched: 10,
			pass: 1,
			furthest: [1, 10],
			watchedAt: null,
			lastActivityAt: null,
			watchingSince: null,
			precision: "unknown",
		},
	},
}
const summary = () => ({
	shows: pending ? 1 : 0,
	only: null,
	announcements: pending ? [show] : [],
})
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
	const url = String(input)
	if (url.startsWith("/api/new-episodes")) {
		if (init?.method === "POST") visits++
		return Response.json(summary())
	}
	if (url === "/api/user-data") return Response.json(userData)
	throw new Error(`Unexpected request: ${url}`)
}) as typeof fetch
const client = new QueryClient({
	defaultOptions: { queries: { retry: false } },
})
client.setQueryData(getQueryKeyUserData("member"), userData)
const row = {
	id: 402,
	title: show.title,
	poster_path: null,
	backdrop_path: null,
	state: "seen",
	kind: "seenNew",
	watched: 10,
	aired: 20,
	left: 10,
	running: true,
	furthest: [1, 10],
	lastActivityAt: null,
	watchingSince: null,
	activeAt: null,
	next: {
		season: 2,
		number: 1,
		name: "Return",
		airDate: "2026-10-07",
		runtime: 25,
	},
	upcoming: null,
}
function Shell() {
	const fresh = useNewEpisodesData()
	return (
		<>
			<span data-badge>{fresh?.shows ?? 0}</span>
			<Outlet />
		</>
	)
}
const router = createMemoryRouter(
	[
		{
			element: <Shell />,
			children: [
				{
					path: "/watch/shows",
					element: (
						<MyShowsPage
							data={
								{
									continue: [row],
									start: [],
									pickUp: [],
									waiting: [],
									onHold: [],
									dropped: [],
									total: 1,
								} as never
							}
							now={Date.parse("2026-10-08")}
							arrival={{
								since: { day: "2026-10-01", visited: true },
								titles: [show.title],
								announcements: [show],
							}}
						/>
					),
				},
				{
					path: "/show/:id",
					element: <Link to="/watch/shows">Back to My shows</Link>,
				},
				{
					path: "/api/new-episodes",
					action: async ({ request }) => {
						const form = await request.formData()
						assert.equal(form.get("intent"), "dismiss")
						assert.equal(form.get("token"), show.token)
						pending = false
						return { ok: true }
					},
				},
			],
		},
	],
	{ initialEntries: ["/watch/shows"] },
)
const container = document.createElement("div")
document.body.appendChild(container)
const root = createRoot(container as unknown as Element)
const settle = async () => {
	for (let i = 0; i < 8; i++)
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10))
		})
}
await act(async () =>
	root.render(
		h(
			AuthContext.Provider,
			{ value: { user: { id: "member" }, loading: false } as never },
			h(QueryClientProvider, { client }, h(RouterProvider, { router })),
		),
	),
)
await settle()
assert.ok(container.querySelector("[data-arrival]"))
assert.equal(container.querySelector("[data-badge]")?.textContent, "1")
assert.ok(!container.textContent?.includes("Continue comes first"))
assert.ok(visits > 0)
await act(async () => {
	await router.navigate("/show/402-returning-show")
})
await act(async () => {
	await router.navigate("/watch/shows")
})
await settle()
assert.ok(
	container.querySelector("[data-arrival]"),
	"opening details and returning must preserve the announcement",
)
const dismiss = container.querySelector<HTMLButtonElement>(
	"button[aria-label='Dismiss new episodes for Returning show']",
)
assert.ok(dismiss)
await act(async () => {
	dismiss.click()
})
await settle()
assert.equal(pending, false)
assert.equal(container.querySelector("[data-arrival]"), null)
assert.equal(container.querySelector("[data-badge]")?.textContent, "0")
assert.ok(
	container.textContent?.includes("Returning show"),
	"dismissal must leave the show in Continue",
)
await act(async () => {
	await router.navigate("/show/402-returning-show")
	await router.navigate("/watch/shows")
})
await settle()
assert.equal(
	container.querySelector("[data-arrival]"),
	null,
	"the dismissed announcement must stay gone after navigation",
)
await act(async () => root.unmount())
client.clear()
router.dispose()
await browser.happyDOM.abort()
console.log("__ANNOUNCEMENT_INTERACTION_PASSED__")
