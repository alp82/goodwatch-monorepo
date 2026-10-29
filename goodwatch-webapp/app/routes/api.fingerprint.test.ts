import "../server/title-filter/test-alias.ts"
import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { beforeEach, mock, test } from "node:test"
import type { LoaderFunctionArgs } from "@remix-run/node"
import type { PopulationTitle } from "../domain/fingerprint-effects/population.ts"
import type { CoreScores } from "../server/utils/fingerprint.ts"

const stubUrl = `data:text/javascript,${encodeURIComponent(`
 export const state = {};
 export const getFingerprintPopulation = (...args) => state.getFingerprintPopulation(...args);
 export const loadFingerprintTitle = (...args) => state.loadFingerprintTitle(...args);
 export const FINGERPRINT_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400";
`)}`
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
		if (url.endsWith("/fingerprint-population.server.ts"))
			return {
				format: "module",
				source: `export * from ${JSON.stringify(stubUrl)}`,
				shortCircuit: true,
			}
		return next(url, context)
	},
})
const { state } = await import(stubUrl)
const getFingerprintPopulation = mock.fn(async (_type: string) =>
	buildPopulation([title]),
)
const loadFingerprintTitle = mock.fn(
	async (
		_type: string,
		_id: number,
	): Promise<
		(Omit<PopulationTitle, "scores"> & { scores: CoreScores | null }) | null
	> => null,
)
Object.assign(state, { getFingerprintPopulation, loadFingerprintTitle })
const { buildPopulation } = await import(
	"../domain/fingerprint-effects/population.ts"
)
const { VALID_FINGERPRINT_KEYS } = await import(
	"../server/utils/fingerprint.ts"
)
const { loader: mix } = await import("./api.fingerprint.mix.ts")
const { loader: pairs } = await import("./api.fingerprint.pairs.ts")
const title: PopulationTitle = {
	tmdbId: 1,
	title: "Dune",
	year: 2021,
	poster: "/dune.jpg",
	goodwatch: 80,
	scores: Object.fromEntries(
		VALID_FINGERPRINT_KEYS.map((k) => [k, 8]),
	) as CoreScores,
}
const args = (search: string) =>
	({
		request: new Request(`https://goodwatch.app/api/fingerprint/${search}`),
	}) as LoaderFunctionArgs
beforeEach(() => {
	getFingerprintPopulation.mock.resetCalls()
	loadFingerprintTitle.mock.resetCalls()
	getFingerprintPopulation.mock.mockImplementation(async () =>
		buildPopulation([title]),
	)
	loadFingerprintTitle.mock.mockImplementation(async () => null)
})

test("returns public pair data without querying a population title again", async () => {
	const response = await pairs(args("pairs?type=movie&id=1"))
	assert.ok(response.headers.get("Cache-Control")?.includes("public"))
	const result = await response.json()
	assert.equal(result.of, 1)
	assert.equal(result.pairs.length, 20)
	assert.equal(
		result.pairs.every(
			(p: { a: string; b: string; both: number }) =>
				Object.keys(p).sort().join(",") === "a,b,both",
		),
		true,
	)
	assert.equal(loadFingerprintTitle.mock.callCount(), 0)
})
test("loads scores for a title outside the population and returns 404 for a missing title", async () => {
	loadFingerprintTitle.mock.mockImplementationOnce(async () => ({
		...title,
		tmdbId: 99,
	}))
	assert.equal(
		(await (await pairs(args("pairs?type=show&id=99"))).json()).of,
		1,
	)
	assert.deepEqual(loadFingerprintTitle.mock.calls[0].arguments, ["show", 99])
	await assert.rejects(pairs(args("pairs?type=show&id=100")), { status: 404 })
})
test("returns exact mix fields and filters the excluded title's franchise outside the population", async () => {
	loadFingerprintTitle.mock.mockImplementationOnce(async () => ({
		...title,
		tmdbId: 99,
		title: "Dune: Part Two",
	}))
	const response = await mix(args("mix?type=movie&effects=real&exclude=99"))
	assert.ok(response.headers.get("Cache-Control")?.includes("s-maxage=86400"))
	assert.deepEqual(await response.json(), { total: 1, titles: [] })
	const other = await mix(args("mix?type=movie&effects=real&exclude=100"))
	const result = await other.json()
	assert.equal(result.total, 1)
	assert.deepEqual(Object.keys(result.titles[0]).sort(), [
		"goodwatch",
		"keys",
		"poster",
		"title",
		"tmdbId",
		"year",
	])
})
test("rejects invalid requests before loading data", async () => {
	for (const search of [
		"mix?type=movie&effects=unknown&exclude=1",
		"mix?type=movie&effects=real&exclude=-1",
		"mix?type=tv&effects=real&exclude=1",
	]) {
		await assert.rejects(mix(args(search)), { status: 400 })
	}
	await assert.rejects(pairs(args("pairs?type=movie&id=1e3")), { status: 400 })
	assert.equal(getFingerprintPopulation.mock.callCount(), 0)
})

test("pairs returns 404 for a title without a fingerprint while mix still excludes its franchise", async () => {
	loadFingerprintTitle.mock.mockImplementation(async () => ({
		...title,
		tmdbId: 99,
		title: "Dune: Part Two",
		scores: null,
	}))
	await assert.rejects(pairs(args("pairs?type=movie&id=99")), { status: 404 })
	const response = await mix(args("mix?type=movie&effects=real&exclude=99"))
	assert.equal(response.status, 200)
	assert.deepEqual(await response.json(), { total: 1, titles: [] })
	loadFingerprintTitle.mock.mockImplementation(async () => ({
		...title,
		tmdbId: 99,
		scores: {} as CoreScores,
	}))
	await assert.rejects(pairs(args("pairs?type=movie&id=99")), { status: 404 })
})
