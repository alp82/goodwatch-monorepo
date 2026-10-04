import assert from "node:assert/strict"
import { test } from "node:test"

const { createScrollDepth } = await import("./scroll-depth.ts")

const WINDOW = 900

test("the record keeps the deepest and the last position of one page", () => {
	const depth = createScrollDepth()
	assert.equal(depth.get(), undefined)
	depth.update({ scrollY: 0, scrollHeight: 7800, clientHeight: WINDOW })
	depth.update({ scrollY: 6900, scrollHeight: 7800, clientHeight: WINDOW })
	depth.update({ scrollY: 300.4, scrollHeight: 7800, clientHeight: WINDOW })
	assert.deepEqual(depth.get(), {
		lastScrollY: 301,
		maxScrollY: 6900,
		maxScrollHeight: 6900,
		lastContentY: 1200.4,
		maxContentY: 7800,
		maxContentHeight: 7800,
	})
})

test("a new page starts without the previous page's depth", () => {
	const depth = createScrollDepth()
	depth.update({ scrollY: 6900, scrollHeight: 7800, clientHeight: WINDOW })
	const left = depth.reset()
	assert.equal(left?.maxScrollY, 6900)
	assert.equal(depth.get(), undefined)

	// The next page is shorter and isn't scrolled.
	depth.settle({ scrollY: 0, scrollHeight: 2400, clientHeight: WINDOW })
	assert.deepEqual(depth.get(), {
		lastScrollY: 0,
		maxScrollY: 0,
		maxScrollHeight: 1500,
		lastContentY: 900,
		maxContentY: 900,
		maxContentHeight: 2400,
	})
})

test("a page shorter than the window has no scroll height", () => {
	const depth = createScrollDepth()
	depth.update({ scrollY: 0, scrollHeight: 600, clientHeight: WINDOW })
	assert.equal(depth.get()?.maxScrollHeight, 0)
})

test("the scroll back to the top after a navigation isn't the new page's depth", () => {
	const depth = createScrollDepth()
	depth.update({ scrollY: 6900, scrollHeight: 7800, clientHeight: WINDOW })
	depth.reset()
	// The window animates from the old position to the top of the new page.
	for (const scrollY of [6100, 3000, 400])
		depth.update({ scrollY, scrollHeight: 7000, clientHeight: WINDOW })
	assert.equal(depth.get(), undefined)
	depth.settle({ scrollY: 0, scrollHeight: 7000, clientHeight: WINDOW })
	assert.equal(depth.get()?.maxScrollY, 0)
	// From here on the visitor's own scrolling counts.
	depth.update({ scrollY: 1200, scrollHeight: 7000, clientHeight: WINDOW })
	assert.equal(depth.get()?.maxScrollY, 1200)
	assert.equal(depth.get()?.maxScrollHeight, 6100)
})

test("coming to rest on the page that was loaded changes nothing", () => {
	const depth = createScrollDepth()
	depth.update({ scrollY: 500, scrollHeight: 7800, clientHeight: WINDOW })
	depth.settle({ scrollY: 800, scrollHeight: 7800, clientHeight: WINDOW })
	assert.equal(depth.get()?.maxScrollY, 800)
	assert.equal(depth.get()?.lastScrollY, 800)
})
