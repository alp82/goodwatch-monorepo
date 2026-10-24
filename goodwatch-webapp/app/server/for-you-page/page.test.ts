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
		snapshotVersion: async (): Promise<string | null> => "test",
		taste: async (): Promise<ForYouTaste | null> => taste,
		pool: async () => pool,
		preview: async () => pool.posters,
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
	deps.snapshotVersion = async () => {
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
	deps.snapshotVersion = async () => null
	assert.deepEqual(await loadForYouPage(request, deps), {
		kind: "member",
		status: "unavailable",
	})
	deps.snapshotVersion = async () => "test"
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
	deps.snapshotVersion = async () => null
	assert.deepEqual(await loadForYouGuest(request, undefined, deps), {
		taste: null,
		posters: [],
		guestRatings: 1,
	})
})

test("preview memo shares builds, respects progress/version, expires and stays bounded", async () => {
	const deps = dependencies()
	const guestCtx: ViewerContext = {
		...ctx,
		viewer: { kind: "guest", progress: { interactions: [] } },
		ratings: new Map(),
	}
	deps.viewer = async () => ({
		viewer: guestCtx.viewer,
		context: async () => guestCtx,
	})
	let version = "memo-test"
	deps.snapshotVersion = async () => version
	let builds = 0
	deps.preview = async () => {
		builds++
		return ["/preview.jpg"]
	}
	deps.pool = async () => {
		throw Error("preview must not build the member pool")
	}
	let now = Date.now()
	const realNow = Date.now
	Date.now = () => now
	try {
		const load = () => loadForYouGuest(request, undefined, deps)
		const [a, b] = await Promise.all([load(), load()])
		assert.deepEqual(a, b)
		assert.equal(builds, 1)
		now += 10 * 60_000 - 1
		await load()
		assert.equal(builds, 1)
		now++
		await load()
		assert.equal(builds, 2)
		guestCtx.hidden = new Set([1e12 + 7])
		await load()
		assert.equal(builds, 3)
		guestCtx.country = "FR"
		await load()
		assert.equal(builds, 4)
		guestCtx.ratings = new Map([[1e12 + 8, 9]])
		assert.equal((await load()).guestRatings, 1)
		assert.equal(builds, 5)
		for (let i = 0; i < 129; i++) {
			version = `memo-bound-${i}`
			await load()
		}
		const before = builds
		version = "memo-bound-0"
		await load()
		assert.equal(builds, before + 1, "oldest entry is evicted at the bound")
		version = "memo-retry"
		deps.preview = async () => {
			throw Error("temporary failure")
		}
		assert.deepEqual((await load()).posters, [])
		deps.preview = async () => ["/retry.jpg"]
		assert.deepEqual((await load()).posters, ["/retry.jpg"])
	} finally {
		Date.now = realNow
	}
})
