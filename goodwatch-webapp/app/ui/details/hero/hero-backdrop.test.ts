// The title page's hero backdrop: the first screen's largest content (its LCP).
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

const rendered = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/details/hero/hero-backdrop.test-support.tsx",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__HERO_BACKDROP__")
		.at(-1) ?? "",
)

test("the hero backdrop is fetched first, and the page's scripts wait for it to paint", () => {
	assert.match(rendered.hero, /fetchpriority="high"/)
	assert.match(rendered.hero, /elementtiming="hero"/)
	assert.match(
		rendered.hero,
		/src="https:\/\/image\.tmdb\.org\/t\/p\/w780\/backdrop\.jpg"/,
	)
})
