import { test, eventually } from '../lib/harness';

test('create room: start page → Mood → room page', async ({ room }) => {
  const host = await room.person('Alp');
  await host.open('/');
  await host.see({ visible: ['landing'] });
  await host.audit('start page (first visit)');
  await host.tap(host.button('New room'), { expect: { visible: ['mood-page'] }, moment: 'newRoomMs' });
  await host.audit('Mood page');
  await host.fill(host.page.getByLabel('Mood'), 'funny space heist');
  await host.tap(host.button('Create room'), { expect: { visible: ['room-setup'] }, moment: 'createRoomMs' });
  await room.point('room');
  await host.audit('room page (host, before Start)');
  await eventually(() => host.latest?.ideas.map((i) => [i.text, i.on]), (v) => JSON.stringify(v) === JSON.stringify([['funny space heist', true]]), 'exactly one idea, on', host);
});
