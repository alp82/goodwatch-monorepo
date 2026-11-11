import { test, expect, eventually } from '../lib/harness';
import { createRoom, inviteLink, join, readyHost, start } from './flows';

test.describe('rooms: leave, archive, history, back', () => {
  test('a friend leaves; the host sees one person fewer', async ({ room }) => {
    const host = await readyHost(room);
    const mia = await room.person('Mia');
    await join(mia, await inviteLink(host), 'Mia');
    await eventually(() => host.latest?.participants.length, (n) => n === 2, 'two people', host);
    await mia.tap(mia.button(/, switch room$/), { expect: { visible: ['rooms-sheet'] } });
    await mia.audit('Your rooms sheet (in a room)');
    await mia.tap(mia.button(/, Room page$/), { expect: { visible: ['room-sheet'] } });
    await mia.tap(mia.button('Leave room'), { expect: { visible: ['leave-confirm'] } });
    await mia.audit('Leave confirmation');
    await mia.tap(mia.button('Leave'), { expect: { hidden: ['room-sheet'] }, observers: [[host, { label: { text: 'Just you, people', exact: true } }, 'leaveToPeerMs']] });
    await mia.see({ any: ['landing', 'home-rooms'] }, 10000, 'start page after leaving');

  });

  test('archive a room, restore it from History @core', async ({ room }) => {
    const host = await room.person('Alp');
    await createRoom(host, 'cosy family night');
    await room.point('room');
    await host.tap(host.button('Room'), { expect: { visible: ['room-sheet'] } });
    await host.tap(host.button('Archive room'), { expect: { visible: ['home-rooms'] } });
    await host.audit('start page (returning, after archive)');
    await host.tap(host.button('History'), { expect: { visible: ['history-panel'] } });
    await host.audit('History sheet');
    await expect(host.testId('history-panel').getByText('cosy family night')).toBeVisible();
    await host.tap(host.testId('history-panel').getByRole('button', { name: 'Restore' }).first(), { expect: { text: 'cosy family night' } });
    await host.tap(host.button('Close').last(), { expect: { hidden: ['history-panel'] } });
    // Exactly one copy of the restored room on the start page.
    await host.see({ label: { text: 'cosy family night', exact: true } }, 10000, 'restored room back on the start page');
    expect(await host.page.getByRole('button', { name: 'cosy family night', exact: true }).filter({ visible: true }).count()).toBe(1);
  });

  test('archive from the start page card', async ({ room }) => {
    const host = await room.person('Alp');
    await createRoom(host, 'twist ending');
    await host.open('/');
    await host.see({ visible: ['home-rooms'] });
    await host.tap(host.button('Archive twist ending'), { expect: {} });
    await eventually(async () => host.page.getByRole('button', { name: 'twist ending', exact: true }).filter({ visible: true }).count(), (n) => n === 0, 'archived room leaves the start page', host);
  });

  test('Back: sheets close first, then the room goes back to the start page', async ({ room }) => {
    const host = await readyHost(room);
    // With a sheet open the header is inert (modal sheet: no focus or screen reader behind it); a tap on it,
    // where Back is included, closes the sheet only.
    await host.tap(host.button('Room'), { expect: { visible: ['room-sheet'] } });
    await expect(host.button('Back')).toHaveCount(0);
    await host.tap(host.testId('header-shade'), { expect: { hidden: ['room-sheet'], visible: ['room-setup'] } });
    // Browser Back with a sheet open closes the sheet only.
    await host.tap(host.button('Just you, people'), { expect: { visible: ['people-sheet'] } });
    await host.back();
    await host.see({ hidden: ['people-sheet'], visible: ['room-setup'] }, 5000, 'browser Back closes the People sheet first');
    // Escape closes a sheet on desktop web.
    await host.tap(host.button('Room'), { expect: { visible: ['room-sheet'] } });
    await host.page.keyboard.press('Escape');
    await host.see({ hidden: ['room-sheet'] }, 3000, 'Escape closes the Room sheet');
    // Back from the room goes to the start page with the room listed.
    await host.tap(host.button('Back'), { expect: { visible: ['home-rooms'] } });
    await host.tap(host.button('funny space heist'), { expect: { visible: ['room-setup'] } });
  });

  test('two rooms: switch between them from the header pill', async ({ room }) => {
    const host = await readyHost(room, 'Alp', 'heist night');
    await start(host, []);
    await host.tap(host.button(/, switch room$/), { expect: { visible: ['rooms-sheet'] } });
    await host.tap(host.button('New room').last(), { expect: { visible: ['mood-page'] }, moment: 'newRoomMs' });
    await host.fill(host.page.getByLabel('Mood'), 'western');
    await host.tap(host.button('Create room'), { expect: { visible: ['room-setup'] }, moment: 'createRoomMs' });
    await host.tap(host.button(/, switch room$/), { expect: { visible: ['rooms-sheet'] } });
    await host.audit('Your rooms sheet (two rooms)');
    const other = host.testId('rooms-sheet').getByRole('button', { name: /^heist night/ }).first();
    if (!(await other.isVisible())) host.journeyFailure(`the other room is not listed in Your rooms: ${await host.testId('rooms-sheet').ariaSnapshot()}`);
    await host.tap(other, { expect: { visible: ['voting', 'poster'] } });
  });
});
