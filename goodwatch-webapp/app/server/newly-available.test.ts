// Newly available on a member's services (#456) on the server, against the in-memory Crate of the tracking tests
// with the offers of a country beside it: what the availability index reads to know when a service first carried a
// title, what a member is told, and that a request sends no statement unless something landed. And the 14 days a
// landing counts for (#489): what My movies and My shows list, what the Want to See list marks, and which title
// leads a home door.

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
const LAUNCH = Math.floor(Date.now() / DAY) * DAY - 10 * DAY
const day = (n: number) => LAUNCH + n * DAY

process.env.REDIS_HOST = ""
process.env.TASTE_REDIS_URL = ""
// No scheduled taste rebuild: it would read Crate after the test's own writes.
const { holdTasteRebuildsForTest } = await import("./taste/member.server.ts")
holdTasteRebuildsForTest()
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
const {
	MY_MOVIES_VISIT_KEY,
	getNewlyAvailable,
	recordMyMoviesVisit,
	getLandings,
	getNewOn,
	getRecentlyLanded,
} = await import("./newly-available.server.ts")
const { getTonightParts } = await import("./home-doors.server.ts")
const { getLibraryPage } = await import("./my-library.server.ts")
const { recordMyShowsVisit } = await import("./new-episodes.server.ts")
const { getMemberViewerContext } = await import("./viewer.server.ts")
const { signalOf } = await import("../domain/newly-available.ts")
const { titleKey } = await import("../utils/title-key.ts")
const { tonightsPickOf } = await import("../domain/my-shows.ts")

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
	source?: "backfill" | "title" | "premiere"
	precision?: "exact" | "unknown"
	createdAt?: number
	observedAt?: number
	droppedOn?: number
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
	afterCandidateRead?: () => void

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
		// Watch next's sort facts for the movies behind home's door: a day, a score and a popularity for each.
		if (sql.includes(" AS day, ")) {
			const json = (params as number[]).map((id) => ({
				tmdb_id: id,
				day: day(-400),
				score: 80,
				popularity: 10,
			}))
			return { json, rowcount: json.length }
		}
		if (table !== "streaming_availability" && table !== "availability_history")
			return this.db.execute(raw, params)

		this.offerStatements.push({ sql, params })
		const [country, ...rest] = params as [string, ...unknown[]]
		const types = rest.splice(0, 3)
		assert.deepEqual(types, TYPES, "only subscription and free offers count")
		const inCountry = this.offers.filter(
			(o) =>
				o.country === country &&
				TYPES.includes(o.kind) &&
				(o.droppedOn === undefined ||
					(table === "availability_history" &&
						sql.includes("OR dropped_on >=") &&
						o.droppedOn >= Number(rest[0]))),
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
		const landedDay = (o: Offer) =>
			o.precision === "unknown"
				? Math.floor((o.observedAt ?? o.at) / DAY) * DAY
				: o.at

		// The titles with a live stay that opened since.
		if (sql.startsWith("SELECT DISTINCT media_type, media_tmdb_id")) {
			const [since] = rest as [number]
			const result = answer(
				titles(
					inCountry.filter(
						(o) => o.source !== "backfill" && landedDay(o) >= since,
					),
				)
					.sort((a, b) => a.type.localeCompare(b.type) || a.id - b.id)
					.slice(0, Number(sql.match(/LIMIT (\d+)/)?.[1] ?? 10000))
					.map((o) => [o.type, o.id]),
			)
			this.afterCandidateRead?.()
			return result
		}
		// Every service of those titles with the time it first carried them.
		if (
			sql.startsWith("SELECT media_tmdb_id, streaming_service_id, min(CASE")
		) {
			const [, type, ...ids] = rest as [number, string, ...number[]]
			const earliest = new Map<
				string,
				[number, number, number, number | null, number]
			>()
			for (const o of inCountry) {
				if (o.type !== type || !ids.includes(o.id)) continue
				const key = `${o.id}-${o.service}-${o.droppedOn ?? "open"}`
				const known = earliest.get(key)
				const at = o.source === "backfill" ? 0 : landedDay(o)
				const learnedAt = o.createdAt ?? landedDay(o)
				earliest.set(key, [
					o.id,
					o.service,
					Math.min(at, known?.[2] ?? at),
					o.droppedOn ?? null,
					Math.min(learnedAt, known?.[4] ?? learnedAt),
				])
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

const episodeRow = (showId: number, number: number, airDate: number): Row => ({
	show_id: showId,
	tmdb_id: showId * 1000 + number,
	season_number: 1,
	episode_number: number,
	name: `Episode ${number}`,
	air_date: airDate,
	runtime: 45,
	still_path: null,
	episode_type: "standard",
	removed_at: null,
})
const watchRow = (showId: number, number: number, at: number): Row => ({
	user_id: user,
	watch_id: `w-${showId}-${number}`,
	media_type: "show",
	tmdb_id: showId,
	episode_tmdb_id: showId * 1000 + number,
	season_number: 1,
	episode_number: number,
	watched_at: at,
	watched_at_precision: "moment",
	origin: "single",
	group_id: null,
	import_id: null,
	pass: 1,
	created_at: at,
	updated_at: at,
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
		crate.offerStatements.slice(1).map((s) => s.params.slice(5)),
		[
			["movie", HEAT, DUNE],
			["show", SEVERANCE],
		],
	)
	assert.deepEqual(
		[...seen].map(([key, services]) => [key, [...services]]),
		[
			[
				titleKey("movie", HEAT),
				[[NETFLIX, { at: day(2), learnedAt: day(2), previousServices: [] }]],
			],
			[
				titleKey("movie", DUNE),
				[[NETFLIX, { at: day(3), learnedAt: day(3), previousServices: [] }]],
			],
			[
				titleKey("show", SEVERANCE),
				[[NETFLIX, { at: day(4), learnedAt: day(4), previousServices: [] }]],
			],
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

test("backfilled stays never announce landings, including duplicate ids and offer types", async () => {
	crate.offers = [
		offer("movie", HEAT, NETFLIX, day(3), { source: "backfill" }),
		offer("movie", DUNE, PRIME, day(3)),
		offer("movie", DUNE, AMAZON_VIDEO, day(2), {
			source: "backfill",
			kind: "free",
		}),
		offer("movie", TAR, NETFLIX, day(3)),
		offer("movie", TAR, NETFLIX, day(2), { source: "backfill", kind: "ads" }),
	]
	await availabilityLoaded("US", 2000)
	assert.deepEqual(
		landingsOnServices(
			"US",
			[NETFLIX, PRIME],
			[HEAT, DUNE, TAR].map((id) => titleKey("movie", id)),
		),
		[null, null, null],
	)
})

test("exact landings use appeared_on and unknown live landings use the observed UTC day", async () => {
	crate.offers = [
		offer("movie", DUNE, NETFLIX, day(2), {
			precision: "exact",
			observedAt: day(6),
		}),
		offer("movie", HEAT, NETFLIX, day(-100), {
			precision: "unknown",
			observedAt: day(4) + 12 * 3600000,
		}),
		offer("movie", TAR, NETFLIX, day(5), {
			precision: "unknown",
			observedAt: day(-1),
		}),
	]
	await availabilityLoaded("US", 2000)
	assert.deepEqual(
		landingsOnServices(
			"US",
			[NETFLIX],
			[DUNE, HEAT, TAR].map((id) => titleKey("movie", id)),
		),
		[
			{ at: day(2), learnedAt: day(2), service: NETFLIX },
			{ at: day(4), learnedAt: day(4), service: NETFLIX },
			null,
		],
	)
})

test("a same-day flatrate-to-ads switch on service 2383 continues the backfilled stay", async () => {
	crate.offers = [
		offer("movie", DUNE, 2383, day(-100), {
			source: "backfill",
			droppedOn: day(3),
		}),
		offer("movie", DUNE, 2383, day(3), { kind: "ads" }),
	]
	await availabilityLoaded("US", 2000)
	assert.deepEqual(
		landingsOnServices("US", [2383], [titleKey("movie", DUNE)]),
		[null],
	)
})

test("a same-day 119-to-9 switch continues the backfilled Prime stay", async () => {
	crate.offers = [
		offer("movie", DUNE, 119, day(-100), {
			source: "backfill",
			droppedOn: day(3),
		}),
		offer("movie", DUNE, PRIME, day(3)),
	]
	await availabilityLoaded("US", 2000)
	assert.deepEqual(
		landingsOnServices("US", [PRIME], [titleKey("movie", DUNE)]),
		[null],
	)
})

test("a next-day return after a flicker continues the old live stay", async () => {
	crate.offers = [
		offer("movie", DUNE, NETFLIX, day(-5), { droppedOn: day(2) }),
		offer("movie", DUNE, NETFLIX, day(3), { precision: "exact" }),
	]
	await availabilityLoaded("US", 2000)
	assert.deepEqual(
		landingsOnServices("US", [NETFLIX], [titleKey("movie", DUNE)]),
		[null],
	)
})

test("a switch between saved services is not news, but a member with only the new service sees it", async () => {
	crate.offers = [
		offer("movie", DUNE, 119, day(-100), {
			source: "backfill",
			droppedOn: day(3),
		}),
		offer("movie", DUNE, MAX, day(3)),
	]
	await availabilityLoaded("US", 2000)
	assert.deepEqual(
		landingsOnServices("US", [PRIME, MAX], [titleKey("movie", DUNE)]),
		[null],
	)
	assert.deepEqual(landingsOnServices("US", [MAX], [titleKey("movie", DUNE)]), [
		{ at: day(3), learnedAt: day(3), service: MAX },
	])
})

test("a continuous live stay keeps its original landing day and learned time", async () => {
	member()
	crate.db.seed("user_wishlist", [wish("movie", DUNE)])
	await recordMyMoviesVisit(user, day(2))
	crate.offers = [
		offer("movie", DUNE, NETFLIX, day(3), {
			droppedOn: day(5),
			createdAt: day(3) + 3600000,
		}),
		offer("movie", DUNE, NETFLIX, day(5), { createdAt: day(5) + 3600000 }),
	]
	assert.deepEqual((await told()).movies.ids, [DUNE])
	assert.equal(
		(await getRecentlyLanded(await loaded(), day(6))).movies[0]?.at,
		day(3),
	)
	await recordMyMoviesVisit(user, day(4))
	assert.equal(signalOf(await getNewlyAvailable(await loaded())), null)
})

test("a closed stay does not date a return's open stay", async () => {
	crate.offers = [
		offer("movie", DUNE, NETFLIX, day(-100), {
			source: "backfill",
			droppedOn: day(1),
		}),
		offer("movie", DUNE, NETFLIX, day(3), { source: "title" }),
	]
	await availabilityLoaded("US", 2000)
	assert.deepEqual(
		landingsOnServices("US", [NETFLIX], [titleKey("movie", DUNE)]),
		[{ at: day(3), learnedAt: day(3), service: NETFLIX }],
	)
})

test("a country with more than 20,000 recent titles still returns all landings", async () => {
	crate.offers = Array.from({ length: 20001 }, (_, id) =>
		offer("movie", id + 1, NETFLIX, day(3)),
	)
	await availabilityLoaded("US", 30000)
	const keys = crate.offers.map((o) => titleKey(o.type, o.id))
	assert.deepEqual(
		landingsOnServices("US", [NETFLIX], keys),
		keys.map(() => ({ at: day(3), learnedAt: day(3), service: NETFLIX })),
	)
})

test("a stay closing during candidate reads cannot shift a later landing out of the result", async () => {
	crate.offers = Array.from({ length: 1001 }, (_, id) =>
		offer("movie", id + 1, NETFLIX, day(3)),
	)
	crate.afterCandidateRead = () => {
		crate.offers[0].droppedOn = day(4)
	}
	await availabilityLoaded("US", 2000)
	assert.deepEqual(
		landingsOnServices("US", [NETFLIX], [titleKey("movie", 1001)]),
		[{ at: day(3), learnedAt: day(3), service: NETFLIX }],
	)
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
		{ at: day(3), learnedAt: day(3), service: NETFLIX },
		null,
		null,
		null,
	])
	// With Netflix alone, Heat was not watchable before.
	assert.deepEqual(landingsOnServices("US", [NETFLIX], keys)[1], {
		at: day(2),
		learnedAt: day(2),
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

test("a 10:00 visit and same-day wishlist addition still see a stay observed at 13:00", async () => {
	member()
	const hour = 3_600_000
	crate.db.seed("user_wishlist", [wish("movie", DUNE, day(5) + 11 * hour)])
	await recordMyMoviesVisit(user, day(5) + 10 * hour)
	crate.offers = [
		offer("movie", DUNE, NETFLIX, day(5), {
			precision: "unknown",
			observedAt: day(5) + 13 * hour,
			createdAt: day(5) + 14 * hour,
		}),
	]
	assert.deepEqual((await told()).movies.ids, [DUNE])
	const ctx = await loaded()
	const recent = await getRecentlyLanded(ctx, day(5) + 15 * hour)
	assert.equal(recent.movies[0]?.at, day(5))
	assert.equal(recent.movies[0]?.days, 0)
	await recordMyMoviesVisit(user, day(5) + 14 * hour)
	assert.equal(signalOf(await getNewlyAvailable(ctx)), null)
	assert.deepEqual(listed((await getRecentlyLanded(ctx, day(6))).movies), [
		DUNE,
	])
})

test("a further service on the same landing day does not restart news after a visit", async () => {
	member()
	const hour = 3_600_000
	crate.db.seed("user_wishlist", [wish("movie", DUNE)])
	await recordMyMoviesVisit(user, day(5) + 10 * hour)
	crate.offers = [
		offer("movie", DUNE, NETFLIX, day(5), { createdAt: day(5) + 13 * hour }),
		offer("movie", DUNE, PRIME, day(5), { createdAt: day(5) + 9 * hour }),
	]
	assert.equal(signalOf(await told()), null)
})

test("a backdated exact landing uses its learned time for news and its day for sorting and the 14 days", async () => {
	member()
	crate.db.seed("user_wishlist", [
		wish("movie", DUNE, day(3)),
		wish("movie", HEAT, day(-10)),
	])
	await recordMyMoviesVisit(user, day(4))
	crate.offers = [
		offer("movie", DUNE, NETFLIX, day(1), {
			precision: "exact",
			observedAt: day(7),
			createdAt: day(7),
		}),
		offer("movie", HEAT, NETFLIX, day(3), { createdAt: day(6) }),
	]
	assert.deepEqual((await told()).movies.ids, [HEAT, DUNE])
	const ctx = await loaded()
	await recordMyMoviesVisit(user, day(8))
	assert.deepEqual(listed((await getRecentlyLanded(ctx, day(14))).movies), [
		HEAT,
		DUNE,
	])
	assert.deepEqual(listed((await getRecentlyLanded(ctx, day(15))).movies), [
		HEAT,
	])
})

test("the earliest created_at across a service's live offers clears news after a visit", async () => {
	member()
	crate.db.seed("user_wishlist", [wish("movie", DUNE)])
	await recordMyMoviesVisit(user, day(5) + 10 * 3600000)
	crate.offers = [
		offer("movie", DUNE, NETFLIX, day(5), {
			kind: "ads",
			createdAt: day(5) + 13 * 3600000,
		}),
		offer("movie", DUNE, NETFLIX, day(5), { createdAt: day(5) + 9 * 3600000 }),
	]
	assert.equal(signalOf(await told()), null)
})

test("a landing on the launch day counts even when the configured launch has a time", async () => {
	const previous = process.env.NEWLY_AVAILABLE_SINCE
	process.env.NEWLY_AVAILABLE_SINCE = new Date(
		LAUNCH + 12 * 3_600_000,
	).toISOString()
	try {
		member()
		crate.db.seed("user_wishlist", [wish("movie", DUNE)])
		crate.offers = [
			offer("movie", DUNE, NETFLIX, LAUNCH, {
				createdAt: LAUNCH + 13 * 3_600_000,
			}),
		]
		assert.deepEqual((await told()).movies.ids, [DUNE])
		assert.deepEqual(
			listed((await getRecentlyLanded(await loaded(), LAUNCH + DAY)).movies),
			[DUNE],
		)
	} finally {
		process.env.NEWLY_AVAILABLE_SINCE = previous
	}
})

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
		movies: { ids: [DUNE], only: { title: "Dune", service: "Netflix" } },
		// The latest to land first. Several are counted, and no name is read for them.
		shows: { ids: [SEVERANCE, PLURIBUS], only: null },
	})
	assert.deepEqual(signalOf(fresh), {
		movies: {
			count: 1,
			ids: [DUNE],
			only: { title: "Dune", service: "Netflix" },
		},
		shows: { count: 2, ids: [SEVERANCE, PLURIBUS], only: null },
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

test("several landed titles are all counted, and none is named", async () => {
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
	assert.deepEqual(fresh.movies, { ids, only: null })
})

// ---------------------------------------------------------------------------------------------------------
// Recently landed (#489): what the pages list, for 14 days from the day a title landed

/** The member's context once the country's availability is loaded, with the statements so far forgotten. */
async function loaded() {
	const ctx = await getMemberViewerContext(user, "US")
	await getNewlyAvailable(ctx)
	await availabilityLoaded(ctx.country, 2000)
	crate.db.statements.length = 0
	return ctx
}
const listed = (titles: { tmdbId: number }[]) =>
	titles.map(({ tmdbId }) => tmdbId)

test("My movies and My shows are told what landed in the last 14 days, the latest first, with its service and day", async () => {
	member()
	crate.db.seed("user_wishlist", [
		wish("movie", DUNE),
		wish("movie", HEAT),
		wish("show", PLURIBUS),
	])
	crate.db.seed("user_watch_state", [stateRow(SEVERANCE, "watching")])
	crate.offers = [
		offer("movie", DUNE, NETFLIX, day(3)),
		offer("movie", HEAT, PRIME, day(8)),
		offer("show", SEVERANCE, PRIME, day(5)),
		offer("show", PLURIBUS, NETFLIX, day(4)),
	]
	const recent = await getRecentlyLanded(await loaded(), day(9))
	assert.deepEqual(recent.movies, [
		{
			mediaType: "movie",
			tmdbId: HEAT,
			title: "Heat",
			poster_path: null,
			at: day(8),
			days: 1,
			// The short name, as the title page says it.
			service: { id: PRIME, name: "Prime", logo_path: "/prime.png" },
		},
		{
			mediaType: "movie",
			tmdbId: DUNE,
			title: "Dune",
			poster_path: null,
			at: day(3),
			days: 6,
			service: { id: NETFLIX, name: "Netflix", logo_path: "/netflix.png" },
		},
	])
	assert.deepEqual(listed(recent.shows), [SEVERANCE, PLURIBUS])
	// Everything is within the 14 days: no visit is read for it.
	assert.equal(visitReads().length, 0)
})

test("opening the page clears the signal and leaves the row: the row replaces the line said once", async () => {
	member()
	crate.db.seed("user_wishlist", [wish("movie", DUNE), wish("show", PLURIBUS)])
	crate.offers = [
		offer("movie", DUNE, NETFLIX, day(3)),
		offer("show", PLURIBUS, NETFLIX, day(4)),
	]
	const ctx = await loaded()
	await recordMyMoviesVisit(user, day(6))
	await recordMyShowsVisit(user, day(6))
	assert.equal(signalOf(await getNewlyAvailable(ctx)), null)
	const recent = await getRecentlyLanded(ctx, day(9))
	assert.deepEqual(listed(recent.movies), [DUNE])
	assert.deepEqual(listed(recent.shows), [PLURIBUS])
	// Day 16 is the last of Dune's 14 days, and the 13th of the show's.
	const last = await getRecentlyLanded(ctx, day(16))
	assert.deepEqual(listed(last.movies), [DUNE])
	const after = await getRecentlyLanded(ctx, day(17))
	assert.deepEqual(listed(after.movies), [])
	assert.deepEqual(listed(after.shows), [PLURIBUS])
	assert.deepEqual(await getRecentlyLanded(ctx, day(18)), {
		movies: [],
		shows: [],
	})
})

test("a landing older than 14 days is listed while it is still news, and then the visit is read", async () => {
	member()
	crate.db.seed("user_wishlist", [wish("movie", DUNE), wish("movie", HEAT)])
	crate.offers = [
		offer("movie", DUNE, NETFLIX, day(1)),
		offer("movie", HEAT, NETFLIX, day(8)),
	]
	const ctx = await loaded()
	// The member has not opened My movies since: the signal counts both, so the page says both.
	assert.deepEqual((await getNewlyAvailable(ctx)).movies.ids, [HEAT, DUNE])
	crate.db.statements.length = 0
	const unseen = await getRecentlyLanded(ctx, day(20))
	assert.deepEqual(
		unseen.movies.map(({ tmdbId, days }) => [tmdbId, days]),
		[
			[HEAT, 12],
			[DUNE, 19],
		],
	)
	assert.equal(visitReads().length, 1, "the My movies visit, by its key")
	// Opened: Dune is no longer news and past its 14 days. Heat stays for its own.
	await recordMyMoviesVisit(user, day(20))
	assert.deepEqual(listed((await getRecentlyLanded(ctx, day(20))).movies), [
		HEAT,
	])
	// The marks and the doors go by the 14 days alone.
	assert.deepEqual(listed((await getLandings(ctx, day(20))).movies), [HEAT])
})

test("with nothing landed the row, the marks and the doors' lead send no statement", async () => {
	member()
	crate.db.seed("user_wishlist", [wish("movie", HEAT), wish("movie", TAR)])
	crate.offers = [
		offer("movie", HEAT, PRIME, day(-900)),
		offer("movie", TAR, MAX, day(2)),
	]
	const ctx = await loaded()
	assert.deepEqual(await getRecentlyLanded(ctx), { movies: [], shows: [] })
	assert.deepEqual(await getLandings(ctx), { movies: [], shows: [] })
	assert.equal((await getNewOn(ctx)).size, 0)
	assert.deepEqual(crate.db.statements, [])
})

test("a title added after it landed, a guest and a member without a service have nothing recently landed", async () => {
	member()
	crate.db.seed("user_wishlist", [wish("movie", DUNE, day(4))])
	crate.offers = [offer("movie", DUNE, NETFLIX, day(3))]
	const ctx = await loaded()
	assert.deepEqual(await getRecentlyLanded(ctx, day(5)), {
		movies: [],
		shows: [],
	})
	assert.deepEqual(await getRecentlyLanded({ ...ctx, services: [] }, day(5)), {
		movies: [],
		shows: [],
	})
	assert.deepEqual(
		await getRecentlyLanded(
			{ ...ctx, viewer: { kind: "guest", id: null } as never },
			day(5),
		),
		{ movies: [], shows: [] },
	)
})

test("several services: the title is marked with the one it landed on, and a second one later changes nothing", async () => {
	member()
	crate.db.seed("user_wishlist", [wish("movie", DUNE), wish("movie", HEAT)])
	crate.offers = [
		// On Netflix since day 2, and on Amazon Prime Video since day 6.
		offer("movie", DUNE, NETFLIX, day(2)),
		offer("movie", DUNE, PRIME, day(6)),
		// Already on Netflix for years: Amazon Prime Video adding it is no landing.
		offer("movie", HEAT, NETFLIX, day(-900)),
		offer("movie", HEAT, PRIME, day(6)),
	]
	const ctx = await loaded()
	const marks = await getNewOn(ctx, day(8))
	assert.deepEqual(
		[...marks],
		[
			[
				titleKey("movie", DUNE),
				{ id: NETFLIX, name: "Netflix", logo_path: "/netflix.png" },
			],
		],
	)
	// Its 14 days run from the first service: on day 16 it is over, ten days after the second one came.
	assert.equal((await getNewOn(ctx, day(15))).size, 1)
	assert.equal((await getNewOn(ctx, day(16))).size, 0)
})

test("the Want to See list marks the titles that are new on a service, and no other list does", async () => {
	member()
	crate.db.seed("user_wishlist", [wish("movie", DUNE), wish("movie", HEAT)])
	crate.db.seed("movie", [catalog(DUNE, "Dune"), catalog(HEAT, "Heat")])
	crate.offers = [
		offer("movie", DUNE, PRIME, day(3)),
		offer("movie", HEAT, NETFLIX, day(-900)),
	]
	const ctx = await loaded()
	const marks = await getNewOn(ctx, day(9))
	const choice = { status: "want", sort: null, kind: "all", q: "" } as const
	const want = await getLibraryPage(user, choice, 0, marks)
	assert.deepEqual(
		want.items.map((item) => [item.title, item.newOn ?? null]),
		[
			["Dune", { id: PRIME, name: "Prime", logo_path: "/prime.png" }],
			["Heat", null],
		].sort(
			(a, b) =>
				want.items.findIndex((item) => item.title === a[0]) -
				want.items.findIndex((item) => item.title === b[0]),
		),
	)
	// Without the marks the items are what they were.
	const plain = await getLibraryPage(user, choice)
	assert.ok(plain.items.every((item) => !("newOn" in item)))
	const seen = await getLibraryPage(
		user,
		{ ...choice, status: "seen" },
		0,
		marks,
	)
	assert.ok(seen.items.every((item) => !("newOn" in item)))
})

// ---------------------------------------------------------------------------------------------------------
// Home's doors (#489): a landed title leads its own door

const catalog = (id: number, name: string, rest: Row = {}): Row => ({
	tmdb_id: id,
	title: name,
	poster_path: `/p${id}.jpg`,
	backdrop_path: `/b${id}.jpg`,
	release_year: 2021,
	status: "Ended",
	aired_episode_count: 10,
	number_of_seasons: 1,
	number_of_episodes: 10,
	episode_runtime: [45],
	...rest,
})
// Best match orders the movies: Heat, then Tár, then Dune. And the shows to start: Pluribus before Severance.
const PERCENTILE: Record<number, number> = {
	[titleKey("movie", HEAT)]: 99,
	[titleKey("movie", TAR)]: 90,
	[titleKey("movie", DUNE)]: 60,
	[titleKey("show", PLURIBUS)]: 95,
	[titleKey("show", SEVERANCE)]: 70,
}
const taste = {
	signal: "some" as const,
	ratings: 20,
	liked: 12,
	vector: null,
	match: (keys: number[]) => keys.map((key) => PERCENTILE[key] ?? null),
	percentile: (keys: number[]) => keys.map((key) => PERCENTILE[key] ?? null),
	reasons: () => [],
	leanings: () => [],
}
const THE_BEAR = 136315

/** A member with three Want to See movies and two shows to start, all on their services. */
function doorsMember() {
	member()
	crate.db.seed("user_wishlist", [
		wish("movie", DUNE),
		wish("movie", HEAT),
		wish("movie", TAR),
		wish("show", PLURIBUS),
		wish("show", SEVERANCE),
	])
	crate.db.seed("movie", [
		catalog(DUNE, "Dune"),
		catalog(HEAT, "Heat"),
		catalog(TAR, "Tár"),
	])
	crate.db.seed("show", [
		catalog(PLURIBUS, "Pluribus"),
		catalog(SEVERANCE, "Severance"),
		catalog(THE_BEAR, "The Bear"),
	])
	names({ "The Bear": ["show", THE_BEAR] })
	crate.offers = [
		offer("movie", HEAT, NETFLIX, day(-900)),
		offer("movie", TAR, NETFLIX, day(-900)),
		offer("movie", DUNE, NETFLIX, day(-900)),
		offer("show", PLURIBUS, NETFLIX, day(-900)),
		offer("show", SEVERANCE, NETFLIX, day(-900)),
	]
}
const lands = (
	type: "movie" | "show",
	id: number,
	service: number,
	at: number,
) => {
	crate.offers = [
		...crate.offers.filter((o) => !(o.type === type && o.id === id)),
		offer(type, id, service, at),
	]
}
/** What leads home's Tonight and My shows: the first movie, the first show to start, and what landed of them. */
const leadsOf = (parts: Awaited<ReturnType<typeof getTonightParts>>) => ({
	movie: parts.movies[0]?.title ?? null,
	start: parts.shows.start[0]?.title ?? null,
	continue: (parts.shows.continue[0] ?? parts.shows.pickUp[0])?.title ?? null,
	newOn: parts.newOn,
})
const doorsOn = async (now: number) => {
	const ctx = await loaded()
	const parts = await getTonightParts(ctx, taste as never, now)
	return { parts, doors: leadsOf(parts) }
}

test("without a landing the doors are in their own order: best match first", async () => {
	doorsMember()
	const { parts, doors } = await doorsOn(day(9))
	assert.deepEqual(
		parts.movies.map((movie) => movie.title),
		["Heat", "Tár", "Dune"],
	)
	assert.deepEqual(parts.newOn, { movie: null, start: null })
	assert.equal(doors.movie, "Heat")
	assert.equal(doors.start, "Pluribus")
})

test("a landed movie leads A movie and a landed show to start leads Start a show, for 14 days", async () => {
	doorsMember()
	lands("movie", DUNE, PRIME, day(3))
	lands("show", SEVERANCE, NETFLIX, day(4))
	const { parts, doors } = await doorsOn(day(9))
	// The landed one first; the others keep their order behind it.
	assert.deepEqual(
		parts.movies.map((movie) => movie.title),
		["Dune", "Heat", "Tár"],
	)
	assert.deepEqual(
		parts.shows.start.map((show) => show.title),
		["Severance", "Pluribus"],
	)
	assert.equal(doors.movie, "Dune")
	assert.equal(doors.start, "Severance")
	assert.deepEqual(doors.newOn, { movie: "Prime", start: "Netflix" })
	// A visit of the pages does not end it.
	await recordMyMoviesVisit(user, day(8))
	await recordMyShowsVisit(user, day(8))
	assert.equal((await doorsOn(day(9))).doors.movie, "Dune")
	// Day 16 is the last of Dune's 14 days; the show landed a day later.
	const last = await doorsOn(day(16))
	assert.equal(last.doors.newOn.movie, "Prime")
	const after = await doorsOn(day(17))
	assert.equal(after.doors.movie, "Heat")
	assert.equal(after.doors.newOn.movie, null)
	assert.equal(after.doors.start, "Severance")
	const over = await doorsOn(day(18))
	assert.equal(over.doors.start, "Pluribus")
})

test("of several landed movies the latest leads, and the others follow it", async () => {
	doorsMember()
	lands("movie", DUNE, PRIME, day(3))
	lands("movie", TAR, PRIME, day(6))
	const { parts, doors } = await doorsOn(day(9))
	assert.deepEqual(
		parts.movies.map((movie) => movie.title),
		["Tár", "Dune", "Heat"],
	)
	assert.equal(doors.newOn.movie, "Prime")
})

test("a show the member is in the middle of that landed keeps its place, and Tonight's pick keeps its order", async () => {
	doorsMember()
	// The Bear: watching, an episode watched yesterday, and new on Netflix since day 5.
	crate.db.seed("user_watch_state", [
		{ ...stateRow(THE_BEAR, "watching"), state_changed_at: day(8) },
	])
	crate.db.seed("episode", [
		episodeRow(THE_BEAR, 1, day(-300)),
		episodeRow(THE_BEAR, 2, day(-290)),
		episodeRow(THE_BEAR, 3, day(-280)),
	])
	crate.db.seed("user_watch_log", [watchRow(THE_BEAR, 1, day(8))])
	lands("show", THE_BEAR, NETFLIX, day(5))
	lands("movie", DUNE, PRIME, day(3))
	const ctx = await loaded()
	// It has landed, and the page lists it.
	assert.deepEqual(listed((await getRecentlyLanded(ctx, day(9))).shows), [
		THE_BEAR,
	])
	const parts = await getTonightParts(ctx, taste as never, day(9))
	const doors = leadsOf(parts)
	// Continue is the show, as before, and the shows to start are in their own order.
	assert.equal(doors.continue, "The Bear")
	assert.equal(doors.start, "Pluribus")
	assert.deepEqual(parts.newOn, { movie: "Prime", start: null })
	// Tonight's pick goes by the doors' order: the show the member is in, not the movie that landed.
	const pick = tonightsPickOf(parts.shows, parts.movies[0]?.tmdb_id ?? null)
	assert.deepEqual(pick, { kind: "episode", showId: THE_BEAR })
})

test("without a show to continue, the movie that landed is Tonight's pick, as the first of its door", async () => {
	doorsMember()
	lands("movie", DUNE, PRIME, day(3))
	const { parts } = await doorsOn(day(9))
	assert.deepEqual(tonightsPickOf(parts.shows, parts.movies[0].tmdb_id), {
		kind: "movie",
		movieId: DUNE,
	})
})
