import assert from "node:assert/strict"
import { test } from "node:test"
import { createDemandDedupe, DEMAND_DEDUPE_MS, observeTitleOpened } from "./title-demand.ts"

const opened = { media_type: "movie", tmdb_id: 162483, source_kind: "opened" } as const

test("list then open uses separate dedupe windows, aliases share identity and both expire", () => {
	const accept = createDemandDedupe()
	assert.ok(accept({ ...opened, source_kind: "poster" }, 0))
	assert.ok(accept(opened, 1000))
	assert.equal(accept({ ...opened, tmdb_id: 10679 }, 2000), false)
	assert.equal(accept(opened, DEMAND_DEDUPE_MS), false)
	assert.ok(accept(opened, DEMAND_DEDUPE_MS + 1000))
	assert.ok(accept({ ...opened, media_type: "show" }, DEMAND_DEDUPE_MS + 1001))
})

test("an active title without a poster waits a continuous foreground second; cleanup excludes prefetch/unmount", t => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	const doc = new EventTarget() as EventTarget & { visibilityState: string }
	doc.visibilityState = "hidden"
	const prior = Object.getOwnPropertyDescriptor(globalThis, "document")
	Object.defineProperty(globalThis, "document", { value: doc, configurable: true })
	t.after(() => prior ? Object.defineProperty(globalThis, "document", prior) : Reflect.deleteProperty(globalThis, "document"))
	let opens = 0
	const stop = observeTitleOpened(() => opens++)
	t.mock.timers.tick(5000)
	assert.equal(opens, 0, "background loads do not count")
	doc.visibilityState = "visible"
	doc.dispatchEvent(new Event("visibilitychange"))
	t.mock.timers.tick(900)
	doc.visibilityState = "hidden"
	doc.dispatchEvent(new Event("visibilitychange"))
	t.mock.timers.tick(5000)
	assert.equal(opens, 0, "partial foreground time cannot carry over")
	doc.visibilityState = "visible"
	doc.dispatchEvent(new Event("visibilitychange"))
	t.mock.timers.tick(999)
	assert.equal(opens, 0)
	t.mock.timers.tick(1)
	assert.equal(opens, 1)
	stop()
	const unmount = observeTitleOpened(() => opens++)
	t.mock.timers.tick(900)
	unmount()
	t.mock.timers.tick(1000)
	assert.equal(opens, 1, "an unmounted/prefetched view cannot send")
})


test("TV title views require visible screen time and not a poster", t => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	const screen = {} as Element
	const doc = Object.assign(new EventTarget(), { visibilityState: "visible", querySelectorAll: () => [screen] })
	let intersect: (entries: { target: Element; isIntersecting: boolean; intersectionRatio: number }[]) => void = () => {}
	class Observer {
		constructor(callback: typeof intersect) { intersect = callback }
		observe(element: Element) { assert.equal(element, screen) }
		disconnect() {}
	}
	const descriptors = ["document", "IntersectionObserver"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const)
	Object.defineProperty(globalThis, "document", { value: doc, configurable: true })
	Object.defineProperty(globalThis, "IntersectionObserver", { value: Observer, configurable: true })
	t.after(() => { for (const [key, prior] of descriptors) prior ? Object.defineProperty(globalThis, key, prior) : Reflect.deleteProperty(globalThis, key) })
	let opens = 0
	const stop = observeTitleOpened(() => opens++, ".tvc")
	t.mock.timers.tick(5000)
	assert.equal(opens, 0)
	intersect([{ target: screen, isIntersecting: true, intersectionRatio: 1 }])
	t.mock.timers.tick(900)
	intersect([{ target: screen, isIntersecting: false, intersectionRatio: 0 }])
	t.mock.timers.tick(1000)
	assert.equal(opens, 0)
	intersect([{ target: screen, isIntersecting: true, intersectionRatio: 1 }])
	t.mock.timers.tick(1000)
	assert.equal(opens, 1)
	stop()
})
