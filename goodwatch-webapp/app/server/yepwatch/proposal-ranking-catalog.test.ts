import test from "node:test"
import assert from "node:assert/strict"
import { stubModules } from "../rating-onboarding.test-support.ts"
import { rankingSnapshot, rankingRoom } from "./proposal-ranking-test-support.ts"
import type { CatalogReads } from "./catalog-adapter.ts"
import type { RoomTasteSource, PersonalSignals } from "./proposal-person-signal.ts"
import type { ContinuousMembers } from "./continuous-members.server.ts"
const snapshot = rankingSnapshot(
	Array.from({ length: 30 }, (_, i) => ({
		key: 1e12 + i + 1,
		score: i === 3 ? 95 : 80,
		fp: [10, 0],
	})),
	"catalog-fixture",
)
const globals = globalThis as typeof globalThis & {
	picksSnapshot: typeof snapshot | null
	picksReads: CatalogReads
	picksMetadata: () => Promise<unknown>
}
globals.picksSnapshot = snapshot
globals.picksReads = {
	rankedKeys: async () => Array.from(snapshot.columns.pointIds),
	displays: async (keys) =>
		new Map(
			keys.map((key) => [
				key,
				{
					key,
					tmdbId: key % 1e12,
					mediaType: "movie" as const,
					title: "Fixture",
					year: 2020,
					overview: null,
					posterUrl: null,
					runtimeMinutes: 90,
					goodwatchScore: 80,
				},
			]),
		),
	availability: async (titles, screens) =>
		new Map(
			titles.map((t) => [
				t.key,
				screens.map((s) => ({
					screenId: s.id,
					state: "watchable" as const,
					scope: "title" as const,
					checkedAt: 1,
					offers: [
						{
							serviceId: 1,
							name: "Service one",
							url: null,
							kind: "where_to_watch" as const,
							offerType: "flatrate" as const,
						},
					],
				})),
			]),
		),
	episodes: async () => [],
}
globals.picksMetadata = async () => ({
	countries: [{ code: "DE", name: "Germany" }],
	services: [
		{ id: 1, name: "Service one", logoUrl: null },
		{ id: 2, name: "Service two", logoUrl: null },
	],
	moods: [],
})
stubModules({
	"./goodwatch.server.ts":
		"export const goodwatchReads=globalThis.picksReads;export const goodwatchCatalog={metadata:globalThis.picksMetadata}",
	"../title-snapshot/index.server": "export const getTitleSnapshot=()=>globalThis.picksSnapshot",
	"~/server/availability-index.server": `export const countryServices=()=>({services:[1,2],offsets:new Uint32Array(Array.from({length:31},(_,i)=>i*2)),entries:new Uint16Array(Array.from({length:60},(_,i)=>i%2)),rowOf:key=>key%1e12-1,indexOfService:id=>id-1})`,
	"./continuous-presentation.server.ts":
		"export const enrichContinuousCandidates=async cards=>cards;export const warmEnrichment=()=>{}",
})
const { guestProposalCatalog } = await import("./proposal-guest-catalog.server.ts")
const none = (): PersonalSignals => ({
	revision: "1",
	taste: null,
	seen: new Set(),
	hidden: new Set(),
	wishlist: new Set(),
	nopes: new Map(),
})
test("release catalog uses member wishlist, profile/hidden exclusions and shared-service intersections, without reading taste at Start", async () => {
	const room = rankingRoom()
	room.phase = "setup"
	room.participants[0].member = { state: "linked", prefill: null }
	room.participants[0].serviceIds = [1, 2]
	room.screens[0].serviceIds = [1, 2]
	room.participants.push(
		...["b", "c"].map((id, i) => ({
			...structuredClone(room.participants[0]),
			id,
			serviceIds: i ? null : [2],
		})),
	)
	const member = none()
	member.wishlist = new Set([1e12 + 10])
	member.hidden = new Set([1e12 + 2])
	const profile = none()
	profile.seen = new Set([1e12 + 3])
	profile.wishlist = new Set([1e12 + 4])
	profile.nopes = new Map([
		[1e12 + 4, Date.now()],
		[1e12 + 10, Date.now() - 31 * 86400000],
	])
	const profiles: RoomTasteSource = { prepare: async () => {}, stored: () => profile }
	const members = {
		seenOrNone: async () => ["movie_1"],
		seenStored: async () => ["movie_1"],
		tasteStored: () => member,
		refreshSeen() {},
		refreshTaste() {
			throw Error("a build must use the cached taste")
		},
	} as unknown as ContinuousMembers
	const catalog = guestProposalCatalog(members, profiles),
		page = await catalog.page(room)
	for (const id of [1, 2, 3])
		assert.equal(
			page.candidates.some((c) => c.identity.tmdbId === id),
			false,
		)
	assert.equal(page.candidates.find((c) => c.identity.tmdbId === 10)?.reason?.code, "want_to_see")
	assert.equal(
		page.candidates.find((c) => c.identity.tmdbId === 4)?.reason?.code,
		"on_service_for_everyone",
		"profile wishlists never produce a Want to See boost",
	)
	assert.equal(
		page.candidates.find((c) => c.identity.tmdbId === 4)?.reason?.text,
		"On Service two for everyone",
	)
	assert.equal(
		Object.values(page.ranking!).find((r) => r.key === 1e12 + 4)?.parts.repeat,
		-0.1,
		"profiles without taste still penalize the score",
	)
	assert.equal(
		Object.values(page.ranking!).find((r) => r.key === 1e12 + 10)?.parts.repeat,
		0,
		"Nopes older than 30 days do not penalize a card",
	)
	room.participants[1].serviceIds = [1]
	room.participants[0].serviceIds = [2]
	const mixed = await catalog.page(room)
	assert.equal(
		mixed.candidates.some((c) => c.reason?.code === "on_service_for_everyone"),
		false,
	)
	room.participants = room.participants.slice(0, 2)
	assert.notEqual(
		(await catalog.page(room)).candidates.find((c) => c.identity.tmdbId === 10)?.reason?.code,
		"want_to_see",
	)
})
test("a taste that lands after a setup change rebuilds the prepared deck once; an unchanged one does not", async () => {
	const room = rankingRoom()
	room.phase = "setup"
	room.participants[0].member = { state: "linked", prefill: null }
	let member: PersonalSignals | null = null,
		profile: PersonalSignals | null = null,
		landing: PersonalSignals | null = { ...none(), revision: "member-1" }
	const members = {
		refreshSeen() {},
		tasteStored: () => member,
		refreshTaste: async () => (member = landing ?? member),
	} as unknown as ContinuousMembers
	const profiles: RoomTasteSource = {
		prepare: async () => {
			profile = { ...none(), revision: "profile-1" }
		},
		stored: () => profile,
	}
	const catalog = guestProposalCatalog(members, profiles),
		changed: string[] = []
	catalog.onInputsChanged!((id) => changed.push(id))
	const settle = () => new Promise((resolve) => setTimeout(resolve, 5))
	const before = catalog.inputRevision!(room)
	catalog.refreshExcludedKeys!(room)
	await settle()
	assert.deepEqual(changed, [room.id])
	assert.notEqual(catalog.inputRevision!(room), before, "both tastes are part of the deck identity")
	landing = null
	catalog.refreshExcludedKeys!(room)
	await settle()
	assert.deepEqual(changed, [room.id], "the same tastes again: nothing to rebuild")
})

