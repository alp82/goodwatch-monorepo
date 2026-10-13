import assert from "node:assert/strict"
import { describe, it } from "node:test"
import "../../../server/title-filter/test-alias.ts"
import type { TitleCard } from "~/server/title-cards.server"

const { MOOD_BY_KEY, MOOD_KEYS } = await import("../../../domain/moods.ts")
const { STYLE_BY_KEY, STYLE_KEYS, THEME_BY_KEY, THEME_KEYS } = await import(
	"../../../domain/themes-styles.ts"
)
const { filterStateFromParams, filterStateToParams } = await import(
	"../../../domain/filter-state.ts"
)
const {
	DISCOVER_TABS,
	LIST_TITLES,
	destinationHref,
	readTvState,
	tvItems,
	EMPTY_CONTEXT,
} = await import("./tv-machine.ts")
const {
	DISCOVER_STYLES,
	DISCOVER_TAB_KEYS,
	DISCOVER_THEMES,
	discoverOption,
	discoverOptions,
	discoverQuery,
	listCards,
	listEmptyLine,
	listFacts,
} = await import("./tv-discover.ts")

const APP_KEYS = {
	moods: MOOD_KEYS as readonly string[],
	themes: THEME_KEYS as readonly string[],
	styles: STYLE_KEYS as readonly string[],
}

