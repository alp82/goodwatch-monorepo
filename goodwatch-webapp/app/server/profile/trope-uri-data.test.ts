import assert from "node:assert/strict"
import { test } from "node:test"
import { DEFAULT_VISIBILITY } from "../../domain/profile.ts"
import type { UserData } from "../../types/user-data.ts"
import { rankTropes } from "../../ui/profile/tropes/model.ts"
import { buildUriTropePool } from "./trope-uri-pool.ts"
import { type CatalogRead, createTropesLoader } from "./tropes-data.ts"
import type { TropePool, TropeTitle } from "./tropes-model.ts"
import { tropesPreview, withPreviewDescriptions } from "./tropes-preview.ts"
const url = (slug: string) =>
	`https://tvtropes.org/pmwiki/pmwiki.php/Main/${slug}`
const user = (): UserData => ({
	scores: {},
	watchState: {},
	wishlist: {},
	favorites: {},
	skipped: {},
	notInterested: {},
})
const shell = {
	viewer: "guest" as const,
	visibility: { ...DEFAULT_VISIBILITY },
}
const titles: TropeTitle[] = Array.from({ length: 3 }, (_, i) => ({
	title: {
		key: `movie-${i + 1}`,
		mediaType: "movie",
		tmdbId: i + 1,
		title: `Title ${i}`,
		year: 2000,
		poster: null,
		backdrop: null,
		score: 9,
		gw: 70,
		href: `/movie/${i + 1}`,
		date: null,
	},
	genres: [],
	names: [],
}))
const a = url("AliasA")
const b = url("AliasB")
const target = url("Target")

test("production URI loader groups individually rare labels before qualification and never caches failed identity reads", async () => {
	const owner = user()
	for (const t of titles)
		owner.scores[t.title.key as `movie-${number}`] = {
			score: 9,
			review: null,
			updatedAt: new Date(),
		}
	let writes = 0
	let fail = false
	let cached: TropePool | null = null
	const calls: string[] = []
	const loader = createTropesLoader({
		userData: async () => owner,
		readCache: async () => (cached ? { pool: cached, fresh: true } : null),
		writeCache: async (_, pool) => {
			writes++
			cached = pool
		},
		titlePath: () => "/movie/x",
		resolveReferences: async () => {
			if (fail) throw Error("identity store down")
			return {
				[a]: { url: target, title: "Actual title" },
				[b]: { url: target, title: "Actual title" },
			}
		},
		readDescriptions: async (ids) =>
			Object.fromEntries(
				ids.map((id) => [
					id,
					{
						url: id,
						title: "Current heading",
						text: "Current general definition",
					},
				]),
			),
		read: async <T extends {}>(
			sql: string,
			params: (string | number | Date)[],
		) => {
			calls.push(sql)
			if (sql.includes("FROM show")) return []
			if (sql.includes("AS length"))
				return (params[0] === "show"
					? []
					: [
							{ media_tmdb_id: 1, name: "Rare A", url: a, length: 100 },
							{ media_tmdb_id: 2, name: "Rare A", url: a, length: 200 },
							{ media_tmdb_id: 3, name: "Rare B", url: b, length: 300 },
						]) as unknown as T[]
			return titles.map((t, i) => ({
				tmdb_id: i + 1,
				title: t.title.title,
				release_year: 2000,
				poster_path: null,
				backdrop_path: null,
				gw: 70,
				genres: [],
				tropes: [i === 2 ? "Rare B" : "Rare A"],
			})) as unknown as T[]
		},
	})
	const full = await loader.loadProfileTropes("owner", shell)
	assert.deepEqual(full?.tropes, [target])
	assert.equal(full?.names?.[target], "Current heading")
	assert.equal(writes, 1)
	await loader.loadProfileTropes("owner", shell)
	assert.equal(writes, 1)
	assert.ok(calls.some((sql) => sql.includes("AS length")))
	fail = true
	await assert.rejects(
		loader.refreshProfileTropes("owner"),
		/identity store down/,
	)
	assert.equal(writes, 1)
	assert.equal(full?.schema, 2)
})