test("catalog counts each active linked profile Nope once alongside member taste", async () => {
	const room = rankingRoom()
	room.phase = "setup"
	room.participants[0].member = { state: "linked", prefill: null }
	room.participants.push({ ...structuredClone(room.participants[0]), id: "other" })
	const vector = new Float32Array(74)
	vector[0] = 1
	const member = {
		...none(),
		taste: {
			vector,
			quantiles: Float32Array.from(Array.from({ length: 119 }, (_, i) => i / 118)),
			confidence: 1,
			unseen: new Set<number>(),
			source: "member" as const,
			snapshotVersion: snapshot.version,
		},
	}
	const profile = { ...none(), nopes: new Map([[1e12 + 4, Date.now()]]) }
	let noperPresent = true
	const profiles: RoomTasteSource = {
		prepare: async () => {},
		stored: (_room, p) => (p.id === room.participants[0].id && noperPresent ? profile : none()),
	}
	const members = {
		seenOrNone: async () => [],
		seenStored: async () => [],
		tasteStored: () => member,
	} as unknown as ContinuousMembers
	const catalog = guestProposalCatalog(members, profiles)
	const penalized = await catalog.page(room)
	const rank = Object.values(penalized.ranking!).find((r) => r.key === 1e12 + 4)!
	assert.ok(Math.abs(rank.parts.repeat + 0.1 / 2) < 1e-9)
	noperPresent = false
	const baseline = Object.values((await catalog.page(room)).ranking!).find(
		(r) => r.key === 1e12 + 4,
	)!
	assert.equal(baseline.parts.repeat, 0)
	assert.ok(Math.abs(rank.score - baseline.score - rank.parts.repeat) < 1e-9)
})