describe("the options of mini Discover's tabs", () => {
	it("every one of the eighteen keys exists in the app's lists", () => {
		let count = 0
		for (const { tab, keys } of DISCOVER_TABS)
			for (const key of keys) {
				assert.ok(APP_KEYS[tab].includes(key), `${tab}: ${key}`)
				count++
			}
		assert.equal(count, 18)
	})

	it("are the decided six per tab, by the app's own names", () => {
		const names = (tab: "moods" | "themes" | "styles") =>
			discoverOptions(tab).map((option) => option.name)
		assert.deepEqual(names("moods"), [
			"Funny",
			"Feel-good",
			"Romance",
			"Action",
			"Scary",
			"Mind-bending",
		])
		assert.deepEqual(names("themes"), [
			"Crime",
			"Mystery",
			"Family",
			"Growing up",
			"Future",
			"Fantasy",
		])
		assert.deepEqual(names("styles"), [
			"Animated",
			"Spectacle",
			"Slow burn",
			"Fast-paced",
			"Talky",
			"Nonlinear",
		])
	})

	it("Heavy and History are on no tab", () => {
		const all = DISCOVER_TABS.flatMap(({ tab }) =>
			discoverOptions(tab).map((option) => option.name),
		)
		assert.equal(all.length, 18)
		for (const name of ["Heavy", "History", "Crime & mystery", "Any mood"])
			assert.ok(!all.includes(name), name)
	})

	it("a mood takes its name, line and colour from the app's list", () => {
		for (const option of discoverOptions("moods")) {
			const mood = MOOD_BY_KEY[option.key as keyof typeof MOOD_BY_KEY]
			assert.equal(option.name, mood.name)
			assert.equal(option.color, mood.hue)
			assert.equal(option.line, mood.description)
		}
	})

	it("a theme's and a style's name and colour, written out for the TV, are the app's list's", () => {
		assert.deepEqual(
			Object.keys(DISCOVER_THEMES),
			DISCOVER_TABS.find((one) => one.tab === "themes")?.keys,
		)
		assert.deepEqual(
			Object.keys(DISCOVER_STYLES),
			DISCOVER_TABS.find((one) => one.tab === "styles")?.keys,
		)
		for (const [key, words] of Object.entries(DISCOVER_THEMES)) {
			const theme = THEME_BY_KEY[key as keyof typeof THEME_BY_KEY]
			assert.equal(words.name, theme.name, key)
			assert.equal(words.color, theme.color, key)
		}
		for (const [key, words] of Object.entries(DISCOVER_STYLES)) {
			const style = STYLE_BY_KEY[key as keyof typeof STYLE_BY_KEY]
			assert.equal(words.name, style.name, key)
			assert.equal(words.color, style.color, key)
		}
		for (const option of [
			...discoverOptions("themes"),
			...discoverOptions("styles"),
		]) {
			const words = (
				option.item.startsWith("theme:") ? DISCOVER_THEMES : DISCOVER_STYLES
			)[option.key]
			assert.deepEqual(
				[option.name, option.color, option.line],
				[words.name, words.color, words.line],
			)
		}
	})

	it("the TV's own words do not read the themes' and styles' rules, which are the Discover page's code", async () => {
		const { readFileSync } = await import("node:fs")
		for (const file of [
			"tv-discover.ts",
			"use-tv-discover.ts",
			"screens/Discover.tsx",
		]) {
			const source = readFileSync(new URL(file, import.meta.url), "utf8")
			assert.ok(!/from ".*themes-styles/.test(source), file)
		}
	})

	it("every option has one line, a colour and the machine's item", () => {
		for (const { tab, kind, keys } of DISCOVER_TABS) {
			const options = discoverOptions(tab)
			assert.deepEqual(
				options.map((option) => option.item),
				keys.map((key) => `${kind}:${key}`),
			)
			for (const option of options) {
				assert.match(option.line, /^[A-Z].{8,60}\.$/, option.item)
				assert.match(option.color, /^#[0-9a-f]{6}$/, option.item)
			}
		}
	})

	it("the items on the choice screen are the tabs and the open tab's options, in the machine's order", () => {
		for (const { tab } of DISCOVER_TABS) {
			const screen = readTvState(
				new URLSearchParams(`tv=discover&tab=${tab}`),
				EMPTY_CONTEXT,
			).screen
			assert.deepEqual(
				tvItems(screen, EMPTY_CONTEXT).slice(0, 9),
				[
					...DISCOVER_TAB_KEYS.map((key) => key.item),
					...discoverOptions(tab).map((option) => option.item),
				],
				tab,
			)
		}
		assert.deepEqual(
			DISCOVER_TAB_KEYS.map((key) => key.name),
			["Moods", "Themes", "Styles"],
		)
	})

	it("an unknown key is no option", () => {
		assert.equal(discoverOption("moods", "cozy"), null)
		assert.equal(discoverOption("themes", "funny"), null)
		assert.equal(discoverOption("styles", "war"), null)
	})
})

describe("the titles of one choice", () => {
	it("are asked for with Discover's own parameter for it, and nothing else", () => {
		assert.equal(discoverQuery("moods", "funny"), "moods=funny")
		assert.equal(discoverQuery("themes", "crime"), "themes=crime")
		assert.equal(discoverQuery("styles", "slow"), "styles=slow")
	})

	it("the query and the Expand key's address are one filter, which the Discover page reads as chosen", () => {
		const defaults = { onMyServices: false, notSeenYet: false }
		for (const { tab, kind, keys } of DISCOVER_TABS)
			for (const key of keys) {
				const query = discoverQuery(tab, key)
				const screen = readTvState(
					new URLSearchParams(`tv=discover&${kind}=${key}`),
					EMPTY_CONTEXT,
				).screen
				// The page behind Expand shows the same filter the TV's titles were asked with.
				assert.equal(
					destinationHref(screen, EMPTY_CONTEXT),
					`/discover?${query}`,
				)
				const state = filterStateFromParams(
					new URLSearchParams(query),
					defaults,
				)
				assert.deepEqual(state[tab], [key], query)
				for (const other of ["moods", "themes", "styles"] as const)
					if (other !== tab) assert.deepEqual(state[other], [], query)
				// And the page writes that filter back as the same query.
				assert.equal(filterStateToParams(state, defaults).toString(), query)
			}
	})

	it("the list shows the first four of Discover's results, in their order", () => {
		const cards = Array.from({ length: 40 }, (_, key) => ({ key }) as TitleCard)
		assert.equal(LIST_TITLES, 4)
		assert.deepEqual(
			listCards(cards).map((card) => card.key),
			[0, 1, 2, 3],
		)
		assert.deepEqual(
			listCards(cards.slice(0, 2)).map((card) => card.key),
			[0, 1],
		)
		assert.deepEqual(listCards([]), [])
	})
})

describe("a title's line of facts", () => {
	const card = (rest: Partial<TitleCard> = {}): TitleCard =>
		({
			media_type: "movie",
			release_year: 2001,
			runtime: 116,
			goodwatch_overall_score_normalized_percent: 81.6,
			match: null,
			services: [{ id: 8, name: "Netflix", logo_path: "/n.jpg" }],
			...rest,
		}) as TitleCard

	it("year, kind, length, score and where it streams", () => {
		assert.equal(
			listFacts(card()),
			"2001 · Movie · 1h 56m · 82 score · On Netflix",
		)
	})

	it("the taste match once the person has one", () => {
		assert.equal(
			listFacts(card({ match: 91 })),
			"2001 · Movie · 1h 56m · 82 score · 91% match · On Netflix",
		)
	})

	it("a show says its episodes' length", () => {
		assert.equal(
			listFacts(card({ media_type: "show", runtime: 45 })),
			"2001 · Show · 45 min episodes · 82 score · On Netflix",
		)
	})

	it("leaves out what nobody knows, and says when a title streams nowhere", () => {
		assert.equal(
			listFacts(
				card({
					runtime: null,
					goodwatch_overall_score_normalized_percent: null,
					services: null,
				}),
			),
			"2001 · Movie",
		)
		assert.equal(
			listFacts(card({ services: [] })),
			"2001 · Movie · 1h 56m · 82 score · Not streaming",
		)
	})
})

describe("what the list says without titles", () => {
	it("that they are on their way, then that nothing fits", () => {
		assert.equal(listEmptyLine(true), "Titles are on their way.")
		assert.equal(listEmptyLine(false), "Nothing fits.")
	})
})
