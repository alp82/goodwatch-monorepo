import { test, expect, eventually, ORIGIN } from '../lib/harness';
import { inviteLink, join, pickServices, readyHost, recordPage } from './flows';

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

  // Like a slow create (create-room.spec.ts): two joins in a row outlast the app's 6 s wait. The join page
  // keeps sending the same saved request (same command id and secret) and lets the friend in by itself.
  test('a slow server: the join goes again by itself and the friend gets in without a tap', async ({ room }) => {
    const host = await readyHost(room);
    const invite = await inviteLink(host);
    const mia = await room.person('Mia');
    const answers: { participantId?: string; status: number }[] = [];
    let first = 0;
    let answered = 0;
    await mia.page.route(/\/api\/yepwatch\/v1\/proposal\/rooms\/[^/]+\/join$/, async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      const n = answers.length + 1;
      if (n === 1) first = Date.now();
      // The server gets every try (and seats Mia on the first); the first two answers come after 7 s.
      const context = mia.page.context();
      const before = new Set((await context.cookies()).map((c) => c.name));
      const response = await route.fetch();
      answers.push({ status: response.status(), participantId: (await response.json().catch(() => null))?.credential?.participantId });
      if (n <= 2) {
        // An answer that never arrives sets no room cookie: drop what route.fetch put in the browser's jar.
        for (const c of await context.cookies()) if (!before.has(c.name)) await context.clearCookies({ name: c.name });
        await new Promise((r) => setTimeout(r, 7000));
      } else answered = Date.now();
      await route.fulfill({ response }).catch(() => undefined); // the app stopped waiting for the slow ones
    });
    await mia.open(invite, { settle: false });
    await mia.see({ visible: ['join-screen', 'invite-head'] }, 15000, 'invitation join page');
    await mia.fill(mia.page.getByLabel('Your name').filter({ visible: true }), 'Mia');
    const stop = await recordPage(mia, 'join-screen', /Couldn|Try again|Retry joining|offline/i);
    await mia.tap(mia.button('Join'), { expect: {} });
    // Q24a: quiet at first, then one small floating line; never "Couldn't reach" or Retry joining.
    await expect(mia.page.getByTestId('room-note').filter({ visible: true })).toHaveText('Reconnecting…', { timeout: 12000 });
    await mia.see({ visible: ['services-sheet'] }, 30000, 'the friend gets in by itself');
    const samples = await stop().catch(() => null);
    room.noteOutage(first, answered);
    expect(samples, 'the join page was sampled').not.toBeNull();
    const firstNote = samples!.find((s) => s.note)?.t ?? Infinity;
    expect(firstNote - first, 'quiet for the first 3 s of the outage').toBeGreaterThanOrEqual(3000);
    expect(samples!.some((s) => s.t < first + 3000 && s.t > first), 'sampled during the quiet period').toBe(true);
    expect(samples!.filter((s) => s.error), 'no error or Retry joining meanwhile').toEqual([]);
    expect(answers.length).toBe(3);
    expect(answers.every((a) => a.status === 200)).toBe(true);
    expect(new Set(answers.map((a) => a.participantId)).size, 'every resend is the same seat').toBe(1);
    expect(mia.own?.participantId).toBe(answers[0].participantId);
    await pickServices(mia, ['Disney+']);
    await mia.see({ visible: ['waiting'] });
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
