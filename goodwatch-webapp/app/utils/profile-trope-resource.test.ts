import assert from "node:assert/strict"
import { test } from "node:test"
import { QueryClient } from "@tanstack/react-query"
import { DEFAULT_VISIBILITY } from "../domain/profile.ts"
import { createTropesLoader } from "../server/profile/tropes-data.ts"
import { buildTropePool } from "../server/profile/tropes-model.ts"
import type { UserData } from "../types/user-data.ts"
import {
	mergeProfileTropeResource,
	profileTropeQueryKey,
	profileTropeResource,
	profileTropeRequestParams,
	wantsThinTropes,
} from "./profile-trope-resource.ts"

const empty = (): UserData => ({
	scores: {},
	watchState: {},
	wishlist: {},
	favorites: {},
	skipped: {},
	notInterested: {},
})

test("an unchanged owner pool refreshes independent viewer Seen state without resending the matrix", async () => {
	const pool = buildTropePool(
		Array.from({ length: 3 }, (_, i) => ({
			title: {
				key: `movie-${i + 1}`,
				mediaType: "movie" as const,
				tmdbId: i + 1,
				title: `Title ${i + 1}`,
				year: 2000,
				poster: null,
				backdrop: null,
				score: 8 as const,
				gw: 70,
				href: `/movie/${i + 1}`,
				date: null,
			},
			genres: ["Drama"],
			names: ["Common"],
		})),
		[],
		{},
	)
	const viewer = empty()
	const loader = createTropesLoader({
		read: async () => {
			throw Error("A viewer watch cannot rebuild the owner's pool")
		},
		readCache: async () => ({ pool, fresh: true, version: 123 }),
		writeCache: async () => {
			throw Error("A viewer watch cannot rewrite the owner's pool")
		},
		userData: async (id) => {
			assert.equal(id, "viewer")
			return viewer
		},
		titlePath: () => "",
		readDescriptions: async () => ({
			Common: {
				text: "A shared definition.",
				url: "https://tvtropes.org/common",
			},
		}),
	})
	const shell = {
		viewer: "member" as const,
		visibility: { ...DEFAULT_VISIBILITY },
	}
	const first = (await loader.loadProfileTropes("owner", shell, "viewer"))!
	assert.deepEqual(first.seen, [])
	const initial = profileTropeResource(first, false, new URLSearchParams())
	viewer.scores["movie-1"] = { score: 8, review: null, updatedAt: new Date() }
	const next = (await loader.loadProfileTropes("owner", shell, "viewer"))!
	assert.equal(first.version, next.version)
	assert.equal(first.catalogVersion, next.catalogVersion)
	const compact = profileTropeResource(
		next,
		false,
		new URLSearchParams({
			version: String(first.version),
			catalogVersion: initial.tropes?.catalogVersion ?? "",
		}),
	)
	assert.equal(compact.unchanged, true)
	assert.equal(compact.tropes, null)
	assert.deepEqual(compact.seen, ["movie-1"])
	const merged = mergeProfileTropeResource(initial, compact)
	assert.deepEqual(merged.tropes?.seen, ["movie-1"])
	assert.equal(merged.tropes?.pool, first.pool)
	delete viewer.scores["movie-1"]
	const reverted = (await loader.loadProfileTropes("owner", shell, "viewer"))!
	const revertedResponse = profileTropeResource(
		reverted,
		false,
		new URLSearchParams({
			version: String(first.version),
			catalogVersion: initial.tropes?.catalogVersion ?? "",
		}),
	)
	assert.deepEqual(
		mergeProfileTropeResource(merged, revertedResponse).tropes?.seen,
		[],
	)
})

