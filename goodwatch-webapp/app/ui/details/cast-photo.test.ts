// The title page's cast photos (cast-photo.ts): phones ask for TMDB's 185 px file, wider screens as before (owner, Q38).
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"
import { pick as pickFile } from "../../utils/srcset-pick.test-support.ts"

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

const pick = (width: number, dpr: number) => pickFile(html, width, dpr)

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
	assert.match(html, /width="144"/)
	assert.match(html, /height="216"/)
})

test("the phone rule ends at 768 px: 767 px takes the 185 px file, 768 px the one for 144 px", () => {
	for (const dpr of [2, 3]) {
		assert.match(pick(767, dpr), /\/w185\/face\.jpg/, `767 px at ${dpr}x`)
		assert.match(pick(768, dpr), /\/h632\/face\.jpg/, `768 px at ${dpr}x`)
	}
	assert.match(
		pick(768, 1),
		/\/w185\/face\.jpg/,
		"768 px at 1x: 144 px fits the 185 px file",
	)
})
