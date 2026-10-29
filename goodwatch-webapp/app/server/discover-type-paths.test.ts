import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { test } from "node:test"
import ts from "typescript"
import { stubModules } from "./rating-onboarding.test-support.ts"

// Import the route without its UI or service connections. Redirects must finish before browsing or authentication.
stubModules({
	"~/navigation/instant-navigation":
		"export const cachedClientLoader = () => () => {}",
	"~/server/discover-legacy-params.server":
		"export const legacyDiscoverRedirect = async () => null",
	"~/server/discover-results.server":
		"export class SnapshotNotLoaded extends Error {}; export const discoverFilterDefaults = () => ({}); export const forYouFromParams = () => false; export const getDiscoverResults = () => { throw new Error('Unexpected browse') }",
	"~/server/media-payload.server":
		"export const presentCatalogLoader = load => load",
	"~/server/person.server":
		"export const getPersonName = () => { throw new Error('Unexpected person lookup') }",
	"~/server/viewer.server":
		"export const getViewerContext = () => { throw new Error('Unexpected viewer lookup') }",
	"~/utils/auth":
		"export const getUserIdFromRequest = () => { throw new Error('Unexpected authentication') }",
	"~/telemetry/telemetry": "export const reportBoundaryError = () => {}",
	"~/ui/ErrorPage":
		"export const ErrorPage = () => null; export const errorPageProps = () => ({})",
	"~/ui/discover/DiscoverPage": "export const DiscoverPage = () => null",
	"~/ui/discover/useDiscoverBrowse":
		"export const browseKey = () => ''; export const withSides = () => ''",
	"~/utils/meta": "export const buildMeta = () => []",
})

const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		load(
			url: string,
			context: unknown,
			next: (url: string, context: unknown) => unknown,
		): unknown
	}): void
}
registerHooks({
	load(url, context, next) {
		if (!url.endsWith("/routes/discover.($type).tsx")) return next(url, context)
		return {
			format: "module",
			shortCircuit: true,
			source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
				compilerOptions: {
					module: ts.ModuleKind.ESNext,
					jsx: ts.JsxEmit.ReactJSX,
				},
			}).outputText,
		}
	},
})

const { loader } = await import("../routes/discover.($type).tsx")

async function assertRedirect(
	segment: string,
	search: string,
	expected: string,
) {
	const response = await loader({
		request: new Request(`https://goodwatch.test/discover/${segment}${search}`),
		params: { type: segment },
		context: {},
	})
	assert.ok(response instanceof Response)
	assert.equal(response.status, 301)
	assert.equal(response.headers.get("Location"), expected)
	assert.equal(response.headers.get("Cache-Control"), "private, no-store")
}

for (const [segment, type] of [
	["movies", "movie"],
	["movie", "movie"],
	["shows", "show"],
	["show", "show"],
]) {
	test(`/discover/${segment} redirects to the ${type} filter`, async () => {
		await assertRedirect(segment, "", `/discover?type=${type}`)
		await assertRedirect(
			segment,
			"?country=DE&page=2",
			`/discover?country=DE&page=2&type=${type}`,
		)
	})
}

test("unknown Discover segments still redirect to plain Discover", async () => {
	await assertRedirect("unknown", "", "/discover")
	await assertRedirect("all", "?country=DE", "/discover?country=DE")
})

test("an explicit type query still takes precedence over the path", async () => {
	await assertRedirect(
		"shows",
		"?type=movie&country=DE",
		"/discover?type=movie&country=DE",
	)
	await assertRedirect("movie", "?type=show", "/discover?type=show")
	await assertRedirect("unknown", "?type=show", "/discover?type=show")
})
