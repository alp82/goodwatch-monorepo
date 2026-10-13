import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { EnabledFeatures } from "~/utils/features"
import { searchHref } from "../../navigation/destinations.ts"
import { DOOR_HREF as OLD_DOOR_HREF } from "../tv-flow.ts"
import { RATING_LEVELS, levelOf } from "../../taste-quiz/quiz-flow.ts"
import {
	DOOR_HREF,
	EMPTY_CONTEXT,
	STRIP_LEVELS,
	STRIP_SCORES,
	STRIP_START,
	type TvAction,
	type TvContext,
	type TvScreen,
	type TvState,
	activeItems,
	destinationHref,
	focusLeftBehind,
	focusedItem,
	isTvOnlyChange,
	menuItems,
	readTvState,
	transition,
	tvItems,
	watchHref,
	writeTvParams,
} from "./tv-machine.ts"
import type { TvBox } from "./tv-move.ts"

const guest: TvContext = {
	...EMPTY_CONTEXT,
	tonight: [
		{ title: "movie-1" },
		{ title: "movie-2" },
		{ title: "show-3" },
		{ title: "movie-4" },
	],
	moods: ["funny", "feelgood", "crime"],
	titles: ["movie-11", "show-12", "movie-13", "movie-14", "movie-15"],
	islands: ["i1", "i2", "i3", "i4", "i5", "i6", "i7"],
	hops: ["i2", "i4", "i5"],
}
const member: TvContext = {
	...guest,
	member: true,
	taste: true,
	tonight: [
		{ title: "show-3", href: "/my-shows" },
		{ title: "movie-1", href: "/my-movies" },
		{ title: "show-5", href: "/my-shows#start" },
	],
	sides: ["dark-crime", "gentle-comedy", "big-ideas"],
	nextEpisodes: ["show-21", "show-22", "show-23", "show-24"],
	toStart: ["show-31", "show-32", "show-33", "show-34"],
}

const BAR = ["bar:back", "bar:search", "bar:menu"]
/** The rating strip: its levels low to high, and the exact scores the desktop shows under them. */
const LEVELS = ["level:3", "level:5", "level:7", "level:9"]
const SCORES = Array.from({ length: 10 }, (_, at) => `score:${at + 1}`)
const desktop: TvContext = { ...guest, exactScores: true }

const at = (query: string, depth = 0, ctx: TvContext = guest) =>
	readTvState(new URLSearchParams(query), ctx, depth)
const url = (state: TvState) => writeTvParams(state.screen).toString()
const items = (query: string, ctx: TvContext = guest) =>
	tvItems(at(query, 0, ctx).screen, ctx)

/** Runs actions from a state and returns the final transition plus the URL it ends on. */
function run(start: TvState, ctx: TvContext, ...actions: TvAction[]) {
	let state = start
	let last = transition(state, { type: "focus", item: "" }, ctx)
	for (const action of actions) {
		last = transition(state, action, ctx)
		state = last.state
	}
	return { ...last, url: url(state) }
}

const choose = (query: string, item: string, ctx = guest, depth = 1) =>
	run(at(query, depth, ctx), ctx, { type: "choose", item })

describe("TV state in the URL", () => {
	it("shows home when the URL has no TV screen", () => {
		assert.deepEqual(at("").screen, { name: "home" })
		assert.equal(url(at("")), "")
	})

	it("round-trips every screen with its keys", () => {
		for (const q of [
			"tv=tonight",
			"tv=tonight&pick=2",
			"tv=discover",
			"tv=discover&mood=funny",
			"tv=discover&mood=any",
			"tv=explorer",
			"tv=explorer&island=i3",
			"tv=taste",
			"tv=taste&side=dark-crime",
			"tv=quiz",
			"tv=title&title=movie-603",
			"tv=rate&title=show-1399",
			"tv=search",
			"tv=search&q=heist",
			"tv=about",
		])
			assert.equal(url(at(q)), q)
		assert.equal(url(at("tv=shows", 0, member)), "tv=shows")
	})

	it("falls back to home for unknown screens and incomplete keys", () => {
		for (const q of [
			"tv=nope",
			"tv=home",
			"tv=title",
			"tv=rate",
			"tv=title&title=knives-out",
			"tv=title&title=tv-1399",
			"tv=title&title=movie-0",
		])
			assert.deepEqual(at(q).screen, { name: "home" }, q)
	})

	it("gives a guest who opens My shows home", () => {
		assert.deepEqual(at("tv=shows").screen, { name: "home" })
		assert.deepEqual(at("tv=shows", 0, member).screen, { name: "shows" })
	})

	it("reads the focus of a link and never writes it", () => {
		const state = at("tv=title&title=movie-1&focus=seen")
		assert.equal(focusedItem(state, guest), "seen")
		assert.equal(url(state), "tv=title&title=movie-1")
	})

	it("keeps unrelated search params and drops what the old TV wrote", () => {
		assert.equal(
			writeTvParams(
				at("tv=about").screen,
				new URLSearchParams(
					"ref=share&tv=quiz&step=picks&goal=10&page=2&more=1&from=new&refine=1&service=Netflix&focus=x",
				),
			).toString(),
			"ref=share&tv=about",
		)
	})
})

describe("old addresses", () => {
	it("the moods are Discover", () => {
		assert.equal(url(at("tv=moods")), "tv=discover")
		assert.equal(url(at("tv=moods&refine=1&mood=cozy")), "tv=discover")
	})

	it("the picks for a mood are Discover with that mood", () => {
		assert.equal(url(at("tv=picks&mood=funny")), "tv=discover&mood=funny")
		assert.equal(
			url(at("tv=picks&mood=funny&from=new&service=Netflix")),
			"tv=discover&mood=funny",
		)
	})

	it("the picks without a mood are Tonight", () => {
		assert.equal(url(at("tv=picks")), "tv=tonight")
		assert.equal(
			url(at("tv=picks&from=wishlist&service=Netflix")),
			"tv=tonight",
		)
	})

	it("the services step and this or that are Tonight", () => {
		assert.equal(url(at("tv=services")), "tv=tonight")
		assert.equal(url(at("tv=this-or-that")), "tv=tonight")
	})

	it("the quiz is the quiz, whatever its step was", () => {
		assert.equal(url(at("tv=quiz&step=picks&goal=10&page=1")), "tv=quiz")
	})

	it("a title's catalog number becomes its key", () => {
		assert.equal(
			url(at("tv=title&title=1000000000603")),
			"tv=title&title=movie-603",
		)
		assert.equal(
			url(at("tv=title&title=2000000001399")),
			"tv=title&title=show-1399",
		)
	})

	it("a title it cannot parse is home", () => {
		for (const title of ["603", "1000000000000", "3000000000000", "m", "1e12"])
			assert.equal(url(at(`tv=title&title=${title}`)), "", title)
	})
})

