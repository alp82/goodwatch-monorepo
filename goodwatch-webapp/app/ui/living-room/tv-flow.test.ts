import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
	type TvAction,
	type TvContext,
	type TvState,
	isTvOnlyChange,
	readTvState,
	transition,
	tvItems,
	writeTvParams,
} from "./tv-flow.ts"

const guest: TvContext = {
	member: false,
	pickKeys: ["movie-1", "movie-2", "tv-3", "movie-4"],
	wishlistKeys: [],
	serviceNames: ["Netflix", "Prime Video"],
	moodKeys: ["cozy", "thrilling"],
	hasServices: false,
	answered: 0,
	pairsLeft: 6,
}
const member: TvContext = {
	...guest,
	member: true,
	wishlistKeys: ["movie-9"],
	hasServices: true,
}

const at = (query: string, depth = 0) =>
	readTvState(new URLSearchParams(query), depth)
const url = (state: TvState) => writeTvParams(state).toString()

/** Runs actions from a URL and returns the final transition plus the URL after each one. */
function run(start: TvState, ctx: TvContext, ...actions: TvAction[]) {
	let state = start
	let last = transition(state, { type: "focus", item: "" }, ctx)
	for (const action of actions) {
		last = transition(state, action, ctx)
		state = last.state
	}
	return { ...last, url: url(state) }
}

describe("TV state in the URL", () => {
	it("shows home when the URL has no TV screen", () => {
		assert.deepEqual(at("").screen, { name: "home" })
		assert.equal(url(at("")), "")
	})

	it("round-trips the picks screen with its night", () => {
		assert.equal(
			url(at("tv=picks&mood=cozy&from=wishlist&service=Netflix")),
			"tv=picks&mood=cozy&from=wishlist&service=Netflix",
		)
	})

	it("round-trips a title, an app, a search, and the focus", () => {
		for (const q of [
			"tv=title&title=movie-1",
			"tv=app&app=taste",
			"tv=search&q=heist",
			"tv=moods&refine=1&focus=mood%3Acozy",
		]) {
			assert.equal(url(at(q)), q)
		}
	})

	it("falls back to home for unknown screens and incomplete keys", () => {
		for (const q of ["tv=nope", "tv=title", "tv=app&app=settings"])
			assert.deepEqual(at(q).screen, { name: "home" })
	})

	it("keeps unrelated search params", () => {
		assert.equal(
			writeTvParams(
				at("tv=about"),
				new URLSearchParams("ref=share&tv=home"),
			).toString(),
			"ref=share&tv=about",
		)
	})
})

describe("guest home: Find my tonight", () => {
	it("offers Find my tonight, Just show me, and What is GoodWatch?", () => {
		assert.deepEqual(tvItems({ name: "home" }, guest), [
			"find-my-tonight",
			"just-show-me",
			"about",
		])
	})

	it("goes to services first when the guest has none, pushing history", () => {
		const t = run(at(""), guest, { type: "ok" })
		assert.equal(t.history, "push")
		assert.equal(t.url, "tv=services")
	})

	it("goes straight to this or that when the guest has services", () => {
		assert.equal(
			run(at(""), { ...guest, hasServices: true }, { type: "ok" }).url,
			"tv=this-or-that",
		)
	})

	it("toggles a service on the services screen without navigating", () => {
		const t = run(at("tv=services"), guest, {
			type: "choose",
			item: "service:Netflix",
		})
		assert.equal(t.history, "none")
		assert.deepEqual(t.effects, [
			{ type: "toggle-service", service: "Netflix" },
		])
	})

	it("unlocks Show my picks after three answers", () => {
		assert.ok(
			!tvItems({ name: "this-or-that" }, { ...guest, answered: 2 }).includes(
				"show-picks",
			),
		)
		const t = run(
			at("tv=this-or-that", 2),
			{ ...guest, answered: 3 },
			{ type: "choose", item: "show-picks" },
		)
		assert.equal(t.history, "replace")
		assert.equal(t.url, "tv=picks&from=new")
	})

	it("replaces this or that with the picks after the last pair", () => {
		const t = run(
			at("tv=this-or-that", 2),
			{ ...guest, pairsLeft: 1 },
			{ type: "choose", item: "answer:b" },
		)
		assert.deepEqual(t.effects, [{ type: "answer-pair", side: "b" }])
		assert.equal(t.history, "replace")
		assert.equal(t.url, "tv=picks&from=new")
	})

	it("records an answer and stays while pairs remain", () => {
		const t = run(at("tv=this-or-that"), guest, {
			type: "choose",
			item: "answer:skip",
		})
		assert.equal(t.history, "none")
		assert.equal(t.url, "tv=this-or-that")
	})
})

