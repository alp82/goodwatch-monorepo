// The person page's filmography posters and header portrait on phones (person-images.ts, owner Q40b).
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"
import { pick, tmdbSize } from "../../utils/srcset-pick.test-support.ts"

const r = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/person/person-images.test-support.tsx",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__PERSON_IMAGES__")
		.at(-1) ?? "",
) as Record<
	"posterBefore" | "posterAfter" | "portraitBefore" | "portraitAfter",
	string
>

const PHONES = [
	[360, 2],
	[393, 2.75],
	[412, 2.625],
	[430, 3],
	[390, 3.5],
	[767, 2],
	[767, 3],
] as const
const WIDE = [
	[768, 1],
	[768, 2],
	[768, 3],
	[1024, 2],
	[1440, 1],
	[1440, 2],
] as const

for (const [name, before, after] of [
	["filmography poster", "posterBefore", "posterAfter"],
	["header portrait", "portraitBefore", "portraitAfter"],
] as const) {
	test(`${name}: a phone under 768 px takes TMDB's 185 px file at every pixel ratio`, () => {
		for (const [width, dpr] of PHONES)
			assert.equal(
				tmdbSize(pick(r[after], width, dpr)),
				"w185",
				`${width} px at ${dpr}x`,
			)
	})
	test(`${name}: from 768 px a window takes the file it took before`, () => {
		for (const [width, dpr] of WIDE)
			assert.equal(
				tmdbSize(pick(r[after], width, dpr)),
				tmdbSize(pick(r[before], width, dpr)),
				`${width} px at ${dpr}x`,
			)
	})
}

test("before, a 2.625x phone took the 342 px poster and the 421 px portrait", () => {
	assert.equal(tmdbSize(pick(r.posterBefore, 412, 2.625)), "w342")
	assert.equal(tmdbSize(pick(r.portraitBefore, 412, 2.625)), "h632")
})
