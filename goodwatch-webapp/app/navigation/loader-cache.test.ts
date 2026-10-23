import assert from "node:assert/strict"
import { test } from "node:test"
import {
	FORWARD_MAX_AGE_MS,
	HISTORY_MAX_AGE_MS,
	INCOMPLETE_DATA_HEADER,
	type Loaded,
	LoaderCache,
	type RootWatchState,
	cacheKey,
	identityOf,
	invalidation,
	isWriteRequest,
	memberKey,
	memberOf,
	navigationKind,
	readLoaderResponse,
	releaseOnFreshRoot,
} from "./loader-cache.ts"

const ORIGIN = "https://goodwatch.test"
const url = (path: string) => new URL(path, ORIGIN)
const ROUTE = "routes/movie.$movieKey"
const VISITOR =
	identityOf({ user: null, locale: { country: "DE", language: "de" } }) ?? ""
const key = (path: string, identity = VISITOR) =>
	cacheKey(identity, ROUTE, url(path))

function clock(start = 1_000_000) {
	let now = start
	return {
		now: () => now,
		advance: (ms: number) => {
			now += ms
		},
	}
}

const loaded = (data: unknown, store = true): Loaded => ({
	ok: true,
	data,
	store,
})

test("the key holds the identity, the route, and the URL without _data", () => {
	assert.equal(
		cacheKey(
			"visitor|DE|de",
			ROUTE,
			url("/movie/1-a?country=US&_data=routes%2Fmovie.%24movieKey"),
		),
		cacheKey("visitor|DE|de", ROUTE, url("/movie/1-a?country=US")),
	)
	assert.notEqual(key("/movie/1-a"), key("/movie/1-a?country=US"))
	assert.notEqual(
		cacheKey("visitor|DE|de", ROUTE, url("/movie/1-a")),
		cacheKey("visitor|DE|de", "routes/show.$showKey", url("/movie/1-a")),
	)
})

test("the identity tells members, visitors, countries, and languages apart", () => {
	const member = identityOf({
		user: { id: "u1" },
		locale: { country: "DE", language: "de" },
	})
	const english = identityOf({
		user: null,
		locale: { country: "DE", language: "en" },
	})
	const us = identityOf({
		user: null,
		locale: { country: "US", language: "de" },
	})
	assert.equal(new Set([VISITOR, member, english, us]).size, 4)
	assert.equal(identityOf(undefined), null)
	assert.equal(identityOf({ user: null }), null)
})

test("a forward navigation takes an entry up to a minute old, and loads again after that", () => {
	const time = clock()
	const cache = new LoaderCache(time.now)
	cache.set(key("/movie/1-a"), { id: 1 }, "hover")
	time.advance(FORWARD_MAX_AGE_MS)
	assert.deepEqual(cache.lookup(key("/movie/1-a"), "forward"), {
		kind: "hit",
		data: { id: 1 },
		source: "hover",
		refresh: false,
	})
	time.advance(1)
	assert.equal(cache.lookup(key("/movie/1-a"), "forward").kind, "miss")
})

test("a history navigation takes an entry up to ten minutes old, and asks for a refresh past a minute", () => {
	const time = clock()
	const cache = new LoaderCache(time.now)
	cache.set(key("/movie/1-a"), { id: 1 }, "navigation")
	const first = cache.lookup(key("/movie/1-a"), "history")
	assert.equal(first.kind === "hit" && first.refresh, false)
	time.advance(FORWARD_MAX_AGE_MS + 1)
	const later = cache.lookup(key("/movie/1-a"), "history")
	assert.equal(later.kind === "hit" && later.refresh, true)
	time.advance(HISTORY_MAX_AGE_MS)
	assert.equal(cache.lookup(key("/movie/1-a"), "history").kind, "miss")
})

test("a revalidation never reads the cache, and its answer is stored", async () => {
	const cache = new LoaderCache()
	cache.set(key("/movie/1-a"), { old: true }, "navigation")
	assert.equal(cache.lookup(key("/movie/1-a"), "revalidation").kind, "miss")
	await cache.load(key("/movie/1-a"), "navigation", async () =>
		loaded({ old: false }),
	)
	const found = cache.lookup(key("/movie/1-a"), "forward")
	assert.deepEqual(found.kind === "hit" && found.data, { old: false })
})

