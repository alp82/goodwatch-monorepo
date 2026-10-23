import { test, expect, type Page } from '@playwright/test';
import type { CommandEnvelope, RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import { continuousFixture } from '../continuous-fixture';
async function guest(
  page: Page,
  options: {
    multi?: boolean;
    missing?: boolean;
    lose?: boolean;
    loseReady?: boolean;
    failReady?: boolean;
    failRead?: boolean;
    changeContext?: boolean;
  } = {}
) {
  const room: RoomSnapshot = continuousFixture();
  room.own.canHost = false;
  room.shared.phase = 'setup';
  room.shared.participants[0].screenId = null;
  room.shared.participants[0].ready = false;
  if (options.multi)
    room.shared.screens.push({
      id: 'remote',
      label: 'Remote screen',
      country: 'FR',
      serviceIds: [9],
      confirmed: true,
    });
  if (options.missing) room.shared.screens[0].serviceIds = [];
  const commands: CommandEnvelope[] = [];
  const receipts = new Set<string>();
  let lost = false,
    reads = 0,
    writeFailed = false;
  await page.route('**/api/yepwatch/v1/proposal/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/realtime-ticket'))
      return route.fulfill({
        status: 501,
        json: {
          error: {
            code: 'not_implemented',
            message: 'No transport in isolated component fixture',
            retryable: false,
          },
        },
      });
    if (path.endsWith('/commands')) {
      const e = route.request().postDataJSON() as CommandEnvelope;
      commands.push(e);
      const c = e.command;
      if (options.failReady && c.type === 'ready' && !writeFailed) {
        writeFailed = true;
        return route.fulfill({
          status: 503,
          json: {
            error: {
              code: 'catalog_unavailable',
              message: 'Temporary entry write failure',
              retryable: false,
            },
          },
        });
      }
      if (!receipts.has(e.commandId)) {
        if (c.type === 'assign_screen') {
          if (c.expectedContextVersion !== room.shared.contextVersion)
            throw new Error('Stale assignment fence');
          room.shared.participants[0].screenId = c.screenId;
          room.shared.participants[0].ready = false;
          room.shared.rosterVersion++;
        } else if (c.type === 'ready') {
          if (c.expectedContextVersion !== room.shared.contextVersion)
            return route.fulfill({
              status: 409,
              json: {
                error: { code: 'conflict', message: 'Context changed', retryable: false },
                snapshot: room,
              },
            });
          room.shared.participants[0].ready = c.ready;
        } else throw new Error('Entry sent a non-readiness command');
        receipts.add(e.commandId);
        room.shared.revision++;
        room.own.nextSequence++;
      }
      if ((options.lose || (options.loseReady && c.type === 'ready')) && !lost) {
        lost = true;
        return route.abort();
      }
      return route.fulfill({ json: { receipt: {}, snapshot: room } });
    }
    reads++;
    if (options.failRead && reads === 2)
      return route.fulfill({
        status: 503,
        json: {
          error: {
            code: 'catalog_unavailable',
            message: 'Temporary read failure',
            retryable: true,
          },
        },
      });
    if (options.changeContext && reads === 2) {
      room.shared.contextVersion++;
      room.shared.screens[0].serviceIds = [337];
      room.shared.revision++;
    }
    return route.fulfill({ json: room });
  });
  await page.goto('/room/test-room');
  return { room, commands };
}
test('guests see one room selection without a screen picker or setup controls', async ({
  page,
}) => {
  const f = await guest(page);
  await page.getByText('Waiting for the host to start.', { exact: true }).waitFor();
  await expect(
    page.getByRole('button', { name: /Choose.*screen|Watch on|Ready to watch/ })
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Edit room description and services' })
  ).toHaveCount(0);
  expect(f.room.own.agreement.agreed).toBe(false);
});
test('missing actual services never produces assignment/readiness or another confirmation action', async ({
  page,
}) => {
  const f = await guest(page, { missing: true });
  await page.getByText('The host is setting up the room.', { exact: true }).waitFor();
  expect(f.commands).toHaveLength(0);
  await expect(page.getByRole('button', { name: 'Ready to watch', exact: true })).toHaveCount(0);
});
test('uncertain automatic assignment retries the exact envelope after reload, then automatically readies', async ({
  page,
}) => {
  const f = await guest(page, { lose: true });
  await page.getByRole('button', { name: 'Retry pending action', exact: true }).waitFor();
  const first = structuredClone(f.commands[0]);
  await page.reload();
  await page.getByRole('button', { name: 'Retry pending action', exact: true }).click();
  await page.getByText('Waiting for the host to start.', { exact: true }).waitFor();
  await expect.poll(() => f.commands.length).toBe(3);
  expect(f.commands[1]).toEqual(first);
  expect(f.commands.map((e) => e.command.type)).toEqual([
    'assign_screen',
    'assign_screen',
    'ready',
  ]);
  await expect(page.getByRole('button', { name: 'Ready to watch', exact: true })).toHaveCount(0);
  expect(f.room.own.agreement.agreed).toBe(false);
});
test('failed entry refresh has bounded recovery through Retry connection without a Ready action', async ({
  page,
}) => {
  const f = await guest(page, { failRead: true });
  await page.getByRole('button', { name: 'Retry connection', exact: true }).waitFor();
  expect(f.commands).toHaveLength(0);
  await page.getByRole('button', { name: 'Retry connection', exact: true }).click();
  await page.getByText('Waiting for the host to start.', { exact: true }).waitFor();
  await expect.poll(() => f.commands.length).toBe(2);
  expect(f.commands.map((e) => e.command.type)).toEqual(['assign_screen', 'ready']);
  await expect(page.getByRole('button', { name: 'Ready to watch', exact: true })).toHaveCount(0);
});
test('fresh context is used for automatic entry; later roster/context resets re-ready once with current fences', async ({
  page,
}) => {
  const f = await guest(page, { changeContext: true });
  await page.getByText('Waiting for the host to start.', { exact: true }).waitFor();
  await expect.poll(() => f.commands.length).toBe(2);
  expect(f.commands[0].command).toEqual({
    type: 'assign_screen',
    expectedContextVersion: 2,
    screenId: 'tv',
  });
  f.room.shared.contextVersion++;
  f.room.shared.rosterVersion++;
  f.room.shared.revision++;
  f.room.shared.participants[0].ready = false;
  await page.getByRole('button', { name: 'Refresh room', exact: true }).click();
  await expect.poll(() => f.commands.length).toBe(3);
  await page.getByText('Waiting for the host to start.', { exact: true }).waitFor();
  expect(f.commands[2].command).toEqual({ type: 'ready', expectedContextVersion: 3, ready: true });
  await page.getByRole('button', { name: 'Refresh room', exact: true }).click();
  await page.waitForTimeout(200);
  expect(f.commands).toHaveLength(3);
});

