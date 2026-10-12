// Newly available on a member's services (#456) on the server, against the in-memory Crate of the tracking tests
// with the offers of a country beside it: what the availability index reads to know when a service first carried a
// title, what a member is told, and that a request sends no statement unless something landed.

// CommonJS packages are loaded before the alias hook, which would otherwise resolve their own relative requires.
import "node-crate"
import "ioredis"
import "react"
import "@remix-run/node"
import "zod"
import ts from "typescript"
import "./title-filter/test-alias.ts"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as nodeModule from "node:module"
import { beforeEach, test } from "node:test"
import { CacheTestRedis } from "../utils/cache-test-redis.ts"
import { FakeTrackingCrate } from "./tracking-fake-crate.ts"

// The same stubs as my-pages.test.ts: the keys of two route files, no auth, and no title snapshot.
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
		let source: string | undefined
		if (url.endsWith("/routes/api.user-settings.get.tsx")) {
			const original = readFileSync(new URL(url), "utf8")
			source =
				original.slice(
					original.indexOf("// type definitions"),
					original.indexOf("// API endpoint"),
				) +
				original.slice(
					original.indexOf("export const queryKeyUserSettings"),
					original.indexOf("export const useUserSettings"),
				)
		} else if (url.endsWith("/routes/api.onboarding.media.tsx"))
			source = 'export const queryKeyOnboardingMedia = ["onboarding-media"]'
		else if (url.endsWith("/utils/auth.ts"))
			source =
				'export const getUserIdFromRequest = () => { throw new Error("Unexpected auth") }; export const getAuthFromRequest = getUserIdFromRequest'
		else if (url.endsWith("/title-snapshot/format.server.ts"))
			source = `${readFileSync(new URL(url), "utf8")}\nexport const getTitleSnapshot = () => null`
		if (source === undefined) return next(url, context)
		return {
			format: "module",
			source: ts.transpileModule(source, {
				compilerOptions: {
					module: ts.ModuleKind.ESNext,
					target: ts.ScriptTarget.ESNext,
				},
			}).outputText,
			shortCircuit: true,
		}
	},
})

const DAY = 86_400_000
// The launch is ten days back, so that offers can be dated before and after it and still lie in the past.
const LAUNCH = Date.now() - 10 * DAY
const day = (n: number) => LAUNCH + n * DAY

process.env.REDIS_HOST = ""
process.env.TASTE_REDIS_URL = ""
process.env.REC_TASTE_MATCH = "off"
process.env.REC_TRACKING = "on"
process.env.NEWLY_AVAILABLE_SINCE = new Date(LAUNCH).toISOString()
const { setCrateClientForTest } = await import("../utils/crate.ts")
const { setRedisClusterForTest, resetPendingResetsForTest } = await import(
	"../utils/cache.ts"
)
const { readFirstSeen, keptSince, launchTime, KEPT_DAYS } = await import(
	"./availability-first-seen.server.ts"
)
const { availabilityLoaded, forgetAvailabilityForTest, landingsOnServices } =
	await import("./availability-index.server.ts")
const { MY_MOVIES_VISIT_KEY, getNewlyAvailable, recordMyMoviesVisit } =
	await import("./newly-available.server.ts")
const { recordMyShowsVisit } = await import("./new-episodes.server.ts")
const { getMemberViewerContext } = await import("./viewer.server.ts")
const { signalOf, lineOf } = await import("../domain/newly-available.ts")
const { titleKey } = await import("../utils/title-key.ts")

class Redis extends CacheTestRedis {
	async set(key: string, value: string) {
		this.values.set(key, value)
	}
}

type Row = Record<string, unknown>
const TYPES = ["flatrate", "free", "ads"]

const NETFLIX = 8
const PRIME = 9
const AMAZON_VIDEO = 10
const MAX = 1899
const SERVICES = [
	{ id: NETFLIX, name: "Netflix", logo_path: "/netflix.png" },
	{ id: PRIME, name: "Amazon Prime Video", logo_path: "/prime.png" },
	{ id: MAX, name: "Max", logo_path: "/max.png" },
]

