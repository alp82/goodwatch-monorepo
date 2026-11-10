import assert from "node:assert/strict"
import { type TestContext, test } from "node:test"
import { watchShelfMeasurements } from "./shelf-measure.ts"

function page(t: TestContext) {
	let next = 1
	const frames = new Map<number, FrameRequestCallback>()
	const tasks = new Map<number, () => void>()
	let onResize = () => {}
	let onMutation = () => {}
	let disconnected = 0
	const observed: unknown[] = []
	const mutationTargets: unknown[] = []
	const obstacle = {}
	const stage = Object.assign(new EventTarget(), {
		querySelectorAll: () => [obstacle],
	})
	const camera = {}
	const phone = new EventTarget()
	const cover = new EventTarget()
	const shelf = { contains: (target: unknown) => target === cover }
	let reads = 0
	let dirty = false
	const env = {
		window: {
			requestAnimationFrame: (callback: FrameRequestCallback) => {
				const id = next++
				frames.set(id, callback)
				return id
			},
			cancelAnimationFrame: (id: number) => frames.delete(id),
			setTimeout: (callback: () => void) => {
				const id = next++
				tasks.set(id, callback)
				return id
			},
			clearTimeout: (id: number) => tasks.delete(id),
		},
		ResizeObserver: class {
			constructor(callback: () => void) {
				onResize = callback
			}
			observe(target: unknown) {
				observed.push(target)
			}
			disconnect() {
				disconnected++
			}
		},
		MutationObserver: class {
			constructor(callback: () => void) {
				onMutation = callback
			}
			observe(target: unknown) {
				mutationTargets.push(target)
			}
			disconnect() {
				disconnected++
			}
		},
	}
	for (const [key, value] of Object.entries(env)) {
		const original = Object.getOwnPropertyDescriptor(globalThis, key)
		Object.defineProperty(globalThis, key, { configurable: true, value })
		t.after(() => {
			if (original) Object.defineProperty(globalThis, key, original)
			else Reflect.deleteProperty(globalThis, key)
		})
	}
	const start = () =>
		watchShelfMeasurements({
			shelf: shelf as unknown as HTMLElement,
			stage: stage as unknown as HTMLElement,
			camera: camera as HTMLElement,
			phone: phone as MediaQueryList,
			measure: () => {
				assert.equal(
					dirty,
					false,
					"offset reads must not flush an unpainted input commit",
				)
				reads++
			},
		})
	const frame = () => {
		const pending = [...frames.values()]
		frames.clear()
		for (const callback of pending) callback(0)
	}
	const paint = () => {
		frame()
		dirty = false
		const pending = [...tasks.values()]
		tasks.clear()
		for (const callback of pending) callback()
	}
	const transition = (target: EventTarget, propertyName: string) => {
		const event = new Event("transitionend", { bubbles: true })
		Object.defineProperties(event, {
			propertyName: { value: propertyName },
			target: { value: target },
		})
		stage.dispatchEvent(event)
	}
	return {
		start,
		frame,
		paint,
		stage,
		camera,
		phone,
		obstacle,
		cover,
		observed,
		mutationTargets,
		frames,
		tasks,
		mutate: () => {
			dirty = true
			onMutation()
		},
		resize: () => {
			dirty = true
			onResize()
		},
		transition,
		reads: () => reads,
		disconnected: () => disconnected,
	}
}

test("initial shelf visibility is placed immediately; stage/camera mutations and resize bursts read once after paint", (t) => {
	const p = page(t)
	const stop = p.start()
	assert.equal(p.reads(), 1)
	assert.deepEqual(p.observed, [p.stage, p.obstacle])
	assert.deepEqual(p.mutationTargets, [p.stage, p.camera])
	p.mutate()
	p.resize()
	p.phone.dispatchEvent(new Event("change"))
	assert.equal(p.reads(), 1, "input microtasks do not measure")
	assert.equal(p.frames.size, 1, "all invalidation sources share one batch")
	p.frame()
	assert.equal(p.reads(), 1, "rAF still precedes paint")
	assert.equal(p.tasks.size, 1)
	p.paint()
	assert.equal(p.reads(), 2)
	assert.equal(p.frames.size, 0, "no polling frame remains")
	p.paint()
	assert.equal(p.reads(), 2)
	stop()
})

test("room transform completion rechecks coverage; a cover's own flip does not reschedule layout", (t) => {
	const p = page(t)
	const stop = p.start()
	p.transition(p.cover, "transform")
	p.transition(p.stage, "opacity")
	assert.equal(p.frames.size, 0)
	p.transition(p.stage, "transform")
	assert.equal(p.frames.size, 1)
	p.paint()
	assert.equal(p.reads(), 2)
	stop()
})

test("unmount cancels either queued phase and disconnects all listeners and observers", (t) => {
	const p = page(t)
	let stop = p.start()
	p.mutate()
	stop()
	p.paint()
	assert.equal(p.reads(), 1)
	stop = p.start()
	p.mutate()
	p.frame()
	stop()
	p.paint()
	assert.equal(p.reads(), 2)
	assert.equal(p.disconnected(), 4)
	p.phone.dispatchEvent(new Event("change"))
	p.transition(p.stage, "transform")
	assert.equal(p.frames.size, 0)
	assert.equal(p.tasks.size, 0)
})