describe("the screens and their items, in reading order", () => {
	it("home: the apps, and My shows for a member; no Back, no Expand", () => {
		assert.deepEqual(items(""), [
			"app:tonight",
			"app:discover",
			"app:explorer",
			"app:taste",
			"bar:search",
			"bar:menu",
		])
		assert.deepEqual(items("", member), [
			"app:tonight",
			"app:discover",
			"app:explorer",
			"app:taste",
			"app:shows",
			"bar:search",
			"bar:menu",
		])
	})

	it("Tonight: Details and Another one", () => {
		assert.deepEqual(items("tv=tonight"), [
			"details",
			"another",
			"expand",
			...BAR,
		])
	})

	it("Tonight with one pick has no Another one, and without a pick neither", () => {
		const one = { ...guest, tonight: [{ title: "movie-1" }] }
		assert.deepEqual(items("tv=tonight", one), ["details", "expand", ...BAR])
		assert.deepEqual(items("tv=tonight", EMPTY_CONTEXT), ["expand", ...BAR])
	})

	it("Discover without a mood: every mood, Any mood last", () => {
		assert.deepEqual(items("tv=discover"), [
			"mood:funny",
			"mood:feelgood",
			"mood:crime",
			"mood:any",
			"expand",
			...BAR,
		])
	})

	it("Discover with a mood: up to four titles and Change mood", () => {
		assert.deepEqual(items("tv=discover&mood=funny"), [
			"title:movie-11",
			"title:show-12",
			"title:movie-13",
			"title:movie-14",
			"change-mood",
			"expand",
			...BAR,
		])
	})

	it("Explorer without an island: six islands", () => {
		assert.deepEqual(items("tv=explorer"), [
			"island:i1",
			"island:i2",
			"island:i3",
			"island:i4",
			"island:i5",
			"island:i6",
			"expand",
			...BAR,
		])
	})

	it("Explorer with an island: up to four titles and two islands next door", () => {
		assert.deepEqual(items("tv=explorer&island=i1"), [
			"title:movie-11",
			"title:show-12",
			"title:movie-13",
			"title:movie-14",
			"hop:i2",
			"hop:i4",
			"expand",
			...BAR,
		])
	})

	it("Taste without a taste: Start rating, after the quiz's picks once there are some", () => {
		assert.deepEqual(items("tv=taste", { ...guest, titles: [] }), [
			"start-quiz",
			"expand",
			...BAR,
		])
		assert.deepEqual(items("tv=taste"), [
			"title:movie-11",
			"title:show-12",
			"title:movie-13",
			"title:movie-14",
			"start-quiz",
			"expand",
			...BAR,
		])
	})

	it("Taste with a taste: each side, then Rate more", () => {
		assert.deepEqual(items("tv=taste", member), [
			"side:dark-crime",
			"side:gentle-comedy",
			"side:big-ideas",
			"start-quiz",
			"expand",
			...BAR,
		])
	})

	it("Taste with a side: up to four titles", () => {
		assert.deepEqual(items("tv=taste&side=dark-crime", member), [
			"title:movie-11",
			"title:show-12",
			"title:movie-13",
			"title:movie-14",
			"expand",
			...BAR,
		])
	})

	it("the quiz: the strip's four levels from low to high, Haven't seen it, no Expand", () => {
		assert.deepEqual(items("tv=quiz"), [...LEVELS, "skip", ...BAR])
	})

	it("the quiz on the desktop: the ten exact scores under the levels", () => {
		assert.deepEqual(items("tv=quiz", desktop), [
			...LEVELS,
			...SCORES,
			"skip",
			...BAR,
		])
	})

	it("the quiz without a title to ask about: the bar alone", () => {
		assert.deepEqual(items("tv=quiz", { ...desktop, titles: [] }), BAR)
	})

	it("My shows: up to three Next episodes and up to three shows to start", () => {
		assert.deepEqual(items("tv=shows", member), [
			"title:show-21",
			"title:show-22",
			"title:show-23",
			"title:show-31",
			"title:show-32",
			"title:show-33",
			"expand",
			...BAR,
		])
	})

	it("a title: Watch, Want to See, Seen it", () => {
		assert.deepEqual(items("tv=title&title=movie-1"), [
			"watch",
			"want-to-see",
			"seen",
			"expand",
			...BAR,
		])
	})

	it("the rating: the same strip without Haven't seen it, no Expand", () => {
		assert.deepEqual(items("tv=rate&title=movie-1"), [...LEVELS, ...BAR])
		assert.deepEqual(items("tv=rate&title=movie-1", desktop), [
			...LEVELS,
			...SCORES,
			...BAR,
		])
		// Its title is in the address: the strip is there whatever list the page holds.
		assert.deepEqual(items("tv=rate&title=movie-1", { ...guest, titles: [] }), [
			...LEVELS,
			...BAR,
		])
	})

	it("search without a query: the ideas, and the typed query once it has two characters; no Search, no Expand", () => {
		assert.deepEqual(items("tv=search"), [
			"idea:cozy mystery",
			"idea:space adventure",
			"idea:feel-good comedy",
			"idea:mind-bending thriller",
			"bar:back",
			"bar:menu",
		])
		assert.deepEqual(items("tv=search", { ...guest, draft: "h" }).length, 6)
		assert.deepEqual(items("tv=search", { ...guest, draft: " he " }), [
			"go",
			"idea:cozy mystery",
			"idea:space adventure",
			"idea:feel-good comedy",
			"bar:back",
			"bar:menu",
		])
	})

	it("search with a query: up to four titles; no Search", () => {
		assert.deepEqual(items("tv=search&q=heist"), [
			"title:movie-11",
			"title:show-12",
			"title:movie-13",
			"title:movie-14",
			"expand",
			"bar:back",
			"bar:menu",
		])
	})

	it("What is GoodWatch?: Got it and Rate what I've seen, no Expand", () => {
		assert.deepEqual(items("tv=about"), ["got-it", "rate", ...BAR])
	})

	it("the menu: Home, Search, Sign in for a guest, What is GoodWatch?, Turn off", () => {
		assert.deepEqual(menuItems(guest), [
			"menu:home",
			"menu:search",
			"menu:sign-in",
			"menu:about",
			"menu:off",
		])
		assert.deepEqual(menuItems(member), [
			"menu:home",
			"menu:search",
			"menu:about",
			"menu:off",
		])
	})
})