test("a navigation joins a prefetch that is still loading", async () => {
	const cache = new LoaderCache()
	let finish: (value: Loaded) => void = () => {}
	cache.load(
		key("/movie/1-a"),
		"press",
		() =>
			new Promise((resolve) => {
				finish = resolve
			}),
	)
	const found = cache.lookup(key("/movie/1-a"), "forward")
	assert.equal(found.kind, "pending")
	assert.equal(found.kind === "pending" && found.source, "press")
	assert.equal(cache.covered(key("/movie/1-a")), true)
	finish(loaded({ id: 1 }))
	assert.deepEqual(
		found.kind === "pending" && (await found.promise),
		loaded({ id: 1 }),
	)
	assert.equal(cache.lookup(key("/movie/1-a"), "forward").kind, "hit")
	assert.equal(
		await cache.settled(key("/movie/1-a")).then((data) => JSON.stringify(data)),
		'{"id":1}',
	)
})

test("a failed load leaves nothing behind", async () => {
	const cache = new LoaderCache()
	await assert.rejects(
		cache.load(key("/movie/1-a"), "hover", async () => {
			throw new TypeError("Failed to fetch")
		}),
	)
	assert.equal(cache.lookup(key("/movie/1-a"), "forward").kind, "miss")
	assert.equal(cache.covered(key("/movie/1-a")), false)
})

test("incomplete data a navigation loads goes to it but not into the cache", async () => {
	const cache = new LoaderCache()
	const answer = await cache.load(key("/movie/1-a"), "navigation", async () =>
		loaded({ partial: true }, false),
	)
	assert.deepEqual(answer, loaded({ partial: true }, false))
	assert.equal(cache.lookup(key("/movie/1-a"), "forward").kind, "miss")
	await cache.load(key("/movie/1-a"), "refresh", async () =>
		loaded({ partial: true }, false),
	)
	assert.equal(cache.lookup(key("/movie/1-a"), "forward").kind, "miss")
})

test("incomplete data a prefetch loads serves the one forward navigation, never Back or Forward", async () => {
	const cache = new LoaderCache()
	await cache.load(key("/movie/1-a"), "hover", async () =>
		loaded({ partial: true }, false),
	)
	assert.equal(cache.covered(key("/movie/1-a")), true)
	assert.equal(cache.lookup(key("/movie/1-a"), "history").kind, "miss")
	assert.equal(cache.lookup(key("/movie/1-a"), "forward").kind, "hit")
	assert.equal(cache.lookup(key("/movie/1-a"), "forward").kind, "miss")
	assert.equal(cache.size, 0)
})

test("clear drops entries and loads under way; a load from before doesn't store its answer", async () => {
	const cache = new LoaderCache()
	cache.set(key("/movie/1-a"), { id: 1 }, "seed")
	let finish: (value: Loaded) => void = () => {}
	const running = cache.load(
		key("/movie/2-b"),
		"hover",
		() =>
			new Promise((resolve) => {
				finish = resolve
			}),
	)
	cache.clear()
	assert.equal(cache.lookup(key("/movie/1-a"), "history").kind, "miss")
	assert.equal(cache.lookup(key("/movie/2-b"), "forward").kind, "miss")
	finish(loaded({ id: 2 }))
	await running
	assert.equal(cache.lookup(key("/movie/2-b"), "forward").kind, "miss")
	assert.equal(cache.size, 0)
})

test("another identity's entry never matches", () => {
	const cache = new LoaderCache()
	const member =
		identityOf({
			user: { id: "u1" },
			locale: { country: "DE", language: "de" },
		}) ?? ""
	cache.set(key("/movie/1-a", member), { sides: "member" }, "navigation")
	assert.equal(cache.lookup(key("/movie/1-a"), "forward").kind, "miss")
})

test("the cache keeps the most recently used entries", () => {
	const cache = new LoaderCache(Date.now, 3)
	cache.set(key("/movie/1"), 1, "hover")
	cache.set(key("/movie/2"), 2, "hover")
	cache.set(key("/movie/3"), 3, "hover")
	cache.lookup(key("/movie/1"), "forward")
	cache.set(key("/movie/4"), 4, "hover")
	assert.equal(cache.size, 3)
	assert.equal(cache.lookup(key("/movie/2"), "forward").kind, "miss")
	assert.equal(cache.lookup(key("/movie/1"), "forward").kind, "hit")
	assert.equal(cache.lookup(key("/movie/4"), "forward").kind, "hit")
})

function response(
	status: number,
	headers: Record<string, string>,
	body: unknown = { ok: 1 },
) {
	return {
		status,
		headers: new Headers(headers),
		json: async () => body,
	}
}
const JSON_OK = {
	"Content-Type": "application/json; charset=utf-8",
	"X-Remix-Response": "yes",
}

test("plain 200 JSON from Remix is used and kept", async () => {
	assert.deepEqual(
		await readLoaderResponse(response(200, JSON_OK)),
		loaded({ ok: 1 }),
	)
})

