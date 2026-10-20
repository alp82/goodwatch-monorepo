import assert from "node:assert/strict"
import { Window } from "happy-dom"
import type { Scene } from "./scene"

const browser = new Window({ url: "https://goodwatch.app/" })
for (const name of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"Node",
	"Event",
	"MouseEvent",
])
	Object.defineProperty(globalThis, name, {
		configurable: true,
		value: name === "window" ? browser : browser[name as keyof Window],
	})
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const { createElement: h, act } = await import("react")
const { createRoot } = await import("react-dom/client")
const { Player } = await import("./player")
const container = document.createElement("div")
document.body.append(container)
const root = createRoot(container)
const scenes: Scene[] = (
	["opener", "score", "streaming", "closer"] as const
).map((section) => ({
	id: section,
	section,
	ms: 60000,
	C: () => h("div", null, section),
}))
const data = { pool: [], extra: {} }
const next = () =>
	(
		container.querySelector('button[aria-label="Next chapter"]') as HTMLElement
	).click()
try {
	await act(async () => root.render(h(Player, { scenes, data })))
	for (const expected of ["score", "streaming", "closer"]) {
		await act(async () => next())
		assert.equal(
			container.querySelector(".film-on")?.getAttribute("data-scene"),
			expected,
		)
	}
	// Next during an automatic handover must discard the outgoing scene and its pending cleanup.
	const timed = scenes.map((scene, i) => ({
		...scene,
		ms: i === 0 ? 900 : 60000,
	}))
	await act(async () =>
		root.render(h(Player, { key: "timed", scenes: timed, data })),
	)
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 150))
	})
	assert.equal(
		container.querySelector(".film-in")?.getAttribute("data-scene"),
		"score",
	)
	assert.equal(
		container.querySelector(".film-out")?.getAttribute("data-scene"),
		"opener",
	)
	await act(async () => next())
	assert.equal(
		container.querySelector(".film-on")?.getAttribute("data-scene"),
		"streaming",
	)
	assert.equal(container.querySelector(".film-out"), null)
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 900))
	})
	assert.equal(
		container.querySelector(".film-on")?.getAttribute("data-scene"),
		"streaming",
	)
	console.log("__NEXT_PASSED__")
} finally {
	await act(async () => root.unmount())
	await browser.happyDOM.close()
}