interface Offer {
	type: "movie" | "show"
	id: number
	country: string
	service: number
	kind: string
	at: number
}
const offer = (
	type: "movie" | "show",
	id: number,
	service: number,
	at: number,
	rest: Partial<Offer> = {},
): Offer => ({
	type,
	id,
	country: "US",
	service,
	kind: "flatrate",
	at,
	...rest,
})

/** The tracking tests' Crate, with a country's offers and the names of titles and services beside it. */
class Crate {
	db = new FakeTrackingCrate()
	offers: Offer[] = []
	names = new Map<number, string>()
	/** The statements about offers, in the order they came. */
	offerStatements: { sql: string; params: unknown[] }[] = []
	failFirstSeen = false

	async execute(raw: string, params: unknown[] = []) {
		const sql = raw.trim().replace(/\s+/g, " ")
		const answer = (rows: unknown[][]) => ({
			json: [],
			rows,
			rowcount: rows.length,
		})
		const table = sql.match(/FROM (\w+)/)?.[1]
		if (table === "streaming_service")
			return { json: SERVICES, rowcount: SERVICES.length }
		// The index's preload asks which countries the most members have.
		if (table === "user_setting" && sql.includes("GROUP BY"))
			return { json: [], rowcount: 0 }
		// The names of titles: one statement over both tables, the ids as two arrays.
		if (sql.includes("UNION ALL")) {
			const [movieIds, showIds] = params as [number[], number[]]
			const rows = (type: "movie" | "show", ids: number[]) =>
				ids.flatMap((id) => {
					const title = this.names.get(titleKey(type, id))
					return title
						? [
								{
									tmdb_id: id,
									media_type: type,
									title,
									release_year: 2021,
									poster_path: null,
									backdrop_path: null,
									runtime: null,
								},
							]
						: []
				})
			const json = [...rows("movie", movieIds), ...rows("show", showIds)]
			return { json, rowcount: json.length }
		}
		if (table !== "streaming_availability") return this.db.execute(raw, params)

		this.offerStatements.push({ sql, params })
		const [country, ...rest] = params as [string, ...unknown[]]
		const types = rest.splice(0, 3)
		assert.deepEqual(types, TYPES, "only subscription and free offers count")
		const inCountry = this.offers.filter(
			(o) => o.country === country && TYPES.includes(o.kind),
		)
		const titles = (offers: Offer[]) => [
			...new Map(offers.map((o) => [`${o.type}-${o.id}`, o])).values(),
		]
		// The index: one row per title with its services.
		if (sql.includes("collect_set(streaming_service_id)"))
			return answer(
				titles(inCountry).map((title) => [
					title.type,
					title.id,
					[
						...new Set(
							inCountry
								.filter((o) => o.type === title.type && o.id === title.id)
								.map((o) => o.service),
						),
					],
				]),
			)
		if (this.failFirstSeen) throw new Error("Crate is away")
		// The titles with an offer that first appeared since.
		if (sql.startsWith("SELECT DISTINCT media_type, media_tmdb_id")) {
			const [since] = rest as [number]
			return answer(
				titles(inCountry.filter((o) => o.at > since)).map((o) => [
					o.type,
					o.id,
				]),
			)
		}
		// Every service of those titles with the time it first carried them.
		if (
			sql.startsWith(
				"SELECT media_tmdb_id, streaming_service_id, min(created_at)",
			)
		) {
			const [type, ...ids] = rest as [string, ...number[]]
			const earliest = new Map<string, [number, number, number]>()
			for (const o of inCountry) {
				if (o.type !== type || !ids.includes(o.id)) continue
				const key = `${o.id}-${o.service}`
				const known = earliest.get(key)
				if (!known || o.at < known[2])
					earliest.set(key, [o.id, o.service, o.at])
			}
			return answer([...earliest.values()])
		}
		throw new Error(`The test does not know: ${sql}`)
	}
}

let crate: Crate
const user = "member-A"
const run = (sql: string, params: unknown[]) =>
	crate.execute(sql, params) as Promise<{ rows?: unknown[][] }>

const DUNE = 438631
const HEAT = 949
const TAR = 817758
const SEVERANCE = 95396
const PLURIBUS = 225171

