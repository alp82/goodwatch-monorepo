// What "On <service>" asks Discover for and what it says: the request for one service, the twelve titles of its
// row, which service is on screen, the top bar's words, a title's facts and the words without titles.
import assert from "node:assert/strict"
import { test } from "node:test"
import "../../../server/title-filter/test-alias.ts"
import type { TitleCard } from "~/server/title-cards.server"
import type { TvService } from "./tv-home.ts"
import { EMPTY_CONTEXT, SERVICE_TITLES, destinationHref } from "./tv-machine.ts"
import {
	serviceCards,
	serviceEmptyLine,
	serviceFacts,
	serviceOnScreen,
	serviceQuery,
	serviceScreenName,
	serviceWords,
} from "./tv-service.ts"

// The Discover page's own reading of its address.
const { filterStateFromParams } = await import(
	"../../../domain/filter-state.ts"
)

const card = (rest: Partial<TitleCard> = {}) =>
	({
		media_type: "movie",
		tmdb_id: 161,
		title: "Ocean's Eleven",
		release_year: 2001,
		runtime: 116,
		goodwatch_overall_score_normalized_percent: 81.6,
		match: null,
		services: [{ id: 8, name: "Netflix", logo_path: "/n.jpg" }],
		...rest,
	}) as TitleCard

const NETFLIX: TvService = { id: 8, name: "Netflix", logo_path: "/netflix.jpg" }
const DISNEY: TvService = { id: 337, name: "Disney+", logo_path: "/disney.jpg" }

test("the titles are asked for as the Discover page asks for one service, and nothing else", () => {
	assert.equal(serviceQuery(8), "services=8")
	assert.equal(serviceQuery(337), "services=337")
})

test("the request and the Expand key's address are the same filter: that one service, On my services off", () => {
	for (const id of [8, 9, 337, 1899]) {
		const href = destinationHref(
			{ name: "service", service: id },
			EMPTY_CONTEXT,
		)
		assert.equal(href, `/discover?${serviceQuery(id)}`)
		// With On my services on by default, as for a member with saved services: the parameter turns it off.
		const state = filterStateFromParams(new URLSearchParams(serviceQuery(id)), {
			onMyServices: true,
			notSeenYet: true,
		})
		assert.deepEqual(state.services, [id])
		assert.equal(state.onMyServices, false)
	}
})

test("the row pages through the first twelve of Discover's results", () => {
	const forty = Array.from({ length: 40 }, (_, at) => card({ tmdb_id: at + 1 }))
	assert.equal(SERVICE_TITLES, 12)
	assert.deepEqual(
		serviceCards(forty).map((one) => one.tmdb_id),
		[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
	)
	assert.deepEqual(serviceCards(forty.slice(0, 3)).length, 3)
	assert.deepEqual(serviceCards([]), [])
})

test("the service on screen is one of the person's own, known before any title is", () => {
	assert.equal(serviceOnScreen(8, [NETFLIX, DISNEY], []), NETFLIX)
	assert.equal(serviceOnScreen(337, [NETFLIX, DISNEY], [card()]), DISNEY)
})

test("another service is named by its titles, by the app's short name, and not at all without one that names it", () => {
	const onPrime = card({
		services: [
			{ id: 8, name: "Netflix", logo_path: "/n.jpg" },
			{ id: 9, name: "Amazon Prime Video", logo_path: "/p.jpg" },
		],
	})
	assert.deepEqual(serviceOnScreen(9, [NETFLIX, DISNEY], [card(), onPrime]), {
		id: 9,
		name: "Prime",
		logo_path: "/p.jpg",
	})
	assert.equal(serviceOnScreen(9, [NETFLIX, DISNEY], []), null)
	assert.equal(serviceOnScreen(9, [NETFLIX, DISNEY], [card()]), null)
	// A card whose services nobody knows yet names nothing.
	assert.equal(serviceOnScreen(9, [], [card({ services: null })]), null)
	// A service without a logo in the catalog has none.
	assert.equal(
		serviceOnScreen(
			5,
			[],
			[card({ services: [{ id: 5, name: "Plain", logo_path: "" }] })],
		)?.logo_path,
		null,
	)
})

test("the desktop's bar says On <service> and how many titles Discover has", () => {
	const on = { service: NETFLIX, phone: false, drawn: true }
	assert.deepEqual(serviceWords({ ...on, total: 4812 }), {
		name: "On Netflix",
		crumb: "4,812 titles",
	})
	assert.deepEqual(serviceWords({ ...on, total: 1 }), {
		name: "On Netflix",
		crumb: "1 title",
	})
	// Until Discover has answered, and when it has nothing, there is no count.
	assert.deepEqual(serviceWords({ ...on, total: null }), {
		name: "On Netflix",
		crumb: undefined,
	})
	assert.equal(serviceWords({ ...on, total: 0 }).crumb, undefined)
	assert.equal(
		serviceWords({ ...on, service: null, total: null }).name,
		"On this service",
	)
})

test("the phone's bar has room for a few words: a drawn mark says the name, any other service is named", () => {
	assert.deepEqual(
		serviceWords({ service: NETFLIX, total: 4812, phone: true, drawn: true }),
		{ name: "To watch" },
	)
	assert.deepEqual(
		serviceWords({ service: DISNEY, total: 4812, phone: true, drawn: false }),
		{ name: "On Disney+" },
	)
})

test("a screen reader hears the service's name when the screen opens", () => {
	assert.equal(serviceScreenName(DISNEY), "On Disney+")
	assert.equal(serviceScreenName(null), "On this service")
})

test("a title's facts: the year, what it is, how long, its score and the match, without where it streams", () => {
	assert.equal(serviceFacts(card()), "2001 · Movie · 1h 56m · 82 score")
	assert.equal(
		serviceFacts(card({ match: 91 })),
		"2001 · Movie · 1h 56m · 82 score · 91% match",
	)
	assert.equal(
		serviceFacts(card({ media_type: "show", runtime: 55 })),
		"2001 · Show · 55 min episodes · 82 score",
	)
	// A fact nobody knows is left out.
	assert.equal(
		serviceFacts(
			card({
				runtime: null,
				goodwatch_overall_score_normalized_percent: null,
			} as Partial<TitleCard>),
		),
		"2001 · Movie",
	)
})

test("without titles the list says they are on their way, or that the service has nothing right now", () => {
	assert.equal(serviceEmptyLine(true, NETFLIX), "Titles are on their way.")
	assert.equal(
		serviceEmptyLine(false, NETFLIX),
		"Nothing to watch on Netflix right now.",
	)
	assert.equal(
		serviceEmptyLine(false, null),
		"Nothing to watch here right now.",
	)
})


test("an unrated title has no zero score in its service facts", () => {
	assert.doesNotMatch(
		serviceFacts(card({ goodwatch_overall_score_normalized_percent: 0 })),
		/0 score/,
	)
})