test("an incomplete page is used but not kept", async () => {
	assert.deepEqual(
		await readLoaderResponse(
			response(200, { ...JSON_OK, [INCOMPLETE_DATA_HEADER]: "1" }),
		),
		loaded({ ok: 1 }, false),
	)
})

test("redirects, errors, thrown responses, deferred data, and foreign answers are refused", async () => {
	const refused = [
		response(204, {
			...JSON_OK,
			"X-Remix-Redirect": "/movie/1-a",
			"X-Remix-Status": "301",
		}),
		response(500, { ...JSON_OK, "X-Remix-Error": "yes" }),
		response(404, { ...JSON_OK, "X-Remix-Catch": "yes" }),
		response(200, {
			"Content-Type": "text/remix-deferred",
			"X-Remix-Response": "yes",
		}),
		response(200, { "Content-Type": "text/html" }),
		response(200, { "Content-Type": "application/json" }),
		response(502, {
			"Content-Type": "application/json",
			"X-Remix-Response": "yes",
		}),
	]
	for (const answer of refused)
		assert.deepEqual(await readLoaderResponse(answer), { ok: false })
	const broken = {
		...response(200, JSON_OK),
		json: async () => JSON.parse("{"),
	}
	assert.deepEqual(await readLoaderResponse(broken), { ok: false })
})

const loading = (
	path: string,
	search: string,
	key: string,
	formMethod?: string,
) => ({
	navigation: {
		state: "loading",
		formMethod,
		location: { pathname: path, search, key },
	},
})

test("a loader call is forward, history, or a revalidation by the router's state", () => {
	const target = url("/movie/1-a?country=US&_data=routes%2Fmovie.%24movieKey")
	assert.equal(
		navigationKind(
			loading("/movie/1-a", "?country=US", "new1"),
			target,
			"old0",
		),
		"forward",
	)
	assert.equal(
		navigationKind(loading("/movie/1-a", "?country=US", "k7"), target, "k7"),
		"history",
	)
	// The first entry of a session has no key in history.state.
	assert.equal(
		navigationKind(
			loading("/movie/1-a", "?country=US", "default"),
			target,
			undefined,
		),
		"history",
	)
	assert.equal(
		navigationKind({ navigation: { state: "idle" } }, target, "k7"),
		"revalidation",
	)
	assert.equal(
		navigationKind(
			loading("/movie/1-a", "?country=US", "n", "POST"),
			target,
			"o",
		),
		"revalidation",
	)
	assert.equal(
		navigationKind(loading("/movie/2-b", "?country=US", "n"), target, "o"),
		"revalidation",
	)
	assert.equal(
		navigationKind(loading("/movie/1-a", "", "n"), target, "o"),
		"revalidation",
	)
	assert.equal(navigationKind(undefined, target, "o"), "revalidation")
})

const snapshot = (
	root: unknown,
	formMethod?: string,
	fetchers: [string, { state: string; formMethod?: string }][] = [],
) => ({
	loaderData: { root },
	navigation: { formMethod },
	fetchers: new Map(fetchers),
})
const ROOT = { user: null, locale: { country: "DE", language: "de" } }

test("a new identity clears the cache: sign-in, sign-out, country, language", () => {
	assert.deepEqual(invalidation(VISITOR, snapshot(ROOT)), {
		identity: VISITOR,
		clear: false,
	})
	for (const root of [
		{ user: { id: "u1" }, locale: ROOT.locale },
		{ ...ROOT, locale: { country: "US", language: "de" } },
		{ ...ROOT, locale: { country: "DE", language: "en" } },
		undefined,
	]) {
		const next = invalidation(VISITOR, snapshot(root))
		assert.equal(next.clear, true)
		assert.equal(next.identity, identityOf(root))
	}
})

test("a submission that isn't a GET clears the cache, a GET form doesn't", () => {
	assert.equal(invalidation(VISITOR, snapshot(ROOT, "POST")).clear, true)
	assert.equal(invalidation(VISITOR, snapshot(ROOT, "get")).clear, false)
	assert.equal(
		invalidation(
			VISITOR,
			snapshot(ROOT, undefined, [
				["f", { state: "submitting", formMethod: "DELETE" }],
			]),
		).clear,
		true,
	)
	assert.equal(
		invalidation(
			VISITOR,
			snapshot(ROOT, undefined, [["f", { state: "idle", formMethod: "POST" }]]),
		).clear,
		false,
	)
	assert.equal(
		invalidation(
			VISITOR,
			snapshot(ROOT, undefined, [["f", { state: "loading" }]]),
		).clear,
		false,
	)
})