const setting = (key: string, value: string): Row => ({
	user_id: user,
	key,
	value,
	created_at: day(-100),
	updated_at: day(-100),
})
const wish = (mediaType: string, id: number, at = day(-30)): Row => ({
	user_id: user,
	tmdb_id: id,
	media_type: mediaType,
	created_at: at,
	updated_at: at,
})
const stateRow = (id: number, state: string): Row => ({
	user_id: user,
	tmdb_id: id,
	media_type: "show",
	state,
	state_changed_at: day(-20),
	pass: 1,
	seen_press_group: null,
	seen_press_from: null,
	rate_prompt_dismissed_at: null,
	seen_question: "not_asked",
	created_at: day(-20),
	updated_at: day(-20),
})

/** A member in the United States with Netflix and Amazon Prime Video. */
const member = (settings = { country: "US", services: "8,9" }) => {
	const rows: Row[] = []
	if (settings.country) rows.push(setting("country_default", settings.country))
	if (settings.services)
		rows.push(setting("streaming_providers_default", settings.services))
	crate.db.seed("user_setting", rows)
}
const names = (
	titles: Record<string, [type: "movie" | "show", id: number]>,
) => {
	for (const [name, [type, id]] of Object.entries(titles))
		crate.names.set(titleKey(type, id), name)
}

/** What the member is told, once the country's availability is loaded. */
async function told(guessedCountry = "US") {
	const ctx = await getMemberViewerContext(user, guessedCountry)
	// The first call asks for the country, which starts its load.
	await getNewlyAvailable(ctx)
	await availabilityLoaded(ctx.country, 2000)
	crate.db.statements.length = 0
	return getNewlyAvailable(ctx)
}
const visitReads = () =>
	crate.db.statements.filter(
		(s) => s.sql.includes("FROM user_setting") && s.sql.includes("key = ?"),
	)

beforeEach(() => {
	crate = new Crate()
	setCrateClientForTest(crate)
	setRedisClusterForTest(new Redis())
	resetPendingResetsForTest()
	forgetAvailabilityForTest()
	names({
		Dune: ["movie", DUNE],
		Heat: ["movie", HEAT],
		Tár: ["movie", TAR],
		Severance: ["show", SEVERANCE],
		Pluribus: ["show", PLURIBUS],
	})
})

// ---------------------------------------------------------------------------------------------------------
// The times the index keeps

test("nothing from before the launch is kept, and nothing older than the days the index keeps", () => {
	assert.equal(launchTime(), LAUNCH)
	assert.equal(keptSince(LAUNCH + 5 * DAY), LAUNCH)
	const later = LAUNCH + (KEPT_DAYS + 30) * DAY
	assert.equal(keptSince(later), later - KEPT_DAYS * DAY)
})

test("the first-seen read asks for the titles with a recent offer, then for every service of those titles", async () => {
	crate.offers = [
		// Prime has had Heat for years; Netflix got it after the launch.
		offer("movie", HEAT, PRIME, day(-900)),
		offer("movie", HEAT, NETFLIX, day(2)),
		offer("movie", DUNE, NETFLIX, day(3)),
		// Nothing recent: never read a second time.
		offer("movie", TAR, NETFLIX, day(-50)),
		offer("show", SEVERANCE, NETFLIX, day(4)),
		// Another country, and an offer to rent.
		offer("movie", TAR, NETFLIX, day(4), { country: "DE" }),
		offer("movie", TAR, MAX, day(4), { kind: "rent" }),
	]
	const seen = await readFirstSeen(
		{ country: "US", types: TYPES, since: LAUNCH },
		run,
	)
	assert.deepEqual(
		crate.offerStatements.map((s) => s.sql.slice(0, 44)),
		[
			"SELECT DISTINCT media_type, media_tmdb_id FR",
			"SELECT media_tmdb_id, streaming_service_id, ",
			"SELECT media_tmdb_id, streaming_service_id, ",
		],
	)
	// One statement a kind of title, with the ids of that kind.
	assert.deepEqual(
		crate.offerStatements.slice(1).map((s) => s.params.slice(4)),
		[
			["movie", HEAT, DUNE],
			["show", SEVERANCE],
		],
	)
	assert.deepEqual(
		[...seen].map(([key, services]) => [key, [...services]]),
		[
			[titleKey("movie", HEAT), [[NETFLIX, day(2)]]],
			[titleKey("movie", DUNE), [[NETFLIX, day(3)]]],
			[titleKey("show", SEVERANCE), [[NETFLIX, day(4)]]],
		],
	)
})

