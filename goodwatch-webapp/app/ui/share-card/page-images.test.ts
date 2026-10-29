import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { test } from "node:test"

const designs: {
	key: string
	original: string
	high: string
	lazy: string
	responsive: string
}[] = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/share-card/page-images.test-support.tsx",
		],
		{ encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
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

for (const design of designs) {
	test(`${design.key}: responsive previews retain original fallbacks and full-density candidates`, () => {
		const withoutSizing = withoutPriority(design.responsive).replace(
			/ (?:srcSet|srcset|sizes)="[^"]*"/g,
			"",
		)
		assert.equal(withoutSizing, design.original)
		for (const [tag] of design.responsive.matchAll(/<img\b[^>]*>/g)) {
			const src = / src="([^"]+)"/.exec(tag)?.[1] ?? ""
			if (!src.startsWith("https://image.tmdb.org/")) continue
			const width = Number(/\/w(\d+)\//.exec(src)?.[1])
			const srcset = / (?:srcSet|srcset)="([^"]+)"/.exec(tag)?.[1] ?? ""
			assert.ok(srcset.includes(`${src} ${width}w`))
			assert.ok(
				srcset
					.split(", ")
					.every(
						(candidate) =>
							Number(candidate.split(" ").at(-1)?.slice(0, -1)) <= width,
					),
			)
			const sizes = / sizes="([^"]+)"/.exec(tag)?.[1] ?? ""
			assert.ok(sizes.length > 0)
			assert.doesNotMatch(sizes, /resolution|dppx/)
		}
	})
}
