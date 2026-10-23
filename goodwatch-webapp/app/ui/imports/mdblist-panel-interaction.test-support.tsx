// The MDBList panel in happy-dom, inside a data router as in the app. A member pastes a key and submits; afterwards
// neither the field, the router's navigation or fetchers, nor the page address may hold the key.
import { Window } from "happy-dom"

const window = new Window({ url: "https://goodwatch.app/settings/imports" })
for (const key of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"HTMLInputElement",
	"HTMLFormElement",
	"Node",
	"Event",
	"FormData",
])
	Object.defineProperty(globalThis, key, {
		configurable: true,
		writable: true,
		value: (window as unknown as Record<string, unknown>)[key],
	})
;(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const KEY = "synthetic-key-0001"
const posts: { url: string; method: string; body: string; accept: string }[] =
	[]
let answer: () => Response = () => new Response("{}")
globalThis.fetch = (async (input: string, init?: RequestInit) => {
	posts.push({
		url: String(input),
		method: init?.method ?? "GET",
		body: String(init?.body ?? ""),
		accept: new Headers(init?.headers).get("Accept") ?? "",
	})
	return answer()
}) as typeof fetch

const { createElement: h, act } = await import("react")
const { createRoot } = await import("react-dom/client")
const { RouterProvider, createMemoryRouter } = await import("react-router-dom")
const { MdblistConnectPanel } = await import("./MdblistConnectPanel")

const settle = () =>
	act(async () => new Promise((resolve) => setTimeout(resolve, 30)))

async function run(response: () => Response) {
	answer = response
	posts.length = 0
	const router = createMemoryRouter(
		[{ path: "/settings/imports", element: h(MdblistConnectPanel) }],
		{ initialEntries: ["/settings/imports?source=mdblist"] },
	)
	const container = document.createElement("div")
	document.body.appendChild(container)
	const root = createRoot(container as unknown as Element)
	await act(async () => root.render(h(RouterProvider, { router })))
	const form = container.querySelector("form") as unknown as HTMLFormElement
	const field = container.querySelector(
		'input[name="apiKey"]',
	) as unknown as HTMLInputElement
	field.value = KEY
	const submitter = container.querySelector(
		'button[type="submit"]',
	) as unknown as HTMLElement
	// A browser's submit event bubbles to React's root listener; happy-dom's requestSubmit doesn't.
	const SubmitEvent = (window as unknown as { SubmitEvent: typeof Event })
		.SubmitEvent
	await act(async () => {
		form.dispatchEvent(
			new SubmitEvent("submit", {
				bubbles: true,
				cancelable: true,
				submitter,
			} as EventInit) as unknown as Event,
		)
	})
	for (let i = 0; i < 4; i++) await settle()
	const state = router.state
	const routerState = JSON.stringify({
		location: state.location,
		navigation: state.navigation,
		actionData: state.actionData,
		loaderData: state.loaderData,
		fetchers: [...state.fetchers.values()],
	})
	const result = {
		posts: posts.map((post) => ({
			...post,
			keyCount: new URLSearchParams(post.body).getAll("apiKey").length,
			body: post.body.includes(KEY) ? "has key" : post.body,
		})),
		field: field.value,
		formAction: form.getAttribute("action"),
		path: `${state.location.pathname}${state.location.search}`,
		navigationFormData: state.navigation.formData !== undefined,
		fetcherFormData: [...state.fetchers.values()].some(
			(fetcher) => fetcher.formData !== undefined,
		),
		keyInRouterState: routerState.includes(KEY),
		keyInPage: (container.innerHTML ?? "").includes(KEY),
		alert: container.querySelector('[role="alert"]')?.textContent ?? null,
	}
	await act(async () => root.unmount())
	return result
}

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	})
const results = {
	accepted: await run(() =>
		json({
			location:
				"/settings/imports?source=mdblist&import=00000000-0000-4000-8000-000000000001",
		}),
	),
	refused: await run(() =>
		json({ error: "MDBList didn't accept this API key." }, 400),
	),
}
process.stdout.write(`__MDBLIST_PANEL__${JSON.stringify(results)}`)
process.exit(0)