for (const confidence of [null, 0] as const) {
	test(`catalog applies Nopes with ${confidence === null ? "skipped Taste" : "only unseen answers"}, excluding departed and unlinked people`, async () => {
		const room = rankingRoom()
		room.phase = "setup"
		room.participants[0].profileId = "linked-profile"
		const vector = new Float32Array(74)
		vector[0] = 1
		const profile: PersonalSignals = {
			...none(),
			taste:
				confidence === null
					? null
					: {
							vector,
							quantiles: new Float32Array(119),
							confidence,
							unseen: new Set([1e12 + 29]),
							source: "profile",
							snapshotVersion: snapshot.version,
						},
		}
		room.participants.push(
			{ ...structuredClone(room.participants[0]), id: "departed", leftAt: 1 },
			{ ...structuredClone(room.participants[0]), id: "unlinked", profileId: undefined },
		)
		const profiles: RoomTasteSource = {
			prepare: async () => {},
			stored: (_r, p) => (p.profileId ? profile : null),
		}
		const catalog = guestProposalCatalog(undefined, profiles)
		const before = await catalog.page(room)
		const target = Object.values(before.ranking!).find((r) => r.key === 1e12 + 4)!
		profile.nopes = new Map([[target.key, Date.now()]])
		const after = await catalog.page(room)
		const penalized = Object.values(after.ranking!).find((r) => r.key === target.key)!
		assert.equal(
			penalized.parts.repeat,
			-0.1,
			"only the active linked profile counts in the denominator",
		)
		assert.ok(Math.abs(target.score - penalized.score - 0.1) < 1e-12)
		assert.equal(penalized.parts.taste, 0)
		assert.equal(penalized.parts.minimum, 0)
		assert.ok(penalized.score < target.score, "a participant without taste still lowers the score")
	})
}

test("preview uses only matching Start results without padding, preparing profiles or reading members", async () => {
	const room = rankingRoom()
	room.phase = "setup"
	room.ideas = [
		{
			id: "comedy",
			text: "witty",
			authorId: room.hostId,
			on: true,
			attributes: [{ kind: "want", key: "wit_wordplay", text: "witty" }],
			rankedKeys: [1e12 + 10],
			interpretedAt: 1,
		},
	]
	let prepares = 0
	const profiles: RoomTasteSource = {
		prepare: async () => {
			prepares++
		},
		stored: () => null,
	}
	const catalog = guestProposalCatalog(undefined, profiles)
	const before = structuredClone(room)
	const full = await catalog.page(room)
	const preview = await catalog.page(room, { limit: 5, preview: true })
	assert.equal(prepares, 1, "preview only uses held tastes; Start preparation ran once")
	assert.equal(preview.candidates.length, 1)
	assert.deepEqual(
		full.candidates.map((c) => c.identity.tmdbId),
		[10],
	)
	assert.deepEqual(preview.candidates, full.candidates.slice(0, 5))
	assert.ok(
		preview.candidates.some((c) => c.identity.tmdbId === 10),
		"stored idea reading participates in ranking",
	)
	assert.deepEqual(room, before)
	room.seenKeys = ["movie_10"]
	assert.deepEqual(
		(await catalog.page(room)).candidates,
		[],
		"refill never broadens exhausted ideas",
	)
	room.seenKeys = []
	room.ideas[0].on = false
	const off = await catalog.page(room, { limit: 5, preview: true })
	assert.equal(off.candidates.length, 5, "turning off all ideas explicitly broadens the preview")
	assert.ok(Object.values(preview.ranking!).find((r) => r.key === 1e12 + 10)!.parts.idea > 0)
	assert.ok(
		Object.values(off.ranking!).every((r) => r.parts.idea === 0),
		"switching the idea off removes its boost",
	)
	const availability = globals.picksReads.availability
	globals.picksReads.availability = async (titles, screens, fresh) => {
		const found = await availability(titles, screens, fresh)
		return new Map(
			[...found].map(([key, rows]) => [
				key,
				rows.map((r, i) =>
					screens[i].serviceIds.includes(1) ? r : { ...r, state: "no_match", offers: [] },
				),
			]),
		)
	}
	try {
		room.screens[0].serviceIds = [2]
		assert.deepEqual(
			(await catalog.page(room, { limit: 5, preview: true })).candidates,
			[],
			"unavailable titles cannot leak into another service selection",
		)
	} finally {
		globals.picksReads.availability = availability
	}
	room.constraints.kinds = ["show_start"]
	assert.deepEqual(
		(await catalog.page(room, { limit: 5, preview: true })).candidates,
		[],
		"movie-only fixture cannot leak into show preview",
	)
})

test("catalog without a held taste snapshot still obeys idea membership and exhaustion", async () => {
	const room = rankingRoom()
	room.ideas = [
		{
			id: "scifi",
			text: "scifi super epic",
			authorId: room.hostId,
			on: true,
			attributes: [],
			rankedKeys: [1e12 + 10],
			interpretedAt: 1,
		},
	]
	globals.picksSnapshot = null
	try {
		const catalog = guestProposalCatalog()
		assert.deepEqual(
			(await catalog.page(room)).candidates.map((c) => c.identity.tmdbId),
			[10],
		)
		room.seenKeys = ["movie_10"]
		assert.deepEqual((await catalog.page(room)).candidates, [])
		room.ideas[0].on = false
		assert.ok((await catalog.page(room)).candidates.length > 0)
	} finally {
		globals.picksSnapshot = snapshot
	}
})
