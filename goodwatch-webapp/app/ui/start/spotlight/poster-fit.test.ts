// Whole posters only in the spotlight card's rows (poster-fit.ts, spotlight.css).
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { stageSizeAt } from "../stage/placement.ts"
import {
	ALSO_FIT,
	RESULTS_FIT,
	allFitCss,
	fitAt,
	postersPerView,
} from "./poster-fit.ts"

const css = readFileSync(new URL("./spotlight.css", import.meta.url), "utf8")
const squash = (s: string) => s.replace(/\s+/g, "")

test("spotlight.css holds the generated fit rules", () => {
	const block =
		/\/\* poster fit: start \*\/([\s\S]*)\/\* poster fit: end \*\//.exec(
			css,
		)?.[1]
	assert.ok(block, "spotlight.css has the poster fit markers")
	assert.equal(
		squash(block),
		squash(allFitCss()),
		"regenerate spotlight.css's poster fit block (see poster-fit.ts)",
	)
})

/** The card's width in a window: the column's side padding, then the card's own cap (start.css). */
const cardWidth = (vw: number) =>
	Math.min(
		vw - 2 * (vw >= 640 ? 24 : 16),
		Math.min(1600, Math.max(1200, vw - 320)),
	)

/** The card body's side padding (spotlight.css `.spotlight-pad`). */
const bodyPad = (vw: number) => (vw >= 1024 ? 28 : vw >= 640 ? 24 : 16)

/** "Also for you"'s row width: the panel's half beside the featured title (phones: inside it), plus its -mx-1. */
function alsoWidth(vw: number) {
	const inner = cardWidth(vw) - 2 * bodyPad(vw)
	if (vw < 640) return inner - 2 * 12 + 8
	const gap = vw >= 1024 ? 24 : 16
	const share = vw >= 1024 ? 2 : 2.3
	return (inner - gap) / share + 8
}

const SIZES: [number, number, number, number][] = [
	// width, height, results per view, Also for you per view
	[375, 740, 4, 6],
	[390, 844, 4, 6],
	[768, 1024, 4, 3],
	[1024, 768, 6, 5],
	[1280, 800, 7, 6],
	[1440, 900, 6, 6],
	[1920, 1080, 8, 7],
]

test("whole posters per view at every listed size", () => {
	for (const [vw, vh, results, also] of SIZES) {
		const row = postersPerView(fitAt(RESULTS_FIT, vw, vh), cardWidth(vw))
		assert.equal(row.n, results, `results at ${vw} × ${vh}`)
		const alsoRow = postersPerView(fitAt(ALSO_FIT, vw, vh), alsoWidth(vw))
		assert.equal(alsoRow.n, also, `Also for you at ${vw} × ${vh}`)
		// The posters fill the row exactly: n posters and their gaps, no part of another.
		const spec = fitAt(RESULTS_FIT, vw, vh)
		assert.ok(
			row.posterWidth <= spec.colMax + 0.01,
			`${vw}: ${row.posterWidth}`,
		)
	}
	// Four on phones, about 70 px wide at 375 (owner, 2026-10-28).
	const phone = postersPerView(fitAt(RESULTS_FIT, 375, 740), cardWidth(375))
	assert.ok(Math.abs(phone.posterWidth - 70) < 2, String(phone.posterWidth))
	// Every phone width shows four, the wider ones centered at the posters' widest, never part of a fifth.
	for (const vw of [320, 360, 375, 390, 414, 430, 450, 500, 560, 600, 639]) {
		const spec = fitAt(RESULTS_FIT, vw, 800)
		const row = postersPerView(spec, cardWidth(vw))
		assert.equal(row.n, 4, `${vw}`)
		assert.ok(
			row.posterWidth <= spec.colMax + 0.01,
			`${vw}: ${row.posterWidth}`,
		)
		assert.ok(row.rowWidth <= cardWidth(vw), `${vw}`)
		// The row is exactly four posters and their gaps.
		assert.ok(
			Math.abs(
				4 * row.posterWidth + 3 * spec.gap + 2 * spec.pad - row.rowWidth,
			) < 0.01,
			`${vw}`,
		)
	}
	// Tablets: four at 768 (the spec's list), more as the row widens.
	for (const [vw, n] of [
		[640, 4],
		[700, 4],
		[768, 4],
		[900, 5],
		[1000, 6],
	])
		assert.equal(
			postersPerView(fitAt(RESULTS_FIT, vw, 1024), cardWidth(vw)).n,
			n,
			`${vw}`,
		)
})

/** The header's height per breakpoint (spotlight.css `.spotlight-head`). */
const headAt = (vw: number, vh: number) =>
	vw < 640 ? 68 : vw < 1024 ? 78 : vh <= 820 ? 82 : 90

test("the card's fixed height holds the tallest poster at every breakpoint", () => {
	for (const [vw, vh] of [
		[375, 740],
		[639, 900],
		[768, 1024],
		[1024, 768],
		[1440, 900],
		[1920, 1080],
	]) {
		const spec = fitAt(RESULTS_FIT, vw, vh)
		// Room above the posters for the lifted ring, below them for the row (and on phones the page dots).
		const under = vw < 640 ? 52 : 10
		const need = headAt(vw, vh) + 14 + spec.colMax * 1.5 + under
		const card = stageSizeAt(vw, vh).card
		assert.ok(need <= card, `${vw} × ${vh}: ${need} > ${card}`)
		// No empty band under the phone's posters.
		if (vw < 640) assert.equal(need, card)
	}
})
