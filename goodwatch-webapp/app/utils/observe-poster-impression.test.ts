import assert from "node:assert/strict"
import { test } from "node:test"
import { observePosterImpression } from "./observe-poster-impression.ts"

test("one observer per document tracks continuous impressions independently and releases its last card", (t) => {
	t.mock.timers.enable({ apis: ["setTimeout"] })
	const doc = Object.assign(new EventTarget(), { visibilityState: "visible" })
	const first = { ownerDocument: doc } as unknown as Element
	const second = { ownerDocument: doc } as unknown as Element
	const third = { ownerDocument: doc } as unknown as Element
	type Entry = Pick<IntersectionObserverEntry, "target" | "isIntersecting" | "intersectionRatio">
	const callbacks: ((entries: Entry[]) => void)[] = []
	const observed = new Set<Element>()
	let disconnects = 0
	class Observer {
		constructor(cb: (entries: Entry[]) => void, options: IntersectionObserverInit) {
			assert.equal(options.threshold, 0.5)
			callbacks.push(cb)
		}
		observe(el: Element) {
			observed.add(el)
		}
		unobserve(el: Element) {
			observed.delete(el)
		}
		disconnect() {
			disconnects++
		}
	}
	const prior = Object.getOwnPropertyDescriptor(globalThis, "IntersectionObserver")
	Object.defineProperty(globalThis, "IntersectionObserver", { value: Observer, configurable: true })
	t.after(() => {
		if (prior) Object.defineProperty(globalThis, "IntersectionObserver", prior)
		else Reflect.deleteProperty(globalThis, "IntersectionObserver")
	})
	const hits: string[] = []
	const endFirst = observePosterImpression(first, () => hits.push("first"))
	observePosterImpression(second, () => hits.push("second"))
	const endThird = observePosterImpression(third, () => hits.push("third"))
	assert.equal(callbacks.length, 1)
	const entry = (target: Element, intersectionRatio: number) => ({
		target,
		isIntersecting: true,
		intersectionRatio,
	})
	callbacks[0]([entry(first, 1), entry(second, 0.49), entry(third, 0.5)])
	t.mock.timers.tick(600)
	doc.visibilityState = "hidden"
	doc.dispatchEvent(new Event("visibilitychange"))
	t.mock.timers.tick(1500)
	assert.deepEqual(hits, [])
	doc.visibilityState = "visible"
	doc.dispatchEvent(new Event("visibilitychange"))
	t.mock.timers.tick(200)
	callbacks[0]([entry(second, 0.5)])
	endThird()
	t.mock.timers.tick(800)
	assert.deepEqual(hits, ["first"])
	assert.deepEqual([...observed], [second])
	endFirst()
	t.mock.timers.tick(200)
	assert.deepEqual(hits, ["first", "second"])
	assert.equal(disconnects, 1)
	assert.equal(observed.size, 0)
})
