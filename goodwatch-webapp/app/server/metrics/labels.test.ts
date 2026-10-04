// Checks that request labels never contain paths, identities or cookie contents.
import assert from "node:assert/strict"
import { test } from "node:test"
import "@remix-run/react"
import "../title-filter/test-alias.ts"
const { createRoutePatternMatcher } = await import(
	"../../utils/route-pattern.ts"
)
const { routeLabel, statusClass, createAudienceLabel, cacheControlLabel } =
	await import("./labels.server.ts")

test("routes use manifest patterns, static and unmatched labels", () => {
	const matcher = createRoutePatternMatcher({
		root: { id: "root", path: "" },
		home: { id: "home", parentId: "root", index: true },
		movie: { id: "movie", parentId: "root", path: "movie/:movieKey" },
	})
	assert.equal(routeLabel("/", 200, matcher), "/")
	assert.equal(
		routeLabel("/movie/603-the-matrix", 500, matcher),
		"/movie/:movieKey",
	)
	assert.equal(routeLabel("/assets/file.js", 404, matcher), "static")
	assert.equal(routeLabel("/favicon.ico", 200, matcher), "static")
	assert.equal(routeLabel("/nope", 404, matcher), "unmatched")
})
test("a public file is static even when a wide route matches its path", () => {
	const matcher = createRoutePatternMatcher({
		root: { id: "root", path: "" },
		type: { id: "type", parentId: "root", path: ":type", index: true },
	})
	const publicFiles = new Set(["/favicon.ico"])
	assert.equal(routeLabel("/favicon.ico", 200, matcher, publicFiles), "static")
	assert.equal(routeLabel("/movies", 200, matcher, publicFiles), "/:type")
})
test("status codes form five bounded classes", () => {
	assert.deepEqual(
		[0, 199, 200, 299, 300, 399, 400, 499, 500, 599].map(statusClass),
		["1xx", "1xx", "2xx", "2xx", "3xx", "3xx", "4xx", "4xx", "5xx", "5xx"],
	)
})
test("audience tests exact cookie names and numeric chunks, with a fallback", () => {
	const label = createAudienceLabel("https://example.supabase.co")
	for (const header of [
		undefined,
		"",
		"other=sb-example-auth-token=x",
		"sb-other-auth-token=x",
		"xsb-example-auth-token=x",
		"sb-example-auth-token.other=x",
	])
		assert.equal(label(header), "anon")
	for (const header of [
		"sb-example-auth-token=",
		"a=b; sb-example-auth-token.0=secret",
		"sb-example-auth-token.1=x; a=b",
	])
		assert.equal(label(header), "member")
	const fallback = createAudienceLabel()
	assert.equal(fallback("a=b; sb-other-auth-token.1=x"), "member")
	assert.equal(fallback("a=sb-other-auth-token=x"), "anon")
})
test("cache directives prioritize private restrictions", () => {
	for (const header of [undefined, "", "max-age=60", "x-public=1"])
		assert.equal(cacheControlLabel(header), "none")
	for (const header of [
		"public, max-age=60",
		"s-maxage=60",
		"PUBLIC",
		"s-maxage=0",
	])
		assert.equal(cacheControlLabel(header), "shared")
	for (const header of [
		"private",
		"no-store, public",
		"public, no-cache",
		'private="Set-Cookie", s-maxage=60',
	])
		assert.equal(cacheControlLabel(header), "private")
})
