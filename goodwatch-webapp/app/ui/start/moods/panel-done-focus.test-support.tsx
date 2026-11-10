// Real panel and parent commit; manual frames separate the feedback paint from the later focus task.
import assert from "node:assert/strict"
import { Window } from "happy-dom"
import type { MoodControl } from "~/ui/watch-next/MoodPicker"
const browser = new Window({
	url: "https://goodwatch.app/",
	width: 390,
	height: 844,
})
for (const proto of [browser.Element.prototype, browser.HTMLElement.prototype])
	Reflect.deleteProperty(proto, "animate")
for (const key of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"Element",
	"SVGElement",
	"Node",
	"getComputedStyle",
	"matchMedia",
])
	Object.defineProperty(globalThis, key, {
		configurable: true,
		value: browser[key as keyof Window],
	})
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
let next = 1
let clock = 0
const frames = new Map<number, FrameRequestCallback>()
const tasks = new Map<number, () => void>()
const raf = (callback: FrameRequestCallback) => {
	const id = next++
	frames.set(id, callback)
	return id
}
const cancel = (id: number) => {
	frames.delete(id)
}
const nativeTimeout = browser.setTimeout
const nativeClearTimeout = browser.clearTimeout
// Happy DOM types its native timers as Node handles; the controlled test clock deliberately uses browser IDs.
Object.defineProperties(browser, {
	requestAnimationFrame: { configurable: true, writable: true, value: raf },
	cancelAnimationFrame: { configurable: true, writable: true, value: cancel },
	setTimeout: {
		configurable: true,
		writable: true,
		value: (callback: () => void) => {
			const id = next++
			tasks.set(id, callback)
			return id
		},
	},
	clearTimeout: {
		configurable: true,
		writable: true,
		value: (id: number) => {
			tasks.delete(id)
		},
	},
})
Object.assign(globalThis, {
	requestAnimationFrame: raf,
	cancelAnimationFrame: cancel,
})
const { act, useLayoutEffect, useRef, useState } = await import("react")
const { createRoot } = await import("react-dom/client")
const { StartMoodPanel } = await import("./StartMoodPanel")
const { startPicker, startShelfLines } = await import("./start-picker")
const phases: string[] = []
let setOpen: (open: boolean) => void = () => {}
let returns = 0
function Page() {
	const [open, updateOpen] = useState(true)
	const [feedback, setFeedback] = useState(0)
	setOpen = updateOpen
	const anchor = useRef<HTMLDivElement>(null)
	const button = useRef<HTMLButtonElement>(null)
	useLayoutEffect(() => {
		if (anchor.current)
			anchor.current.getBoundingClientRect = () => ({
				x: 20,
				y: 70,
				left: 20,
				top: 70,
				right: 370,
				bottom: 100,
				width: 350,
				height: 30,
				toJSON() {},
			})
	}, [])
	useLayoutEffect(() => {
		if (feedback) phases.push("feedback-commit")
	}, [feedback])
	const control: MoodControl = {
		open,
		setOpen: updateOpen,
		picker: startPicker([], null, {}),
		countScope: "titles",
		toggle() {},
		clear() {},
		refused: null,
	}
	return (
		<>
			<div className="start-moods" ref={anchor}>
				<button
					type="button"
					data-moodbutton
					ref={button}
					onFocus={() => {
						returns++
						phases.push("return-focus")
					}}
				>
					Moods
				</button>
			</div>
			<input aria-label="Another control" />
			<output>{feedback}</output>
			<StartMoodPanel
				control={control}
				shelf={startShelfLines([], null, "any")}
				anchor={anchor}
				returnFocus={button}
				onDone={() => {
					updateOpen(false)
					setFeedback((n) => n + 1)
				}}
			/>
		</>
	)
}
const host = document.createElement("div")
document.body.append(host)
const root = createRoot(host)
const button = () => {
	const found = host.querySelector<HTMLButtonElement>("[data-moodbutton]")
	assert.ok(found)
	return found
}
const outside = () => {
	const found = host.querySelector<HTMLInputElement>("input")
	assert.ok(found)
	return found
}
const done = () => {
	const found = Array.from(
		document.querySelectorAll<HTMLButtonElement>(
			'[role="dialog"][aria-label="Picks"] button',
		),
	).find((el) => el.textContent === "Done")
	assert.ok(found)
	return found
}
const frame = () =>
	act(async () => {
		clock += 16
		const due = [...frames.values()]
		frames.clear()
		for (const callback of due) callback(clock)
	})
const task = () =>
	act(async () => {
		const due = [...tasks.values()]
		tasks.clear()
		for (const callback of due) callback()
	})
const paint = async () => {
	await frame()
	await task()
}
const open = async () => {
	await act(async () => setOpen(true))
	for (let i = 0; i < 3; i++) await paint()
}
const finish = async () => {
	await act(async () => {
		done().focus()
		done().click()
	})
}
try {
	await act(async () => root.render(<Page />))
	for (let i = 0; i < 3; i++) await paint()
	await finish()
	assert.deepEqual(
		phases,
		["feedback-commit"],
		"close/card feedback commits without synchronous return focus",
	)
	assert.notEqual(document.activeElement, button())
	await frame()
	assert.equal(returns, 0, "the animation frame still precedes feedback paint")
	await task()
	assert.equal(document.activeElement, button())
	assert.deepEqual(phases, ["feedback-commit", "return-focus"])

	await open()
	await finish()
	await act(async () => outside().focus())
	await paint()
	assert.equal(
		document.activeElement,
		outside(),
		"a new focused control keeps focus",
	)
	assert.equal(returns, 1)

	await open()
	await finish()
	await frame()
	const pending = [...tasks.keys()]
	assert.ok(pending.length > 0)
	await act(async () => setOpen(true))
	for (const id of pending)
		assert.ok(!tasks.has(id), "reopening cancels the stale focus task")
	await paint()
	assert.equal(returns, 1)
	for (let i = 0; i < 2; i++) await paint()

	await finish()
	await frame()
	const onUnmount = [...tasks.keys()]
	await act(async () => root.unmount())
	for (const id of onUnmount)
		assert.ok(!tasks.has(id), "unmount cancels pending focus")
	await paint()
	assert.equal(returns, 1)
	console.log("__PANEL_DONE_FOCUS_PASSED__")
} finally {
	await act(async () => root.unmount())
	browser.setTimeout = nativeTimeout
	browser.clearTimeout = nativeClearTimeout
	frames.clear()
	tasks.clear()
	await browser.happyDOM.close()
}