test('lost ready response retries its exact envelope without another confirmation and clears recovery feedback', async ({
  page,
}) => {
  const f = await guest(page, { loseReady: true });
  await page.getByRole('button', { name: 'Retry pending action', exact: true }).waitFor();
  const ready = structuredClone(f.commands[1]);
  await page.getByRole('button', { name: 'Retry pending action', exact: true }).click();
  await page.getByText('Waiting for the host to start.', { exact: true }).waitFor();
  await expect.poll(() => f.commands.length).toBe(3);
  expect(f.commands[2]).toEqual(ready);
  await expect(page.getByRole('button', { name: 'Retry connection', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ready to watch', exact: true })).toHaveCount(0);
});
test('definitive failed ready write stops without loops and generic connection retry uses the unchanged sequence', async ({
  page,
}) => {
  const f = await guest(page, { failReady: true });
  await page.getByRole('button', { name: 'Retry connection', exact: true }).waitFor();
  const failed = structuredClone(f.commands[1]);
  await page.waitForTimeout(250);
  expect(f.commands).toHaveLength(2);
  await page.getByRole('button', { name: 'Retry connection', exact: true }).click();
  await page.getByText('Waiting for the host to start.', { exact: true }).waitFor();
  await expect.poll(() => f.commands.length).toBe(3);
  expect(f.commands[2].sequence).toBe(failed.sequence);
  expect(f.commands[2].command).toEqual(failed.command);
  expect(f.room.own.agreement.agreed).toBe(false);
});
