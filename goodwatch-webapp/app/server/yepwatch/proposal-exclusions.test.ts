import test from 'node:test'
import assert from 'node:assert/strict'
import { roomExclusions } from './proposal-member-exclusions.ts'
import { rankingRoom } from './proposal-ranking-test-support.ts'
import { redesignTransition } from './proposal-redesign.ts'
import type { ContinuousMembers } from './continuous-members.server.ts'
import type { PersonalSignals, RoomTasteSource } from './proposal-person-signal.ts'
test('room exclusions combine member seen, always-hidden, and profile seen; departed people do not contribute', async () => {
  const room = rankingRoom(), p = room.participants[0]
  p.member = { state: 'linked', prefill: null }
  const member: PersonalSignals = { revision: '1', taste: null, seen: new Set(), hidden: new Set([1e12 + 2]), wishlist: new Set(), nopes: new Map() }
  const profile: PersonalSignals = { ...member, hidden: new Set(), seen: new Set([2e12 + 3]) }
  const members = { seenOrNone: async () => ['movie_1'], seenStored: async () => ['movie_1'], tasteStored: () => member, refreshSeen() {} } as unknown as ContinuousMembers
  const profiles: RoomTasteSource = { prepare: async () => {}, stored: () => profile }
  const catalog = roomExclusions(members, profiles)
  assert.deepEqual(new Set(await catalog.excludedKeys(room)), new Set(['movie_1', 'movie_2', 'show_3']))
  p.showSeen = true
  assert.deepEqual(await catalog.excludedKeys(room, { stored: true, readMissing: false }), ['movie_2'])
  p.leftAt = Date.now()
  assert.deepEqual(await catalog.excludedKeys(room), [])
})
test('a device profile can switch showSeen; an empty unlinked place cannot', () => {
  const room = rankingRoom(); room.phase = 'setup'
  const command = { commandId: 'toggle', sequence: 1, command: { type: 'set_show_seen' as const, show: true } }
  assert.throws(() => redesignTransition(room, room.hostId, command, Date.now()), { code: 'member_required' })
  Object.assign(room.participants[0], { profileId: 'private-profile' })
  assert.equal(redesignTransition(room, room.hostId, command, Date.now())?.participants[0].showSeen, true)
})
