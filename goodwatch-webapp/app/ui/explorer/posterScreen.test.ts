import assert from "node:assert/strict"
import { test } from "node:test"
import type { ExplorerTitle } from "../../domain/explorer.ts"
import type { MapIsland } from "./island.ts"
import {
	SCREEN_AT,
	becomesScreen,
	createScreenWatch,
	fillWidth,
	largestPoster,
	wheelScrolls,
} from "./posterScreen.ts"

test("posters grow to about 0.41 of the stage height", () => {
	assert.equal(largestPoster(1440, 900, false), (900 * 0.62) / 1.5)
	assert.equal(largestPoster(2560, 1440, false), (1440 * 0.62) / 1.5)
})

test("never below 300 px, 220 on phones", () => {
	assert.equal(largestPoster(1280, 600, false), 300)
	assert.equal(largestPoster(390, 480, true), 220)
})

test("never above the size where posters used to fill the view", () => {
	// A phone held upright: the height would allow more than the width does.
	assert.equal(fillWidth(390, 844, true), 300)
	assert.equal(largestPoster(390, 844, true), 300)
	for (const [w, h, phone] of [
		[1440, 900, false],
		[800, 1400, false],
		[390, 844, true],
	] as const)
		assert.ok(largestPoster(w, h, phone) <= fillWidth(w, h, phone))
})

test("a poster becomes the screen about half a notch past its largest size", () => {
	assert.equal(SCREEN_AT, 1.1)
	assert.equal(becomesScreen(372, 372), false)
	assert.equal(becomesScreen(372 * 1.09, 372), false)
	assert.equal(becomesScreen(372 * 1.1, 372), true)
})

const island = { id: "mood:funny" } as unknown as MapIsland
const title = (key: number) => ({ key }) as unknown as ExplorerTitle
const LARGEST = 300

/** One frame: the zoom's point at (500, 400), a poster drawn at `w` there, `raw` before the clamp. */
function frame(
	watch: ReturnType<typeof createScreenWatch>,
	raw: number,
	zoomingIn: boolean,
	at = { x: 500, y: 400 },
) {
	watch.begin(at.x, at.y)
	watch.see(island, 3, title(7), 500, 400, Math.min(raw, LARGEST), raw, LARGEST)
	return watch.end(LARGEST, false, zoomingIn)
}

test("zooming on into the big poster at the point makes it the screen, once", () => {
	const watch = createScreenWatch()
	assert.equal(frame(watch, 290, true), null)
	const c = frame(watch, 340, true)
	assert.equal(c?.i, 3)
	assert.equal(c?.title.key, 7)
	assert.equal(c?.w, LARGEST)
	// Still big: it doesn't fire again.
	assert.equal(frame(watch, 360, true), null)
	// Once the poster at the point is small again, it can.
	assert.equal(frame(watch, 200, false), null)
	assert.ok(frame(watch, 340, true))
})

test("panning over a big poster, or one away from the zoom's point, doesn't open it", () => {
	const watch = createScreenWatch()
	assert.equal(frame(watch, 340, false), null)
	const far = createScreenWatch()
	assert.equal(frame(far, 340, true, { x: 900, y: 400 }), null)
})

test("nothing opens while a poster is already the screen", () => {
	const watch = createScreenWatch()
	watch.begin(500, 400)
	watch.see(island, 3, title(7), 500, 400, LARGEST, 340, LARGEST)
	assert.equal(watch.end(LARGEST, true, true), null)
})

const area = (scrollTop: number, scrollHeight = 600, clientHeight = 300) => ({
	scrollTop,
	scrollHeight,
	clientHeight,
})

test("a wheel turn over details that can scroll that way scrolls them", () => {
	assert.equal(wheelScrolls([area(0)], 40), true)
	assert.equal(wheelScrolls([area(150)], -40), true)
	assert.equal(wheelScrolls([area(150)], 40), true)
})

test("past the details' end, or over details that don't scroll, the wheel reaches the screen", () => {
	assert.equal(wheelScrolls([area(300)], 40), false)
	assert.equal(wheelScrolls([area(0)], -40), false)
	assert.equal(wheelScrolls([area(0, 300, 300)], 40), false)
	assert.equal(wheelScrolls([], 40), false)
	assert.equal(wheelScrolls([area(100)], 0), false)
})

test("an outer scrollable area still scrolls when the inner one is at its end", () => {
	assert.equal(wheelScrolls([area(300), area(0)], 40), true)
})
