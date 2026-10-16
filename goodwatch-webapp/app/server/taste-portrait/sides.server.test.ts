// Sides of you on a made-up person with two clear strands of loved titles (dark crime and silly comedy): how the sides
// group and are named, the edges just past each side, and how lists inside a side follow the person's order.
import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { describe, it } from "node:test"
import "../title-filter/test-alias.ts"
import type { TitleFacts } from "../title-snapshot/snapshot.server"
import type { Person, PoolTitle, RatedTitle } from "./person.server"

// The taste module's index pulls in the viewer and React, the availability index the Crate client: the sides need only
// the craft keys of one, and nothing of the other while the person has no services.
const { registerHooks } = nodeModule as unknown as {
	registerHooks(hooks: {
		resolve(
			specifier: string,
			context: unknown,
			next: (s: string, c: unknown) => unknown,
		): unknown
	}): void
}
registerHooks({
	resolve: (specifier, context, next) =>
		specifier === "~/server/availability-index.server"
			? {
					url: "data:text/javascript,export const isOnServices = () => null",
					shortCircuit: true,
				}
			: next(
					specifier === "~/server/taste/index.server"
						? "~/server/taste/taste.server"
						: specifier,
					context,
				),
})

const { buildSides, franchiseOf } = await import("./sides.server")
const { KEYS, K, meanOf } = await import("./person.server")

const at = (key: string) => KEYS.indexOf(key)
// A repeatable spread, so titles of a strand are alike but not identical.
let seed = 7
const noise = () => {
	seed = (seed * 16807) % 2147483647
	return (seed / 2147483647 - 0.5) * 0.6
}

function z(strong: Record<string, number>) {
	const v = new Float64Array(K).map(() => noise())
	for (const [key, value] of Object.entries(strong))
		v[at(key)] = value + noise() * 0.3
	return v
}

const CRIME = { crime: 2.5, bleakness: 2.2, tension: 2, intrigue: 1.8 }
const COMEDY = {
	situational_comedy: 2.5,
	physical_comedy: 2.2,
	wholesome: 1.8,
	absurdist_humor: 1.6,
}

let next = 1
function facts(over: Partial<TitleFacts> = {}): TitleFacts {
	return {
		mediaType: "movie",
		tmdbId: next,
		genres: [],
		releaseDay: 15_000,
		score: 75,
		votes: 5000,
		popularity: 10,
		origin: "US",
		hasPoster: true,
		hasBackdrop: true,
		adult: false,
		anime: false,
		moods: [],
		...over,
	}
}

function rated(
	strong: Record<string, number>,
	score: number,
	over: Partial<TitleFacts> = {},
): RatedTitle {
	const key = 1e12 + next++
	return {
		key,
		score,
		z: z(strong),
		fingerprint: new Uint8Array(K),
		facts: facts(over),
	}
}

function unseen(
	strong: Record<string, number>,
	over: Partial<TitleFacts> = {},
): PoolTitle {
	const key = 1e12 + next++
	return { key, z: z(strong), facts: facts(over) }
}

function person(ratedTitles: RatedTitle[], pool: PoolTitle[]): Person {
	const scores = ratedTitles.map((r) => r.score)
	const mu = scores.reduce((a, b) => a + b, 0) / scores.length
	const sigma =
		Math.sqrt(scores.reduce((a, b) => a + (b - mu) ** 2, 0) / scores.length) ||
		1
	return {
		input: {
			kind: "member",
			scores: new Map(),
			chosen: new Set(),
			wantToSee: new Set(),
			skipped: new Set(),
			notInterested: new Set(),
			country: "DE",
			services: [],
			taste: {} as never,
		},
		snapshot: {} as never,
		rated: [...ratedTitles].sort((a, b) => b.score - a.score || a.key - b.key),
		ratedByKey: new Map(ratedTitles.map((r) => [r.key, r])),
		mu,
		sigma,
		selection: meanOf(ratedTitles.map((r) => r.z)),
		preference: meanOf(ratedTitles.map((r) => r.z)),
		signature: meanOf(ratedTitles.map((r) => r.z)),
		unseen: pool,
		zOf: () => null,
		match: () => new Map(),
		rankSteps: () => new Map(),
		onMyServices: () => null,
	}
}

