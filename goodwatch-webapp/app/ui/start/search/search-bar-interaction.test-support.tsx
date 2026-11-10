// The real field and query hook; no search retrieval or interpretation requests run in this harness.
import assert from "node:assert/strict"
import { mock } from "node:test"
import { Window } from "happy-dom"

const browser = new Window({ url: "https://goodwatch.app/" })
for (const key of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"Element",
	"Node",
])
	Object.defineProperty(globalThis, key, {
		configurable: true,
		value: browser[key as keyof Window],
	})
Object.assign(globalThis, {
	IS_REACT_ACT_ENVIRONMENT: true,
	matchMedia: () => ({ matches: true }),
	fetch: () => {
		throw new Error("Search tests must not request the backend")
	},
})
const frames = new Map<number, FrameRequestCallback>()
let nextFrame = 0
Object.defineProperty(browser, "requestAnimationFrame", {
	value: (callback: FrameRequestCallback) => {
		const id = ++nextFrame
		frames.set(id, callback)
		return id
	},
})
Object.defineProperty(browser, "cancelAnimationFrame", {
	value: (id: number) => {
		frames.delete(id)
	},
})

const { act } = await import("react")
const { createRoot } = await import("react-dom/client")
const { createMemoryRouter, RouterProvider } = await import("react-router-dom")
const { StartSearchBar } = await import("./StartSearchBar")
const { useStartQuery } = await import("../stage/useStartQuery")
const { IDLE_RESULTS } = await import("../stage/start-query")
let start: ReturnType<typeof useStartQuery> | undefined
const current = () => {
	assert.ok(start)
	return start
}
let renders = 0
let asks = 0
const choices: string[] = []
function Page() {
	renders += 1
	start = useStartQuery({ onChoice: (action) => choices.push(action.type) })
	return (
		<StartSearchBar
			query={start.query}
			results={IDLE_RESULTS}
			searchRevision={start.searchRevision}
			search={start.search}
			clearSearch={start.clearSearch}
			onAsk={() => asks++}
		/>
	)
}
const router = createMemoryRouter([{ path: "/", element: <Page /> }], {
	initialEntries: ["/?q=earlier&moods=funny", "/?moods=scary"],
	initialIndex: 1,
})
const host = document.createElement("div")
document.body.append(host)
const root = createRoot(host)
const find = <T extends Element>(selector: string) => {
	const found = host.querySelector<T>(selector)
	assert.ok(found, selector)
	return found
}
const input = () => find<HTMLInputElement>("input")
const type = async (value: string) =>
	act(async () => {
		// Bypass React's value tracker, as native input does, then dispatch the actual input event.
		const setter = Object.getOwnPropertyDescriptor(
			browser.HTMLInputElement.prototype,
			"value",
		)?.set
		assert.ok(setter)
		setter.call(input(), value)
		input().dispatchEvent(
			new browser.Event("input", { bubbles: true }) as unknown as Event,
		)
	})
const submit = () =>
	act(async () => {
		find<HTMLFormElement>("form").dispatchEvent(
			new browser.Event("submit", {
				bubbles: true,
				cancelable: true,
			}) as unknown as Event,
		)
	})
const clear = async () => {
	const field = input()
	await act(async () => {
		field.focus()
		const button = find<HTMLButtonElement>('[aria-label="Clear the search"]')
		const down = new browser.MouseEvent("mousedown", {
			bubbles: true,
			cancelable: true,
			button: 0,
		})
		button.dispatchEvent(down as unknown as Event)
		assert.equal(
			down.defaultPrevented,
			true,
			"a pointer press keeps the input's focus",
		)
		assert.equal(document.activeElement, field)
		const secondary = new browser.MouseEvent("mousedown", {
			bubbles: true,
			cancelable: true,
			button: 2,
		})
		button.dispatchEvent(secondary as unknown as Event)
		assert.equal(
			secondary.defaultPrevented,
			false,
			"secondary mouse actions keep their default behavior",
		)
		button.click()
	})
	assert.equal(field.value, "", "the pointer click still clears immediately")
	assert.equal(document.activeElement, field)
}
const advance = (ms: number) => act(async () => mock.timers.tick(ms))
const frame = () =>
	act(async () => {
		const callbacks = [...frames.values()]
		frames.clear()
		for (const callback of callbacks) callback(performance.now())
	})
const paint = async () => {
	await frame()
	await advance(0)
}

