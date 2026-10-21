import { test, expect } from '@playwright/test';
import { fixtureSnapshot } from '../../src/dev/fixtures';

for (const legacyVeto of [false, true]) {
  test(`No and Watch preserve pass/undo/completion semantics${legacyVeto ? ' with a historical veto' : ''}`, async ({ page }) => {
    const snapshot = fixtureSnapshot(); snapshot.shared.constraints.kinds = ['movie', 'show_start']; snapshot.shared.candidates = snapshot.shared.candidates.slice(0, 2);
    snapshot.shared.phase = 'voting'; snapshot.shared.round = { version: 1, rosterVersion: 1, contextVersion: 1, candidateCount: 2, completed: false };
    snapshot.shared.participants = [snapshot.shared.participants[0]];
    if (legacyVeto) snapshot.own.votes = [{ candidateId: snapshot.shared.candidates[0].id, value: 'veto', revision: 4 }];
    const commands: { type: string; value?: string | null; expectedVoteRevision?: number }[] = [];
    const cors = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8097', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
    await page.addInitScript(a => sessionStorage.setItem('yepwatch.room.fixture-room', JSON.stringify(a)), { roomId: 'fixture-room', participantId: 'you', token: '', expiresAt: snapshot.shared.expiresAt });
    await page.route('**/api/yepwatch/v1/**', async route => {
      const req = route.request(); if (req.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: cors }); return; }
      const path = new URL(req.url()).pathname;
      if (path.endsWith('/realtime-ticket')) { await route.fulfill({ status: 501, headers: cors, json: { error: { code: 'not_implemented', message: 'Isolated fixture', retryable: false } } }); return; }
      let result: unknown = snapshot;
      if (path.endsWith('/commands')) {
        const body = req.postDataJSON(); const c = body.command; commands.push(c);
        if (c.type === 'vote') {
          const old = snapshot.own.votes.find(v => v.candidateId === c.candidateId);
          expect(c.expectedVoteRevision).toBe(old?.revision ?? 0);
          snapshot.own.votes = [...snapshot.own.votes.filter(v => v.candidateId !== c.candidateId), { candidateId: c.candidateId, value: c.value, revision: (old?.revision ?? 0) + 1 }];
          snapshot.shared.participants[0].completedCount = snapshot.own.votes.filter(v => v.value !== null).length;
        } else if (c.type === 'complete_round') {
          snapshot.own.roundCompleted = true; snapshot.shared.phase = 'shortlist'; snapshot.shared.round!.completed = true;
          snapshot.shared.shortlist = { version: 1, proposalVersion: 1, candidateIds: [], proposedCandidateId: null, consentCount: 0 };
        }
        snapshot.shared.revision++; snapshot.own.nextSequence++;
        result = { receipt: { commandId: body.commandId, sequence: body.sequence, appliedRevision: snapshot.shared.revision, replayed: false }, snapshot };
      }
      await route.fulfill({ headers: cors, json: result });
    });
    await page.goto('/room/fixture-room');
    const no = page.getByRole('button', { name: 'No', exact: true }); const watch = page.getByRole('button', { name: 'Watch', exact: true });
    await expect(no).toBeVisible(); await expect(watch).toBeVisible(); await expect(page.getByRole('progressbar')).toHaveCount(0);
    await expect(page.getByText(/Your round ·|\b0\/2\b|\b1\/2\b|Not okay tonight|room veto|short round/)).toHaveCount(0);
    if (legacyVeto) {
      await page.getByRole('button', { name: 'Undo my last choice' }).click();
      await expect.poll(() => commands.length).toBe(1); expect(commands[0]).toMatchObject({ value: null, expectedVoteRevision: 4 });
    }
    await no.click(); await expect.poll(() => commands.length).toBe(legacyVeto ? 2 : 1); expect(commands.at(-1)?.value).toBe('pass');
    await expect(page.getByText('Your shared shortlist', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo my last choice' }).click(); await expect.poll(() => commands.at(-1)?.value).toBe(null);
    await watch.click(); await expect.poll(() => commands.at(-1)?.value).toBe('watch');
    // Chromium touch events exercise the same RN PanResponder used by native left swipe.
    await expect(page.getByText('An Evening Somewhere', { exact: true })).toBeVisible();
    const title = page.getByText('An Evening Somewhere', { exact: true }); await title.scrollIntoViewIfNeeded(); const box = (await title.boundingBox())!;
    const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    const y = box.y + box.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 290, y }] });
    for (const x of [260, 220, 170, 100]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => commands.at(-1)?.value).toBe('pass');
    await expect(page.getByRole('button', { name: 'Finish my round' })).toBeVisible();
    await expect(page.getByText('Your shared shortlist', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: `artifacts/binary-voting-${legacyVeto ? 'legacy' : 'finish'}-fixture.png`, fullPage: true });
    await page.getByRole('button', { name: 'Finish my round' }).click(); await expect(page.getByText('Your shared shortlist', { exact: true })).toBeVisible();
    expect(commands.every(c => c.value !== 'veto')).toBe(true);
  });
}