test("URI excerpts authorize target/movie pairs and retain the actual contextual label without name guessing", async () => {
	const pool = buildUriTropePool(
		titles,
		titles.flatMap((t) => [
			{ key: t.title.key, name: "Context A", url: a, length: 100 },
			{ key: t.title.key, name: "Context B", url: b, length: 500 },
		]),
		{
			[a]: { url: target, title: "Actual title" },
			[b]: { url: target, title: "Actual title" },
		},
	)
	const calls: { sql: string; params: (string | number | Date)[] }[] = []
	const read: CatalogRead = async <T extends {}>(
		sql: string,
		params: (string | number | Date)[],
	) => {
		calls.push({ sql, params })
		return [
			{
				media_tmdb_id: 1,
				name: "Context A",
				url: a,
				content: "Short sentence.",
			},
			{
				media_tmdb_id: 1,
				name: "Context B",
				url: b,
				content: "The longer actual contextual write-up.",
			},
			{
				media_tmdb_id: 1,
				name: "Actual title",
				url: url("WrongPage"),
				content: "Wrong target must never leak.",
			},
			{
				media_tmdb_id: 999,
				name: "Context A",
				url: a,
				content: "Unrated private movie must never leak.",
			},
		] as unknown as T[]
	}
	const loader = createTropesLoader({
		read,
		userData: async () => user(),
		readCache: async () => ({ pool, fresh: true }),
		writeCache: async () => {},
		titlePath: () => "",
		resolveReferences: async () => ({}),
		readDescriptions: async () => ({}),
	})
	assert.deepEqual(
		await loader.loadProfileTropeExcerpts("owner", shell, target, [
			"movie-1",
			"movie-999",
		]),
		[
			{
				key: "movie-1",
				text: "The longer actual contextual write-up.",
				label: "Context B",
				labels: ["Context A", "Context B"],
			},
		],
	)
	assert.ok(calls[0].sql.includes("url IN (?,?)"))
	assert.ok(!calls[0].sql.includes("match(name"))
	assert.deepEqual(
		await loader.loadProfileTropeExcerpts("owner", shell, "Actual title", [
			"movie-1",
		]),
		[],
	)
	assert.equal(calls.length, 1)
	const hidden = {
		...shell,
		visibility: { ...DEFAULT_VISIBILITY, taste: "me" as const },
	}
	assert.deepEqual(
		await loader.loadProfileTropeExcerpts("owner", hidden, target, ["movie-1"]),
		[],
	)
	assert.equal(calls.length, 1)
})

test("large alias route unions use bounded excerpt batches", async () => {
	const routes = Array.from({ length: 801 }, (_, i) => url(`Route${i}`))
	const mappings = Object.fromEntries(
		routes.map((reference) => [
			reference,
			{ url: target, title: "Actual title" },
		]),
	)
	const pool = buildUriTropePool(
		titles,
		titles.flatMap((t) =>
			routes.map((reference) => ({
				key: t.title.key,
				name: "Context",
				url: reference,
				length: 100,
			})),
		),
		mappings,
	)
	const calls: { sql: string; params: (string | number | Date)[] }[] = []
	const loader = createTropesLoader({
		read: async <T extends {}>(
			sql: string,
			params: (string | number | Date)[],
		) => {
			calls.push({ sql, params })
			return [] as T[]
		},
		userData: async () => user(),
		readCache: async () => ({ pool, fresh: true }),
		writeCache: async () => {},
		titlePath: () => "",
		readDescriptions: async () => ({}),
		resolveReferences: async () => ({}),
	})
	assert.deepEqual(
		await loader.loadProfileTropeExcerpts("owner", shell, target, ["movie-1"]),
		[],
	)
	assert.equal(calls.length, 3)
	assert.deepEqual(
		calls.map((c) => c.params.length),
		[402, 402, 3],
	)
})

test("visible descriptions authorize owner target IDs, bound reads, refresh versions and isolate catalog failures from filters", async () => {
	const pool = buildUriTropePool(
		titles,
		titles.map((t) => ({
			key: t.title.key,
			name: "Context",
			url: a,
			length: 100,
		})),
		{ [a]: { url: target, title: "Actual title" } },
	)
	const calls: string[][] = []
	let failure = false
	let text: string | null = "Definition one"
	let heading = "Actual heading"
	const loader = createTropesLoader({
		read: async () => {
			throw Error("no heavy recomputation")
		},
		userData: async () => user(),
		readCache: async () => ({ pool, fresh: true, version: 123 }),
		writeCache: async () => {
			throw Error("no writes")
		},
		titlePath: () => "",
		resolveReferences: async () => ({}),
		readDescriptions: async (ids, options) => {
			calls.push(ids)
			if (failure) throw Error("optional catalog down")
			assert.equal(options?.strict, true)
			return Object.fromEntries(
				ids.map((id) => [id, { url: id, title: heading, text }]),
			)
		},
	})
	const initial = await loader.loadProfileTropeDescriptions("owner", shell, [
		target,
		url("UnratedTarget"),
		target,
	])
	assert.deepEqual(calls, [[target]])
	assert.deepEqual(Object.keys(initial.entries), [target])
	text = "Definition two"
	heading = "Corrected actual heading"
	const updated = await loader.loadProfileTropeDescriptions("owner", shell, [
		target,
	])
	assert.notEqual(initial.catalogVersion, updated.catalogVersion)
	assert.equal(updated.entries[target].title, heading)
	text = null
	assert.equal(
		(await loader.loadProfileTropeDescriptions("owner", shell, [target]))
			.entries[target].text,
		null,
	)
	const before = calls.length
	assert.deepEqual(
		(
			await loader.loadProfileTropeDescriptions("owner", shell, [
				url("UnratedTarget"),
			])
		).entries,
		{},
	)
	assert.deepEqual(
		(
			await loader.loadProfileTropeDescriptions(
				"owner",
				{ ...shell, visibility: { ...DEFAULT_VISIBILITY, scores: "me" } },
				[target],
			)
		).entries,
		{},
	)
	assert.equal(calls.length, before)
	await assert.rejects(
		loader.loadProfileTropeDescriptions("owner", shell, Array(61).fill(target)),
		RangeError,
	)
	failure = true
	await assert.rejects(
		loader.loadProfileTropeDescriptions("owner", shell, [target]),
		/optional catalog down/,
	)
	const matrix = await loader.loadProfileTropes("owner", shell, null, {
		wait: false,
		descriptions: false,
	})
	assert.equal(matrix?.tropes[0], target)
	assert.deepEqual(matrix?.descriptions, {})
})