describe("history: what pushes", () => {
	it("opening an app", () => {
		for (const [app, to] of [
			["tonight", "tv=tonight"],
			["discover", "tv=discover"],
			["explorer", "tv=explorer"],
			["taste", "tv=taste"],
			["shows", "tv=shows"],
		]) {
			const t = choose("", `app:${app}`, member, 0)
			assert.equal(t.history, "push", app)
			assert.equal(t.url, to)
			assert.equal(t.state.depth, 1)
			assert.deepEqual(t.effects, [])
		}
	})

	it("a guest has no My shows to open", () => {
		assert.equal(choose("", "app:shows").history, "none")
	})

	it("a mood, and Any mood", () => {
		const mood = choose("tv=discover", "mood:crime")
		assert.equal(mood.history, "push")
		assert.equal(mood.url, "tv=discover&mood=crime")
		assert.equal(choose("tv=discover", "mood:any").url, "tv=discover&mood=any")
	})

	it("an island", () => {
		const t = choose("tv=explorer", "island:i3")
		assert.equal(t.history, "push")
		assert.equal(t.url, "tv=explorer&island=i3")
	})

	it("a side", () => {
		const t = choose("tv=taste", "side:big-ideas", member)
		assert.equal(t.history, "push")
		assert.equal(t.url, "tv=taste&side=big-ideas")
	})

	it("a title, from every list", () => {
		for (const [q, ctx] of [
			["tv=discover&mood=funny", guest],
			["tv=explorer&island=i1", guest],
			["tv=taste", guest],
			["tv=taste&side=dark-crime", member],
			["tv=search&q=heist", guest],
		] as const) {
			const t = choose(q, "title:show-12", ctx)
			assert.equal(t.history, "push", q)
			assert.equal(t.url, "tv=title&title=show-12")
		}
		assert.equal(
			choose("tv=shows", "title:show-31", member).url,
			"tv=title&title=show-31",
		)
	})

	it("Tonight's Details, for the pick on show", () => {
		assert.equal(choose("tv=tonight", "details").url, "tv=title&title=movie-1")
		assert.equal(
			choose("tv=tonight&pick=2", "details").url,
			"tv=title&title=show-3",
		)
	})

	it("the quiz", () => {
		const t = choose("tv=taste", "start-quiz")
		assert.equal(t.history, "push")
		assert.equal(t.url, "tv=quiz")
	})

	it("the rating, after Seen it", () => {
		const t = choose("tv=title&title=movie-1", "seen")
		assert.equal(t.history, "push")
		assert.equal(t.url, "tv=rate&title=movie-1")
		assert.deepEqual(t.effects, [{ type: "seen", title: "movie-1" }])
	})

	it("search, from the Remote, the bar and the menu", () => {
		for (const action of [
			{ type: "open-search" },
			{ type: "choose", item: "bar:search" },
		] as const) {
			const t = run(at("tv=tonight", 1), guest, action)
			assert.equal(t.history, "push")
			assert.equal(t.url, "tv=search")
			assert.equal(t.state.depth, 2)
		}
		const menu = run(
			at("tv=tonight", 1),
			guest,
			{ type: "toggle-menu" },
			{ type: "choose", item: "menu:search" },
		)
		assert.equal(menu.history, "push")
		assert.equal(menu.url, "tv=search")
		assert.equal(menu.state.menuOpen, false)
	})

	it("a query submitted from another screen", () => {
		const t = run(at("tv=tonight"), guest, {
			type: "submit-search",
			query: "heist",
		})
		assert.equal(t.history, "push")
		assert.equal(t.url, "tv=search&q=heist")
	})

	it("a new screen starts with its own focus", () => {
		const t = run(
			at("focus=app%3Adiscover"),
			guest,
			{ type: "ok" },
			{ type: "ok" },
		)
		assert.equal(t.url, "tv=discover&mood=funny")
		assert.equal(t.state.focus, null)
		assert.equal(focusedItem(t.state, guest), "title:movie-11")
	})
})

describe("history: what replaces", () => {
	it("Another one on Tonight, which steps through three picks, wraps and keeps the focus", () => {
		const second = choose("tv=tonight", "another")
		assert.equal(second.history, "replace")
		assert.equal(second.url, "tv=tonight&pick=1")
		assert.equal(second.state.depth, 1)
		assert.equal(focusedItem(second.state, guest), "another")
		const t = run(second.state, guest, { type: "ok" }, { type: "ok" })
		assert.equal(t.history, "replace")
		assert.equal(t.url, "tv=tonight")
	})

	it("Another one counts a pick past the end from the pick it shows", () => {
		assert.equal(
			choose("tv=tonight&pick=7", "another").url,
			"tv=tonight&pick=2",
		)
	})

	it("Sail to an island", () => {
		const t = choose("tv=explorer&island=i1", "hop:i4")
		assert.equal(t.history, "replace")
		assert.equal(t.url, "tv=explorer&island=i4")
		assert.equal(t.state.depth, 1)
		assert.equal(t.state.focus, null)
	})

	it("search results from the search screen, so Back from them is one step", () => {
		const first = run(
			at(""),
			guest,
			{ type: "open-search" },
			{ type: "submit-search", query: " heist " },
		)
		assert.equal(first.history, "replace")
		assert.equal(first.state.depth, 1)
		assert.equal(first.url, "tv=search&q=heist")
		assert.equal(run(first.state, guest, { type: "back" }).history, "back")
	})

	it("a new query on the results", () => {
		const t = run(at("tv=search&q=heist", 1), guest, {
			type: "submit-search",
			query: "space",
		})
		assert.equal(t.history, "replace")
		assert.equal(t.url, "tv=search&q=space")
	})

	it("Rate what I've seen on What is GoodWatch?", () => {
		const t = choose("tv=about", "rate")
		assert.equal(t.history, "replace")
		assert.equal(t.url, "tv=quiz")
	})
})

describe("history: what goes back", () => {
	it("Back with history from this visit", () => {
		for (const action of [
			{ type: "back" },
			{ type: "choose", item: "bar:back" },
		] as const) {
			const t = run(at("tv=about", 1), guest, action)
			assert.equal(t.history, "back")
			assert.equal(t.url, "tv=about")
		}
	})

	it("Got it on What is GoodWatch?", () => {
		assert.equal(choose("tv=about", "got-it").history, "back")
	})

	it("the quiz score that reaches the goal, with the effect that stores it", () => {
		const last = { ...guest, quizProgress: 4 }
		const t = choose("tv=quiz", "level:7", last)
		assert.equal(t.history, "back")
		assert.deepEqual(t.effects, [{ type: "quiz-rate", score: 7 }])
	})

	it("a rating level, with the effect that stores it", () => {
		for (const [item, score] of [
			["level:9", 9],
			["level:7", 7],
			["level:5", 5],
			["level:3", 3],
		] as const) {
			const t = choose("tv=rate&title=movie-1", item)
			assert.equal(t.history, "back")
			assert.deepEqual(t.effects, [{ type: "rate", title: "movie-1", score }])
		}
	})

	it("Change mood, when the moods are one step back", () => {
		assert.equal(
			choose("tv=discover&mood=funny", "change-mood").history,
			"back",
		)
	})
})

