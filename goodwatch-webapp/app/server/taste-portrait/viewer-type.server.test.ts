// The viewer type on made-up leanings: three families, a word or two each.
import assert from "node:assert/strict"
import * as nodeModule from "node:module"
import { test } from "node:test"
import "../title-filter/test-alias.ts"

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

const { viewerType } = await import("./fingerprint.server")
type Leaning = Parameters<typeof viewerType>[0][number]

const a = (key: string, family: string, edge: number, tier = 2) =>
	({ key, family, edge, tier }) as Leaning

test("names the strongest leaning of three different families", () => {
	const type = viewerType([
		a("physical_comedy", "humor", 1.54),
		a("catharsis", "feel", 1.4),
		a("wholesome", "feel", 1.39),
		a("situational_comedy", "humor", 1.19),
		a("character_depth", "story", 1.04),
	])
	assert.deepEqual(type, {
		name: "Slapstick, big payoffs, deep characters",
		keys: ["physical_comedy", "catharsis", "character_depth"],
	})
})

test("fills from the same family when fewer than three families lean", () => {
	const type = viewerType([
		a("novelty", "story", 1.6),
		a("eccentricity", "story", 1.2),
		a("absurdist_humor", "humor", 1.3),
		a("wonder", "feel", 0.2, 0),
	])
	assert.equal(type?.name, "Originality, absurdity, oddballs")
})

test("two leanings read with 'and'; one leaning or craft only is no type", () => {
	assert.equal(
		viewerType([a("wit_wordplay", "humor", 1), a("mystery", "world", 0.9)])
			?.name,
		"Wit and mysteries",
	)
	assert.equal(viewerType([a("wit_wordplay", "humor", 1)]), null)
	assert.equal(
		viewerType([a("wit_wordplay", "humor", 1), a("acting", "craft", 2)]),
		null,
	)
})
