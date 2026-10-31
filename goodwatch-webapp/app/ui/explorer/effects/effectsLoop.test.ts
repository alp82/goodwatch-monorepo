// The effects loop stops asking for frames once nothing draws, with reduced motion too: a combination that's up keeps
// no frames going after its glint ends.
import assert from "node:assert/strict"
import { test } from "node:test"
import { createMapEffects } from "./mapEffects.ts"
import type { EffectCombination } from "./types.ts"

/** Just enough of a document and its canvases for the effects layer, and a frame clock we step by hand. */
function fakePage() {
	const frames: ((now: number) => void)[] = []
	const ctx = {
		createImageData: (w: number, h: number) => ({
			width: w,
			height: h,
			data: new Uint8ClampedArray(w * h * 4),
		}),
		putImageData() {},
		clearRect() {},
	}
	const canvas = () => ({
		width: 0,
		height: 0,
		className: "",
		style: {} as Record<string, string>,
		setAttribute() {},
		remove() {},
		getContext: () => ctx,
	})
	const g = globalThis as Record<string, unknown>
	g.document = { createElement: canvas }
	g.requestAnimationFrame = (f: (now: number) => void) => frames.push(f)
	g.cancelAnimationFrame = () => {}
	const host = { clientWidth: 1280, clientHeight: 800, appendChild() {} }
	let now = 0
	/** Runs frames until none is asked for (or `max`); how many ran. */
	const run = (max: number) => {
		let n = 0
		while (frames.length && n < max) {
			now += 16.7
			const f = frames.shift() as (now: number) => void
			f(now)
			n++
		}
		return n
	}
	return {
		host: host as unknown as HTMLElement,
		run,
		pending: () => frames.length,
	}
}

const up: EffectCombination = {
	hub: { x: 640, y: 400, r: 300 },
	rise: 1,
	ready: true,
	picked: [
		{ id: "mood:funny", x: 200, y: 200, r: 60, color: "#ff8800" },
		{ id: "theme:crime", x: 1000, y: 600, r: 60, color: "#3366ff" },
	],
}

test("with reduced motion, the loop goes idle after the combination's glint", () => {
	const page = fakePage()
	const fx = createMapEffects(page.host, { reducedMotion: true })
	// The map reports the combination every frame while it's up.
	for (let i = 0; i < 5; i++) fx.combination(up)
	const ran = page.run(2000)
	assert.ok(ran > 0, "the glint played")
	assert.ok(ran < 2000, `still asking for frames after ${ran}`)
	assert.equal(page.pending(), 0)
	// Still up and reported again: no new glint, no new frames.
	fx.combination(up)
	assert.equal(page.run(2000), 0)
	fx.destroy()
})

test("with motion, the combination that's up keeps its calm loop going", () => {
	const page = fakePage()
	const fx = createMapEffects(page.host, { reducedMotion: false })
	fx.combination(up)
	assert.equal(page.run(300), 300)
	// Gone: the loop winds down.
	fx.combination(null)
	assert.ok(page.run(5000) < 5000)
	fx.destroy()
})
