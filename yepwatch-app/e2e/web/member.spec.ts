import { randomBytes } from 'node:crypto';
import { test, expect, eventually, issuer } from '../lib/harness';
import { inviteLink, join, readyHost } from './flows';

const account = (who: string) => `member-${who}-${randomBytes(3).toString('hex')}`;

test.describe('GoodWatch sign-in (local fake issuer)', () => {
  test('sign in from the start page, room gets GoodWatch services, Profile, Log out', async ({ room }) => {
    const user = account('Alp');
    const host = await room.person('Alp', { member: user });
    await host.open('/');
    await host.see({ visible: ['landing'] });
    // One full-page round trip through GoodWatch, back to the same screen.
    await host.roundTrip(host.button('Continue with GoodWatch').first());
    await host.see({ visible: ['avatar-goodwatch-mark'] }, 15000, 'signed in: GoodWatch mark on the avatar');
    await expect(host.page.getByRole('button', { name: 'Continue with GoodWatch' })).toHaveCount(0);
    await host.audit('start page (member)');
    // A new room links to the account and brings the GoodWatch services.
    await host.tap(host.button('New room'), { expect: { visible: ['mood-page'] }, moment: 'newRoomMs' });
    await host.fill(host.page.getByLabel('Mood'), 'heist');
    await host.tap(host.button('Create room'), { expect: { visible: ['room-setup'] }, moment: 'createRoomMs' });
    await expect(host.button(/^Netflix, Disney\+.*, change$/)).toBeVisible({ timeout: 10000 });
    await host.tap(host.button('Profile'), { expect: { visible: ['profile-panel'] } });
    await host.audit('Profile (member)');
    await expect(host.testId('profile-panel').getByText('Signed in with GoodWatch')).toBeVisible();
    await host.tap(host.button('Log out'), { expect: { text: 'Continue with GoodWatch' } });
    await host.tap(host.button('Close').last(), { expect: { hidden: ['profile-panel'] } });
    // The linked room keeps its GoodWatch services after logging out.
    await expect(host.button(/^Netflix, Disney\+.*, change$/)).toBeVisible();
  });

  test('lapsed session: Reconnect GoodWatch on the start page and in Profile', async ({ room }) => {
    const user = account('Lee');
    const p = await room.person('Lee', { member: user });
    // Short GoodWatch access tokens: the server has to renew, and renewal is what lapses.
    await issuer(`/_e2e/user?user=${encodeURIComponent(user)}`, { accessTtlS: 2 });
    await p.open('/');
    // The signed-in start page reads its rooms once; the session lapses after that read, not during it
    // (a lapse mid-read is answered 403 by design, which this journey isn't about).
    const home = p.page.waitForResponse((r) => r.url().endsWith('/api/yepwatch/v1/proposal/account/home'), { timeout: 15000 });
    await p.roundTrip(p.button('Continue with GoodWatch').first());
    await p.see({ visible: ['avatar-goodwatch-mark'] }, 15000, 'signed in');
    await home;
    await issuer(`/_e2e/lapse?user=${encodeURIComponent(user)}`);
    await p.page.waitForTimeout(2500);
    await p.reload();
    await p.settle();
    await p.see({ visible: ['start-reconnect'] }, 15000, 'start page offers Reconnect GoodWatch');
    await p.audit('start page (lapsed member)');
    await p.tap(p.button('Profile'), { expect: { visible: ['profile-panel', 'profile-lapsed'] } });
    await p.audit('Profile (lapsed)');
    await expect(p.testId('profile-panel').getByText('GoodWatch needs a quick reconnect')).toBeVisible();
    await issuer(`/_e2e/restore?user=${encodeURIComponent(user)}`);
    await p.roundTrip(p.testId('profile-panel').getByRole('button', { name: 'Reconnect GoodWatch' }));
    await p.see({ visible: ['avatar-goodwatch-mark'], hidden: ['start-reconnect'] }, 15000, 'reconnected');
  });

  test('member joins by invitation: "Join as <name>"', async ({ room }) => {
    const host = await readyHost(room);
    const invite = await inviteLink(host);
    const user = account('Mia');
    const mia = await room.person('Mia', { member: user });
    await issuer(`/_e2e/user?user=${encodeURIComponent(user)}`, { displayName: 'Mia' });
    await mia.open('/');
    await mia.roundTrip(mia.button('Continue with GoodWatch').first());
    await mia.see({ visible: ['avatar-goodwatch-mark'] }, 15000, 'signed in');
    await mia.open(invite, { settle: false });
    await mia.see({ visible: ['join-screen', 'invite-head'] });
    await mia.audit('join page (member)');
    await mia.tap(mia.button('Join as Mia'), { expect: { any: ['waiting', 'services-sheet'] } });
    await eventually(() => host.latest?.participants.map((p) => p.nickname).sort(), (v) => JSON.stringify(v) === JSON.stringify(['Alp', 'Mia']), 'host sees Mia (name from GoodWatch)', host);
    void join;
  });
});
