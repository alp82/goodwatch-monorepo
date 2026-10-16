// Taste group names on made-up groups: two traits and the most specific noun that describes three in four titles.
import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { describe, it } from "node:test"
import "../title-filter/test-alias.ts"
import type { TitleFacts } from "../title-snapshot/snapshot.server"
import type { RatedTitle } from "./person.server"

// As in sides.server.test.ts: the taste module's index and the availability index pull in what names don't need.
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

const { NAME_LENGTH, nameGroup } = await import("./group-names.server")
const { KEYS, K } = await import("./person.server")

let next = 1
function title(
	genres: string[],
	z: Record<string, number> = {},
	over: Partial<TitleFacts> = {},
): RatedTitle {
	const v = new Float64Array(K)
	for (const [key, value] of Object.entries(z)) v[KEYS.indexOf(key)] = value
	return {
		key: 1e12 + next++,
		score: 9,
		z: v,
		fingerprint: new Uint8Array(K),
		facts: {
			mediaType: "movie",
			tmdbId: next,
			genres,
			releaseDay: 15_000,
			score: 75,
			votes: 5000,
			popularity: 10,
			origin: "FR",
			hasPoster: true,
			hasBackdrop: true,
			adult: false,
			anime: false,
			moods: [],
			...over,
		},
	}
}
const titles = (n: number, genres: string[], z?: Record<string, number>) =>
	Array.from({ length: n }, () => title(genres, z))
// A standout: the keys in order, most first.
const order = (...keys: string[]) =>
	keys.map((key, i) => ({ key, weight: keys.length - i }))
const name = (
	standout: ReturnType<typeof order>,
	members: RatedTitle[],
	taken = new Set<string>(),
) => nameGroup(standout, members, taken)?.name

