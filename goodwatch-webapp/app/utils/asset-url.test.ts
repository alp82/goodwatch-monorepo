import assert from "node:assert/strict"
import { test } from "node:test"
import { assetUrl, manifestAt, setServerAssetBase } from "./asset-url.ts"

const base = "https://static.example.com"
test("manifestAt moves every local address without mutating the build", () => {
	const manifest = {
		url: "/assets/manifest.js",
		entry: { module: "/assets/entry.js", imports: ["/assets/shared.js"] },
		routes: {
			root: {
				module: "/assets/root.js",
				imports: ["/assets/route.js"],
				css: ["/assets/root.css"],
			},
			absolute: {
				module: "https://static.example.com/already.js",
				imports: [],
				css: [],
			},
			missing: undefined,
		},
	}
	const before = structuredClone(manifest)
	const copy = manifestAt(manifest, base)
	assert.deepEqual(copy, {
		url: `${base}/assets/manifest.js`,
		entry: {
			module: `${base}/assets/entry.js`,
			imports: [`${base}/assets/shared.js`],
		},
		routes: {
			root: {
				module: `${base}/assets/root.js`,
				imports: [`${base}/assets/route.js`],
				css: [`${base}/assets/root.css`],
			},
			absolute: manifest.routes.absolute,
			missing: undefined,
		},
	})
	assert.deepEqual(manifest, before)
	assert.equal(manifestAt(manifest, ""), manifest)
})

test("assetUrl reads the server address on each call and preserves absolute addresses", () => {
	let current = ""
	setServerAssetBase(() => current)
	assert.equal(assetUrl("/images/a.webp"), "/images/a.webp")
	current = base
	assert.equal(assetUrl("/images/a.webp"), `${base}/images/a.webp`)
	assert.equal(
		assetUrl("https://static.example.com/a.webp"),
		"https://static.example.com/a.webp",
	)
	assert.equal(assetUrl("data:image/svg+xml,a"), "data:image/svg+xml,a")
	current = ""
	assert.equal(assetUrl("/flags/DE.svg"), "/flags/DE.svg")
})
