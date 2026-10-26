// The pictures of the movie and show hubs' category tiles (TileBackdrop.tsx).
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

const rendered = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/explore/tile-backdrop.test-support.tsx",
		],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	)
		.split("__TILE_BACKDROP__")
		.at(-1) ?? "",
) as Record<"lazy" | "eager" | "high" | "local" | "localEager", string> & {
	priorities: string[][]
}

test("a hub tile's picture is an image, not a CSS background that every tile starts at once", () => {
	// The hub has about 40 tiles. As backgrounds, all their w1280 files (40 to 120 KB each) started with the page,
	// and on a phone the next page change's data waited seconds behind them (#753).
	for (const html of Object.values(rendered).filter(
		(v) => typeof v === "string",
	)) {
		assert.match(html as string, /^<img /)
		assert.match(html as string, /alt=""/)
		assert.doesNotMatch(html as string, /background-image/)
		assert.match(html as string, /object-cover/)
	}
})

test("tiles on the first screen load at once, the rest when they come near", () => {
	assert.match(rendered.lazy, /loading="lazy"/)
	assert.match(rendered.local, /loading="lazy"/)
	for (const html of [rendered.eager, rendered.high, rendered.localEager])
		assert.doesNotMatch(html, /loading=/)
	// The first section's first two rows are on the first screen of a wide window. No tile is the hubs' largest
	// content (the intro text is, on phones and desktops), so none is fetched ahead of the rest.
	assert.deepEqual(rendered.priorities[0], [
		...Array(8).fill("eager"),
		"lazy",
		"lazy",
	])
	assert.deepEqual(rendered.priorities[1], Array(10).fill("lazy"))
})

test("a TMDB picture comes at the size the tile is drawn, inside the page's padding, gaps and 1280 px width", () => {
	assert.match(
		rendered.lazy,
		/sizes="\(min-width: 1280px\) 294px, \(min-width: 1024px\) calc\(\(100vw - 104px\) \/ 4\), \(min-width: 768px\) calc\(\(100vw - 80px\) \/ 3\), \(min-width: 640px\) calc\(\(100vw - 56px\) \/ 2\), /,
	)
	assert.match(rendered.lazy, /w780\/dcqI4l0vvGAyLsGGxobNsCVQdNK\.jpg 780w/)
	assert.match(
		rendered.local,
		/src="\/images\/backdrops\/backdrop-streaming-netflix\.webp"/,
	)
})