describe("nameGroup", () => {
	it("names a group by two traits and a noun, with no place and no clause", () => {
		const members = titles(8, ["Crime", "Drama"])
		assert.equal(
			name(order("bleakness", "tension", "crime", "intrigue"), members),
			"Dark, tense crime",
		)
	})

	it("ends in the most specific noun that describes three in four titles", () => {
		const standout = order("wonder", "spectacle", "hopefulness")
		// All adventures, six in eight science fiction: science fiction is rarer in the catalog.
		const scifi = [
			...titles(6, ["Adventure", "Science Fiction"]),
			...titles(2, ["Adventure"]),
		]
		assert.equal(name(standout, scifi), "Wondrous, epic sci-fi")
		// Five in eight science fiction isn't three in four.
		const adventures = [
			...titles(5, ["Adventure", "Science Fiction"]),
			...titles(3, ["Adventure"]),
		]
		assert.equal(name(standout, adventures), "Wondrous, epic adventures")
	})

	it("counts action titles as adventures", () => {
		const members = [...titles(4, ["Adventure"]), ...titles(4, ["Action"])]
		assert.equal(
			name(order("spectacle", "wonder"), members),
			"Epic, wondrous adventures",
		)
	})

	it("counts a tense crime or mystery story as a thriller", () => {
		const standout = order("bleakness", "psychological", "intrigue")
		const members = [
			...titles(4, ["Thriller"]),
			...titles(2, ["Crime"], { tension: 1 }),
			...titles(2, ["Drama"], { mystery: 1, tension: 1 }),
		]
		assert.equal(name(standout, members), "Dark, psychological thrillers")
		// Tense, but neither crime nor mystery: four in eight.
		const tense = [
			...titles(4, ["Thriller"]),
			...titles(4, ["Drama"], { tension: 1 }),
		]
		assert.equal(name(standout, tense), "Dark, psychological stories")
	})

	it("calls family titles family movies only when they are films", () => {
		const standout = order("wholesome", "wonder")
		assert.equal(
			name(standout, titles(8, ["Family"])),
			"Warm, wondrous family movies",
		)
		const shows = Array.from({ length: 8 }, () =>
			title(["Family"], {}, { mediaType: "show" }),
		)
		assert.equal(name(standout, shows), "Warm, wondrous stories")
	})

	it("ends in stories only when no other noun describes three in four", () => {
		const members = [...titles(4, ["Crime"]), ...titles(4, ["Comedy"])]
		assert.equal(
			name(order("eccentricity", "ambiguity"), members),
			"Eccentric, ambiguous stories",
		)
	})

	it("counts a title as a kind by the World attribute it carries, without the genre", () => {
		const members = titles(8, ["Drama"], { crime: 1 })
		assert.equal(
			name(order("bleakness", "tension"), members),
			"Dark, tense crime",
		)
		const faint = titles(8, ["Drama"], { crime: 0.3 })
		assert.equal(
			name(order("bleakness", "tension"), faint),
			"Dark, tense dramas",
		)
	})

	it("doesn't repeat in a trait what the noun says", () => {
		const members = titles(8, ["Thriller"])
		assert.equal(
			name(order("tension", "bleakness", "intrigue"), members),
			"Dark, gripping thrillers",
		)
	})

	it("says what kind of funny before comedies, and only funny before another noun", () => {
		const humor = order("physical_comedy", "absurdist_humor", "wholesome")
		assert.equal(
			name(humor, titles(8, ["Comedy"])),
			"Slapstick, absurd comedies",
		)
		// Without comedies, two kinds of funny would read "Funny, funny".
		assert.equal(name(humor, titles(8, ["Music"])), "Funny, warm stories")
	})

	it("calls grounded comedies everyday, and other grounded titles realistic", () => {
		const standout = order("cringe_humor", "contemporary_realism")
		assert.equal(
			name(standout, titles(8, ["Comedy"])),
			"Awkward, everyday comedies",
		)
		assert.equal(
			name(order("bleakness", "contemporary_realism"), titles(8, ["Thriller"])),
			"Dark, realistic thrillers",
		)
	})

	it("never pairs two traits that repeat a word", () => {
		assert.equal(
			name(order("bleakness", "dark_humor", "tension"), titles(8, ["Music"])),
			"Dark, tense stories",
		)
	})

	it("puts a World trait right before the noun", () => {
		assert.equal(
			name(order("psychological", "bleakness"), titles(8, ["Music"])),
			"Dark, psychological stories",
		)
	})

	it("takes the next traits when the first two make a name too long", () => {
		// "Philosophical, melancholic dramas" is 33 characters.
		const members = titles(8, ["Drama"])
		const short = name(order("philosophical", "melancholy", "pathos"), members)
		assert.equal(short, "Philosophical, moving dramas")
		assert.ok((short ?? "").length <= NAME_LENGTH)
	})

	it("keeps the most specific noun even when its names run long, and takes the shortest", () => {
		// "Socially critical stories" fits; "Socially critical, class-conscious sports stories" is longer still.
		const members = titles(8, ["Music"], { sports: 1 })
		assert.equal(
			name(order("social_commentary", "class_and_capitalism"), members),
			"Socially critical sports stories",
		)
	})

	it("takes a name with two traits up to 29 characters", () => {
		// "Cathartic, exciting thrillers" is 29 characters.
		assert.equal(
			name(order("catharsis", "adrenaline"), titles(8, ["Thriller"])),
			"Cathartic, exciting thrillers",
		)
	})

	it("takes one trait only when no name with two fits", () => {
		// "Moving, philosophical war stories" is 33 characters.
		const members = titles(8, ["War"])
		assert.equal(
			name(order("pathos", "philosophical"), members),
			"Moving war stories",
		)
	})

	it("calls a documentary a documentary, never a biopic", () => {
		const standout = order("bleakness", "tension")
		assert.equal(
			name(standout, titles(8, ["Music"], { biographical: 1 })),
			"Dark, tense biopics",
		)
		assert.equal(
			name(standout, titles(8, ["Documentary"], { biographical: 1 })),
			"Dark, tense documentaries",
		)
		// Five in eight documentaries, so neither noun holds.
		const mixed = [
			...titles(5, ["Documentary"], { biographical: 1 }),
			...titles(3, ["Music"], { biographical: 1 }),
		]
		assert.equal(name(standout, mixed), "Dark, tense stories")
	})

	it("never uses a World word that reads as crime-focused", () => {
		assert.equal(
			name(order("crime", "bleakness", "tension"), titles(8, ["Drama"])),
			"Dark, tense dramas",
		)
	})

	it("leaves out a trait most titles are far below the catalog on", () => {
		const members = [
			...titles(3, ["Crime"], { tension: 2 }),
			...titles(5, ["Crime"], { tension: -2 }),
		]
		assert.equal(
			name(order("tension", "bleakness", "intrigue"), members),
			"Dark, gripping crime",
		)
	})

	it("keeps the names of one member's groups apart", () => {
		const taken = new Set<string>()
		const standout = order("bleakness", "tension", "intrigue")
		const first = name(standout, titles(8, ["Crime"]), taken)
		const second = name(standout, titles(8, ["Crime"]), taken)
		assert.equal(first, "Dark, tense crime")
		assert.equal(second, "Dark, gripping crime")
	})
})
