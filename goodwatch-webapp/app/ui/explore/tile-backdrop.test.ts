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
) as { tmdb: string; local: string }

test("a hub tile's picture is a lazy image, not a CSS background that every tile starts at once", () => {
	// The hub has about 40 tiles. As backgrounds, all their w1280 files (40 to 120 KB each) started with the page,
	// and on a phone the next page change's data waited seconds behind them (#753).
	for (const html of [rendered.tmdb, rendered.local]) {
		assert.match(html, /^<img [^>]*loading="lazy"/)
		assert.match(html, /decoding="async"/)
		assert.match(html, /alt=""/)
		assert.doesNotMatch(html, /background-image/)
		assert.match(html, /object-cover/)
	}
})

test("a TMDB picture comes at the size the tile is drawn", () => {
	assert.match(
		rendered.tmdb,
		/srcSet="[^"]*w780\/dcqI4l0vvGAyLsGGxobNsCVQdNK\.jpg 780w[^"]*w1280\/dcqI4l0vvGAyLsGGxobNsCVQdNK\.jpg 1280w"/,
	)
	assert.match(rendered.tmdb, /sizes="\(min-width: 1024px\) 25vw/)
	assert.match(
		rendered.local,
		/src="\/images\/backdrops\/backdrop-streaming-netflix\.webp"/,
	)
})
