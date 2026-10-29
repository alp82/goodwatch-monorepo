import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

const designs: { key: string; original: string; high: string; lazy: string }[] =
	JSON.parse(
		execFileSync(
			"node_modules/.bin/vite-node",
			[
				"--config",
				"app/ui/imports/source-import-test-vite.config.ts",
				"app/ui/share-card/page-images.test-support.tsx",
			],
			{ encoding: "utf8" },
		)
			.split("__CARD_IMAGES__")
			.at(-1)!,
	)
const withoutPriority = (html: string) =>
	html.replace(/ (?:fetchpriority="high"|loading="lazy"|decoding="async")/g, "")
for (const design of designs) {
	test(`${design.key}: preview priority preserves every image file, dimension, and visible element`, () => {
		assert.equal(withoutPriority(design.high), design.original)
		assert.equal(withoutPriority(design.lazy), design.original)
		const hasImages = design.original.includes("https://image.tmdb.org/")
		assert.equal(
			design.high.match(/fetchpriority="high"/g)?.length ?? 0,
			hasImages ? 1 : 0,
		)
		assert.equal(design.lazy.includes('loading="lazy"'), hasImages)
		assert.ok(!design.lazy.includes('fetchpriority="high"'))
	})
}