describe("history: a deep link has nothing to go back to", () => {
	it("Back replaces the screen with home", () => {
		const t = run(at("tv=title&title=movie-1"), guest, { type: "back" })
		assert.equal(t.history, "replace")
		assert.equal(t.url, "")
		assert.equal(t.state.depth, 0)
	})

	it("Back on home does nothing", () => {
		const start = at("")
		const t = run(start, guest, { type: "back" })
		assert.equal(t.history, "none")
		assert.equal(t.state, start)
	})

	it("the last quiz score shows Taste", () => {
		const t = choose("tv=quiz", "level:9", { ...guest, quizProgress: 4 }, 0)
		assert.equal(t.history, "replace")
		assert.equal(t.url, "tv=taste")
		assert.deepEqual(t.effects, [{ type: "quiz-rate", score: 9 }])
	})

	it("a rating level shows the title", () => {
		const t = choose("tv=rate&title=movie-1", "level:5", guest, 0)
		assert.equal(t.history, "replace")
		assert.equal(t.url, "tv=title&title=movie-1")
		assert.deepEqual(t.effects, [{ type: "rate", title: "movie-1", score: 5 }])
	})

	it("Change mood shows the moods", () => {
		const t = choose("tv=discover&mood=funny", "change-mood", guest, 0)
		assert.equal(t.history, "replace")
		assert.equal(t.url, "tv=discover")
	})
})

describe("history: the Home key", () => {
	it("is one more step, so Back returns to the screen before it", () => {
		const home = run(at("tv=title&title=movie-1", 4), guest, { type: "home" })
		assert.equal(home.history, "push")
		assert.equal(home.url, "")
		assert.equal(home.state.depth, 5)
		assert.equal(run(home.state, guest, { type: "back" }).history, "back")
	})

	it("does nothing on home", () => {
		assert.equal(run(at("", 2), guest, { type: "home" }).history, "none")
	})
})

describe("history: what changes nothing", () => {
	it("a focus move, by direction, by the wheel and by the pointer", () => {
		const boxes: TvBox[] = [
			{ id: "watch", left: 0, top: 0, width: 100, height: 50 },
			{ id: "want-to-see", left: 120, top: 0, width: 100, height: 50 },
		]
		for (const action of [
			{ type: "move", dir: "right", boxes },
			{ type: "step", by: 1 },
			{ type: "focus", item: "want-to-see" },
		] as const) {
			const t = run(at("tv=title&title=movie-1", 1), guest, action)
			assert.equal(t.history, "none")
			assert.equal(focusedItem(t.state, guest), "want-to-see")
			assert.equal(t.url, "tv=title&title=movie-1")
			assert.deepEqual(t.effects, [])
		}
	})

	it("the menu", () => {
		const t = run(at("tv=tonight"), guest, { type: "toggle-menu" })
		assert.equal(t.history, "none")
		assert.equal(t.state.menuOpen, true)
		assert.equal(t.url, "tv=tonight")
	})

	it("power", () => {
		assert.equal(
			run(at("tv=tonight"), guest, { type: "power", on: false }).history,
			"none",
		)
	})

	it("an action that only has an effect: Watch, Want to See, a quiz score before the last", () => {
		const watch = choose("tv=title&title=movie-1", "watch")
		assert.equal(watch.history, "none")
		assert.deepEqual(watch.effects, [{ type: "watch", title: "movie-1" }])
		const want = choose("tv=title&title=movie-1", "want-to-see")
		assert.equal(want.history, "none")
		assert.deepEqual(want.effects, [{ type: "want-to-see", title: "movie-1" }])
		const answer = choose("tv=quiz", "level:3", {
			...guest,
			quizProgress: 3,
		})
		assert.equal(answer.history, "none")
		assert.deepEqual(answer.effects, [{ type: "quiz-rate", score: 3 }])
	})
})

describe("the Expand key's destinations", () => {
	const dest = (query: string, ctx: TvContext = guest) =>
		destinationHref(at(query, 0, ctx).screen, ctx)

	it("Tonight, a member: the pick's own page", () => {
		assert.equal(dest("tv=tonight", member), "/my-shows")
		assert.equal(dest("tv=tonight&pick=1", member), "/my-movies")
		assert.equal(dest("tv=tonight&pick=2", member), "/my-shows#start")
	})

	it("Tonight, a guest: Discover", () => {
		assert.equal(dest("tv=tonight"), "/discover")
		assert.equal(dest("tv=tonight", { ...member, member: false }), "/discover")
	})

	it("Tonight, a member without a pick: Discover", () => {
		assert.equal(dest("tv=tonight", { ...member, tonight: [] }), "/discover")
	})

	it("Discover, the choice: Discover, and nothing travels", () => {
		assert.equal(dest("tv=discover"), "/discover")
	})

	it("Discover, the titles: the mood travels", () => {
		assert.equal(dest("tv=discover&mood=funny"), "/discover?moods=funny")
	})

	it("Discover, Any mood: Discover without a mood", () => {
		assert.equal(dest("tv=discover&mood=any"), "/discover")
	})

	it("Discover never carries a streaming service", () => {
		assert.equal(
			dest("tv=discover&mood=funny&service=Netflix"),
			"/discover?moods=funny",
		)
	})

	it("Explorer, the map: the grouping travels", () => {
		assert.equal(dest("tv=explorer"), "/explorer?grouping=mood")
	})

	it("Explorer, an island: the island travels", () => {
		assert.equal(
			dest("tv=explorer&island=i3"),
			"/explorer?grouping=mood&island=i3",
		)
	})

	it("Taste, and a side: Taste", () => {
		assert.equal(dest("tv=taste"), "/taste")
		assert.equal(dest("tv=taste&side=dark-crime", member), "/taste")
	})

	it("My shows: My shows", () => {
		assert.equal(dest("tv=shows", member), "/my-shows")
	})

	it("a title: its page", () => {
		const named = { ...guest, titleName: "Knives Out" }
		assert.equal(
			dest("tv=title&title=movie-546554", named),
			"/movie/546554-knives-out",
		)
		assert.equal(
			dest("tv=title&title=show-107113", {
				...guest,
				titleName: "Only Murders in the Building",
			}),
			"/show/107113-only-murders-in-the-building",
		)
	})

	it("a title whose name is not there yet: the address its page moves on from", () => {
		assert.equal(dest("tv=title&title=movie-546554"), "/movie/546554")
	})

	it("search results: the search for that query, as the site's own search goes there", () => {
		assert.equal(dest("tv=search&q=heist"), "/discover?q=heist")
		for (const q of ["heist", "cozy mystery", "feel-good & more"])
			assert.equal(
				destinationHref({ name: "search", query: q }, guest),
				searchHref(q, { filterBar: true } as EnabledFeatures),
			)
	})

	it("home, the quiz, the rating, search before a query and What is GoodWatch? have no page", () => {
		for (const q of [
			"",
			"tv=quiz",
			"tv=rate&title=movie-1",
			"tv=search",
			"tv=about",
		]) {
			assert.equal(dest(q), null, q)
			assert.equal(items(q).includes("expand"), false, q)
		}
	})

	it("OK on the Expand key names the page, and the screen stays as it is", () => {
		const t = choose("tv=discover&mood=funny", "expand")
		assert.equal(t.history, "none")
		assert.equal(t.url, "tv=discover&mood=funny")
		assert.equal(t.state.focus, "expand")
		assert.deepEqual(t.effects, [
			{ type: "expand", href: "/discover?moods=funny" },
		])
	})

	it("keeps the member pages' addresses in step with the old TV's", () => {
		assert.deepEqual(DOOR_HREF, OLD_DOOR_HREF)
	})
})

