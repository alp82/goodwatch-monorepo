// A page's 103 Early Hints response (early-hints.ts).
import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { earlyHintLinks, isPageNavigation } from "./early-hints.ts"

const base = "https://static.example.com"
const sheets = {
	site: "/assets/tailwind-A1.css",
	home: ["/assets/living-room-B2.css", "/assets/boot-C3.css"],
}
const page = (url: string, headers: Record<string, string> = {}) => ({
	method: "GET",
	url,
	headers: { "sec-fetch-dest": "document", ...headers },
})

describe("earlyHintLinks", () => {
	it("gives the start page both preconnects and its render-blocking style sheets, without credentials like its links", () => {
		assert.deepEqual(earlyHintLinks(page("/?tv=discover"), base, sheets), [
			`<${base}>; rel=preconnect; crossorigin`,
			`<${base}>; rel=preconnect`,
			`<${base}/assets/tailwind-A1.css>; rel=preload; as=style; crossorigin`,
			`<${base}/assets/living-room-B2.css>; rel=preload; as=style; crossorigin`,
			`<${base}/assets/boot-C3.css>; rel=preload; as=style; crossorigin`,
		])
	})

	it("gives every other page the site's style sheet only", () => {
		assert.deepEqual(
			earlyHintLinks(page("/movie/603-the-matrix"), base, sheets),
			[
				`<${base}>; rel=preconnect; crossorigin`,
				`<${base}>; rel=preconnect`,
				`<${base}/assets/tailwind-A1.css>; rel=preload; as=style; crossorigin`,
			],
		)
	})

	it("names the site's own host, without preconnects or crossorigin, while the page does", () => {
		assert.deepEqual(earlyHintLinks(page("/"), "", sheets), [
			"</assets/tailwind-A1.css>; rel=preload; as=style",
			"</assets/living-room-B2.css>; rel=preload; as=style",
			"</assets/boot-C3.css>; rel=preload; as=style",
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
