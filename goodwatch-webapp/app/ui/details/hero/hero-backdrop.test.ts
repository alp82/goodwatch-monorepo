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

test("the hero asks without credentials, and the 103's files are what its srcset gives on a phone and a desktop", () => {
	assert.match(rendered.hero, /crossorigin="anonymous"/)
	assert.deepEqual(rendered.files, {
		phone: "https://image.tmdb.org/t/p/w780/backdrop.jpg",
		desktop: "https://image.tmdb.org/t/p/w1280/backdrop.jpg",
	})
	for (const file of Object.values(rendered.files) as string[])
		assert.ok(rendered.hero.includes(file), file)
})

test("a tap on the trailer button from before the app was there is kept for it (utils/replay-tap.ts)", () => {
	assert.match(rendered.trailer, /data-replay-tap="trailer"/)
})

test("a prefetch's early hero load asks for what the hero's srcset and sizes give, so the hero reuses it", () => {
	const { preload, hero } = rendered
	assert.ok(hero.includes(`src="${preload.src}"`), preload.src)
	assert.ok(
		hero.includes(`srcSet="${preload.srcSet}"`) ||
			hero.includes(`srcset="${preload.srcSet}"`),
		preload.srcSet,
	)
	assert.ok(hero.includes(`sizes="${preload.sizes}"`), preload.sizes)
})