/** 30 loved crime titles, 30 loved comedies, a few middling ones, and an unseen pool next to each strand. */
function twoStrands() {
	const titles = [
		...Array.from({ length: 30 }, () =>
			rated(CRIME, 9, { moods: ["crime"], genres: ["Crime", "Drama"] }),
		),
		...Array.from({ length: 30 }, () =>
			rated(COMEDY, 9, { moods: ["funny", "feelgood"], genres: ["Comedy"] }),
		),
		...Array.from({ length: 10 }, () => rated({}, 5)),
	]
	const pool = [
		...Array.from({ length: 120 }, () => unseen(CRIME)),
		// Korean crime: common right next to the crime side, never rated.
		...Array.from({ length: 40 }, () => unseen(CRIME, { origin: "KR" })),
		...Array.from({ length: 160 }, () => unseen(COMEDY)),
	]
	return { titles, pool }
}

describe("franchiseOf", () => {
	it("reads a franchise's titles as one", () => {
		assert.equal(
			franchiseOf("The Lord of the Rings: The Two Towers"),
			franchiseOf("The Lord of the Rings: The Return of the King"),
		)
		assert.equal(franchiseOf("Toy Story"), franchiseOf("Toy Story 2"))
		assert.equal(
			franchiseOf("The Godfather"),
			franchiseOf("The Godfather Part II"),
		)
		assert.notEqual(franchiseOf("Star Wars"), franchiseOf("Star Trek"))
		assert.notEqual(
			franchiseOf("The Dark Knight"),
			franchiseOf("The Dark Crystal"),
		)
		assert.notEqual(
			franchiseOf("Once Upon a Time in America"),
			franchiseOf("Once Upon a Time in Hollywood"),
		)
	})
})