test("member writes clear the cache, reads over POST and other sites don't", () => {
	for (const path of [
		"/api/update-scores",
		"/api/update-wishlist",
		"/api/update-scores-batch",
		"/api/imports/abc/confirm",
		"/api/imdb-import/abc/undo",
		"/api/user-settings/set",
		"/api/media-preferences",
		"/api/tracking/show",
		"/api/watch-log",
		"/api/watch-next/watched",
		"/api/auth/sign-out",
	])
		assert.equal(isWriteRequest("POST", url(path), ORIGIN), true, path)
	assert.equal(isWriteRequest("GET", url("/api/update-scores"), ORIGIN), false)
	assert.equal(
		isWriteRequest("POST", url("/api/discover/results"), ORIGIN),
		false,
	)
	assert.equal(
		isWriteRequest("POST", url("/api/poster-impressions"), ORIGIN),
		false,
	)
	assert.equal(
		isWriteRequest(
			"POST",
			new URL("https://elsewhere.test/api/update-scores"),
			ORIGIN,
		),
		false,
	)
})

test("a load the cache was cleared under is obsolete: nobody gets its answer", async () => {
	const cache = new LoaderCache()
	let finish: (value: Loaded) => void = () => {}
	const running = cache.load(
		key("/movie/1-a"),
		"press",
		() =>
			new Promise((resolve) => {
				finish = resolve
			}),
	)
	cache.clear()
	finish(loaded({ beforeWrite: true }))
	assert.deepEqual(await running, { ok: false, obsolete: true })
})

test("a navigation waiting for a prefetch that a clear made obsolete loads again with the identity now", async () => {
	const cache = new LoaderCache()
	const member =
		identityOf({
			user: { id: "u2" },
			locale: { country: "DE", language: "de" },
		}) ?? ""
	let identity = VISITOR
	let finish: (value: Loaded) => void = () => {}
	cache.load(
		key("/movie/1-a"),
		"press",
		() =>
			new Promise((resolve) => {
				finish = resolve
			}),
	)
	const answering = cache.answer(
		"forward",
		() => key("/movie/1-a", identity),
		async () => loaded({ who: identity }),
	)
	await Promise.resolve()
	identity = member
	cache.clear()
	finish(loaded({ who: VISITOR }))
	const answer = await answering
	assert.deepEqual(answer, { data: { who: member }, source: "navigation" })
	assert.equal(cache.lookup(key("/movie/1-a", member), "forward").kind, "hit")
})

test("only the newest load of a key stores its answer", async () => {
	const cache = new LoaderCache()
	let finishRefresh: (value: Loaded) => void = () => {}
	const refresh = cache.load(
		key("/movie/1-a"),
		"refresh",
		() =>
			new Promise((resolve) => {
				finishRefresh = resolve
			}),
	)
	await cache.load(key("/movie/1-a"), "navigation", async () =>
		loaded({ version: "new" }),
	)
	finishRefresh(loaded({ version: "old" }))
	await refresh
	const found = cache.lookup(key("/movie/1-a"), "forward")
	assert.deepEqual(found.kind === "hit" && found.data, { version: "new" })
})

test("a forward navigation that joined an incomplete prefetch uses it up; Back never joins it", async () => {
	const cache = new LoaderCache()
	let finish: (value: Loaded) => void = () => {}
	cache.load(
		key("/movie/1-a"),
		"hover",
		() =>
			new Promise((resolve) => {
				finish = resolve
			}),
	)
	const forward = cache.answer(
		"forward",
		() => key("/movie/1-a"),
		async () => loaded({ own: true }),
	)
	finish(loaded({ partial: true }, false))
	assert.deepEqual(await forward, { data: { partial: true }, source: "hover" })
	assert.equal(cache.lookup(key("/movie/1-a"), "forward").kind, "miss")

	cache.load(
		key("/movie/2-b"),
		"hover",
		() =>
			new Promise((resolve) => {
				finish = resolve
			}),
	)
	const back = cache.answer(
		"history",
		() => key("/movie/2-b"),
		async () => loaded({ own: true }),
	)
	finish(loaded({ partial: true }, false))
	assert.deepEqual(await back, { data: { own: true }, source: "navigation" })
})

test("the first page's data serves Back for a minute only", () => {
	const time = clock()
	const cache = new LoaderCache(time.now)
	cache.set(key("/movie/1-a"), { id: 1 }, "seed")
	time.advance(FORWARD_MAX_AGE_MS)
	assert.equal(cache.lookup(key("/movie/1-a"), "history").kind, "hit")
	time.advance(1)
	assert.equal(cache.lookup(key("/movie/1-a"), "history").kind, "miss")
})