describe("the title screen and the rating", () => {
	it("Seen it asks how it was, and the rating returns to the title", () => {
		const rate = choose("tv=title&title=show-3", "seen", member)
		assert.equal(rate.state.depth, 2)
		assert.equal(focusedItem(rate.state, member), "level:7")
		const t = run(rate.state, member, { type: "ok" })
		assert.equal(t.history, "back")
		assert.deepEqual(t.effects, [{ type: "rate", title: "show-3", score: 7 }])
	})

	it("Watch names the title, and the screen stays as it is with the key focused", () => {
		const t = choose("tv=title&title=movie-546554", "watch")
		assert.equal(t.history, "none")
		assert.equal(t.url, "tv=title&title=movie-546554")
		assert.equal(focusedItem(t.state, guest), "watch")
		assert.deepEqual(t.effects, [{ type: "watch", title: "movie-546554" }])
		// What is remembered for the entry it leaves: Back from the page returns with the Watch key focused.
		assert.equal(
			focusLeftBehind(
				at("tv=title&title=movie-546554", 1),
				{ type: "choose", item: "watch" },
				guest,
			),
			"watch",
		)
	})

	it("Watch opens the title's page on GoodWatch at its streaming block", () => {
		const named = { ...guest, titleName: "Knives Out" }
		assert.equal(
			watchHref("movie-546554", named),
			"/movie/546554-knives-out#streaming",
		)
		assert.equal(
			watchHref("movie-546554", named),
			`${destinationHref({ name: "title", title: "movie-546554" }, named)}#streaming`,
		)
		assert.equal(watchHref("nothing", named), null)
	})

	it("ignores an action of another screen", () => {
		for (const item of ["watch", "seen", "level:9", "details", "go"]) {
			const start = at("tv=about", 1)
			const t = run(start, guest, { type: "choose", item })
			assert.equal(t.history, "none", item)
			assert.equal(t.state, start)
			assert.deepEqual(t.effects, [])
		}
	})
})

