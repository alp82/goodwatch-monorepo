import assert from "node:assert/strict"
import { test } from "node:test"
import "../title-filter/test-alias.ts"
import type {
	ForYouPool,
	ForYouTaste,
} from "../../domain/for-you-page/contract.ts"
import type { ViewerContext } from "../viewer.server.ts"

const { loadForYouPage, loadForYouGuest } = await import("./page.server.ts")
const request = new Request("http://localhost/for-you")
const pool: ForYouPool = {
	keys: ["movie-1"],
	names: ["One"],
	years: [2000],
	posters: ["/one.jpg"],
	scores: [80],
	steps: [80],
	moods: [0],
	themes: [0],
	styles: [0],
	fingerprints: "5".repeat(74),
	scope: "everywhere",
}
const taste: ForYouTaste = {
	subject: "member",
	attributes: [],
	groups: [],
	loved: {},
}
const ctx: ViewerContext = {
	viewer: { kind: "member", userId: "test" },
	country: "DE",
	services: [],
	seen: new Set(),
	hidden: new Set(),
	notInterested: new Set(),
	skipped: new Set(),
	wishlist: new Map(),
	ratings: new Map([[1e12 + 2, 9]]),
	forYou: true,
}
const noTaste = {
	signal: "none" as const,
	ratings: 0,
	liked: 0,
	vector: null,
	match: (keys: number[]) => keys.map(() => null),
	percentile: (keys: number[]) => keys.map(() => null),
	reasons: () => [],
	leanings: () => [],
}
function dependencies() {
	return {
		viewer: async () => ({ viewer: ctx.viewer, context: async () => ctx }),
		loadTaste: async () => noTaste,
		hasSnapshot: async () => true,
		taste: async (): Promise<ForYouTaste | null> => taste,
		pool: async () => pool,
	}
}

test("guest page returns only its shell without reading context or stores", async () => {
	const deps = dependencies()
	deps.viewer = async () => ({
		viewer: { kind: "guest", progress: { interactions: [] } },
		context: async () => {
			throw Error("must not read")
		},
	})
	deps.hasSnapshot = async () => {
		throw Error("must not read")
	}
	assert.deepEqual(await loadForYouPage(request, deps), { kind: "guest" })
})
test("member page returns the exact domain payload", async () => {
	assert.deepEqual(await loadForYouPage(request, dependencies()), {
		kind: "member",
		status: "ready",
		pool,
		taste,
	})
})
test("missing snapshot, empty taste and failed pool degrade gracefully", async () => {
	const deps = dependencies()
	deps.hasSnapshot = async () => false
	assert.deepEqual(await loadForYouPage(request, deps), {
		kind: "member",
		status: "unavailable",
	})
	deps.hasSnapshot = async () => true
	deps.taste = async () => null
	assert.deepEqual(await loadForYouPage(request, deps), {
		kind: "member",
		status: "empty",
	})
	deps.taste = async () => taste
	deps.pool = async () => {
		throw Error("stub store unavailable")
	}
	assert.deepEqual(await loadForYouPage(request, deps), {
		kind: "member",
		status: "unavailable",
	})
})
test("preview returns compact data and rating count, or a safe unavailable preview", async () => {
	const deps = dependencies()
	assert.deepEqual(await loadForYouGuest(request, undefined, deps), {
		taste,
		posters: ["/one.jpg"],
		guestRatings: 1,
	})
	deps.hasSnapshot = async () => false
	assert.deepEqual(await loadForYouGuest(request, undefined, deps), {
		taste: null,
		posters: [],
		guestRatings: 1,
	})
})
