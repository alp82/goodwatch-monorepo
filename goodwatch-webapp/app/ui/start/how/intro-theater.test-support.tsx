// Run by intro-theater.test.ts through vite-node, in happy-dom: the TV corner's load failure and retry, and the
// theater's hold on the page behind it (inert, no scrolling) and how Close hands it back.
import assert from "node:assert/strict"
import { Window } from "happy-dom"

const browser = new Window({
	url: "https://goodwatch.app/",
	width: 1280,
	height: 800,
})
for (const name of [
	"window",
	"document",
	"navigator",
	"HTMLElement",
	"Element",
	"Node",
	"Event",
	"MouseEvent",
	"KeyboardEvent",
	"getComputedStyle",
])
	Object.defineProperty(globalThis, name, {
		configurable: true,
		value:
			name === "window"
				? browser
				: name === "getComputedStyle"
					? browser.getComputedStyle.bind(browser)
					: browser[name as keyof Window],
	})
Object.assign(globalThis, {
	IS_REACT_ACT_ENVIRONMENT: true,
	// The film's data never comes: the theater shows its notice instead of the film.
	fetch: () => Promise.reject(new Error("offline")),
})
let unhandled: unknown = null
process.on("unhandledRejection", (reason) => {
	unhandled = reason
})

// Web Animations as a record: every animation finishes at once.
type Played = { el: Element; options: KeyframeAnimationOptions }
const played: Played[] = []
const proto = browser.Element.prototype as unknown as Element
Object.assign(proto, {
	animate(this: Element, _frames: unknown, options: KeyframeAnimationOptions) {
		played.push({ el: this, options })
		return { finished: Promise.resolve(), cancel() {} }
	},
	getAnimations: () => [],
})

const { createElement: h, act } = await import("react")
const { createRoot } = await import("react-dom/client")
const { MemoryRouter } = await import("react-router-dom")
const { HowItWorksCorner } = await import("./HowItWorksCorner")
const { IntroTheater } = await import("./IntroTheater")
const { cornerPlacement, introFrom } = await import("./intro-push")

const html = document.documentElement
// happy-dom has no layout: the window is its size less a 15 px scrollbar.
Object.defineProperties(html, {
	clientWidth: { get: () => browser.innerWidth - 15 },
	clientHeight: { get: () => browser.innerHeight },
})
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
const settle = async () => {
	for (let i = 0; i < 5; i++) await act(tick)
}
const press = (key: string, el: EventTarget = document.body) =>
	el.dispatchEvent(
		new browser.KeyboardEvent("keydown", {
			key,
			bubbles: true,
			cancelable: true,
		}) as unknown as Event,
	)
const dialog = () => document.querySelector('[role="dialog"]')
const closeButton = () =>
	document.querySelector<HTMLElement>('button[aria-label="Close the intro"]')

// The page: the app's own root in <body>, as Remix renders it.
const app = document.createElement("div")
app.id = "app"
document.body.append(app)
const root = createRoot(app)

try {
	// 1. The corner: a load that fails (pointerdown's early start too) says so and the next press tries again.
	let attempts = 0
	let fail = true
	const loadTheater = () => {
		attempts += 1
		return fail
			? Promise.reject(new Error("stale chunk"))
			: Promise.resolve(IntroTheater)
	}
	await act(async () =>
		root.render(h(MemoryRouter, null, h(HowItWorksCorner, { loadTheater }))),
	)
	const corner = app.querySelector<HTMLButtonElement>(".start-how-room")
	assert.ok(corner)
	corner.dispatchEvent(
		new browser.PointerEvent("pointerdown", {
			bubbles: true,
		}) as unknown as Event,
	)
	await act(async () => corner.click())
	await settle()
	assert.equal(attempts, 1, "the press shares pointerdown's load")
	assert.equal(
		unhandled,
		null,
		"pointerdown's failed load isn't left unhandled",
	)
	assert.match(corner.textContent ?? "", /Couldn't load\. Try again/)
	assert.match(app.querySelector("output")?.textContent ?? "", /couldn't load/)
	assert.equal(dialog(), null)

	fail = false
	await act(async () => corner.click())
	await settle()
	assert.equal(attempts, 2, "the next press loads again")
	assert.match(corner.textContent ?? "", /Watch the intro/)
	assert.ok(dialog(), "the theater is open")

	// 2. Open: the page behind is inert and doesn't scroll; the keyboard is in the theater, at Close.
	assert.ok(app.hasAttribute("inert"), "the page behind is inert")
	assert.ok(!dialog()?.hasAttribute("inert"))
	assert.equal(html.style.overflow, "hidden", "the page doesn't scroll")
	assert.equal(
		html.style.getPropertyValue("scrollbar-gutter"),
		"stable",
		"its scrollbar's gutter stays",
	)
	assert.equal(document.activeElement, closeButton())

	// Close: the page comes back as it was, and the keyboard is on the corner again.
	await act(async () => closeButton()?.click())
	await settle()
	assert.equal(dialog(), null)
	assert.ok(!app.hasAttribute("inert"))
	assert.equal(html.style.overflow, "")
	assert.equal(html.style.getPropertyValue("scrollbar-gutter"), "")
	assert.equal(document.activeElement, corner, "Close gives focus back")
	await act(async () => root.unmount())

	// 3. The camera from a corner on screen: Escape pulls back out to it. The page is unlocked before onClose runs.
	const box = { left: 360, top: 420, width: 560, height: 340 }
	const from = introFrom(
		box,
		(() => {
			const p = cornerPlacement(box.width, box.height)
			return { ...p, left: p.left + box.left, top: p.top + box.top }
		})(),
		"tv-corner.webp",
	)
	const open = async () => {
		const host = createRoot(app)
		let closed = 0
		await act(async () =>
			host.render(
				h(IntroTheater, {
					from,
					onClose: () => {
						assert.ok(!app.hasAttribute("inert"), "unlocked before onClose")
						assert.equal(html.style.overflow, "")
						closed += 1
					},
					onTryIt: () => {},
				}),
			),
		)
		await settle()
		assert.ok(closeButton(), "the film is open")
		return { host, closed: () => closed }
	}
	const pulledBack = () =>
		played.some(({ options }) => options.direction === "reverse")

	let t = await open()
	played.length = 0
	await act(async () => press("Escape"))
	await settle()
	assert.equal(t.closed(), 1)
	assert.ok(pulledBack(), "Escape pulls back to the corner")
	await act(async () => t.host.unmount())

	// 4. The window changed size while the film was open: Close fades out instead of pulling back to where the corner
	// was.
	t = await open()
	browser.happyDOM.setViewport({ width: 800, height: 1280 })
	await act(async () => {
		browser.dispatchEvent(new browser.Event("resize"))
	})
	played.length = 0
	await act(async () => closeButton()?.click())
	await settle()
	assert.equal(t.closed(), 1)
	assert.ok(!pulledBack(), "no pull back after a viewport change")
	assert.ok(
		played.some(({ el }) => el.getAttribute("role") === "dialog"),
		"the theater fades out",
	)
	await act(async () => t.host.unmount())
	assert.ok(!app.hasAttribute("inert"))

	console.log("__INTRO_THEATER_PASSED__")
} finally {
	await browser.happyDOM.close()
}
