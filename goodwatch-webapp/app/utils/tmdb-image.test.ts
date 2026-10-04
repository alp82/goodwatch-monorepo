import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
	gridPosterPriority,
	imageLoadingProps,
	tmdbFixedImage,
	tmdbFluidImage,
	tmdbImageUrl,
	tmdbSizeFor,
	tmdbSizes,
} from "./tmdb-image.ts"

const BASE = "https://image.tmdb.org/t/p"

describe("tmdbImageUrl", () => {
	it("uses the image host directly, never the host that redirects", () => {
		assert.equal(tmdbImageUrl("/abc.jpg", "w342"), `${BASE}/w342/abc.jpg`)
	})

	it("accepts a path with or without a leading slash", () => {
		assert.equal(tmdbImageUrl("abc.jpg", "w92"), `${BASE}/w92/abc.jpg`)
		assert.equal(tmdbImageUrl("//abc.png", "w92"), `${BASE}/w92/abc.png`)
	})
})

describe("tmdbSizeFor", () => {
	it("picks the smallest step that covers the displayed width", () => {
		assert.equal(tmdbSizeFor("poster", 92), "w92")
		assert.equal(tmdbSizeFor("poster", 93), "w154")
		assert.equal(tmdbSizeFor("poster", 167), "w185")
		assert.equal(tmdbSizeFor("backdrop", 412), "w780")
		assert.equal(tmdbSizeFor("logo", 44), "w45")
	})

	it("multiplies the displayed width by the pixel ratio", () => {
		assert.equal(tmdbSizeFor("poster", 167, 2), "w342")
		assert.equal(tmdbSizeFor("logo", 44, 2), "w92")
		assert.equal(tmdbSizeFor("backdrop", 412, 2), "w1280")
	})

	it("counts a pixel ratio above 2 as 2", () => {
		assert.equal(tmdbSizeFor("poster", 167, 3), tmdbSizeFor("poster", 167, 2))
		assert.equal(tmdbSizeFor("poster", 167, 2.625), "w342")
	})

	it("counts a pixel ratio below 1 as 1", () => {
		assert.equal(tmdbSizeFor("poster", 167, 0.5), "w185")
	})

	it("never picks the original: a cast photo in a 144 px circle gets h632 at most", () => {
		assert.equal(tmdbSizeFor("profile", 144, 1), "w185")
		assert.equal(tmdbSizeFor("profile", 144, 2), "h632")
		assert.equal(tmdbSizeFor("profile", 2000, 2), "h632")
		assert.equal(tmdbSizeFor("backdrop", 5000, 2), "w1280")
	})
})

describe("tmdbFixedImage", () => {
	it("offers one file for a pixel ratio of 1 and one for 2", () => {
		assert.deepEqual(tmdbFixedImage("profile", "/p.jpg", 144), {
			src: `${BASE}/w185/p.jpg`,
			srcSet: `${BASE}/w185/p.jpg 1x, ${BASE}/h632/p.jpg 2x`,
		})
		assert.deepEqual(tmdbFixedImage("logo", "/l.png", 44), {
			src: `${BASE}/w45/l.png`,
			srcSet: `${BASE}/w45/l.png 1x, ${BASE}/w92/l.png 2x`,
		})
	})

	it("leaves srcSet out when one file covers both", () => {
		assert.deepEqual(tmdbFixedImage("profile", "/p.jpg", 200), {
			src: `${BASE}/h632/p.jpg`,
		})
		assert.deepEqual(tmdbFixedImage("logo", "/l.png", 20), {
			src: `${BASE}/w45/l.png`,
		})
	})
})

// What a browser does with srcSet and sizes: slot width times pixel ratio, then the smallest
// file that covers it. The slot is the first entry of sizes whose condition matches.
function browserPick(
	image: { srcSet?: string; sizes?: string },
	viewport: number,
	ratio: number,
) {
	const entry = (image.sizes ?? "").split(", ").find((candidate) => {
		const minWidth = /\(min-width: (\d+)px\)/.exec(candidate)
		const minRatio = /\(min-resolution: ([\d.]+)dppx\)/.exec(candidate)
		return (
			(!minWidth || viewport >= Number(minWidth[1])) &&
			(!minRatio || ratio >= Number(minRatio[1]))
		)
	}) as string
	const length = entry.replace(/\([^)]*: [^)]*\) /g, "").replace(/ and /g, "")
	const calc = /^calc\(([\d.]+)vw \* ([\d.]+)\)$/.exec(length)
	const slot = calc
		? (viewport * Number(calc[1]) * Number(calc[2])) / 100
		: length.endsWith("vw")
			? (viewport * Number.parseFloat(length)) / 100
			: Number.parseFloat(length)
	const files = (image.srcSet ?? "").split(", ").map((candidate) => {
		const [url, width] = candidate.split(" ")
		return { url, width: Number.parseInt(width) }
	})
	const file =
		files.find((f) => f.width >= slot * ratio) ?? files[files.length - 1]
	return file.url.split("/")[5]
}

