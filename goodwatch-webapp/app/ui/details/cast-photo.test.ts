// The title page's cast photos (cast-photo.ts): phones ask for TMDB's 185 px file, wider screens as before (owner, Q38).
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

const html = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/details/cast-photo.test-support.tsx",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__CAST_PHOTO__")
		.at(-1) ?? "",
) as string

const attr = (name: string) =>
	new RegExp(`${name}="([^"]*)"`).exec(html)?.[1] ?? ""
const candidates = attr("srcSet")
	.split(", ")
	.map((entry) => {
		const [url, w] = entry.split(" ")
		return { url, w: Number.parseInt(w) }
	})
/** The slot `sizes` gives for a window, as a browser evaluates it (min-width and min-resolution only). */
function slot(width: number, dpr: number): number {
	for (const rule of attr("sizes").split(", ")) {
		const cond =
			/^\((min-width|min-resolution): ([\d.]+)(px|dppx)\) (.+)$/.exec(rule)
		const length = cond ? cond[4] : rule
		if (cond) {
			const value = Number.parseFloat(cond[2])
			if (cond[1] === "min-width" ? width < value : dpr < value) continue
		}
		const calc = /^calc\(([\d.]+)px \* ([\d.]+)\)$/.exec(length)
		return calc ? Number(calc[1]) * Number(calc[2]) : Number.parseFloat(length)
	}
	return 0
}
/** The file a browser takes: the smallest candidate at least slot × pixel ratio wide, or the largest. */
const pick = (width: number, dpr: number) =>
	(candidates.find((c) => c.w >= slot(width, dpr) * dpr) ?? candidates.at(-1))
		?.url ?? ""

test("a phone takes the 185 px file at every pixel ratio", () => {
	for (const [width, dpr] of [
		[360, 2],
		[393, 2.75],
		[412, 2.625],
		[430, 3],
		[390, 3.5],
	])
		assert.match(
			pick(width, dpr),
			/\/w185\/face\.jpg/,
			`${width} px at ${dpr}x`,
		)
})

test("wider screens keep the file they had: 144 px at their own pixel ratio", () => {
	assert.match(pick(1440, 1), /\/w185\/face\.jpg/)
	assert.match(pick(1440, 2), /\/h632\/face\.jpg/)
	assert.match(pick(820, 2), /\/h632\/face\.jpg/)
	// The box is the same: 144 px wide, 216 px high, cropped to the circle by its parent.
	assert.equal(attr("width"), "144")
	assert.equal(attr("height"), "216")
})