test("without a recent offer the first-seen read is one statement", async () => {
	crate.offers = [offer("movie", TAR, NETFLIX, day(-50))]
	const seen = await readFirstSeen(
		{ country: "US", types: TYPES, since: LAUNCH },
		run,
	)
	assert.equal(seen.size, 0)
	assert.equal(crate.offerStatements.length, 1)
})

test("the index says when a title landed on some services", async () => {
	crate.offers = [
		offer("movie", HEAT, PRIME, day(-900)),
		offer("movie", HEAT, NETFLIX, day(2)),
		offer("movie", DUNE, NETFLIX, day(3)),
		// Amazon Video carried it before the id of Amazon Prime Video appeared.
		offer("movie", TAR, AMAZON_VIDEO, day(-900)),
		offer("movie", TAR, PRIME, day(3)),
	]
	const keys = [DUNE, HEAT, TAR, 1].map((id) => titleKey("movie", id))
	// While the country loads, nothing has landed.
	assert.deepEqual(landingsOnServices("US", [NETFLIX, PRIME], keys), [
		null,
		null,
		null,
		null,
	])
	assert.equal(await availabilityLoaded("US", 2000), true)
	assert.deepEqual(landingsOnServices("US", [NETFLIX, PRIME, 10, 119], keys), [
		{ at: day(3), service: NETFLIX },
		null,
		null,
		null,
	])
	// With Netflix alone, Heat was not watchable before.
	assert.deepEqual(landingsOnServices("US", [NETFLIX], keys)[1], {
		at: day(2),
		service: NETFLIX,
	})
})

test("when the first-seen read fails, the index loads and nothing has landed", async () => {
	crate.offers = [offer("movie", DUNE, NETFLIX, day(3))]
	crate.failFirstSeen = true
	const errors = console.error
	console.error = () => {}
	try {
		landingsOnServices("US", [NETFLIX], [titleKey("movie", DUNE)])
		assert.equal(await availabilityLoaded("US", 2000), true)
	} finally {
		console.error = errors
	}
	assert.deepEqual(
		landingsOnServices("US", [NETFLIX], [titleKey("movie", DUNE)]),
		[null],
	)
})

// ---------------------------------------------------------------------------------------------------------
// What a member is told

test("a member is told the Want to See titles and the shows they watch that landed on their services", async () => {
	member()
	crate.db.seed("user_wishlist", [
		wish("movie", DUNE),
		wish("movie", HEAT),
		wish("movie", TAR),
		wish("show", PLURIBUS),
	])
	crate.db.seed("user_watch_state", [stateRow(SEVERANCE, "on_hold")])
	crate.offers = [
		offer("movie", DUNE, NETFLIX, day(3)),
		// Already watchable on Prime: Netflix adding it is not news.
		offer("movie", HEAT, PRIME, day(-900)),
		offer("movie", HEAT, NETFLIX, day(2)),
		// On a service the member does not have.
		offer("movie", TAR, MAX, day(2)),
		offer("show", SEVERANCE, PRIME, day(5)),
		offer("show", PLURIBUS, NETFLIX, day(4)),
	]
	const fresh = await told()
	assert.deepEqual(fresh, {
		movies: { ids: [DUNE], titles: ["Dune"], service: "Netflix" },
		// The latest to land first.
		shows: {
			ids: [SEVERANCE, PLURIBUS],
			titles: ["Severance", "Pluribus"],
			service: "Amazon Prime Video",
		},
	})
	assert.deepEqual(signalOf(fresh), {
		movies: {
			count: 1,
			ids: [DUNE],
			only: { title: "Dune", service: "Netflix" },
		},
		shows: { count: 2, ids: [SEVERANCE, PLURIBUS], only: null },
	})
	assert.deepEqual(lineOf(fresh.shows), {
		count: 2,
		titles: ["Severance", "Pluribus"],
		service: "Amazon Prime Video",
	})
	// The two visits are read, each by its whole key, and no offer is read for the request.
	assert.equal(visitReads().length, 2)
	assert.equal(
		crate.offerStatements.length,
		4,
		"the index's load with its first-seen statements: the titles, then one a kind",
	)
})

