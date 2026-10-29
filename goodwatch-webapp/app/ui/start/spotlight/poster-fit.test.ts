// Whole posters only in the spotlight card's rows (poster-fit.ts, spotlight.css).
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { ALSO_FIT, allFitCss, fitAt, postersPerView } from "./poster-fit.ts"

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

const SIZES: [number, number, number][] = [
	// width, height, Also for you per view
	[375, 740, 6],
	[390, 844, 6],
	[768, 1024, 3],
	[1024, 768, 5],
	[1280, 800, 6],
	[1440, 900, 6],
	[1920, 1080, 7],
]

test("whole posters per view at every listed size", () => {
	for (const [vw, vh, also] of SIZES) {
		const spec = fitAt(ALSO_FIT, vw, vh)
		const row = postersPerView(spec, alsoWidth(vw))
		assert.equal(row.n, also, `Also for you at ${vw} × ${vh}`)
		// The posters fill the row exactly: n posters and their gaps, no part of another.
		assert.ok(
			row.posterWidth <= spec.colMax + 0.01,
			`${vw}: ${row.posterWidth}`,
		)
	}
})
