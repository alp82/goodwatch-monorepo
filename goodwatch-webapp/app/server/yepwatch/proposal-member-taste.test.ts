import test from 'node:test'
import assert from 'node:assert/strict'
import { stubModules } from '../rating-onboarding.test-support.ts'
import { memberTasteSchema } from './proposal-member-taste.ts'
import { createMemberResource } from './member-resource.server.ts'
import { ContinuousMembers, type MemberReads, type MemberIssuer } from './continuous-members.server.ts'
import type { ContinuousRepository } from './continuous-types.ts'
import { rankingRoom } from './proposal-ranking-test-support.ts'
import { RoomError } from './errors.ts'
// Only calibration boundaries: no Redis, Crate or issuer connections in these copy tests.
stubModules({
  '../title-snapshot/index.server': "export const getTitleSnapshot=()=>({version:'fixture'})",
  '../taste/formula.server': 'export const quantileTable=()=>new Float32Array(119)',
  '../taste/pool.server': 'export const tastePool=()=>({});export const poolCosines=()=>new Float32Array(1)',
})
const payload = { vector: Array.from({ length: 74 }, (_, i) => i === 0 ? 1 : 0), liked: 8, version: 'v1', wishlist: [1e12 + 1], hidden: [2e12 + 2] }
test('member taste resource verifies the live grant before reading and has bounded, strict shape', async () => {
  let reads = 0
  const resource = createMemberResource({ verify: async token => { if (token !== 'valid') throw Error(); return { userId: 'private-account', expiresAt: Date.now() + 10000 } },
    prefill: async () => ({ country: null, serviceIds: [], savedProgressAvailable: false }), progress: async () => ({ source: 'goodwatch', shows: [], limitReached: false }),
    taste: async userId => { assert.equal(userId, 'private-account'); reads++; return payload } })
  assert.equal((await resource(new Request('https://goodwatch.app/api/yepwatch/account?view=taste'))).status, 401)
  assert.equal(reads, 0)
  const response = await resource(new Request('https://goodwatch.app/api/yepwatch/account?view=taste', { headers: { authorization: 'Bearer valid' } }))
  assert.equal(memberTasteSchema.safeParse((await response.json()).data).success, true)
  for (const bad of [{ ...payload, vector: [1] }, { ...payload, vector: Array(74).fill(Infinity) }, { ...payload, wishlist: Array(501).fill(1e12 + 1) }, { ...payload, ratings: [] }]) assert.equal(memberTasteSchema.safeParse(bad).success, false)
})
test('taste copies share reads, are read again after five minutes, end after ten, and a refused grant ends every copy', async () => {
  let now = 10000, reads = 0, refuse = false, down = false
  const room = rankingRoom(), p = room.participants[0]
  p.memberUserId = 'account'; p.member = { state: 'linked', prefill: null }; p.memberGrant = { accessToken: 'token', expiresAt: 99999999 }
  const memberReads: MemberReads = { prefill: async () => ({ country: null, serviceIds: [], savedProgressAvailable: false }),
    taste: async () => { reads++; if (refuse) throw new RoomError('member_required', 'gone', 403); if (down) throw new RoomError('busy', 'down', 503); return payload } }
  const members = new ContinuousMembers({} as ContinuousRepository, {} as MemberIssuer, memberReads, { callbackUrl: '', browserOrigins: [], nativeReturnUri: '' }, () => now)
  assert.equal(members.tasteStored(room, p.id), null)
  await Promise.all([members.refreshTaste(room, p.id), members.refreshTaste(room, p.id)])
  assert.equal(reads, 1); assert.equal(members.tasteStored(room, p.id)?.taste?.confidence, 1)
  now += 299999; await members.refreshTaste(room, p.id); assert.equal(reads, 1)
  // Half its age: read again, and the held copy stays in use meanwhile and through an outage.
  now += 1; down = true
  const first = members.tasteStored(room, p.id)
  const rereading = members.refreshTaste(room, p.id)
  assert.equal(members.tasteStored(room, p.id), first, 'the held copy ranks until the new one lands')
  assert.equal(await rereading, first); assert.equal(reads, 2)
  down = false; await members.refreshTaste(room, p.id); assert.equal(reads, 3)
  assert.notEqual(members.tasteStored(room, p.id), first)
  now += 599999; assert.ok(members.tasteStored(room, p.id))
  now += 1; assert.equal(members.tasteStored(room, p.id), null)
  refuse = true; await members.refreshTaste(room, p.id)
  assert.equal(members.tasteStored(room, p.id), null)
  await members.refreshTaste(room, p.id); assert.equal(reads, 4, 'refused grant is not asked again')
  p.memberGrant = { accessToken: 'renewed', expiresAt: 99999999 }; refuse = false
  await members.refreshTaste(room, p.id); assert.equal(reads, 5)
})