test("with nothing landed a request sends no statement", async () => {
	member()
	crate.db.seed("user_wishlist", [wish("movie", HEAT), wish("movie", TAR)])
	crate.offers = [
		offer("movie", HEAT, PRIME, day(-900)),
		offer("movie", TAR, MAX, day(2)),
	]
	const fresh = await told()
	assert.equal(signalOf(fresh), null)
	assert.deepEqual(crate.db.statements, [])
})

test("nothing from before the launch is news, and no title added after its offer appeared", async () => {
	member()
	crate.db.seed("user_wishlist", [
		// The catch-up of late September 2026 made this offer look new.
		wish("movie", HEAT, day(-200)),
		// Added the day after it landed.
		wish("movie", DUNE, day(4)),
		wish("movie", TAR, day(1)),
	])
	crate.offers = [
		offer("movie", HEAT, NETFLIX, day(-14)),
		offer("movie", DUNE, NETFLIX, day(3)),
		offer("movie", TAR, NETFLIX, day(3)),
	]
	assert.deepEqual((await told()).movies.ids, [TAR])
})

test("opening My movies clears the movies, opening My shows the shows", async () => {
	member()
	crate.db.seed("user_wishlist", [wish("movie", DUNE), wish("show", PLURIBUS)])
	crate.offers = [
		offer("movie", DUNE, NETFLIX, day(3)),
		offer("show", PLURIBUS, NETFLIX, day(4)),
	]
	const before = await told()
	assert.deepEqual([before.movies.ids, before.shows.ids], [[DUNE], [PLURIBUS]])

	await recordMyMoviesVisit(user, day(6))
	assert.deepEqual(
		crate.db
			.table("user_setting")
			.filter((row) => row.key === MY_MOVIES_VISIT_KEY)
			.map((row) => row.value),
		[new Date(day(6)).toISOString()],
	)
	const afterMovies = await told()
	assert.deepEqual(
		[afterMovies.movies.ids, afterMovies.shows.ids],
		[[], [PLURIBUS]],
	)

	// The shows share the stored visit of My shows (#442).
	await recordMyShowsVisit(user, day(6))
	assert.equal(signalOf(await told()), null)

	// A title that lands after the visit is news again.
	crate.offers.push(offer("movie", HEAT, NETFLIX, day(7)))
	crate.db.seed("user_wishlist", [wish("movie", HEAT)])
	setRedisClusterForTest(new Redis())
	forgetAvailabilityForTest()
	assert.deepEqual((await told()).movies.ids, [HEAT])
})

test("a member without a saved service is told nothing", async () => {
	member({ country: "US", services: "" })
	crate.db.seed("user_wishlist", [wish("movie", DUNE)])
	crate.offers = [offer("movie", DUNE, NETFLIX, day(3))]
	assert.equal(signalOf(await told()), null)
})

test("a member without a saved country is told nothing, whatever country the request comes from", async () => {
	member({ country: "", services: "8,9" })
	crate.db.seed("user_wishlist", [wish("movie", DUNE)])
	crate.offers = [offer("movie", DUNE, NETFLIX, day(3))]
	const ctx = await getMemberViewerContext(user, "US")
	assert.equal(ctx.country, "US")
	assert.equal(signalOf(await getNewlyAvailable(ctx)), null)
	assert.deepEqual(crate.offerStatements, [], "no country is loaded for them")
})

test("a title whose offers are unknown is not news until an offer exists", async () => {
	member()
	crate.db.seed("user_wishlist", [wish("movie", DUNE)])
	crate.offers = []
	assert.equal(signalOf(await told()), null)
})

test("more than three landed titles are all counted, and three are named", async () => {
	member()
	const ids = [DUNE, HEAT, TAR, 4, 5]
	crate.db.seed(
		"user_wishlist",
		ids.map((id) => wish("movie", id)),
	)
	crate.offers = ids.map((id, i) =>
		offer("movie", id, NETFLIX, day(5 - i * 0.1)),
	)
	const fresh = await told()
	assert.deepEqual(fresh.movies, {
		ids,
		titles: ["Dune", "Heat", "Tár"],
		service: "Netflix",
	})
})
