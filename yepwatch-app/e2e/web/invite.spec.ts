import { test, expect, eventually, ORIGIN } from '../lib/harness';
import { inviteLink, join, pickServices, readyHost } from './flows';

test.describe('invite and join', () => {
  test('public invite preview: link-preview tags and card image', async ({ room }) => {
    const host = await readyHost(room);
    const invite = await inviteLink(host);
    const code = new URL(invite).pathname.split('/').pop()!;
    const html = await (await fetch(invite)).text();
    expect(html, 'invite page carries og tags for this code').toContain(`/invites/${code}/card.png`);
    expect(html).toContain('<title>Join my YepWatch room</title>');
    const card = await fetch(`${ORIGIN}/api/yepwatch/v1/proposal/invites/${code}/card.png`);
    expect(card.status, 'invite card renders').toBe(200);
    expect(card.headers.get('content-type')).toContain('image/png');
    const preview = await fetch(`${ORIGIN}/api/yepwatch/v1/proposal/invites/preview`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN }, body: JSON.stringify({ code }) });
    expect(preview.status, 'invite preview answers').toBe(200);
    const body = await preview.json();
    expect(body.hostName).toBe('Alp');
    expect(body.ideas.map((i: { text: string }) => i.text)).toEqual(['funny space heist']);
  });

  test('join from a fresh browser via the invite link @core', async ({ room }) => {
    const host = await readyHost(room);
    const invite = await inviteLink(host);
    const mia = await room.person('Mia');
    await mia.open(invite, { settle: false });
    const shown = await mia.firstShown(['join-screen', 'invite-head']);
    if (shown.at) mia.record('inviteOpenMs', shown.at - shown.origin, 'navigation start → join page with host and mood');
    await expect(mia.page.getByText('funny space heist').first()).toBeVisible();
    await mia.audit('join page (invitation)');
    await mia.fill(mia.page.getByLabel('Your name').filter({ visible: true }), 'Mia');
    await mia.tap(mia.button('Join'), { expect: { visible: ['services-sheet'] }, observers: [[host, { label: { text: '^2 people, people$' } }, 'joinToPeerMs']] });
    await room.point('room');
    await pickServices(mia, ['Disney+']);
    await mia.see({ visible: ['waiting'] });
    await mia.audit('friend waiting for the host');
    await expect(mia.page.getByText('Waiting for Alp to start', { exact: true })).toBeVisible();
    await eventually(() => host.latest?.participants.length, (n) => n === 2, 'exactly two people (no duplicate join)', host);
  });

  test('join by code from the start page', async ({ room }) => {
    const host = await readyHost(room);
    const code = new URL(await inviteLink(host)).pathname.split('/').pop()!;
    const sam = await room.person('Sam', { locale: 'en-US' });
    await sam.open('/');
    await sam.tap(sam.button('Join a room'), { expect: { visible: ['join-screen'] } });
    await sam.audit('join page (by code)');
    await sam.fill(sam.page.getByLabel('Room code or invitation'), code);
    await sam.fill(sam.page.getByLabel('Your name').filter({ visible: true }), 'Sam');
    await sam.tap(sam.button('Join'), { expect: { visible: ['services-sheet'] } });
    await pickServices(sam, ['HBO Max']);
    await sam.see({ visible: ['waiting'] });
    await eventually(() => host.latest?.participants.length, (n) => n === 2, 'exactly two people', host);
  });

  test('a friend suggests an idea: it arrives on, NEW for the host', async ({ room }) => {
    const host = await readyHost(room);
    const mia = await room.person('Mia');
    await join(mia, await inviteLink(host), 'Mia');
    await room.point('room');
    await mia.tap(mia.button('Suggest an idea'), { expect: { visible: ['mood-page'] } });
    await mia.fill(mia.page.getByLabel('Mood'), 'space adventure');
    await mia.tap(mia.page.getByLabel('Mood'), { key: 'Enter', expect: { visible: ['waiting'] }, observers: [[host, { label: { text: 'Use space adventure', exact: true } }, 'ideaToPeerMs']] });
    await expect(host.page.getByText('NEW', { exact: true })).toBeVisible();
    await expect(host.page.getByRole('switch', { name: 'Use space adventure' }).filter({ visible: true })).toHaveAttribute('aria-checked', 'true');
    await expect(mia.page.getByRole('switch', { name: 'Use space adventure' }).filter({ visible: true })).toBeDisabled();
    await eventually(() => host.latest?.ideas.length, (n) => n === 2, 'exactly two ideas', host);
  });
});
