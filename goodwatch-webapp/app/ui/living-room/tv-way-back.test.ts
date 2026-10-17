import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { TV_PROPERTIES, type TvTrip, WAY_BACK_LIVES, bracketArm, pagesFromTv, parseTrip, tvProperties, wayBackShows } from "./tv-way-back.ts"

const trip: TvTrip = { idx: 4, to: "/discover", box: { left: 18, top: 145, width: 1080, height: 583 }, w: 1440, h: 900, art: null, out: true }

describe("parseTrip", () => {
	it("reads back what was stored", () => {
		assert.deepEqual(parseTrip(JSON.stringify(trip)), trip)
	})
	it("takes a trip without a box: the page changed without motion", () => {
		assert.equal(parseTrip(JSON.stringify({ ...trip, box: null }))?.box, null)
	})
	it("is no trip for nothing, for text that is not JSON, and for what an older build stored", () => {
		assert.equal(parseTrip(null), null)
		assert.equal(parseTrip(""), null)
		assert.equal(parseTrip("{"), null)
		assert.equal(parseTrip(JSON.stringify({ inset: "inset(1px 2px 3px 4px round 3px)", w: 1440, h: 900 })), null)
	})
	it("is no trip with a box that has no size", () => {
		assert.equal(parseTrip(JSON.stringify({ ...trip, box: { left: 0, top: 0, width: 0, height: 10 } })), null)
	})
	it("reads `out` as false unless it is true", () => {
		assert.equal(parseTrip(JSON.stringify({ ...trip, out: undefined }))?.out, false)
	})
})

describe("pagesFromTv", () => {
	it("is 1 on the page the TV opened", () => {
		assert.equal(pagesFromTv(trip, 5, "/discover"), 1)
	})
	it("is 0 one step from the TV on another page: the header leads out of the room too", () => {
		assert.equal(pagesFromTv(trip, 5, "/taste"), 0)
	})
	it("counts on from there, whatever the page", () => {
		assert.equal(pagesFromTv(trip, 6, "/movie/1-x"), 2)
		assert.equal(pagesFromTv(trip, 7, "/person/2-y"), 3)
	})
	it("is 0 on the TV's own entry, before it, and without a trip", () => {
		assert.equal(pagesFromTv(trip, 4, "/"), 0)
		assert.equal(pagesFromTv(trip, 2, "/discover"), 0)
		assert.equal(pagesFromTv(null, 5, "/discover"), 0)
	})
})

describe("wayBackShows", () => {
	it("shows only on the page the TV opened and disappears after one navigation", () => {
		assert.equal(WAY_BACK_LIVES, 1)
		assert.deepEqual([0, 1, 2, 3, 4].map(wayBackShows), [false, true, false, false, false])
	})
})

describe("tvProperties", () => {
	const window = { w: 1425, h: 900 }
	const box = { left: 18, top: 145, width: 1080, height: 583 }
	it("scales the room until the picture is as wide as the window, its corner on the window's", () => {
		const k = 1425 / 1080
		assert.equal(tvProperties(box, window)["--tv-room"], `translate(${Math.round(-18 * k * 100) / 100}px, ${Math.round(-145 * k * 100) / 100}px) scale(${Math.round(k * 10000) / 10000})`)
	})
	it("starts the page in the picture, at the picture's scale", () => {
		assert.equal(tvProperties(box, window)["--tv-page"], "translate(18px, 145px) scale(0.7579)")
	})
	it("hides what of the page hangs out under the picture", () => {
		// 583 px of picture at 1425/1080 is 769.24 px of page; the window has 900.
		assert.equal(tvProperties(box, window)["--tv-page-clip"], "inset(0 0 130.76px 0)")
	})
	it("hides nothing when the picture is taller than the window's proportion", () => {
		assert.equal(tvProperties({ left: 14, top: 77, width: 362, height: 900 }, { w: 390, h: 844 })["--tv-page-clip"], "inset(0 0 0px 0)")
	})
	it("hands over the picture's box and the brackets' arm, and nothing the list of properties does not name", () => {
		const properties = tvProperties(box, window)
		assert.deepEqual(Object.keys(properties), [...TV_PROPERTIES])
		assert.deepEqual([properties["--tv-l"], properties["--tv-t"], properties["--tv-w"], properties["--tv-h"], properties["--tv-arm"]], ["18px", "145px", "1080px", "583px", "120px"])
	})
})

describe("bracketArm", () => {
	it("is a share of the picture's shorter side, between 14 and 120 px", () => {
		assert.equal(bracketArm({ left: 0, top: 0, width: 1080, height: 583 }), 120)
		assert.equal(bracketArm({ left: 0, top: 0, width: 362, height: 302 }), 60)
		assert.equal(bracketArm({ left: 0, top: 0, width: 80, height: 60 }), 14)
	})
})