describe("buildSides", () => {
	it("groups two clear strands into two sides that each hold together", () => {
		const { titles, pool } = twoStrands()
		const view = buildSides(person(titles, pool))
		assert.equal(view.status, "ready")
		assert.equal(view.sides.length, 2)
		const loved = new Set(titles.filter((t) => t.score === 9).map((t) => t.key))
		for (const side of view.sides) {
			assert.ok(side.count >= 25, `${side.name} holds ${side.count}`)
			assert.equal("share" in side, false)
			for (const key of side.here) assert.ok(loved.has(key))
		}
		assert.equal(view.openFirst, view.sides[0].id)
		assert.deepEqual(view.headline, {
			first: view.sides[0].id,
			second: view.sides[1].id,
		})
	})

	it("names each side by what sets it apart from the other", () => {
		const { titles, pool } = twoStrands()
		const view = buildSides(person(titles, pool))
		const names = view.sides.map((s) => s.name)
		assert.notEqual(names[0], names[1])
		const crime = view.sides.find((s) =>
			s.attributes.some((a) => a.key === "crime"),
		)
		const comedy = view.sides.find((s) =>
			s.attributes.some(
				(a) => a.key === "situational_comedy" || a.key === "physical_comedy",
			),
		)
		assert.ok(crime && comedy && crime !== comedy)
		assert.equal(crime.name, "Dark, tense crime")
		assert.match(comedy.name, /comedies$/)
	})

	it("opens Watch next with the moods most of a side's titles carry", () => {
		const { titles, pool } = twoStrands()
		const view = buildSides(person(titles, pool))
		const crime = view.sides.find((s) =>
			s.attributes.some((a) => a.key === "crime"),
		)
		const comedy = view.sides.find((s) => s !== crime)
		assert.deepEqual(crime?.moods, ["crime"])
		assert.deepEqual([...(comedy?.moods ?? [])].sort(), ["feelgood", "funny"])
	})

	it("finds a place right next to a side that the person hasn't rated, and only on that side", () => {
		const { titles, pool } = twoStrands()
		const view = buildSides(person(titles, pool))
		const crime = view.sides.find((s) =>
			s.attributes.some((a) => a.key === "crime"),
		)
		const korea = crime?.edges.find((e) => e.kind === "country")
		assert.ok(korea, "the crime side has a country edge")
		assert.equal(korea.name, "From South Korea")
		assert.equal(korea.tail, "from South Korea")
		assert.equal(korea.count, 0)
		assert.equal(korea.average, null)
		const comedy = view.sides.find((s) => s !== crime)
		assert.ok(!comedy?.edges.some((e) => e.id.endsWith("country-KR")))
	})

	it("never offers a place the person rates below their usual", () => {
		const { titles, pool } = twoStrands()
		// Two Korean crime titles rated 3: Korea is no longer an invitation.
		titles.push(
			rated(CRIME, 3, { origin: "KR" }),
			rated(CRIME, 3, { origin: "KR" }),
		)
		const view = buildSides(person(titles, pool))
		for (const side of view.sides)
			assert.ok(!side.edges.some((e) => e.id.endsWith("country-KR")))
	})

	it("never offers a place rated even a little below the usual", () => {
		const { titles, pool } = twoStrands()
		const mu = titles.reduce((a, t) => a + t.score, 0) / titles.length
		// Between the old tolerance (0.3 below) and the usual itself.
		titles.push(
			rated(CRIME, Math.round((mu - 0.1) * 10) / 10, { origin: "KR" }),
		)
		const view = buildSides(person(titles, pool))
		for (const side of view.sides)
			assert.ok(!side.edges.some((e) => e.id.endsWith("country-KR")))
	})

	it("adds the way toward the other side once per pair, and no step twice", () => {
		const { titles, pool } = twoStrands()
		const view = buildSides(person(titles, pool))
		const bridges = view.sides.flatMap((s) =>
			s.edges.filter((e) => e.kind === "bridge"),
		)
		assert.ok(bridges.length <= 1)
		for (const bridge of bridges) {
			assert.equal(bridge.tail, null)
			assert.ok(view.sides.some((s) => s.id === bridge.toward))
		}
		const steps = view.sides.flatMap((s) =>
			s.edges.filter((e) => e.kind === "step").map((e) => e.name),
		)
		assert.equal(new Set(steps).size, steps.length)
	})

	it("orders the lists inside a side by the order it is given", () => {
		const { titles, pool } = twoStrands()
		const reverse = (keys: number[]) => [...keys].sort((a, b) => b - a)
		const view = buildSides(person(titles, pool), reverse)
		for (const side of view.sides) {
			assert.deepEqual(side.moreOfThis, reverse(side.moreOfThis))
			for (const edge of side.edges)
				assert.deepEqual(edge.suggestions, reverse(edge.suggestions))
		}
	})

	it("leaves out a loved title its side's name doesn't describe", () => {
		// A side with many strong attributes: a title can be close to it overall and still lack one its name claims.
		const WARM = {
			wonder: 2.2,
			hopefulness: 2,
			wholesome: 1.8,
			nostalgia: 1.6,
			family_dynamics: 1.6,
			coming_of_age: 1.5,
			fantasy: 1.5,
		}
		const build = (extra: RatedTitle[]) =>
			buildSides(
				person(
					[
						...Array.from({ length: 30 }, () => rated(CRIME, 9)),
						...Array.from({ length: 30 }, () => rated(WARM, 9)),
						...Array.from({ length: 10 }, () => rated({}, 5)),
						...extra,
					],
					[
						...Array.from({ length: 160 }, () => unseen(CRIME)),
						...Array.from({ length: 160 }, () => unseen(WARM)),
					],
				),
			)
		const warmSide = (view: ReturnType<typeof build>) =>
			view.sides.find((side) => side.attributes.some((a) => a.key in WARM))
		const plain = warmSide(build([]))
		assert.ok(plain)
		const claimed = plain.attributes.slice(0, 2).map((a) => a.key)
		// Like the side in all but one claimed attribute, which it is far below the catalog on (John Wick in a hopeful side).
		const against = rated({ ...WARM, [claimed[1]]: -2 }, 9)
		const alike = rated(WARM, 9)
		assert.equal(warmSide(build([alike]))?.count, plain.count + 1)
		assert.equal(warmSide(build([against]))?.count, plain.count)
	})

	it("orders the sides by how many titles they keep, after leaving some out", () => {
		// 34 crime titles, 12 of them far below the catalog on the three traits every name of the side claims one of:
		// the side keeps 22 and falls behind the 30 comedies.
		const STRONG_CRIME = { ...CRIME, crime: 6 }
		const AGAINST = { bleakness: -1.2, tension: -1.2, intrigue: -1.2 }
		const titles = [
			...Array.from({ length: 22 }, () => rated(STRONG_CRIME, 9)),
			...Array.from({ length: 12 }, () =>
				rated({ ...STRONG_CRIME, ...AGAINST }, 9),
			),
			...Array.from({ length: 30 }, () => rated(COMEDY, 9)),
			...Array.from({ length: 10 }, () => rated({}, 5)),
		]
		const view = buildSides(person(titles, []))
		assert.equal(view.sides.length, 2)
		assert.ok(view.sides[0].attributes.some((a) => a.key in COMEDY))
		assert.deepEqual(
			view.sides.map((side) => side.count),
			[30, 22],
		)
		assert.equal(view.openFirst, view.sides[0].id)
		assert.deepEqual(view.headline, {
			first: view.sides[0].id,
			second: view.sides[1].id,
		})
	})

	it("leaves out a loved title that is only loosely like its side", () => {
		const { titles, pool } = twoStrands()
		const plain = buildSides(person(titles, pool))
		const crimeCount = () =>
			plain.sides.find((side) => side.attributes.some((a) => a.key === "crime"))
				?.count ?? 0
		// A little crime in a title about something else: about 0.2 close to the crime side.
		const loose = rated(
			{
				crime: 0.9,
				bleakness: 0.8,
				warfare: 3,
				political: 3,
				spectacle: 3,
				historical: 3,
			},
			9,
		)
		const view = buildSides(person([...titles, loose], pool))
		const crime = view.sides.find((side) =>
			side.attributes.some((a) => a.key === "crime"),
		)
		assert.equal(crime?.count, crimeCount())
	})

	it("keeps a small side under another of its names when the first leaves out too many", () => {
		// 14 loved titles: 12 crime and two comedies, one of them far below the catalog on slapstick.
		const titles = [
			...Array.from({ length: 12 }, () => rated(CRIME, 9)),
			rated({ ...COMEDY, physical_comedy: 5.5 }, 9),
			rated({ ...COMEDY, physical_comedy: -1.1 }, 9),
			...Array.from({ length: 20 }, () => rated({}, 5)),
		]
		const view = buildSides(person(titles, []))
		assert.equal(view.status, "ready")
		assert.equal(view.sides.length, 2)
		assert.equal(view.sides[1].count, 2)
	})

	it("shows one title of a franchise among a side's titles", () => {
		const { titles, pool } = twoStrands()
		// Three films that read alike, rated 10.
		const film = z(CRIME)
		const sequels = [0, 1, 2].map(() => ({
			...rated(CRIME, 10),
			z: new Float64Array(film),
		}))
		const view = buildSides(person([...titles, ...sequels], pool))
		const shown = view.sides
			.flatMap((s) => s.here)
			.filter((key) => sequels.some((t) => t.key === key))
		assert.ok(shown.length <= 1)
	})

	it("gives a small history mostly in one strand two sides, as the sample taste guests see", () => {
		const titles = [
			...Array.from({ length: 12 }, () => rated(CRIME, 9)),
			...Array.from({ length: 2 }, () => rated(COMEDY, 9)),
			...Array.from({ length: 20 }, () => rated({}, 5)),
		]
		const view = buildSides(person(titles, []))
		assert.equal(view.status, "ready")
		assert.equal(view.sides.length, 2)
	})

	it("has no sides with too few loved titles", () => {
		const titles = [rated(CRIME, 9), rated(COMEDY, 9), rated({}, 5)]
		assert.equal(buildSides(person(titles, [])).status, "empty")
	})
})
