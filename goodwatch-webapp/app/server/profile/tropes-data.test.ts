import assert from "node:assert/strict"
import { test } from "node:test"
import { DEFAULT_VISIBILITY } from "../../domain/profile.ts"
import type { UserData } from "../../types/user-data.ts"
import { type CatalogRead, createTropesLoader } from "./tropes-data.ts"
import type { TropePool } from "./tropes-model.ts"
const empty = (): UserData => ({
	scores: {},
	watchState: {},
	wishlist: {},
	favorites: {},
	skipped: {},
	notInterested: {},
})
function fixture(count = 6, dense = false) {
	const owner = empty()
	const viewer = empty()
	for (let i = 1; i <= count; i++)
		owner.scores[`${i % 2 ? "movie" : "show"}-${i}`] = {
			score: i % 2 ? 9 : 6,
			review: null,
			updatedAt: new Date(i * 1000),
		}
	viewer.scores["movie-1"] = owner.scores["movie-1"]
	viewer.watchState["show-2"] = {
		state: "seen",
		watchedAt: null,
		precision: "unknown",
		count: 1,
		pass: 1,
		episodesWatched: 1,
		furthest: [1, 1],
		lastActivityAt: null,
	}
	viewer.watchState["show-4"] = {
		...viewer.watchState["show-2"],
		state: "watching",
	}
	const calls: { sql: string; params: (string | number | Date)[] }[] = []
	const users: string[] = []
	let cached: TropePool | null = null
	let writes = 0
	const read: CatalogRead = async <T extends {}>(
		sql: string,
		params: (string | number | Date)[],
	) => {
		calls.push({ sql, params })
		const ids = params.filter((p): p is number => typeof p === "number")
		const rows = ids.flatMap<unknown>((id) =>
			sql.includes("SELECT media_tmdb_id, content")
				? {
						media_tmdb_id: id,
						content: `<span class="spoiler">Secret ${id} &amp; more.</span>`,
					}
				: sql.includes("AS length")
					? params
							.filter(
								(p): p is string =>
									typeof p === "string" && p !== "movie" && p !== "show",
							)
							.map((name) => ({
								media_tmdb_id: id,
								name,
								url: "https://tvtropes.org/common",
								length: 1000,
							}))
					: {
							tmdb_id: id,
							title: `Title ${id}`,
							release_year: id === 1 ? 1990 : null,
							poster_path: "/p.jpg",
							backdrop_path: "/b.jpg",
							gw: 71.5,
							genres: ["Sci-Fi & Fantasy"],
							tropes: dense
								? Array.from({ length: 190 }, (_, i) => `Trope ${i}`)
								: id === count
									? []
									: ["Common", "Common", `Rare ${id}`],
						},
		)
		return rows as unknown as T[]
	}
	const loader = createTropesLoader({
		read,
		userData: async (id) => {
			users.push(id)
			return id === "owner" ? owner : viewer
		},
		readCache: async () => cached,
		writeCache: async (_, pool) => {
			cached = pool
			writes++
		},
		titlePath: (kind, id) => `/${kind}/${id}`,
		descriptions: {
			Common: {
				text: "Unchanged description.",
				url: "https://tvtropes.org/common",
			},
		},
	})
	const shell = {
		viewer: "guest" as const,
		visibility: { ...DEFAULT_VISIBILITY },
	}
	return {
		...loader,
		shell,
		calls,
		users,
		viewer,
		get writes() {
			return writes
		},
		get cached() {
			return cached
		},
	}
}
test("pool retains baseline titles, aligns indexes, deduplicates tropes, coalesces reads and isolates viewer state", async () => {
	const f = fixture()
	const [a, b] = await Promise.all([
		f.loadProfileTropes("owner", f.shell),
		f.loadProfileTropes("owner", f.shell),
	])
	assert.deepEqual(a, b)
	assert.equal(f.writes, 1)
	assert.equal(f.users.filter((id) => id === "owner").length, 1)
	assert.equal(a?.pool.length, 6)
	assert.deepEqual(a?.tropes, ["Common"])
	assert.deepEqual(a?.years, [1990, 1990])
	assert.deepEqual(a?.seen, [])
	assert.equal(a?.titles["movie-1"].backdrop, "/b.jpg")
	assert.equal(a?.pool.find((t) => t.k === "show-6")?.r.length, 0)
	for (const t of a?.pool ?? []) assert.equal(t.r.length, t.d.length)
	assert.ok(a)
	assert.ok(a.pool[0].d[0] > 0)
	assert.equal(f.calls.length, 4)
	const cached = f.cached
	assert.ok(cached)
	assert.equal("seen" in cached, false)
	assert.equal(
		(
			await f.loadProfileTropes(
				"owner",
				{ ...f.shell, viewer: "owner" },
				"owner",
			)
		)?.seen.length,
		6,
	)
	assert.deepEqual(
		(
			await f.loadProfileTropes(
				"owner",
				{ ...f.shell, viewer: "member" },
				"viewer",
			)
		)?.seen,
		["movie-1", "show-2"],
	)
	assert.equal(f.calls.length, 4)
})
test("hidden parts perform no reads", async () => {
	const f = fixture()
	const shell = {
		viewer: "guest" as const,
		visibility: { ...DEFAULT_VISIBILITY, scores: "me" as const },
	}
	assert.equal(await f.loadProfileTropes("owner", shell), null)
	assert.deepEqual(
		await f.loadProfileTropeExcerpts("owner", shell, "Common", ["movie-1"]),
		[],
	)
	assert.equal(f.calls.length, 0)
	assert.equal(f.users.length, 0)
})
test("excerpts restrict keys to this profile and trope but permit guest reveals", async () => {
	const f = fixture()
	assert.deepEqual(
		await f.loadProfileTropeExcerpts("owner", f.shell, "Common", [
			"show-2",
			"movie-999",
			"show-6",
			"movie-1",
			"movie-1",
		]),
		[
			{ key: "show-2", text: "Secret 2 & more." },
			{ key: "movie-1", text: "Secret 1 & more." },
		],
	)
	const calls = f.calls.length
	assert.deepEqual(
		await f.loadProfileTropeExcerpts("owner", f.shell, "Unknown", ["movie-1"]),
		[],
	)
	assert.equal(f.calls.length, calls)
	await assert.rejects(
		f.loadProfileTropeExcerpts(
			"owner",
			f.shell,
			"Common",
			Array(17).fill("movie-1"),
		),
		RangeError,
	)
})
test("800 titles batch reads and fetch only lengths", async () => {
	const f = fixture(800, true)
	const pool = await f.loadProfileTropes("owner", f.shell)
	assert.equal(pool?.pool.length, 800)
	assert.equal(pool?.tropes.length, 190)
	assert.ok(pool?.pool.every((t) => t.r.length === 190 && t.d.length === 190))
	assert.equal(f.calls.length, 4)
	assert.ok(
		f.calls.every((c) => !c.sql.includes("SELECT media_tmdb_id, content")),
	)
	assert.ok(
		f.calls
			.filter((c) => c.sql.includes("AS length"))
			.every((c) => c.params.length === 591),
	)
})
test("empty libraries have finite bounds and no catalog reads", async () => {
	const f = fixture(0)
	const pool = await f.loadProfileTropes("owner", f.shell)
	assert.deepEqual(pool?.years, [0, 0])
	assert.deepEqual(pool?.pool, [])
	assert.equal(f.calls.length, 0)
})
