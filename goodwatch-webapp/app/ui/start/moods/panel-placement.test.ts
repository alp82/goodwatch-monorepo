import "../../../server/title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { test, type TestContext } from "node:test"
import type { PanelBox } from "./start-picker.ts"
const { afterPanelPaint, watchPanelPlacement } = await import(
	"./panel-placement.ts"
)

function page(t: TestContext) {
	let next = 0
	let now = 0
	const frames = new Map<number, FrameRequestCallback>()
	const timers = new Map<number, { at: number; callback: () => void }>()
	const viewport = new EventTarget()
	const events = new EventTarget()
	const reads: string[] = []
	let animations: Animation[] = []
	const column = {
		getBoundingClientRect: () => {
			reads.push("column")
			return { left: 50, width: 500 }
		},
	}
	const block = { getAnimations: () => animations }
	const anchor = {
		isConnected: true,
		closest: (selector: string) =>
			selector === ".start-block" ? block : column,
		getBoundingClientRect: () => {
			reads.push("row")
			return { bottom: 300 }
		},
	} as unknown as HTMLElement
	const window = Object.assign(events, {
		innerHeight: 900,
		scrollX: 0,
		scrollY: 100,
		visualViewport: Object.assign(viewport, { height: 900 }),
		requestAnimationFrame: (callback: FrameRequestCallback) => {
			const id = ++next
			frames.set(id, callback)
			return id
		},
		cancelAnimationFrame: (id: number) => frames.delete(id),
		setTimeout: (callback: () => void, delay = 0) => {
			const id = ++next
			timers.set(id, { at: now + delay, callback })
			return id
		},
		clearTimeout: (id: number) => timers.delete(id),
	})
	const document = {
		querySelector: () => ({
			getBoundingClientRect: () => {
				reads.push("dock")
				return { top: 850, height: 50 }
			},
		}),
		scrollingElement: {
			get scrollHeight() {
				reads.push("scrollHeight")
				return 2000
			},
		},
	}
	for (const [key, value] of Object.entries({ window, document })) {
		const original = Object.getOwnPropertyDescriptor(globalThis, key)
		Object.defineProperty(globalThis, key, { configurable: true, value })
		t.after(() => {
			if (original) Object.defineProperty(globalThis, key, original)
			else Reflect.deleteProperty(globalThis, key)
		})
	}
	const frame = () => {
		const pending = [...frames.values()]
		frames.clear()
		for (const callback of pending) callback(now)
	}
	const advance = (ms: number) => {
		const until = now + ms
		while (true) {
			const pending = [...timers.entries()]
				.filter(([, timer]) => timer.at <= until)
				.sort((a, b) => a[1].at - b[1].at)[0]
			if (!pending) break
			now = pending[1].at
			timers.delete(pending[0])
			pending[1].callback()
		}
		now = until
	}
	const paint = () => {
		frame()
		advance(0)
	}
	const boxes: PanelBox[] = []
	return {
		anchor,
		reads,
		boxes,
		frames,
		timers,
		window,
		viewport,
		frame,
		advance,
		paint,
		moving: (value: Animation[]) => {
			animations = value
		},
		start: () => watchPanelPlacement(anchor, (box) => boxes.push(box)),
	}
}

test("opening measurement waits for paint, batches its geometry reads, and never measures on scroll", (t) => {
	const p = page(t)
	const stop = p.start()
	assert.deepEqual(p.reads, [])
	p.frame()
	assert.deepEqual(p.reads, [], "rAF itself does not force layout before paint")
	p.advance(0)
	assert.deepEqual(p.reads, ["dock", "column", "row", "scrollHeight"])
	assert.deepEqual(p.boxes[0], {
		top: 408,
		left: 50,
		width: 500,
		maxHeight: 526,
		scrollBy: 0,
		viewTop: 308,
	})
	p.window.dispatchEvent(new Event("scroll"))
	p.paint()
	assert.equal(p.reads.length, 4)
	stop()
})

test("window/visual viewport resize bursts coalesce and animation completion replaces per-frame geometry polling", async (t) => {
	const p = page(t)
	const stop = p.start()
	p.paint()
	let finish!: () => void
	const finished = new Promise<void>((resolve) => {
		finish = resolve
	})
	p.moving([
		{ playState: "running", pending: false, finished } as unknown as Animation,
	])
	for (let i = 0; i < 10; i++) {
		p.window.dispatchEvent(new Event("resize"))
		p.viewport.dispatchEvent(new Event("resize"))
		p.advance(20)
	}
	assert.equal(p.reads.length, 4)
	p.advance(80)
	p.paint()
	for (let i = 0; i < 30; i++) p.paint()
	assert.equal(p.reads.length, 4, "animation frames read no geometry")
	assert.equal(p.frames.size, 0, "no polling frame remains")
	finish()
	await Promise.resolve()
	await Promise.resolve()
	p.paint()
	assert.equal(p.boxes.length, 2)
	assert.equal(p.reads.length, 8)
	stop()
})

test("closing cancels queued work and stale animations; interrupted animations and the timeout both release placement", async (t) => {
	const p = page(t)
	const closeBeforePaint = p.start()
	closeBeforePaint()
	p.paint()
	assert.equal(p.reads.length, 0)
	const stop = p.start()
	p.paint()
	let reject!: (error: Error) => void
	p.moving([
		{
			playState: "running",
			finished: new Promise((_, fail) => {
				reject = fail
			}),
		} as unknown as Animation,
	])
	p.window.dispatchEvent(new Event("resize"))
	p.advance(80)
	p.paint()
	reject(new Error("transition cancelled"))
	await Promise.resolve()
	await Promise.resolve()
	p.paint()
	assert.equal(p.boxes.length, 2)
	p.moving([
		{
			playState: "running",
			finished: new Promise(() => {}),
		} as unknown as Animation,
	])
	p.window.dispatchEvent(new Event("resize"))
	p.advance(80)
	p.paint()
	p.advance(2000)
	p.paint()
	assert.equal(
		p.boxes.length,
		3,
		"an animation that never settles cannot block resizing",
	)
	p.window.dispatchEvent(new Event("resize"))
	p.advance(80)
	p.paint()
	stop()
	p.advance(5000)
	p.paint()
	assert.equal(p.boxes.length, 3, "closed panels receive no late placement")
	assert.equal(p.frames.size, 0)
	assert.equal(p.timers.size, 0)
})

test("a focus task can be cancelled both before and after its animation frame", (t) => {
	const p = page(t)
	let focused = 0
	const before = afterPanelPaint(() => focused++)
	before()
	p.paint()
	const between = afterPanelPaint(() => focused++)
	p.frame()
	between()
	p.advance(0)
	assert.equal(focused, 0)
})