test("Main to Mohs targets retain canonical titles through ranking, first30, lazy descriptions and authorized movie excerpts", async () => {
	const original = url("OneBigLie")
	const canonical = "https://tvtropes.org/pmwiki/pmwiki.php/Mohs/OneBigLie"
	const resolved = { [original]: { url: canonical, title: "One Big Lie" } }
	const pool = buildUriTropePool(
		titles,
		titles.map((t) => ({
			key: t.title.key,
			name: "A contextual lie label",
			url: original,
			length: 100,
		})),
		resolved,
	)
	assert.deepEqual(pool.tropes, [canonical])
	assert.equal(pool.urls[canonical], canonical)
	assert.equal(rankTropes(pool, pool.pool).ranked[0].name, "One Big Lie")
	const visible = withPreviewDescriptions(
		tropesPreview({ ...pool, seen: [] }),
		{
			[canonical]: {
				url: canonical,
				title: "One Big Lie",
				text: "Actual observed Mohs general definition.",
			},
		},
	)
	assert.equal(visible.ranked.length, 1)
	assert.equal(visible.ranked[0].id, canonical)
	assert.equal(
		visible.ranked[0].description,
		"Actual observed Mohs general definition.",
	)
	assert.deepEqual(visible.ranked[0].labels, ["A contextual lie label"])
	const reads: string[][] = []
	const loader = createTropesLoader({
		read: async <T extends {}>(
			sql: string,
			params: (string | number | Date)[],
		) => {
			assert.ok(sql.includes("url IN (?)"))
			assert.ok(params.includes(original))
			assert.ok(!params.includes(canonical))
			return [
				{
					media_tmdb_id: 1,
					name: "A contextual lie label",
					url: original,
					content: "Actual movie-specific write-up.",
				},
				{
					media_tmdb_id: 999,
					name: "Other",
					url: original,
					content: "Not in owner pool.",
				},
			] as unknown as T[]
		},
		userData: async () => user(),
		readCache: async () => ({ pool, fresh: true, version: 123 }),
		writeCache: async () => {},
		titlePath: () => "",
		resolveReferences: async () => resolved,
		readDescriptions: async (ids) => {
			reads.push(ids)
			return Object.fromEntries(
				ids.map((id) => [
					id,
					{
						url: id,
						title: "Updated One Big Lie",
						text: "Current observed general definition.",
					},
				]),
			)
		},
	})
	const lazy = await loader.loadProfileTropeDescriptions("owner", shell, [
		canonical,
		"https://tvtropes.org/pmwiki/pmwiki.php/Creator/Someone",
	])
	assert.deepEqual(reads, [[canonical]])
	assert.equal(lazy.entries[canonical].title, "Updated One Big Lie")
	assert.deepEqual(
		await loader.loadProfileTropeExcerpts("owner", shell, canonical, [
			"movie-1",
			"movie-999",
		]),
		[
			{
				key: "movie-1",
				text: "Actual movie-specific write-up.",
				label: "A contextual lie label",
				labels: ["A contextual lie label"],
			},
		],
	)
	const before = reads.length
	assert.deepEqual(
		(
			await loader.loadProfileTropeDescriptions(
				"owner",
				{ ...shell, visibility: { ...DEFAULT_VISIBILITY, taste: "me" } },
				[canonical],
			)
		).entries,
		{},
	)
	assert.equal(reads.length, before)
})
