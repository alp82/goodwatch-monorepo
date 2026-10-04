import assert from "node:assert/strict"
import { test } from "node:test"

const { createRoutePatternMatcher } = await import("./route-pattern.ts")
const { createRouteTagger } = await import("./web-vitals-telemetry.ts")

const patternOf = createRoutePatternMatcher({
	root: { id: "root", path: "" },
	"routes/_index": { id: "routes/_index", parentId: "root", index: true },
	"routes/movie.$movieKey": {
		id: "routes/movie.$movieKey",
		parentId: "root",
		path: "movie/:movieKey",
	},
	"routes/u.$handle.lists.$id": {
		id: "routes/u.$handle.lists.$id",
		parentId: "root",
		path: "u/:handle/lists/:id",
	},
})
const landing = { pathname: "/movie/603-the-matrix", ttfbMs: 180 }

type Tagged = { properties: Record<string, unknown> }
const taggerFor = (
	pageLoad: typeof landing | { pathname: string; ttfbMs: null },
) => createRouteTagger(patternOf, pageLoad) as (event: unknown) => Tagged

test("every event with a path gets the route pattern", () => {
	const tag = taggerFor(landing)
	const tagged = tag({
		event: "$pageview",
		properties: { $pathname: "/u/some-handle/lists/42" },
	})
	assert.equal(tagged.properties.route_pattern, "/u/:handle/lists/:id")
	assert.equal("landing_route_pattern" in tagged.properties, false)
})

test("a path no route serves is `unmatched`", () => {
	const tag = taggerFor(landing)
	const tagged = tag({ event: "$pageview", properties: { $pathname: "/x/y" } })
	assert.equal(tagged.properties.route_pattern, "unmatched")
})

test("an event without a path passes through untouched", () => {
	const tag = taggerFor(landing)
	const event = { event: "$snapshot", properties: { size: 3 } }
	assert.equal(tag(event), event)
	assert.equal(tag(null), null)
})

test("the Web Vitals event with FCP carries the landing route and the TTFB", () => {
	const tag = taggerFor(landing)
	const tagged = tag({
		event: "$web_vitals",
		properties: {
			$pathname: "/movie/603-the-matrix",
			$web_vitals_FCP_value: 900,
			$web_vitals_LCP_value: 1400,
		},
	})
	assert.deepEqual(
		{
			route: tagged.properties.route_pattern,
			landing: tagged.properties.landing_route_pattern,
			ttfb: tagged.properties.ttfb_ms,
		},
		{ route: "/movie/:movieKey", landing: "/movie/:movieKey", ttfb: 180 },
	)
	assert.equal(tagged.properties.$web_vitals_LCP_value, 1400)
})

test("a later Web Vitals event of the same page load doesn't repeat the TTFB", () => {
	const tag = taggerFor(landing)
	const tagged = tag({
		event: "$web_vitals",
		properties: {
			$pathname: "/movie/603-the-matrix",
			$web_vitals_CLS_value: 0.02,
		},
	})
	assert.equal(tagged.properties.landing_route_pattern, "/movie/:movieKey")
	assert.equal("ttfb_ms" in tagged.properties, false)
})

test("after in-app navigation the event keeps the landing route and drops the TTFB", () => {
	const tag = taggerFor(landing)
	const tagged = tag({
		event: "$web_vitals",
		properties: { $pathname: "/", $web_vitals_FCP_value: 900 },
	})
	assert.equal(tagged.properties.route_pattern, "/")
	assert.equal(tagged.properties.landing_route_pattern, "/movie/:movieKey")
	assert.equal("ttfb_ms" in tagged.properties, false)
})

test("no TTFB from the browser means no TTFB property", () => {
	const tag = taggerFor({ ...landing, ttfbMs: null })
	const tagged = tag({
		event: "$web_vitals",
		properties: { $pathname: landing.pathname, $web_vitals_FCP_value: 900 },
	})
	assert.equal("ttfb_ms" in tagged.properties, false)
})

test("the tagger copies the event instead of changing it", () => {
	const tag = taggerFor(landing)
	const event = { event: "$pageview", properties: { $pathname: "/" } }
	tag(event)
	assert.deepEqual(event, {
		event: "$pageview",
		properties: { $pathname: "/" },
	})
})