describe("the rating strip", () => {
	// The strip as the desktop lays it out: each level as wide as its scores, the ten scores under them, and in the
	// quiz Haven't seen it under those. The bar is above, at the right.
	const cell = 100
	const span = [
		["level:3", 0, 4],
		["level:5", 4, 2],
		["level:7", 6, 2],
		["level:9", 8, 2],
	] as const
	const boxes: TvBox[] = [
		...span.map(([id, from, width]) => ({
			id,
			left: from * cell,
			top: 300,
			width: width * cell - 8,
			height: 92,
		})),
		...SCORES.map((id, at) => ({
			id,
			left: at * cell,
			top: 400,
			width: cell - 8,
			height: 64,
		})),
		{ id: "skip", left: 0, top: 492, width: 280, height: 64 },
		{ id: "bar:back", left: 560, top: 20, width: 130, height: 64 },
		{ id: "bar:search", left: 700, top: 20, width: 150, height: 64 },
		{ id: "bar:menu", left: 860, top: 20, width: 132, height: 64 },
	]
	const move = (
		query: string,
		from: string,
		dir: TvAction & { type: "move" },
	) =>
		focusedItem(
			run(at(query, 1, desktop), desktop, { type: "focus", item: from }, dir)
				.state,
			desktop,
		)
	const go = (dir: "up" | "down" | "left" | "right") =>
		({ type: "move", dir, boxes }) as const

	it("reads its levels and their scores from the app's rating levels", () => {
		assert.deepEqual(
			STRIP_LEVELS,
			RATING_LEVELS.map((level) => level.score),
		)
		assert.deepEqual(STRIP_LEVELS, [3, 5, 7, 9])
		assert.deepEqual(STRIP_SCORES, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
		assert.equal(STRIP_START, "level:7")
		assert.equal(RATING_LEVELS[levelOf(7)].name, "Good")
	})

	it("OK on a level gives the level's score: 3, 5, 7 and 9", () => {
		for (const score of [3, 5, 7, 9] as const) {
			assert.deepEqual(choose("tv=quiz", `level:${score}`).effects, [
				{ type: "quiz-rate", score },
			])
			assert.deepEqual(
				choose("tv=rate&title=movie-1", `level:${score}`).effects,
				[{ type: "rate", title: "movie-1", score }],
			)
		}
	})

	it("an exact score is given as it is, in the quiz and for a title", () => {
		for (const score of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const) {
			assert.deepEqual(choose("tv=quiz", `score:${score}`, desktop).effects, [
				{ type: "quiz-rate", score },
			])
			const rated = choose("tv=rate&title=movie-1", `score:${score}`, desktop)
			assert.equal(rated.history, "back")
			assert.deepEqual(rated.effects, [
				{ type: "rate", title: "movie-1", score },
			])
		}
	})

	it("has no exact score on the phone: choosing one does nothing", () => {
		const start = at("tv=quiz", 1)
		const t = run(start, guest, { type: "choose", item: "score:8" })
		assert.equal(t.state, start)
		assert.deepEqual(t.effects, [])
		assert.equal(
			run(start, guest, { type: "focus", item: "score:8" }).state,
			start,
		)
	})

	it("Left and Right move along the levels, and stop at the ends", () => {
		assert.equal(move("tv=quiz", "level:7", go("right")), "level:9")
		assert.equal(move("tv=quiz", "level:9", go("right")), "level:9")
		assert.equal(move("tv=quiz", "level:7", go("left")), "level:5")
		assert.equal(move("tv=quiz", "level:5", go("left")), "level:3")
		assert.equal(move("tv=quiz", "level:3", go("left")), "level:3")
	})

	it("Down from a level lands on the lowest exact score under it", () => {
		for (const [level, score] of [
			["level:3", "score:1"],
			["level:5", "score:5"],
			["level:7", "score:7"],
			["level:9", "score:9"],
		])
			for (const query of ["tv=quiz", "tv=rate&title=movie-1"])
				assert.equal(move(query, level, go("down")), score, level)
	})

	it("Up from an exact score lands on the level over it", () => {
		const over = [3, 3, 3, 3, 5, 5, 7, 7, 9, 9]
		for (const query of ["tv=quiz", "tv=rate&title=movie-1"])
			SCORES.forEach((score, at) =>
				assert.equal(move(query, score, go("up")), `level:${over[at]}`, score),
			)
	})

	it("these two moves need no boxes: the machine names them before the direction rule", () => {
		const blind = { type: "move", dir: "down", boxes: [] } as const
		assert.equal(move("tv=quiz", "level:3", blind), "score:1")
		assert.equal(
			move("tv=quiz", "score:10", { ...blind, dir: "up" }),
			"level:9",
		)
	})

	it("Left and Right move along all ten scores", () => {
		assert.equal(move("tv=quiz", "score:4", go("right")), "score:5")
		assert.equal(move("tv=quiz", "score:7", go("left")), "score:6")
		assert.equal(move("tv=quiz", "score:10", go("right")), "score:10")
		assert.equal(move("tv=quiz", "score:1", go("left")), "score:1")
	})

	it("Down from the scores reaches Haven't seen it in the quiz; a rating has nothing there", () => {
		assert.equal(move("tv=quiz", "score:2", go("down")), "skip")
		const rate = boxes.filter((box) => box.id !== "skip")
		assert.equal(
			move("tv=rate&title=movie-1", "score:2", {
				type: "move",
				dir: "down",
				boxes: rate,
			}),
			"score:2",
		)
	})

	it("Up from a level reaches the bar, and Down from the bar comes back to the levels", () => {
		assert.equal(move("tv=quiz", "level:9", go("up")), "bar:menu")
		assert.equal(move("tv=quiz", "bar:menu", go("down")), "level:9")
	})

	it("on the phone, without exact scores, Down from a level is the direction rule's: Haven't seen it", () => {
		const phone = boxes.filter((box) => !box.id.startsWith("score:"))
		const t = run(
			at("tv=quiz", 1),
			guest,
			{ type: "focus", item: "level:5" },
			{ type: "move", dir: "down", boxes: phone },
		)
		assert.equal(focusedItem(t.state, guest), "skip")
	})

	it("leaves the menu's own moves alone while the menu is open", () => {
		const open = run(at("tv=quiz", 1, desktop), desktop, {
			type: "toggle-menu",
		})
		const t = run(open.state, desktop, { type: "move", dir: "down", boxes: [] })
		assert.equal(focusedItem(t.state, desktop), "menu:home")
		assert.equal(t.state.focus, open.state.focus)
	})

	it("the pointer over a key gives it the focus, and a click gives its score", () => {
		const over = run(at("tv=quiz", 1, desktop), desktop, {
			type: "focus",
			item: "score:6",
		})
		assert.equal(focusedItem(over.state, desktop), "score:6")
		assert.deepEqual(over.effects, [])
		const t = run(over.state, desktop, { type: "choose", item: "score:8" })
		assert.deepEqual(t.effects, [{ type: "quiz-rate", score: 8 }])
	})

	it("the wheel steps through the levels, the scores and Haven't seen it in reading order", () => {
		const all = tvItems({ name: "quiz" }, desktop)
		let state = at("tv=quiz", 1, desktop)
		const from = all.indexOf("level:7")
		const seen = all.map(() => {
			state = transition(state, { type: "step", by: 1 }, desktop).state
			return focusedItem(state, desktop)
		})
		assert.deepEqual(seen, [...all.slice(from + 1), ...all.slice(0, from + 1)])
	})
})

describe("the taste quiz", () => {
	it("Haven't seen it skips and never ends the quiz", () => {
		const t = choose("tv=quiz", "skip", { ...guest, quizProgress: 4 })
		assert.equal(t.history, "none")
		assert.deepEqual(t.effects, [{ type: "quiz-skip" }])
		assert.equal(focusedItem(t.state, guest), "skip")
	})

	it("keeps the focus where it was after a score, so the next title takes the same press", () => {
		for (const item of ["level:3", "level:9", "score:8", "score:1"]) {
			const t = run(
				at("tv=quiz", 2, desktop),
				desktop,
				{ type: "choose", item },
				{ type: "ok" },
				{ type: "ok" },
			)
			assert.equal(focusedItem(t.state, desktop), item)
			assert.equal(t.history, "none")
			assert.deepEqual(t.effects, [
				{ type: "quiz-rate", score: Number(item.split(":")[1]) },
			])
		}
	})

	it("ends with the score that reaches the goal, whichever key gave it", () => {
		const last = { ...desktop, quizProgress: 4 }
		for (const item of ["level:5", "score:10"]) {
			const t = choose("tv=quiz", item, last)
			assert.equal(t.history, "back")
			assert.equal(t.effects.length, 1)
		}
	})

	it("goes on past the goal when rating more", () => {
		const t = choose("tv=quiz", "level:9", { ...member, quizProgress: 7 })
		assert.equal(t.history, "none")
	})

	it("Haven't seen it is the quiz's alone", () => {
		const start = at("tv=rate&title=movie-1", 1)
		const t = run(start, guest, { type: "choose", item: "skip" })
		assert.equal(t.state, start)
		assert.deepEqual(t.effects, [])
	})
})

describe("search", () => {
	it("ignores queries shorter than two characters", () => {
		assert.equal(
			run(at("tv=search"), guest, { type: "submit-search", query: " a " })
				.history,
			"none",
		)
	})

	it("starts on the typed query once it has a key, and OK searches for it", () => {
		const typing = { ...guest, draft: "heist " }
		assert.equal(focusedItem(at("tv=search", 1), typing), "go")
		const t = run(at("tv=search", 1), typing, { type: "ok" })
		assert.equal(t.history, "replace")
		assert.equal(t.url, "tv=search&q=heist")
	})

	it("an idea searches for its words", () => {
		const t = choose("tv=search", "idea:cozy mystery")
		assert.equal(t.history, "replace")
		assert.equal(t.url, "tv=search&q=cozy+mystery")
		assert.deepEqual(t.state.screen, { name: "search", query: "cozy mystery" })
	})

	it("the Search key on the empty search screen goes back", () => {
		assert.equal(
			run(at("tv=search", 1), guest, { type: "open-search" }).history,
			"back",
		)
	})

	it("the Search key on the results opens the search screen again", () => {
		const t = run(at("tv=search&q=heist", 1), guest, { type: "open-search" })
		assert.equal(t.history, "push")
		assert.equal(t.url, "tv=search")
	})
})

describe("the menu", () => {
	const open = (query: string, ctx: TvContext, depth = 1) =>
		run(at(query, depth, ctx), ctx, { type: "toggle-menu" }).state

	it("opens from the bar and starts on Home", () => {
		const t = choose("tv=tonight", "bar:menu")
		assert.equal(t.state.menuOpen, true)
		assert.equal(t.history, "none")
		assert.equal(focusedItem(t.state, guest), "menu:home")
		assert.deepEqual(activeItems(t.state, guest), menuItems(guest))
	})

	it("takes the focus while open, without touching the URL or the screen's focus", () => {
		const s = open("tv=tonight&focus=another", guest)
		const boxes = menuItems(guest).map((id, n) => ({
			id,
			left: 800,
			top: 100 + n * 92,
			width: 360,
			height: 76,
		}))
		const t = run(
			s,
			guest,
			{ type: "move", dir: "down", boxes },
			{ type: "step", by: 1 },
			{ type: "focus", item: "details" },
		)
		assert.equal(t.history, "none")
		assert.equal(focusedItem(t.state, guest), "menu:sign-in")
		assert.equal(t.url, "tv=tonight")
		const closed = run(t.state, guest, { type: "back" })
		assert.equal(closed.state.menuOpen, false)
		assert.equal(closed.history, "none")
		assert.equal(focusedItem(closed.state, guest), "another")
	})

	it("Home goes home as a new screen and closes", () => {
		const t = run(open("tv=title&title=movie-1", guest), guest, { type: "ok" })
		assert.equal(t.history, "push")
		assert.equal(t.url, "")
		assert.equal(t.state.depth, 2)
		assert.equal(t.state.menuOpen, false)
	})

	it("Sign in names the effect and closes; a member has no such item", () => {
		const t = run(open("tv=tonight", guest), guest, {
			type: "choose",
			item: "menu:sign-in",
		})
		assert.equal(t.history, "none")
		assert.equal(t.state.menuOpen, false)
		assert.deepEqual(t.effects, [{ type: "sign-in" }])
		const m = run(open("tv=tonight", member), member, {
			type: "choose",
			item: "menu:sign-in",
		})
		assert.deepEqual(m.effects, [])
	})

	// The plan's history table says "replace" here. That would take the screen under the menu out of the history,
	// and Back from What is GoodWatch? would skip it; in the prototype the screen replaced was the menu's own.
	it("What is GoodWatch? is a new screen, so Back returns to the screen under the menu", () => {
		const t = run(open("tv=discover&mood=funny", guest, 2), guest, {
			type: "choose",
			item: "menu:about",
		})
		assert.equal(t.history, "push")
		assert.equal(t.url, "tv=about")
		assert.equal(t.state.depth, 3)
		assert.equal(t.state.menuOpen, false)
		assert.equal(
			run(t.state, guest, { type: "choose", item: "got-it" }).history,
			"back",
		)
	})

	it("only closes when it points at the screen already showing", () => {
		for (const [query, item] of [
			["tv=about", "menu:about"],
			["", "menu:home"],
			["tv=search", "menu:search"],
		]) {
			const t = run(open(query, guest), guest, { type: "choose", item })
			assert.equal(t.history, "none", item)
			assert.equal(t.state.menuOpen, false)
			assert.equal(t.url, query)
		}
	})

	it("turns the TV off", () => {
		const t = run(open("", guest), guest, { type: "choose", item: "menu:off" })
		assert.equal(t.state.power, "off")
		assert.equal(t.state.menuOpen, false)
	})

	it("closes instead of choosing an item behind it", () => {
		const t = run(open("", guest), guest, {
			type: "choose",
			item: "app:discover",
		})
		assert.equal(t.state.menuOpen, false)
		assert.equal(t.history, "none")
		assert.equal(t.url, "")
	})

	it("closes on the Menu key again", () => {
		const t = run(open("tv=tonight", guest), guest, { type: "toggle-menu" })
		assert.equal(t.state.menuOpen, false)
	})
})

describe("focus", () => {
	const box = (id: string, left: number, top: number): TvBox => ({
		id,
		left,
		top,
		width: 100,
		height: 50,
	})
	const home = [
		box("app:tonight", 0, 300),
		box("app:discover", 120, 300),
		box("app:explorer", 240, 300),
		box("app:taste", 360, 300),
		box("bar:search", 240, 0),
		box("bar:menu", 360, 0),
	]

	it("starts on the screen's first own item, on the rating strip on Good, never on the bar or the Expand key", () => {
		for (const [query, first] of [
			["", "app:tonight"],
			["tv=tonight", "details"],
			["tv=discover", "mood:funny"],
			["tv=discover&mood=funny", "title:movie-11"],
			["tv=explorer", "island:i1"],
			["tv=quiz", "level:7"],
			["tv=title&title=movie-1", "watch"],
			["tv=rate&title=movie-1", "level:7"],
			["tv=search", "idea:cozy mystery"],
			["tv=about", "got-it"],
		])
			assert.equal(focusedItem(at(query), guest), first, query)
	})

	it("starts on the first action of a list with no titles", () => {
		const empty = { ...guest, titles: [] }
		assert.equal(
			focusedItem(at("tv=discover&mood=funny"), empty),
			"change-mood",
		)
		assert.equal(focusedItem(at("tv=explorer&island=i1"), empty), "hop:i2")
	})

	it("starts on Back when a screen has nothing of its own", () => {
		const empty = { ...guest, titles: [] }
		assert.equal(focusedItem(at("tv=search&q=zzz"), empty), "bar:back")
		assert.equal(focusedItem(at("tv=tonight"), EMPTY_CONTEXT), "bar:back")
	})

	it("moves in four directions over the boxes it is given", () => {
		const t = run(
			at(""),
			guest,
			{ type: "move", dir: "right", boxes: home },
			{ type: "move", dir: "right", boxes: home },
			{ type: "move", dir: "up", boxes: home },
		)
		assert.equal(t.state.focus, "bar:search")
		assert.equal(t.history, "none")
	})

	it("stays when there is nothing in that direction, or the focused item was not measured", () => {
		const start = at("")
		assert.equal(
			run(start, guest, { type: "move", dir: "left", boxes: home }).state,
			start,
		)
		assert.equal(
			run(start, guest, { type: "move", dir: "right", boxes: home.slice(1) })
				.state,
			start,
		)
	})

	it("does not move to a box that is not an item of the screen", () => {
		const stale = [home[0], box("title:movie-11", 120, 300), home[2]]
		const t = run(at(""), guest, { type: "move", dir: "right", boxes: stale })
		assert.equal(t.state.focus, "app:explorer")
	})

	it("hands the canvas scale to the direction rule", () => {
		// Doubled boxes: "discover" is 10 canvas pixels below and far to the side, "explorer" 45 below and in line.
		const boxes: TvBox[] = [
			{ id: "app:tonight", left: 600, top: 0, width: 200, height: 100 },
			{ id: "app:discover", left: 1400, top: 120, width: 200, height: 100 },
			{ id: "app:explorer", left: 600, top: 190, width: 200, height: 100 },
		]
		const down = (scale?: number) =>
			run(at(""), guest, { type: "move", dir: "down", boxes, scale }).state
				.focus
		assert.equal(down(2), "app:explorer")
		assert.equal(down(), "app:discover")
	})

	it("steps through every item in reading order with the wheel, and wraps", () => {
		const all = tvItems({ name: "home" }, guest)
		let state = at("")
		const seen = all.map(() => {
			state = transition(state, { type: "step", by: 1 }, guest).state
			return focusedItem(state, guest)
		})
		assert.deepEqual(seen, [...all.slice(1), all[0]])
		assert.equal(
			run(at(""), guest, { type: "step", by: -1 }).state.focus,
			"bar:menu",
		)
	})

	it("takes the item the pointer is over, and ignores one the screen does not have", () => {
		const start = at("")
		const t = run(start, guest, { type: "focus", item: "app:taste" })
		assert.equal(t.state.focus, "app:taste")
		assert.equal(
			run(t.state, guest, { type: "focus", item: "app:taste" }).state,
			t.state,
		)
		assert.equal(
			run(start, guest, { type: "focus", item: "title:gone" }).state,
			start,
		)
	})

	it("falls back to where the focus starts when the focused item is gone", () => {
		assert.equal(
			run(at("focus=title%3Agone"), guest, { type: "ok" }).url,
			"tv=tonight",
		)
	})

	it("a pointer's choice takes the focus too", () => {
		const t = choose("tv=title&title=movie-1", "want-to-see")
		assert.equal(t.state.focus, "want-to-see")
	})

	it("remembers the focus of the screen an action leaves", () => {
		const screen = at("tv=discover&focus=mood%3Acrime", 1)
		assert.equal(focusLeftBehind(screen, { type: "ok" }, guest), "mood:crime")
		assert.equal(
			focusLeftBehind(at("tv=discover"), { type: "home" }, guest),
			"mood:funny",
		)
		assert.equal(
			focusLeftBehind(screen, { type: "choose", item: "mood:any" }, guest),
			"mood:any",
		)
		assert.equal(
			focusLeftBehind(screen, { type: "choose", item: "title:gone" }, guest),
			"mood:crime",
		)
		const menu = run(screen, guest, { type: "toggle-menu" }).state
		assert.equal(
			focusLeftBehind(menu, { type: "choose", item: "menu:about" }, guest),
			"mood:crime",
		)
	})
})

describe("the Remote's streaming keys", () => {
	// What a press does waits for the prototype of the service screen.
	it("do nothing for now: no screen, no toast, nothing in the URL", () => {
		for (const query of [
			"",
			"tv=tonight",
			"tv=discover",
			"tv=discover&mood=funny",
		])
			for (const service of ["Netflix", "Amazon Prime Video"]) {
				const start = at(query, 1)
				const t = run(start, guest, { type: "service-key", service })
				assert.equal(t.history, "none", query)
				assert.equal(t.state, start)
				assert.deepEqual(t.effects, [])
			}
	})

	it("leave an open menu open", () => {
		const menu = run(at(""), guest, { type: "toggle-menu" }).state
		assert.equal(
			run(menu, guest, { type: "service-key", service: "Netflix" }).state,
			menu,
		)
	})
})

describe("power and boot", () => {
	it("boots after turning on, ignores keys while booting, then shows home", () => {
		const off = run(at("tv=about"), guest, { type: "power", on: false })
		assert.equal(off.state.power, "off")
		const booting = run(
			off.state,
			guest,
			{ type: "power", on: true },
			{ type: "ok" },
			{ type: "home" },
		)
		assert.equal(booting.state.power, "booting")
		assert.equal(booting.url, "tv=about")
		const on = run(booting.state, guest, { type: "boot-done" })
		assert.equal(on.state.power, "on")
		assert.equal(on.history, "replace")
		assert.equal(on.url, "")
	})

	it("ignores everything but the power key while off", () => {
		const off = run(at("tv=about"), guest, { type: "power", on: false }).state
		for (const action of [
			{ type: "ok" },
			{ type: "back" },
			{ type: "toggle-menu" },
			{ type: "boot-done" },
		] as const)
			assert.equal(run(off, guest, action).state, off)
	})

	it("turning off closes the menu", () => {
		const t = run(
			at(""),
			guest,
			{ type: "toggle-menu" },
			{ type: "power", on: false },
		)
		assert.equal(t.state.menuOpen, false)
		assert.equal(t.state.power, "off")
	})
})

describe("loader revalidation", () => {
	it("treats changes to TV params alone as TV-only", () => {
		assert.equal(
			isTvOnlyChange(
				new URL("https://x/?tv=about"),
				new URL("https://x/?tv=discover&mood=funny"),
			),
			true,
		)
		assert.equal(
			isTvOnlyChange(
				new URL("https://x/?tv=explorer&island=i1&ref=a"),
				new URL("https://x/?ref=a&tv=title&title=movie-1&focus=seen"),
			),
			true,
		)
		assert.equal(
			isTvOnlyChange(
				new URL("https://x/?tv=picks&from=new&step=keep&service=Netflix"),
				new URL("https://x/?tv=tonight&pick=1"),
			),
			true,
		)
		assert.equal(
			isTvOnlyChange(
				new URL("https://x/?tv=about"),
				new URL("https://x/?tv=about&ref=a"),
			),
			false,
		)
		assert.equal(
			isTvOnlyChange(new URL("https://x/"), new URL("https://x/movie/1")),
			false,
		)
	})
})

describe("every screen", () => {
	const screens: [TvScreen, TvContext][] = [
		"",
		"tv=tonight",
		"tv=discover",
		"tv=discover&mood=funny",
		"tv=explorer",
		"tv=explorer&island=i1",
		"tv=taste",
		"tv=taste&side=dark-crime",
		"tv=quiz",
		"tv=shows",
		"tv=title&title=movie-1",
		"tv=rate&title=movie-1",
		"tv=search",
		"tv=search&q=heist",
		"tv=about",
	].flatMap((q) =>
		[guest, member, EMPTY_CONTEXT].map((ctx): [TvScreen, TvContext] => [
			at(q, 0, ctx).screen,
			ctx,
		]),
	)

	it("has item ids that are unique and of the form kind or kind:argument", () => {
		for (const [screen, ctx] of screens) {
			const all = tvItems(screen, ctx)
			assert.equal(new Set(all).size, all.length, screen.name)
			for (const item of all) assert.match(item, /^[a-z-]+(:.+)?$/)
		}
	})

	it("ends with the Expand key exactly where it has a page, then the bar", () => {
		for (const [screen, ctx] of screens) {
			const all = tvItems(screen, ctx)
			const tail = all.slice(
				all.findIndex((i) => i === "expand" || i.startsWith("bar:")),
			)
			assert.deepEqual(
				tail,
				[
					...(destinationHref(screen, ctx) ? ["expand"] : []),
					...(screen.name === "home" ? [] : ["bar:back"]),
					...(screen.name === "search" ? [] : ["bar:search"]),
					"bar:menu",
				],
				screen.name,
			)
		}
	})

	it("answers OK on each of its items without leaving the screens it knows", () => {
		for (const [screen, ctx] of screens)
			for (const item of tvItems(screen, ctx)) {
				const start: TvState = { ...at("", 1), screen }
				const t = transition(start, { type: "choose", item }, ctx)
				assert.deepEqual(
					readTvState(writeTvParams(t.state.screen), ctx).screen,
					t.state.screen,
					`${screen.name} ${item}`,
				)
			}
	})
})
