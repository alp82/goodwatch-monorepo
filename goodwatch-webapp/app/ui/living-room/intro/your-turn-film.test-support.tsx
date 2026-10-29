// Run by your-turn-film.test.ts through vite-node, in happy-dom.
import assert from "node:assert/strict"
import { Window } from "happy-dom"

const browser = new Window({ url: "https://goodwatch.app/" })
for (const name of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"Node",
	"Event",
	"MouseEvent",
	"Element",
])
	Object.defineProperty(globalThis, name, {
		configurable: true,
		value: name === "window" ? browser : browser[name as keyof Window],
	})
Object.assign(globalThis, {
	IS_REACT_ACT_ENVIRONMENT: true,
	// The hold's speed ramp runs frame by frame.
	requestAnimationFrame: (f: FrameRequestCallback) =>
		setTimeout(() => f(performance.now()), 16),
	cancelAnimationFrame: (id: number) => clearTimeout(id),
})
const { createElement: h, act } = await import("react")
const { createRoot } = await import("react-dom/client")
const { FILM, FILM_ENDING_ON_YOUR_TURN } = await import("./film")
const { Player, Stage, chapterCount } = await import("./player")
const { YOUR_TURN_MS, YourTurn, YourTurnExit } = await import(
	"./scenes/your-turn"
)
const { Quiz } = await import("./scenes/quiz")

// The film list: the same chapters in the same order, only the end differs.
assert.equal(FILM_ENDING_ON_YOUR_TURN.length, FILM.length)
assert.deepEqual(
	FILM_ENDING_ON_YOUR_TURN.slice(0, -1),
	FILM.slice(0, -1),
	"every chapter before the end is the TV's",
)
const end = FILM_ENDING_ON_YOUR_TURN.at(-1)
assert.ok(end)
assert.equal(end.id, "your-turn")
assert.equal(end?.C, YourTurn)
assert.equal(end?.section, "closer")
assert.equal(end?.ms, YOUR_TURN_MS)
// The TV keeps its quiz, which waits for the visitor and isn't a chapter.
assert.equal(FILM.at(-1)?.C, Quiz)
assert.equal(chapterCount(FILM), FILM.length - 1)
// Your turn goes on by itself: it is a chapter, so the bar fills over it and Next steps past it.
assert.equal(chapterCount(FILM_ENDING_ON_YOUR_TURN), FILM.length)

const container = document.createElement("div")
document.body.append(container)
const root = createRoot(container)
const data = { pool: [], extra: {} }
try {
	// On the end card: the chapter bar names it "Your turn", Next leaves the film (onAt past the last scene).
	const seen: number[] = []
	const scenes = [
		{ id: "opener", section: "opener" as const, ms: 60000, C: () => h("div") },
		{ ...end, ms: 60000 },
	]
	let tried = 0
	await act(async () =>
		root.render(
			h(
				YourTurnExit.Provider,
				{
					value: () => {
						tried += 1
					},
				},
				h(Stage, {
					k: 1,
					children: h(Player, {
						scenes,
						data,
						startAt: 1,
						onAt: (i: number) => {
							seen.push(i)
						},
					}),
				}),
			),
		),
	)
	assert.match(
		container.querySelector(".film-chapter-now")?.textContent ?? "",
		/Your turn/,
	)
	const tryIt = [...container.querySelectorAll("button")].find(
		(b) => b.textContent === "Try it",
	) as HTMLElement | undefined
	assert.ok(tryIt, "the end card has Try it")
	// The space bar on a focused Try it presses it; on the film's own Next it still holds the film at 2x.
	const space = (el: Element, type: "keydown" | "keyup" = "keydown") => {
		const e = new browser.KeyboardEvent(type, {
			code: "Space",
			key: " ",
			bubbles: true,
			cancelable: true,
		})
		el.dispatchEvent(e as unknown as Event)
		return e.defaultPrevented
	}
	tryIt.focus()
	assert.equal(space(tryIt), false, "Space on Try it is the button's")
	const next = container.querySelector('button[aria-label="Next chapter"]')
	assert.ok(next)
	await act(async () => {
		assert.equal(space(next), true, "Space on Next holds the film")
	})
	await act(async () => {
		space(next, "keyup")
	})
	await act(async () => tryIt.click())
	assert.equal(tried, 1)
	await act(async () =>
		(
			container.querySelector(
				'button[aria-label="Next chapter"]',
			) as HTMLElement
		).click(),
	)
	assert.equal(
		seen.at(-1),
		scenes.length,
		"Next on the end card steps past the film",
	)
	console.log("__YOUR_TURN_PASSED__")
} finally {
	await act(async () => root.unmount())
	await browser.happyDOM.close()
}
