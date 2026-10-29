// Run by start-browse.test.ts through vite-node: the genre cloud in happy-dom on a screen that can hover. A chip that
// takes the keyboard focus opens its peek, and Escape closes it while the focus stays on the chip.
import { Window } from "happy-dom"

const window = new Window({ url: "https://goodwatch.app/" })
// A desktop: the cloud opens peeks on hover and focus there.
;(window as unknown as { matchMedia: (query: string) => unknown }).matchMedia =
	(query: string) => ({
		matches: query === "(hover: hover)",
		media: query,
		addEventListener() {},
		removeEventListener() {},
	})
for (const key of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"Element",
	"Node",
	"KeyboardEvent",
	"PointerEvent",
	"requestAnimationFrame",
	"cancelAnimationFrame",
])
	Object.defineProperty(globalThis, key, {
		configurable: true,
		writable: true,
		value: (window as unknown as Record<string, unknown>)[key],
	})
;(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const { createElement: h, act } = await import("react")
const { createRoot } = await import("react-dom/client")
const { MemoryRouter } = await import("react-router-dom")
const { GenreCloud } = await import("./GenreCloud")

const genre = (path: string, i: number) => ({
	name: path,
	path,
	titles: [0, 1, 2].map((j) => ({
		title: `Title ${i}${j}`,
		poster_path: `/p${i}${j}.jpg`,
	})),
})
const genres = {
	movie: ["drama", "comedy"].map(genre),
	show: ["crime"].map(genre),
}

const container = document.createElement("div")
document.body.appendChild(container)
const root = createRoot(container as unknown as Element)
await act(async () =>
	root.render(h(MemoryRouter, null, h(GenreCloud, { genres }))),
)

const chip = () =>
	container.querySelector(
		'a[href="/movies/genres/comedy"]',
	) as unknown as HTMLElement
const state = () => {
	const peek = container.querySelector(
		"#sb-peek",
	) as unknown as HTMLElement | null
	return {
		on: chip().hasAttribute("data-on"),
		describedBy: chip().getAttribute("aria-describedby"),
		peekOpacity: peek?.style.opacity ?? null,
		peekText: peek?.textContent ?? null,
		focused: document.activeElement === (chip() as unknown),
	}
}

const steps: Record<string, ReturnType<typeof state>> = {}
await act(async () => chip().focus())
steps.focused = state()
await act(async () => {
	document.dispatchEvent(
		new window.KeyboardEvent("keydown", {
			key: "Escape",
			bubbles: true,
		}) as unknown as Event,
	)
})
steps.escaped = state()
await act(async () => root.unmount())
process.stdout.write(`__GENRE_CLOUD__${JSON.stringify(steps)}`)
process.exit(0)
