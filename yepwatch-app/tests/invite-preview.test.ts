import test from 'node:test';
import assert from 'node:assert/strict';
import { ContinuousApi, RoomFailure } from '../src/core/continuous/api-client';
import { invitePreviewSchema } from '../src/core/continuous/wire';

const preview = {
  roomId: 'r'.repeat(32), hostName: 'Alp', ideas: [{text: 'A cosy mystery'}],
  kinds: ['movie', 'show_start'], phase: 'setup', people: 2,
};

test('invite preview schema accepts the public contract and rejects extra private fields and invalid values', () => {
  assert.deepEqual(invitePreviewSchema.parse(preview), preview);
  assert.ok(invitePreviewSchema.safeParse({...preview, hostName: null, ideas: [], phase: 'decided'}).success);
  for (const invalid of [
    {...preview, participantIds: ['private']}, {...preview, services: []},
    {...preview, votes: []}, {...preview, proposal: null}, {...preview, candidates: []},
    {...preview, ideas: [{text: 'A cosy mystery', authorId: 'private'}]},
    {...preview, ideas: [{text: 'A cosy mystery', on: true}]},
    {...preview, phase: 'expired'}, {...preview, kinds: ['tv']},
    {...preview, people: -1}, {...preview, people: 1.5}, {...preview, people: '2'},
    {...preview, roomId: ''}, {...preview, hostName: 1}, {...preview, ideas: [{}]},
    {roomId: preview.roomId},
  ]) assert.equal(invitePreviewSchema.safeParse(invalid).success, false);
});

test('invitePreview posts code publicly and validates the response before returning it', async () => {
  const api = new ContinuousApi(async (url, init) => {
    assert.match(String(url), /\/api\/yepwatch\/v1\/proposal\/invites\/preview$/);
    assert.equal(init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(init?.body)), {code: 'ABC234'});
    assert.equal(new Headers(init?.headers).get('Authorization'), null);
    return Response.json(preview);
  });
  assert.deepEqual(await api.invitePreview('ABC234'), preview);
  await assert.rejects(new ContinuousApi(async () => Response.json({...preview, votes: []})).invitePreview('ABC234'));
  await assert.rejects(new ContinuousApi(async () => Response.json({error: {code: 'not_found', message: 'Invite unavailable'}}, {status: 404})).invitePreview('ABC234'),
    e => e instanceof RoomFailure && e.code === 'not_found');
});
