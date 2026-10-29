// How it works' TV corner and the camera push (intro-push.ts), and where Try it scrolls (hand-off.ts).
import assert from "node:assert/strict"
import { test } from "node:test"
import { handOffPlan } from "./hand-off.ts"
import {
	CORNER_TV,
	CORNER_ZOOM,
	cornerPlacement,
	filmBox,
	introFrom,
	pushFrames,
	tvRectIn,
} from "./intro-push.ts"

const near = (a: number, b: number, eps = 0.01) =>
	assert.ok(Math.abs(a - b) <= eps, `${a} is not ${b}`)

// The crop's sizes: phones (220 px tall), from 640 px (280), from 768 px beside the text (340).
const CROPS = [
	[343, 220],
	[358, 220],
	[576, 280],
	[355, 340],
	[492, 340],
	[560, 340],
]

test("the crop zooms so the TV is about a third of its width", () => {
	assert.ok(CORNER_ZOOM >= 1 && CORNER_ZOOM <= 4)
	near(CORNER_TV.width * CORNER_ZOOM, 0.36)
})

test("the painting always covers the crop, the TV whole and in the middle", () => {
	for (const [w, h] of CROPS) {
		const image = cornerPlacement(w, h)
		assert.ok(image.left <= 0 && image.top <= 0, `${w}x${h}`)
		assert.ok(image.left + image.width >= w - 0.01, `${w}x${h} right edge`)
		assert.ok(image.top + image.height >= h - 0.01, `${w}x${h} bottom edge`)
		const tv = tvRectIn(image)
		assert.ok(tv.left >= 0 && tv.top >= 0, `${w}x${h} TV inside`)
		assert.ok(tv.left + tv.width <= w && tv.top + tv.height <= h)
		near(tv.left + tv.width / 2, w / 2, 1)
		// Room for the pill under the TV on the small crops (how-it-works.css: 10 px under it, 40 px tall).
		if (w < 540)
			assert.ok(tv.top + tv.height + 10 + 40 <= h - 4, `${w}x${h} pill`)
	}
})

test("the film's box is as large as fits, between 16:9 and 1.85:1", () => {
	assert.deepEqual(filmBox({ left: 0, top: 0, width: 1600, height: 900 }), {
		left: 0,
		top: 0,
		width: 1600,
		height: 900,
	})
	const phone = filmBox({ left: 0, top: 0, width: 390, height: 844 })
	near(phone.width, 390)
	near(phone.height, (390 * 9) / 16)
	near(phone.top, (844 - phone.height) / 2)
	const wide = filmBox({ left: 0, top: 0, width: 2560, height: 1080 })
	near(wide.width / wide.height, 1.85)
})

/** A frame's transform, applied to a point of the room copy (origin top-left, at the room's box). */
function apply(
	transform: string,
	room: { left: number; top: number },
	x: number,
	y: number,
) {
	const m = /translate\((.+)px, (.+)px\) scale\((.+)\)/.exec(transform)
	assert.ok(m, transform)
	const [tx, ty, s] = m.slice(1).map(Number)
	return [
		room.left + tx + (x - room.left) * s,
		room.top + ty + (y - room.top) * s,
	]
}

test("the push starts where the corner is and ends with the TV covering the film's box", () => {
	const box = { left: 16, top: 900, width: 343, height: 220 }
	const placed = cornerPlacement(box.width, box.height)
	const image = {
		...placed,
		left: box.left + placed.left,
		top: box.top + placed.top,
	}
	const from = introFrom(box, image, "/tv-corner.avif")
	assert.equal(from.image.left, placed.left)
	const target = filmBox({ left: 0, top: 0, width: 390, height: 844 })
	const frames = pushFrames(from, target)
	assert.equal(frames[0].offset, 0)
	assert.equal(frames.at(-1)?.offset, 1)
	const tv = from.tvRect
	const [x0, y0] = apply(frames[0].transform, box, tv.left, tv.top)
	near(x0, tv.left)
	near(y0, tv.top)
	const last = frames.at(-1)?.transform ?? ""
	const [l, t] = apply(last, box, tv.left, tv.top)
	const [r, b] = apply(last, box, tv.left + tv.width, tv.top + tv.height)
	// The TV ends a little larger than the film's box, centered on it.
	assert.ok(l <= target.left + 0.5 && r >= target.left + target.width - 0.5)
	assert.ok(t <= target.top + 0.5 && b >= target.top + target.height - 0.5)
	near((l + r) / 2, target.left + target.width / 2, 0.5)
	near((t + b) / 2, target.top + target.height / 2, 0.5)
})

test("Try it: nothing asked goes to the page's top, something asked centers the card under the header", () => {
	assert.deepEqual(
		handOffPlan({
			asked: false,
			stageTop: 0,
			cardTop: 600,
			cardHeight: 306,
			viewport: 740,
		}),
		{ kind: "search", top: 0 },
	)
	const plan = handOffPlan({
		asked: true,
		stageTop: 0,
		cardTop: 600,
		cardHeight: 306,
		viewport: 740,
	})
	assert.equal(plan.kind, "card")
	// 64 px header, then (676 - 306) / 2 above the card.
	assert.equal(plan.top, 600 - 64 - 185)
	// A card taller than the screen keeps 16 px under the header; never above the page's top.
	assert.equal(
		handOffPlan({
			asked: true,
			stageTop: 0,
			cardTop: 100,
			cardHeight: 900,
			viewport: 740,
		}).top,
		20,
	)
	assert.equal(
		handOffPlan({
			asked: true,
			stageTop: 0,
			cardTop: 10,
			cardHeight: 300,
			viewport: 740,
		}).top,
		0,
	)
})
