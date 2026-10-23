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
let answer: (signal?: AbortSignal) => Response | Promise<Response> = () =>
	new Response("{}")
const signals: (AbortSignal | undefined)[] = []
globalThis.fetch = (async (input: string, init?: RequestInit) => {
	signals.push(init?.signal ?? undefined)
	posts.push({
		url: String(input),
		method: init?.method ?? "GET",
		body: String(init?.body ?? ""),
		accept: new Headers(init?.headers).get("Accept") ?? "",
	})
	return answer(init?.signal ?? undefined)
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

/** Submits, then leaves the page while the read is still running. */
async function leave(response: (signal?: AbortSignal) => Promise<Response>) {
	answer = response
	posts.length = 0
	signals.length = 0
	const router = createMemoryRouter(
		[
			{ path: "/settings/imports", element: h(MdblistConnectPanel) },
			{ path: "/discover", element: h("p", null, "Elsewhere") },
		],
		{ initialEntries: ["/settings/imports?source=mdblist"] },
	)
	const container = document.createElement("div")
	document.body.appendChild(container)
	const root = createRoot(container as unknown as Element)
	await act(async () => root.render(h(RouterProvider, { router })))
	const form = container.querySelector("form") as unknown as HTMLFormElement
	;(
		container.querySelector(
			'input[name="apiKey"]',
		) as unknown as HTMLInputElement
	).value = KEY
	const SubmitEvent = (window as unknown as { SubmitEvent: typeof Event })
		.SubmitEvent
	await act(async () => {
		form.dispatchEvent(
			new SubmitEvent("submit", {
				bubbles: true,
				cancelable: true,
				submitter: container.querySelector('button[type="submit"]'),
			} as EventInit) as unknown as Event,
		)
	})
	await settle()
	// The member opens another page; the panel unmounts with the read still running.
	await act(async () => {
		await router.navigate("/discover")
	})
	await settle()
	const signal = signals[0]
	for (let i = 0; i < 4; i++) await settle()
	const result = {
		posts: posts.length,
		signalPassed: signal !== undefined,
		aborted: signal?.aborted ?? false,
		path: router.state.location.pathname,
		text: container.textContent,
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
	// A read that honors the abort, as undici and the browser do.
	left: await leave(
		(signal) =>
			new Promise<Response>((_resolve, reject) =>
				signal?.addEventListener("abort", () => reject(signal.reason), {
					once: true,
				}),
			),
	),
	// An answer that still arrives after the member left must not bring them back to Imports.
	late: await leave(
		() =>
			new Promise<Response>((resolve) =>
				setTimeout(
					() =>
						resolve(
							json({
								location:
									"/settings/imports?source=mdblist&import=00000000-0000-4000-8000-000000000002",
							}),
						),
					60,
				),
			),
	),
}
process.stdout.write(`__MDBLIST_PANEL__${JSON.stringify(results)}`)
process.exit(0)
