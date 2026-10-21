import { test, expect } from '@playwright/test';
import { fixtureSnapshot } from '../../src/dev/fixtures';
import type { RoomSnapshot } from '@goodwatch/yepwatch-contracts';

for (const role of ['host', 'completed host', 'guest'] as const) {
  test(`legacy continuation voting has explicit recovery for ${role}`, async ({ page }) => {
    let snapshot: RoomSnapshot = fixtureSnapshot(); snapshot.shared.phase = 'voting'; snapshot.shared.round = { version: 1, rosterVersion: 1, contextVersion: 1, candidateCount: 3, completed: false };
    snapshot.own.roundCompleted = role === 'completed host';
    if (role === 'guest') { snapshot.own.participantId = 'partner'; snapshot.own.canHost = false; }
    const commands: Record<string, unknown>[] = [];
    const cors = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8097', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
    await page.addInitScript(access => sessionStorage.setItem('yepwatch.room.fixture-room', JSON.stringify(access)), { roomId: 'fixture-room', participantId: snapshot.own.participantId, token: '', expiresAt: snapshot.shared.expiresAt });
    await page.route('**/api/yepwatch/v1/**', async route => {
      const request = route.request(); if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: cors }); return; }
      const path = new URL(request.url()).pathname;
      if (path.endsWith('/realtime-ticket')) { await route.fulfill({ status: 501, headers: cors, json: { error: { code: 'not_implemented', message: 'No fixture transport', retryable: false } } }); return; }
      if (path.endsWith('/commands')) {
        const body = request.postDataJSON(); commands.push(body.command);
        if (body.command.type === 'new_round') {
          expect(body.command.expectedRevision).toBe(1);
          snapshot = structuredClone(snapshot); snapshot.shared.phase = 'setup'; snapshot.shared.revision++; snapshot.shared.contextVersion++; snapshot.shared.rosterVersion++; snapshot.shared.round = null; snapshot.shared.candidates = [];
          snapshot.shared.participants.forEach(p => { p.ready = false; p.completedCount = 0; }); snapshot.own.roundCompleted = false; snapshot.own.votes = []; snapshot.own.nextSequence++;
        } else if (body.command.type === 'setup') { snapshot.shared.constraints = body.command.constraints; snapshot.shared.contextVersion++; snapshot.shared.revision++; snapshot.own.nextSequence++; }
        else { await route.fulfill({ status: 403, headers: cors, json: { error: { code: 'member_required', message: 'Saved progress required', retryable: false } } }); return; }
        await route.fulfill({ headers: cors, json: { snapshot } }); return;
      }
      await route.fulfill({ headers: cors, json: snapshot });
    });
    await page.goto('/room/fixture-room');
    await expect(page.getByText('This round needs saved progress', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Watch|No|Finish my round|Undo my last choice/ })).toHaveCount(0);
    expect(commands).toEqual([]);
    if (role === 'host') await page.screenshot({ path: 'artifacts/legacy-host-recovery-mobile.png', fullPage: true });
    if (role === 'guest') {
      await expect(page.getByText('Ask the host to return to setup', { exact: false })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Return to setup', exact: true })).toHaveCount(0);
    } else {
      await page.getByRole('button', { name: 'Return to setup', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Use movies & new shows', exact: true })).toBeVisible();
      expect(commands).toEqual([{ type: 'new_round', expectedRevision: 1 }]);
      await page.getByRole('button', { name: 'Use movies & new shows', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Start a round', exact: true })).toBeVisible();
      expect(commands[1].type).toBe('setup'); expect((commands[1].constraints as { kinds: string[] }).kinds).toEqual(['movie', 'show_start']);
    }
  });
}