describe("tmdbSizes", () => {
	it("keeps the displayed widths in order and reports a narrower slot to a phone with a high pixel ratio", () => {
		assert.equal(
			tmdbSizes([
				["(min-width: 768px)", "390px"],
				[null, "100vw"],
			]),
			[
				"(min-width: 768px) 390px",
				"(min-resolution: 3dppx) calc(100vw * 0.6)",
				"(min-resolution: 2.5dppx) calc(100vw * 0.7)",
				"100vw",
			].join(", "),
		)
		assert.equal(
			tmdbSizes([[null, "340px"]]),
			"(min-resolution: 3dppx) 204px, (min-resolution: 2.5dppx) 238px, 340px",
		)
	})
})

describe("what a browser requests", () => {
	const backdrop = tmdbFluidImage("backdrop", "/b.jpg", [[null, "100vw"]], {
		fallbackWidth: 780,
	})
	const poster = tmdbFluidImage(
		"poster",
		"/p.jpg",
		[
			["(min-width: 1024px)", "200px"],
			["(min-width: 768px)", "23vw"],
			["(min-width: 475px)", "31vw"],
			[null, "42vw"],
		],
		{ fallbackWidth: 230, minWidth: 100, maxWidth: 230 },
	)

	it("gives a phone the w780 backdrop at full width, whatever its pixel ratio", () => {
		assert.equal(browserPick(backdrop, 360, 2), "w780")
		assert.equal(browserPick(backdrop, 412, 1.75), "w780") // Lighthouse's phone
		assert.equal(browserPick(backdrop, 412, 2.625), "w780") // Pixel 7
		assert.equal(browserPick(backdrop, 390, 3), "w780") // iPhone
		assert.equal(browserPick(backdrop, 430, 3), "w780")
	})

	it("gives a wide screen the backdrop that covers it", () => {
		assert.equal(browserPick(backdrop, 1440, 1), "w1280")
		assert.equal(browserPick(backdrop, 768, 1), "w780")
	})

	it("gives a phone the w342 poster in a two-column grid", () => {
		assert.equal(browserPick(poster, 360, 2), "w342")
		assert.equal(browserPick(poster, 412, 1.75), "w342")
		assert.equal(browserPick(poster, 412, 2.625), "w342")
		assert.equal(browserPick(poster, 390, 3), "w342")
		assert.equal(browserPick(poster, 430, 3), "w342")
	})

	it("gives a desktop grid the poster for its pixel ratio", () => {
		assert.equal(browserPick(poster, 1440, 1), "w342")
		assert.equal(browserPick(poster, 1440, 2), "w500")
	})
})

describe("tmdbFluidImage", () => {
	it("lists the steps with their widths, and a real src for crawlers", () => {
		const image = tmdbFluidImage("backdrop", "/b.jpg", [[null, "100vw"]], {
			fallbackWidth: 780,
		})
		assert.equal(image.src, `${BASE}/w780/b.jpg`)
		assert.equal(
			image.srcSet,
			`${BASE}/w300/b.jpg 300w, ${BASE}/w780/b.jpg 780w, ${BASE}/w1280/b.jpg 1280w`,
		)
		assert.equal(image.sizes, tmdbSizes([[null, "100vw"]]))
	})

	it("leaves out the steps below the narrowest and past twice the widest displayed width", () => {
		const image = tmdbFluidImage("poster", "/p.jpg", [[null, "46vw"]], {
			fallbackWidth: 230,
			minWidth: 100,
			maxWidth: 230,
		})
		assert.equal(image.src, `${BASE}/w342/p.jpg`)
		assert.equal(
			image.srcSet,
			[154, 185, 342, 500].map((w) => `${BASE}/w${w}/p.jpg ${w}w`).join(", "),
		)
	})
})

describe("which images are eager", () => {
	it("makes an image lazy unless a page says otherwise", () => {
		assert.deepEqual(imageLoadingProps(), {
			loading: "lazy",
			decoding: "async",
		})
		assert.deepEqual(imageLoadingProps("lazy"), {
			loading: "lazy",
			decoding: "async",
		})
	})

	it("never makes the page's largest image lazy, and fetches it first", () => {
		assert.deepEqual(imageLoadingProps("high"), { fetchpriority: "high" })
		assert.deepEqual(imageLoadingProps("eager"), {})
	})

	it("loads the first row of a poster grid without waiting, and the rest lazily", () => {
		assert.deepEqual([0, 1, 2, 5, 6, 40].map(gridPosterPriority), [
			"high",
			"high",
			"eager",
			"eager",
			"lazy",
			"lazy",
		])
	})
})
