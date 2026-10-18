// The start page's scripts start after it has painted (start-after-paint.ts). These tests run the script it writes
// against a small stand-in for the browser.
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import vm from "node:vm"
import { FALLBACK_MS, startAfterPaintScript } from "./start-after-paint.ts"

type Node = {
	tag: string
	rel?: string
	href?: string
	type?: string
	textContent?: string
}
type Img = {
	currentSrc: string
	complete: boolean
	naturalWidth: number
	shown: boolean
	getClientRects: () => unknown[]
}
type Entry = { name?: string; element?: Img }
type Callback = (list: {
	getEntries: () => Entry[]
	getEntriesByName: (name: string) => Entry[]
}) => void

const img = (over: Partial<Img> = {}): Img => {
	const one = {
		currentSrc: "/assets/hand.avif",
		complete: false,
		naturalWidth: 0,
		shown: true,
		...over,
	} as Img
	one.getClientRects = () => (one.shown ? [{}] : [])
	return one
}

function browser({
	types = ["paint", "element", "navigation"],
	heroes = [] as Img[],
} = {}) {
	const head: Node[] = []
	const body: Node[] = []
	const timers: { fn: () => void; ms: number }[] = []
	const observers: Record<string, Callback> = {}
	class PerformanceObserver {
		static supportedEntryTypes = types
		fn: Callback
		constructor(fn: Callback) {
			this.fn = fn
		}
		observe({ type }: { type: string }) {
			observers[type] = this.fn
		}
	}
	const document = {
		createElement: (tag: string) => ({ tag }) as Node,
		head: { appendChild: (n: Node) => head.push(n) },
		body: { appendChild: (n: Node) => body.push(n) },
		querySelectorAll: (selector: string) =>
			selector === 'img[elementtiming="hero"]' ? heroes : [],
	}
	const context = vm.createContext({
		window: {
			PerformanceObserver: types.length ? PerformanceObserver : undefined,
		},
		document,
		setTimeout: (fn: () => void, ms = 0) => timers.push({ fn, ms }),
	})
	const deliver = (type: string, entries: Entry[]) =>
		observers[type]?.({
			getEntries: () => entries,
			getEntriesByName: (name) => entries.filter((e) => e.name === name),
		})
	return {
		run: (source: string) => vm.runInContext(source, context),
		head,
		body,
		paint: (name: string) => deliver("paint", [{ name }]),
		painted: (...elements: Img[]) =>
			deliver(
				"element",
				elements.map((element) => ({ element })),
			),
		/** Runs the timers that are due within `ms`, in order. */
		tick: (ms: number) => {
			const due = timers.filter((t) => t.ms <= ms)
			timers.splice(0, timers.length, ...timers.filter((t) => t.ms > ms))
			for (const t of due) t.fn()
		},
		started: () => body.length > 0,
	}
}

const CODE = 'import "/assets/manifest.js";\nimport("/assets/entry.client.js");'
const PRELOADS = [
	"/assets/manifest.js",
	"/assets/entry.client.js",
	"/assets/root.js",
]

describe("startAfterPaintScript", () => {
	it("asks for nothing before the first contentful paint", () => {
		const b = browser()
		b.run(startAfterPaintScript(CODE, PRELOADS))
		b.paint("first-paint")
		b.tick(0)
		assert.equal(b.head.length, 0)
		assert.equal(b.body.length, 0)
	})

	it("starts the preloads, then the module script, after the first contentful paint", () => {
		const b = browser()
		b.run(startAfterPaintScript(CODE, PRELOADS))
		b.paint("first-contentful-paint")
		b.tick(0)
		assert.deepEqual(
			b.head.map((n) => [n.rel, n.href]),
			PRELOADS.map((href) => ["modulepreload", href]),
		)
		assert.deepEqual(b.body, [
			{ tag: "script", type: "module", textContent: CODE },
		])
	})

	it("waits for every hero picture this window shows to be painted", () => {
		const hand = img()
		const room = img({ currentSrc: "/assets/room-phone.avif" })
		const b = browser({ heroes: [hand, room] })
		b.run(startAfterPaintScript(CODE, PRELOADS))
		b.paint("first-contentful-paint")
		b.tick(0)
		assert.equal(b.started(), false)
		b.painted(room)
		b.tick(0)
		assert.equal(b.started(), false)
		b.painted(hand)
		b.tick(0)
		assert.equal(b.started(), true)
	})

	it("counts a hero painted before the first contentful paint was reported", () => {
		const hand = img()
		const b = browser({ heroes: [hand] })
		b.run(startAfterPaintScript(CODE, PRELOADS))
		b.painted(hand)
		b.tick(0)
		assert.equal(b.started(), false)
		b.paint("first-contentful-paint")
		b.tick(0)
		assert.equal(b.started(), true)
	})

	it("waits for a hero whose request hasn't started at the first contentful paint", () => {
		const hand = img({ currentSrc: "" })
		const b = browser({ heroes: [hand] })
		b.run(startAfterPaintScript(CODE, PRELOADS))
		b.paint("first-contentful-paint")
		b.tick(0)
		assert.equal(b.started(), false)
		hand.currentSrc = "/assets/hand.avif"
		b.painted(hand)
		b.tick(0)
		assert.equal(b.started(), true)
	})

	it("doesn't wait for a hero that this window hides, leaves empty, or that failed", () => {
		const hidden = img({ shown: false })
		const placeholder = img({ currentSrc: "data:image/gif;base64,R0lGOD" })
		const failed = img({ complete: true, naturalWidth: 0 })
		const b = browser({ heroes: [hidden, placeholder, failed] })
		b.run(startAfterPaintScript(CODE, PRELOADS))
		b.paint("first-contentful-paint")
		b.tick(0)
		assert.equal(b.started(), true)
	})

	it("waits for the first contentful paint only without Element Timing", () => {
		const b = browser({ types: ["paint"], heroes: [img()] })
		b.run(startAfterPaintScript(CODE, PRELOADS))
		b.paint("first-contentful-paint")
		b.tick(0)
		assert.equal(b.started(), true)
	})

	it("starts them once, when the fallback timer comes too", () => {
		const b = browser()
		b.run(startAfterPaintScript(CODE, PRELOADS))
		b.paint("first-contentful-paint")
		b.tick(FALLBACK_MS)
		assert.equal(b.body.length, 1)
		assert.equal(b.head.length, PRELOADS.length)
	})

	it("starts them after the fallback time in a tab that doesn't paint, or whose hero never paints", () => {
		for (const heroes of [[], [img()]]) {
			const b = browser({ heroes })
			b.run(startAfterPaintScript(CODE, PRELOADS))
			if (heroes.length) b.paint("first-contentful-paint")
			b.tick(FALLBACK_MS - 1)
			assert.equal(b.started(), false)
			b.tick(FALLBACK_MS)
			assert.equal(b.started(), true)
		}
	})

	it("starts them at once without paint timing", () => {
		for (const types of [[], ["navigation"]]) {
			const b = browser({ types })
			b.run(startAfterPaintScript(CODE, PRELOADS))
			assert.equal(b.body.length, 1)
			assert.equal(b.head.length, PRELOADS.length)
		}
	})

	it("can't end its script element early", () => {
		const source = startAfterPaintScript(
			'"</script><script>alert(1)</script>"',
			["/a</script>.js"],
		)
		assert.ok(!source.includes("</"))
		const b = browser({ types: [] })
		b.run(source)
		assert.equal(b.body[0].textContent, '"</script><script>alert(1)</script>"')
		assert.equal(b.head[0].href, "/a</script>.js")
	})
})
