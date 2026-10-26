// A page's 103 Early Hints response (early-hints.ts).
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { earlyHintLinks, isPageNavigation } from "./early-hints.ts"

const base = "https://static.example.com"
const files = {
	site: "/assets/tailwind-A1.css",
	home: ["/assets/living-room-B2.css", "/assets/boot-C3.css"],
	font: "/assets/gabarito-latin-D4.woff2",
	room: {
		phone: ["/assets/room-phone-E5.avif", "/assets/hand-F6.avif"],
		desktop: ["/assets/room-G7.avif", "/assets/hand-F6.avif"],
	},
	marks: ["/assets/logo-white-H8.svg", "/assets/primevideo-logo-I9.svg"],
}
const page = (url: string, headers: Record<string, string> = {}) => ({
	method: "GET",
	url,
	headers: { "sec-fetch-dest": "document", ...headers },
})
/** What Chrome on a phone sends with a navigation. */
const phone = {
	"sec-ch-ua-mobile": "?1",
	accept: "text/html,application/xhtml+xml,image/avif,image/webp,*/*;q=0.8",
}
const desktop = { ...phone, "sec-ch-ua-mobile": "?0" }

const shared = [
	`<${base}>; rel=preconnect; crossorigin`,
	`<${base}>; rel=preconnect`,
	`<${base}/assets/tailwind-A1.css>; rel=preload; as=style; crossorigin`,
	`<${base}/assets/gabarito-latin-D4.woff2>; rel=preload; as=font; type="font/woff2"; crossorigin`,
]
const homeSheets = [
	`<${base}/assets/living-room-B2.css>; rel=preload; as=style; crossorigin`,
	`<${base}/assets/boot-C3.css>; rel=preload; as=style; crossorigin`,
]
/** The first screen's small marks, which every browser draws: after the room's pictures. */
const marks = [
	`<${base}/assets/logo-white-H8.svg>; rel=preload; as=image; crossorigin`,
	`<${base}/assets/primevideo-logo-I9.svg>; rel=preload; as=image; crossorigin`,
]

describe("earlyHintLinks", () => {
	it("gives a phone's start page the shared hints, its style sheets and the portrait room's pictures", () => {
		assert.deepEqual(
			earlyHintLinks(page("/?tv=discover", phone), base, files),
			[
				...shared,
				...homeSheets,
				`<${base}/assets/room-phone-E5.avif>; rel=preload; as=image; crossorigin; fetchpriority=high`,
				`<${base}/assets/hand-F6.avif>; rel=preload; as=image; crossorigin; fetchpriority=high`,
				...marks,
			],
		)
	})

	it("gives a desktop's start page the room photo and the hand", () => {
		assert.deepEqual(earlyHintLinks(page("/", desktop), base, files), [
			...shared,
			...homeSheets,
			`<${base}/assets/room-G7.avif>; rel=preload; as=image; crossorigin; fetchpriority=high`,
			`<${base}/assets/hand-F6.avif>; rel=preload; as=image; crossorigin; fetchpriority=high`,
			...marks,
		])
	})

	it("names no picture when the browser doesn't say what it is or doesn't take AVIF", () => {
		assert.deepEqual(earlyHintLinks(page("/"), base, files), [
			...shared,
			...homeSheets,
			...marks,
		])
		assert.deepEqual(
			earlyHintLinks(
				page("/", { ...phone, accept: "text/html,image/webp,*/*" }),
				base,
				files,
			),
			[...shared, ...homeSheets, ...marks],
		)
	})

	it("gives every other page the site's style sheet and the brand font", () => {
		assert.deepEqual(
			earlyHintLinks(page("/movie/603-the-matrix", phone), base, files),
			shared,
		)
	})

	it("names the site's own host, without preconnects, while the page does; a font is always fetched without credentials", () => {
		assert.deepEqual(earlyHintLinks(page("/", phone), "", files), [
			"</assets/tailwind-A1.css>; rel=preload; as=style",
			'</assets/gabarito-latin-D4.woff2>; rel=preload; as=font; type="font/woff2"; crossorigin',
			"</assets/living-room-B2.css>; rel=preload; as=style",
			"</assets/boot-C3.css>; rel=preload; as=style",
			"</assets/room-phone-E5.avif>; rel=preload; as=image; fetchpriority=high",
			"</assets/hand-F6.avif>; rel=preload; as=image; fetchpriority=high",
			"</assets/logo-white-H8.svg>; rel=preload; as=image",
			"</assets/primevideo-logo-I9.svg>; rel=preload; as=image",
		])
	})
})

describe("isPageNavigation", () => {
	it("takes a browser's page request, by Sec-Fetch-Dest or else by Accept", () => {
		assert.equal(isPageNavigation(page("/")), true)
		assert.equal(
			isPageNavigation({
				method: "GET",
				url: "/discover",
				headers: { accept: "text/html,*/*" },
			}),
			true,
		)
	})

	it("leaves out files, data requests, API calls, other methods and other destinations", () => {
		for (const request of [
			page("/assets/root-A1.js"),
			page("/favicon-32x32.png"),
			page("/discover?_data=routes%2Fdiscover"),
			page("/api/intro"),
			page("/health/ready"),
			page("/og/index.jpg"),
			page("/sitemap.xml"),
			page("/mcp"),
			{ ...page("/"), method: "POST" },
			{ ...page("/"), method: "HEAD" },
			page("/", { "sec-fetch-dest": "iframe" }),
			{ method: "GET", url: "/", headers: { accept: "application/json" } },
		])
			assert.equal(isPageNavigation(request), false, request.url)
	})
})