test("while held, the cache answers nothing and keeps nothing; releasing clears it", async () => {
	const cache = new LoaderCache()
	cache.set(key("/movie/1-a"), { who: "before" }, "navigation")
	const release = cache.hold()
	assert.equal(cache.held, true)
	assert.equal(cache.lookup(key("/movie/1-a"), "history").kind, "miss")
	assert.equal(
		await cache.answer(
			"forward",
			() => key("/movie/1-a"),
			async () => loaded({ who: "during" }),
		),
		null,
	)
	const during = cache.load(key("/movie/2-b"), "hover", async () =>
		loaded({ who: "during" }),
	)
	release()
	await during
	assert.equal(cache.held, false)
	assert.equal(cache.size, 0)
	release()
	assert.equal(cache.held, false)
})

test("a revalidation that starts while a navigation waits never reads the cache", () => {
	const target = url("/movie/1-a")
	assert.equal(
		navigationKind(
			{ ...loading("/movie/1-a", "", "n"), revalidation: "loading" },
			target,
			"o",
		),
		"revalidation",
	)
	assert.equal(
		navigationKind(
			{ ...loading("/movie/1-a", "", "n"), revalidation: "idle" },
			target,
			"o",
		),
		"forward",
	)
})

test("any POST to the site's /api/ clears the cache, except the known reads", () => {
	for (const path of [
		"/api/something-new",
		"/api/new-episodes",
		"/api/social/wrong-title",
	])
		assert.equal(isWriteRequest("POST", url(path), ORIGIN), true, path)
	for (const path of [
		"/api/e",
		"/api/combined-search",
		"/api/explorer/map",
		"/api/title-cards",
		"/api/watch-next",
		"/api/watch-next/cards",
		"/api/taste/match",
		"/api/tonight",
		"/api/watchability",
	])
		assert.equal(isWriteRequest("POST", url(path), ORIGIN), false, path)
	assert.equal(isWriteRequest("POST", url("/movie/1-a"), ORIGIN), false)
})

function fakeRouter(root: unknown) {
	const listeners = new Set<(state: RootWatchState) => void>()
	const router = {
		state: {
			loaderData: { root },
			errors: null,
			navigation: { state: "idle" },
			revalidation: "idle",
		} as RootWatchState,
		subscribe(listener: (state: RootWatchState) => void) {
			listeners.add(listener)
			return () => listeners.delete(listener)
		},
		set(patch: Partial<RootWatchState>) {
			router.state = { ...router.state, ...patch }
			for (const listener of [...listeners]) listener(router.state)
		},
	}
	return router
}

test("the hold ends with a fresh root, not with an idle router", () => {
	const router = fakeRouter({ user: { id: "a" } })
	let released = 0
	let kept = false
	let reruns = 0
	releaseOnFreshRoot(router, () => released++, {
		kept: () => kept,
		rerunRoot: () => reruns++,
	})
	// The root's request failed twice: the retry wrapper answers with A's data again.
	router.set({ revalidation: "loading" })
	kept = true
	router.set({
		revalidation: "idle",
		loaderData: { root: { user: { id: "a" } } },
	})
	assert.equal(released, 0)
	assert.equal(reruns, 1)
	// A navigation that doesn't rerun the root.
	router.set({ navigation: { state: "loading" } })
	router.set({ navigation: { state: "idle" } })
	assert.equal(released, 0)
	// A root that threw.
	router.set({ errors: { root: new Error("down") } })
	assert.equal(released, 0)
	assert.equal(reruns, 2)
	// The next navigation reruns the root, and the server answers.
	kept = false
	router.set({ navigation: { state: "loading" }, errors: null })
	router.set({
		navigation: { state: "idle" },
		loaderData: { root: { user: { id: "b" } } },
	})
	assert.equal(released, 1)
	router.set({ loaderData: { root: { user: null } } })
	assert.equal(released, 1)
})

test("the hold waits while the router is busy", () => {
	const router = fakeRouter({ user: null })
	let released = 0
	releaseOnFreshRoot(router, () => released++, {
		kept: () => false,
		rerunRoot: () => {},
	})
	router.set({
		revalidation: "loading",
		loaderData: { root: { user: { id: "b" } } },
	})
	assert.equal(released, 0)
	router.set({ revalidation: "idle" })
	assert.equal(released, 1)
})

test("the member part of the identity matches the auth provider's", () => {
	const root = { user: { id: "u1" }, locale: { country: "DE", language: "de" } }
	assert.equal(memberOf(root), memberKey("u1"))
	assert.equal(memberOf({ user: null, locale: {} }), memberKey(null))
	assert.equal(memberOf(undefined), null)
})
