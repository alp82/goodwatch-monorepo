import assert from "node:assert/strict"
import { test } from "node:test"
import {
	SHAPE_BY_CODE,
	fitTransform,
	gainOf,
	heroBoxOf,
	isTiny,
	regionsOf,
	tallFrameOf,
	viewBoxOf,
} from "./geometry.ts"
import { VIEW_BOX, WORLD_HEIGHT, WORLD_SHAPES, WORLD_WIDTH } from "./shapes.ts"

const LISTED = "US GB FR JP DE IN CA IT ES KR HK CN RU AU MX BR AR SE DK IE BE NL PL TR".split(" ")

test("every country the pages list has a shape, a region and a label point on the canvas", () => {
	for (const code of LISTED) {
		const shape = SHAPE_BY_CODE.get(code)
		assert.ok(shape, code)
		assert.ok(shape.region, `${code} has no region`)
		assert.ok(
			shape.at[0] > 0 && shape.at[0] < WORLD_WIDTH && shape.at[1] > 0 && shape.at[1] < WORLD_HEIGHT,
			code,
		)
		assert.ok(shape.d || isTiny(shape), `${code} has neither an outline nor a dot`)
	}
	assert.ok(isTiny(SHAPE_BY_CODE.get("HK")!))
	assert.ok(!isTiny(SHAPE_BY_CODE.get("BE")!))
})

test("no country is listed twice and the asset stays small", () => {
	const codes = WORLD_SHAPES.filter((shape) => shape.code).map((shape) => shape.code)
	assert.equal(new Set(codes).size, codes.length)
	const bytes = WORLD_SHAPES.reduce((sum, shape) => sum + shape.d.length, 0)
	assert.ok(bytes < 120_000, `${bytes} bytes of outlines`)
})

test("a view holds every listed country of its region, except the ones wider than the region", () => {
	assert.deepEqual(regionsOf(LISTED), ["americas", "europe", "asia"])
	for (const region of regionsOf(LISTED)) {
		const box = viewBoxOf(region, LISTED)
		for (const code of LISTED) {
			const shape = SHAPE_BY_CODE.get(code)!
			if (shape.region !== region || code === "RU") continue
			assert.ok(
				shape.box[0] >= box[0] &&
					shape.box[2] <= box[2] &&
					shape.box[1] >= box[1] &&
					shape.box[3] <= box[3],
				code,
			)
			assert.ok(box[1] >= 0 && box[3] <= WORLD_HEIGHT)
		}
	}
	assert.deepEqual(viewBoxOf("africa", LISTED), VIEW_BOX.africa)
	assert.deepEqual(viewBoxOf("world", LISTED), VIEW_BOX.world)
})

test("Europe comes clearly closer on a wide frame; every region does on a phone's", () => {
	const wide = VIEW_BOX.world
	assert.ok(gainOf(wide, viewBoxOf("europe", LISTED)) > 3)
	assert.ok(gainOf(wide, viewBoxOf("americas", LISTED)) < 1.6)
	const tall = tallFrameOf(wide)
	for (const region of regionsOf(LISTED))
		assert.ok(gainOf(tall, viewBoxOf(region, LISTED)) > 1.25, region)
})

test("fitting a box centers it in the frame", () => {
	const frame = [0, 0, 200, 100] as const
	const { scale, x, y } = fitTransform(frame, [50, 50, 100, 75])
	assert.equal(scale, 4)
	assert.equal(x + scale * 75, 100)
	assert.equal(y + scale * 62.5, 50)
})

test("the hero holds its country, in the middle or in the right half", () => {
	for (const code of LISTED) {
		const shape = SHAPE_BY_CODE.get(code)!
		for (const anchor of [0.5, 0.72]) {
			const box = heroBoxOf(shape, 2.4, anchor)
			if (code !== "RU")
				assert.ok(shape.box[0] >= box[0] && shape.box[2] <= box[2], `${code} at ${anchor}`)
			const middle = (shape.box[0] + shape.box[2]) / 2
			assert.ok(Math.abs((middle - box[0]) / (box[2] - box[0]) - anchor) < 0.001)
		}
	}
})
