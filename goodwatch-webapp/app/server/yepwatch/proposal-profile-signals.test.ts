import { test } from "node:test"
import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { TasteProfiles } from "./proposal-taste-profile.ts"
import { profileTasteSource } from "./proposal-profile-signals.ts"
import { MemoryProfileStore, tasteFixture, tasteDisplays, key } from "./proposal-taste-test-support.ts"
import { rankingRoom } from "./proposal-ranking-test-support.ts"
import type { ContinuousMembers } from "./continuous-members.server.ts"
import type { PersonalSignals } from "./proposal-person-signal.ts"

const snapshot = tasteFixture()
function setup() {
	const store = new MemoryProfileStore()
	let now = 1_000_000
	const profiles = new TasteProfiles(store, "s".repeat(32), () => snapshot, tasteDisplays, () => now)
	const id = profiles.identity(randomBytes(32).toString("base64url"))
	const room = rankingRoom()
	room.participants[0].profileId = id
	return { store, profiles, id, room, person: room.participants[0], advance: (ms: number) => (now += ms), at: () => now }
}
const answers = (...items: [number, "loved" | "not_for_me" | "unseen"][]) => items.map(([i, answer], n) => ({ key: key(i), answer, at: 10 + n }))

test("a profile's answers rank the person: taste, confidence and seen sets, held without a read or a calculation", async () => {
	const f = setup(), source = profileTasteSource(f.profiles)
	assert.equal(source.stored(f.room, f.person), null, "nothing is held before a build prepares it")
	await f.profiles.answers(f.id, { revision: 0, items: answers([1, "loved"], [5, "not_for_me"], [9, "unseen"]) })
	const reads = f.store.reads
	// The answer write built the taste: the next deck identity and Start's exclusions need no prepare.
	const signals = source.stored(f.room, f.person)!
	assert.equal(f.store.reads, reads)
	assert.equal(signals.taste?.source, "profile")
	assert.equal(signals.taste?.confidence, 1.5 / 8)
	assert.equal(signals.taste?.snapshotVersion, snapshot.version)
	assert.equal(signals.taste?.quantiles.length, 119)
	assert.deepEqual([...signals.seen].sort(), [key(1), key(5)])
	assert.deepEqual([...signals.taste!.unseen], [key(9)])
	assert.equal(signals.hidden.size + signals.wishlist.size + signals.nopes.size, 0)
	assert.equal(source.stored(f.room, f.person), signals, "the same held taste is the same object")
	await source.prepare(f.room)
	assert.equal(source.stored(f.room, f.person)!.revision, signals.revision, "preparing a held taste changes nothing")
	await f.profiles.answers(f.id, { revision: 1, items: [{ key: key(13), answer: "loved", at: 20 }] })
	assert.notEqual(source.stored(f.room, f.person)!.revision, signals.revision, "a changed profile is a new deck input")
})

test("someone without answers, or who left, has no taste; a cold profile is read once by prepare", async () => {
	const f = setup(), source = profileTasteSource(f.profiles)
	await source.prepare(f.room)
	assert.equal(f.store.reads, 1)
	const empty = source.stored(f.room, f.person)!
	assert.equal(empty.taste, null)
	assert.equal(empty.seen.size, 0)
	await source.prepare(f.room)
	assert.equal(f.store.reads, 1, "held: no second read")
	f.person.leftAt = 5
	assert.equal(source.stored(f.room, f.person), null)
})

test("a member keeps their GoodWatch taste with their YepWatch answers blended in, counted once as a member", async () => {
	const f = setup()
	f.person.member = { state: "linked", prefill: null }
	const vector = new Float32Array(74); vector[3] = 1
	let member: PersonalSignals | null = { revision: "m1", seen: new Set(), hidden: new Set([key(30)]), wishlist: new Set(), nopes: new Map(),
		taste: { vector, quantiles: new Float32Array(119), confidence: 0.75, unseen: new Set(), source: "member", snapshotVersion: snapshot.version } }
	const source = profileTasteSource(f.profiles, { tasteStored: () => member } as unknown as ContinuousMembers)
	await source.prepare(f.room)
	assert.equal(source.stored(f.room, f.person)!.taste, null, "no answers: the GoodWatch taste ranks alone")
	await f.profiles.answers(f.id, { revision: 0, items: answers([1, "loved"], [2, "loved"]) })
	const before = source.stored(f.room, f.person)!
	assert.equal(before.taste, null, "until the blend is built the GoodWatch taste ranks alone, never the answers twice")
	assert.deepEqual([...before.seen].sort(), [key(1), key(2)], "answered titles count as seen at once")
	await source.prepare(f.room)
	const blended = source.stored(f.room, f.person)!
	assert.notEqual(blended.revision, before.revision)
	assert.equal(blended.taste?.source, "member")
	assert.equal(blended.taste?.confidence, 1)
	assert.ok(blended.taste!.vector[3] > 0.9, "the GoodWatch vector leads")
	assert.ok(blended.taste!.vector[0] > 0, "the loved titles' dimension joins it")
	assert.equal(blended.hidden.size, 0, "hidden titles stay with the GoodWatch copy")
	// The GoodWatch copy ran out (grant ended, too old): the answers alone rank, as a profile.
	member = null
	assert.equal(source.stored(f.room, f.person)!.taste?.source, "profile")
})