describe("guest home: Just show me and What is GoodWatch?", () => {
	it("shows new picks right away", () => {
		assert.equal(
			run(at(""), guest, { type: "choose", item: "just-show-me" }).url,
			"tv=picks&from=new",
		)
	})

	it("opens What is GoodWatch? with both ways onward", () => {
		const t = run(at(""), guest, { type: "choose", item: "about" })
		assert.equal(t.url, "tv=about")
		assert.deepEqual(tvItems(t.state.screen, guest), [
			"find-my-tonight",
			"just-show-me",
		])
	})

	it("offers Refine my picks once the guest answered, else Make it mine via services", () => {
		assert.equal(
			tvItems(
				{ name: "picks", night: { mood: null, source: "new", service: null } },
				guest,
			).at(-1),
			"services",
		)
		assert.equal(
			tvItems(
				{ name: "picks", night: { mood: null, source: "new", service: null } },
				{ ...guest, answered: 2 },
			).at(-1),
			"this-or-that",
		)
	})
})

describe("member home: mood, source, picks", () => {
	it("lists Any mood, the moods, and the four apps", () => {
		assert.deepEqual(tvItems({ name: "home" }, member), [
			"mood:any",
			"mood:cozy",
			"mood:thrilling",
			"app:watch-now",
			"app:taste",
			"app:discover",
			"app:explorer",
		])
	})

	it("asks Wishlist or new after a mood, then shows the picks", () => {
		const t = run(
			at(""),
			member,
			{ type: "choose", item: "mood:cozy" },
			{ type: "choose", item: "source:wishlist" },
		)
		assert.equal(t.history, "push")
		assert.equal(t.url, "tv=picks&mood=cozy&from=wishlist")
		assert.equal(t.state.depth, 2)
	})

	it("switches between Wishlist and new in place", () => {
		const t = run(at("tv=picks&mood=cozy"), member, {
			type: "choose",
			item: "switch-source",
		})
		assert.equal(t.history, "replace")
		assert.equal(t.url, "tv=picks&mood=cozy&from=new")
	})

	it("Pick a mood from the picks replaces them with the new mood", () => {
		const t = run(
			at("tv=picks&mood=cozy&from=new", 3),
			member,
			{ type: "choose", item: "moods" },
			{ type: "choose", item: "mood:thrilling" },
		)
		assert.equal(t.history, "replace")
		assert.equal(t.url, "tv=picks&mood=thrilling")
	})

	it("Pick for me opens the moods", () => {
		assert.equal(
			run(at("tv=about"), member, { type: "pick-for-me" }).url,
			"tv=moods",
		)
	})
})

describe("title screen", () => {
	it("opens a pick's title screen", () => {
		const t = run(at("tv=picks&from=new"), guest, { type: "ok" })
		assert.equal(t.url, "tv=title&title=movie-1")
		assert.deepEqual(tvItems(t.state.screen, guest), [
			"watch",
			"want-to-see",
			"seen",
			"not-for-me",
			"full-page",
		])
	})

	it("Want to See stays; Seen it and Not for me go back", () => {
		assert.deepEqual(
			run(at("tv=title&title=m", 1), guest, {
				type: "choose",
				item: "want-to-see",
			}).effects,
			[{ type: "want-to-see", title: "m" }],
		)
		const seen = run(at("tv=title&title=m", 1), guest, {
			type: "choose",
			item: "seen",
		})
		assert.equal(seen.history, "back")
		assert.deepEqual(seen.effects, [{ type: "seen", title: "m" }])
	})

	it("Full page leaves the living room for the title", () => {
		assert.deepEqual(
			run(at("tv=title&title=m"), guest, { type: "choose", item: "full-page" })
				.effects,
			[{ type: "leave", to: { kind: "title", title: "m" } }],
		)
	})
})