try {
	await act(async () => root.render(<RouterProvider router={router} />))
	mock.timers.enable({ apis: ["setTimeout"] })
	const initialRenders = renders
	await type("f")
	await type("funny")
	assert.equal(input().value, "funny")
	assert.equal(
		renders,
		initialRenders,
		"keystrokes never render the page that owns the query",
	)
	assert.equal(current().query.text, "")
	assert.equal(current().query.draft, "")
	assert.equal(router.state.location.search, "?moods=scary")
	await advance(799)
	assert.equal(current().query.text, "")
	await advance(1)
	await act(async () => {
		await import("./SearchInterpretation")
	})
	assert.equal(current().query.text, "funny")
	assert.deepEqual(current().query.picks, ["m:scary"])
	assert.equal(
		new URLSearchParams(router.state.location.search).get("q"),
		null,
		"the query commits before its URL write",
	)
	await frame()
	assert.equal(
		new URLSearchParams(router.state.location.search).get("q"),
		null,
		"the animation frame only schedules a task after paint",
	)
	await advance(0)
	assert.equal(
		new URLSearchParams(router.state.location.search).get("q"),
		"funny",
	)
	assert.deepEqual(choices, ["search"])
	assert.equal(asks, 0, "the pause doesn't open the card")

	await type("space adventure")
	await act(async () => current().setPicks(["m:funny"]))
	assert.equal(
		input().value,
		"space adventure",
		"a mood choice keeps the live draft",
	)
	await submit()
	assert.equal(current().query.text, "space adventure")
	assert.equal(asks, 1)
	await advance(800)
	await paint()
	assert.equal(
		choices.filter((choice) => choice === "search").length,
		2,
		"submit cancels the pause",
	)

	// A blur only opens existing results; it does not commit the field before its pause.
	await type("pending")
	await act(async () => {
		input().dispatchEvent(
			new browser.FocusEvent("focusout", {
				bubbles: true,
				relatedTarget: browser.document.body,
			}) as unknown as Event,
		)
	})
	assert.equal(current().query.text, "space adventure")
	assert.equal(asks, 2)
	await clear()
	assert.equal(input().value, "")
	assert.equal(current().query.text, "")
	assert.deepEqual(current().query.picks, ["m:funny"])
	await advance(800)
	await paint()
	assert.equal(current().query.text, "")

	await type("pending before preset")
	const preset = find<HTMLButtonElement>(".start-example button")
	const phrase = (preset.textContent ?? "").slice(5, -1)
	await act(async () => preset.click())
	assert.equal(current().query.text, phrase)
	assert.equal(input().value, phrase)
	assert.equal(asks, 3)
	await advance(800)
	await paint()
	assert.equal(
		current().query.text,
		phrase,
		"a preset cancels the previous draft's pause",
	)
	await type("")
	assert.equal(current().query.text, "", "deleting all text clears immediately")

	await paint()
	await type("draft before navigation")
	await act(async () => current().search("queued before Back"))
	await frame()
	await act(async () => router.navigate(-1))
	await advance(0)
	assert.equal(input().value, "earlier")
	assert.equal(current().query.text, "earlier")
	await advance(800)
	await paint()
	assert.equal(
		current().query.text,
		"earlier",
		"Back cancels stale draft's pause",
	)
	await type("another pending draft")
	await act(async () => current().search("queued before Forward"))
	await act(async () => router.navigate(1))
	await paint()
	assert.equal(input().value, "")
	assert.equal(current().query.text, "")
	await advance(800)
	await paint()
	assert.equal(current().query.text, "", "Forward cancels stale draft's pause")

	// The searched text may stay equal across navigation: the picks still change and the field must reset.
	await type("do not commit on navigation")
	await act(async () => router.navigate("/?moods=dark"))
	assert.equal(input().value, "")
	await advance(800)
	await paint()
	assert.equal(current().query.text, "")

	await type("pending external clear")
	await act(async () => current().clearSearch())
	assert.equal(
		input().value,
		"",
		"an explicit clear resets an uncommitted field too",
	)
	await advance(800)
	await paint()
	assert.equal(current().query.text, "")

	await act(async () => current().search("first queued query"))
	await act(async () => current().search("second queued query"))
	await act(async () => current().clearSearch())
	await paint()
	assert.equal(
		new URLSearchParams(router.state.location.search).get("q"),
		null,
		"rapid commits and clear cancel every stale URL write",
	)

	await type("x")
	await submit()
	await advance(800)
	await paint()
	assert.equal(current().query.text, "", "a short draft never commits")
	assert.ok(input().classList.contains("ph-no-capture"))
	assert.ok(input().classList.contains("sentry-mask"))
	assert.ok(input().hasAttribute("data-ph-no-capture"))
	const visibility = Object.getOwnPropertyDescriptor(
		document,
		"visibilityState",
	)
	Object.defineProperty(document, "visibilityState", {
		configurable: true,
		value: "hidden",
	})
	await type("background search")
	await advance(800)
	await advance(0)
	assert.equal(
		new URLSearchParams(router.state.location.search).get("q"),
		"background search",
		"a debounce fired in a hidden tab writes its URL without an animation frame",
	)
	assert.equal(frames.size, 0)
	if (visibility) Object.defineProperty(document, "visibilityState", visibility)
	else Reflect.deleteProperty(document, "visibilityState")
	await act(async () => current().clearSearch())
	await paint()

	await type("keyboard clear")
	await act(async () => current().search("keyboard clear"))
	const keyboardClear = find<HTMLButtonElement>(
		'[aria-label="Clear the search"]',
	)
	await act(() => keyboardClear.focus())
	assert.equal(
		document.activeElement,
		keyboardClear,
		"the clear button remains keyboard focusable",
	)
	assert.equal(keyboardClear.type, "button")
	// Native keyboard activation dispatches click without mousedown; exercise that same handler from button focus.
	await act(() => keyboardClear.click())
	assert.equal(input().value, "")
	assert.equal(current().query.text, "")
	assert.equal(
		document.activeElement,
		input(),
		"keyboard activation returns focus to the emptied field",
	)
	await paint()

	await type("discarded when unmounted")
	await act(async () => current().search("queued before unmount"))
	const finalUrl = router.state.location.search
	const finalChoices = choices.length
	await act(async () => root.unmount())
	await advance(800)
	await paint()
	assert.equal(choices.length, finalChoices)
	assert.equal(
		router.state.location.search,
		finalUrl,
		"unmount cancels the queued URL write",
	)
	console.log("__SEARCH_BAR_INTERACTION_PASSED__")
} finally {
	mock.timers.reset()
	router.dispose()
	await browser.happyDOM.close()
}