test("changing the root display language does not reuse another language's unchanged matrix", () => {
	const client = new QueryClient()
	const shell = {
		handle: "profile",
		viewer: "guest" as const,
		visibility: { ...DEFAULT_VISIBILITY },
	}
	const pool = {
		...buildTropePool([], [], {}),
		seen: [],
		version: 123,
		catalogVersion: "stable",
	}
	const english = profileTropeResource(
		{
			...pool,
			titles: {
				"movie-1": {
					key: "movie-1",
					mediaType: "movie",
					tmdbId: 1,
					title: "English title",
					year: 2000,
					poster: null,
					backdrop: null,
					score: 8,
					gw: 70,
					href: "/movie/1",
					date: null,
				},
			},
		},
		false,
		new URLSearchParams(),
	)
	client.setQueryData(profileTropeQueryKey(shell, null, "en"), english)
	const germanKey = profileTropeQueryKey(shell, null, "de")
	const previous = client.getQueryData<typeof english>(germanKey)
	assert.equal(client.getQueryData(germanKey), undefined)
	// This is the first request for this language, so the client sends no cached owner/catalog versions.
	const params = new URLSearchParams()
	if (previous?.tropes?.version)
		params.set("version", String(previous.tropes.version))
	if (previous?.tropes?.catalogVersion)
		params.set("catalogVersion", previous.tropes.catalogVersion)
	const german = profileTropeResource(
		{
			...pool,
			titles: {
				...english.tropes!.titles,
				"movie-1": {
					...english.tropes!.titles["movie-1"],
					title: "Deutscher Titel",
				},
			},
		},
		false,
		params,
	)
	assert.equal(german.unchanged, false)
	client.setQueryData(germanKey, mergeProfileTropeResource(previous, german))
	assert.equal(
		client.getQueryData<typeof german>(germanKey)?.tropes?.titles["movie-1"]
			.title,
		"Deutscher Titel",
	)
	assert.equal(
		client.getQueryData<typeof english>(profileTropeQueryKey(shell, null, "en"))
			?.tropes?.titles["movie-1"].title,
		"English title",
	)
	client.clear()
})

test("filter matrices contain neither article text nor server-only source labels/routes", () => {
	const ids = Array.from(
		{ length: 1000 },
		(_, i) => `https://tvtropes.org/pmwiki/pmwiki.php/Main/Page${i}`,
	)
	const pool = {
		...buildTropePool([], [], {}),
		schema: 2,
		tropes: ids,
		seen: [],
		version: 123,
		names: Object.fromEntries(ids.map((id) => [id, "Actual title"])),
		urls: Object.fromEntries(ids.map((id) => [id, id])),
		descriptions: Object.fromEntries(
			ids.map((id) => [id, "Long article paragraph. ".repeat(350)]),
		),
		references: Object.fromEntries(ids.map((id) => [id, [id]])),
		labels: Object.fromEntries(ids.map((id) => [id, ["Contextual label"]])),
	}
	const resource = profileTropeResource(
		pool,
		false,
		profileTropeRequestParams(),
	)
	assert.deepEqual(resource.tropes?.descriptions, {})
	assert.equal("references" in (resource.tropes ?? {}), false)
	assert.equal("labels" in (resource.tropes ?? {}), false)
	assert.ok(JSON.stringify(resource).length < JSON.stringify(pool).length / 10)
	const changed = profileTropeResource(
		{
			...pool,
			catalogVersion: "new definitions",
			descriptions: { other: "Changed" },
		},
		false,
		new URLSearchParams({
			format: "thin-v1",
			version: "123",
			catalogVersion: resource.tropes?.catalogVersion ?? "",
		}),
	)
	assert.equal(changed.unchanged, true)
})

test("thin format is explicitly negotiated on cold and warm requests while legacy clients retain their full contract", () => {
	const pool = {
		...buildTropePool([], [], {}),
		seen: [],
		version: 321,
		catalogVersion: "legacy-definition-version",
		descriptions: { Context: "Full general definition" },
		labels: { Context: ["Original label"] },
		references: {
			Context: ["https://tvtropes.org/pmwiki/pmwiki.php/Main/Actual"],
		},
	}
	const cold = profileTropeRequestParams()
	assert.equal(cold.get("format"), "thin-v1")
	assert.equal(cold.has("version"), false)
	const thin = profileTropeResource(pool, false, cold)
	assert.deepEqual(thin.tropes?.descriptions, {})
	assert.equal(thin.tropes?.catalogVersion, "thin-v1")
	const warm = profileTropeRequestParams(thin)
	assert.equal(warm.get("format"), "thin-v1")
	assert.equal(profileTropeResource(pool, false, warm).unchanged, true)
	for (const params of [
		new URLSearchParams(),
		new URLSearchParams({ format: "unknown" }),
	]) {
		assert.equal(wantsThinTropes(params), false)
		const legacy = profileTropeResource(pool, false, params)
		assert.equal(legacy.tropes, pool)
		assert.equal(legacy.tropes?.descriptions.Context, "Full general definition")
		assert.deepEqual(legacy.tropes?.labels, pool.labels)
		assert.deepEqual(legacy.tropes?.references, pool.references)
		assert.equal(legacy.tropes?.catalogVersion, "legacy-definition-version")
	}
	const legacyWarm = new URLSearchParams({
		version: "321",
		catalogVersion: "legacy-definition-version",
	})
	assert.equal(profileTropeResource(pool, false, legacyWarm).unchanged, true)
})