test('committed Nopes persist across rooms; Yep and undo remove them without changing taste identity or budget', async () => {
	const f = setup(), source = profileTasteSource(f.profiles)
	await f.profiles.touch(f.id)
	await source.prepare(f.room)
	const before = source.stored(f.room, f.person)!
	const original = structuredClone(f.store.rows.get(f.id)!.profile)
	assert.equal(before.nopes.size, 0, 'dealt but unanswered records nothing')
	await source.voteCommitted!(f.room, f.person, key(1), 'pass', f.at())
	assert.deepEqual([...source.stored(f.room, f.person)!.nopes], [[key(1), f.at()]])
	assert.deepEqual(f.store.rows.get(f.id)!.profile.nopes, [{ key: key(1), at: f.at() }])
	assert.equal(source.stored(f.room, f.person)!.revision, before.revision)
	assert.equal(f.store.rows.get(f.id)!.profile.write_count, original.write_count)
	const otherRoom = rankingRoom()
	otherRoom.participants[0].profileId = f.id
	assert.equal(source.stored(otherRoom, otherRoom.participants[0])!.nopes.has(key(1)), true)
	for (const value of ['watch', null] as const) {
		await source.voteCommitted!(f.room, f.person, key(1), 'pass', f.at())
		await source.voteCommitted!(f.room, f.person, key(1), value, f.at())
		assert.equal(source.stored(f.room, f.person)!.nopes.size, 0)
	}
	delete f.person.profileId
	await source.voteCommitted!(f.room, f.person, key(2), 'pass', f.at())
	assert.deepEqual(f.store.rows.get(f.id)!.profile.nopes, [])
})

test('Nope reads ignore expiry and future times; every next profile write prunes history', async () => {
	const f = setup(), source = profileTasteSource(f.profiles)
	await f.profiles.touch(f.id)
	await source.prepare(f.room)
	await source.voteCommitted!(f.room, f.person, key(1), 'pass', f.at())
	f.advance(30 * 86400000 + 1)
	assert.equal(source.stored(f.room, f.person)!.nopes.size, 0)
	await source.voteCommitted!(f.room, f.person, key(2), 'pass', f.at() + 1)
	assert.deepEqual(f.store.rows.get(f.id)!.profile.nopes, [])
	await source.voteCommitted!(f.room, f.person, key(2), 'pass', f.at())
	assert.deepEqual(f.store.rows.get(f.id)!.profile.nopes, [{ key: key(2), at: f.at() }])
	f.advance(30 * 86400000 + 1)
	await f.profiles.answers(f.id, { revision: 0, items: [{ key: key(5), answer: 'loved', at: f.at() }] })
	assert.deepEqual(f.store.rows.get(f.id)!.profile.nopes, [])
})

test('Nope bursts coalesce, retain 300 newest unique entries and retry CAS conflicts', async () => {
	const f = setup(), source = profileTasteSource(f.profiles)
	await f.profiles.touch(f.id)
	await source.prepare(f.room)
	const start = f.at()
	f.advance(1000)
	const save = f.store.save.bind(f.store)
	let writes = 0
	f.store.save = async (p, old) => { writes++; return writes === 1 ? false : save(p, old) }
	await Promise.all(Array.from({ length: 350 }, (_, i) => source.voteCommitted!(f.room, f.person, key(i), 'pass', start + i)))
	assert.equal(writes, 2, 'one coalesced batch plus its CAS retry')
	const nopes = source.stored(f.room, f.person)!.nopes
	assert.equal(nopes.size, 300)
	assert.equal(nopes.has(key(49)), false)
	assert.equal(nopes.has(key(50)), true)
	assert.equal(nopes.has(key(349)), true)
	await source.voteCommitted!(f.room, f.person, key(50), 'pass', f.at())
	assert.equal(source.stored(f.room, f.person)!.nopes.get(key(50)), f.at())
})

test('Nope hook silently drops throwing stores and bounded repeated CAS failures', async () => {
	for (const throwing of [false, true]) {
		const f = setup(), source = profileTasteSource(f.profiles)
		await f.profiles.touch(f.id)
		let writes = 0
		f.store.save = async () => { writes++; if (throwing) throw new Error('unavailable'); return false }
		await assert.doesNotReject(source.voteCommitted!(f.room, f.person, key(1), 'pass', f.at()))
		assert.equal(writes, throwing ? 1 : 3)
	}
})

test('votes arriving during a Nope save drain in a subsequent batch, including undo', async () => {
	const f = setup(), source = profileTasteSource(f.profiles)
	await f.profiles.touch(f.id)
	await source.prepare(f.room)
	const save = f.store.save.bind(f.store)
	let release!: () => void, entered!: () => void
	const waiting = new Promise<void>(resolve => { release = resolve })
	const saving = new Promise<void>(resolve => { entered = resolve })
	let writes = 0
	f.store.save = async (p, old) => {
		if (++writes === 1) { entered(); await waiting }
		return save(p, old)
	}
	const first = source.voteCommitted!(f.room, f.person, key(1), 'pass', f.at())
	await saving
	const undo = source.voteCommitted!(f.room, f.person, key(1), null, f.at())
	const next = source.voteCommitted!(f.room, f.person, key(2), 'pass', f.at())
	release()
	await Promise.all([first, undo, next])
	assert.equal(writes, 2)
	assert.deepEqual([...source.stored(f.room, f.person)!.nopes], [[key(2), f.at()]])
})

test('Yep and undo without a stored Nope perform no writes and refresh the held cache', async () => {
	const f = setup(), source = profileTasteSource(f.profiles)
	await f.profiles.touch(f.id)
	await source.prepare(f.room)
	const row = f.store.rows.get(f.id)!
	row.profile.nopes = [{ key: key(2), at: f.at() }]
	row.seq++
	let writes = 0
	const save = f.store.save.bind(f.store)
	f.store.save = async (p, old) => { writes++; return save(p, old) }
	for (const value of ['watch', null] as const) {
		await source.voteCommitted!(f.room, f.person, key(1), value, f.at())
		assert.equal(writes, 0)
		assert.deepEqual([...source.stored(f.room, f.person)!.nopes], [[key(2), f.at()]])
	}
})