describe("apps, search, and the More menu", () => {
	it("opens an app glimpse and leaves for its full page", () => {
		const t = run(
			at(""),
			member,
			{ type: "open-app", app: "explorer" },
			{ type: "ok" },
		)
		assert.deepEqual(t.effects, [
			{ type: "leave", to: { kind: "app", app: "explorer" } },
		])
	})

	it("shows the member's Wishlist in the Watch now glimpse, only Full page for guests", () => {
		assert.deepEqual(tvItems({ name: "app", app: "watch-now" }, member), [
			"title:movie-9",
			"full-page",
		])
		assert.deepEqual(tvItems({ name: "app", app: "watch-now" }, guest), [
			"full-page",
		])
	})

	it("opens the keyboard (push), then shows and refines the results in place (replace)", () => {
		const first = run(
			at(""),
			guest,
			{ type: "open-search" },
			{ type: "submit-search", query: " heist " },
		)
		assert.equal(first.history, "replace")
		assert.equal(first.state.depth, 1)
		assert.equal(first.url, "tv=search&q=heist")
		const again = run(first.state, guest, {
			type: "submit-search",
			query: "space",
		})
		assert.equal(again.history, "replace")
		assert.equal(again.url, "tv=search&q=space")
	})

	it("ignores queries shorter than two characters", () => {
		assert.equal(
			run(at("tv=search"), guest, { type: "submit-search", query: "a" })
				.history,
			"none",
		)
	})

	it("Back closes the open menu before anything else", () => {
		const t = run(
			at("tv=about", 1),
			guest,
			{ type: "toggle-menu" },
			{ type: "back" },
		)
		assert.equal(t.state.menuOpen, false)
		assert.equal(t.history, "none")
		assert.equal(t.url, "tv=about")
	})
})

describe("focus", () => {
	it("moves with the D-pad, wraps, and replaces history", () => {
		const t = run(at(""), guest, { type: "step", by: -1 })
		assert.equal(t.history, "replace")
		assert.equal(t.url, "focus=about")
	})

	it("resets on a new screen", () => {
		assert.equal(run(at("focus=about"), guest, { type: "ok" }).url, "tv=about")
	})

	it("falls back to the first item when the focused item is gone", () => {
		assert.equal(
			run(at("focus=title%3Agone"), guest, { type: "ok" }).url,
			"tv=services",
		)
	})
})

describe("Back, Home, and deep links", () => {
	it("pops history for screens this visit pushed", () => {
		assert.equal(
			run(at("tv=about", 1), guest, { type: "back" }).history,
			"back",
		)
	})

	it("replaces a deep-linked screen with home", () => {
		const t = run(at("tv=title&title=m"), guest, { type: "back" })
		assert.equal(t.history, "replace")
		assert.equal(t.url, "")
	})

	it("does nothing on home", () => {
		assert.equal(run(at(""), guest, { type: "back" }).history, "none")
	})

	it("Home pushes home and starts a new depth", () => {
		const t = run(at("tv=title&title=m", 4), guest, { type: "home" })
		assert.equal(t.history, "push")
		assert.equal(t.url, "")
		assert.equal(t.state.depth, 0)
	})
})

describe("remote streaming keys", () => {
	it("toggle services on the services screen", () => {
		assert.deepEqual(
			run(at("tv=services"), guest, { type: "service-key", service: "Netflix" })
				.effects,
			[{ type: "toggle-service", service: "Netflix" }],
		)
	})

	it("narrow tonight's picks to one service, and pressing again widens them", () => {
		const t = run(at(""), guest, { type: "service-key", service: "Netflix" })
		assert.equal(t.history, "push")
		assert.equal(t.url, "tv=picks&service=Netflix")
		assert.equal(
			run(t.state, guest, { type: "service-key", service: "Netflix" }).url,
			"tv=picks",
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
		)
		assert.equal(booting.state.power, "booting")
		assert.equal(booting.url, "tv=about")
		const on = run(booting.state, guest, { type: "boot-done" })
		assert.equal(on.state.power, "on")
		assert.equal(on.url, "")
	})
})

describe("loader revalidation", () => {
	it("treats changes to TV params alone as TV-only", () => {
		assert.equal(
			isTvOnlyChange(
				new URL("https://x/?tv=about"),
				new URL("https://x/?tv=picks&focus=moods"),
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
