// A real browser participant controlled through visible UI, coordinated with the Android smoke.
const { chromium, expect } = require('@playwright/test');
const readline = require('node:readline');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({headless: true});
  const context = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion: 'reduce'});
  const page = await context.newPage();
  const errors = [];
  const frames = {shared: 0, activity: 0};
  page.on('pageerror', () => errors.push('JavaScript error'));
  page.on('websocket', socket => socket.on('framereceived', event => {
    try {
      const frame = JSON.parse(String(event.payload));
      if (frame.type === 'room.snapshot' || frame.type === 'room.updated') frames.shared++;
      if (frame.type === 'activity') frames.activity++;
    } catch {}
  }));
  const respond = value => process.stdout.write(JSON.stringify(value) + '\n');
  try {
    for await (const line of readline.createInterface({input: process.stdin, crlfDelay: Infinity})) {
      const command = JSON.parse(line);
      if (command.type === 'join') {
        const invite = new URL(command.invite);
        if (invite.origin !== 'http://127.0.0.1:8132' || !invite.pathname.startsWith('/r/')) throw Error('Unexpected invitation origin');
        await page.goto(invite.toString());
        await page.getByLabel('Your nickname').fill('BrowserFriend');
        await page.getByRole('button', {name: 'Join room', exact: true}).click();
        await page.getByRole('button', {name: 'Ready to watch', exact: true}).click();
        await expect(page.getByText('You’re ready. Waiting for the host.', {exact: true})).toBeVisible();
        respond({type: 'ready'});
      } else if (command.type === 'watch') {
        await page.getByRole('button', {name: 'Yep', exact: true}).click();
        await page.getByRole('button', {name: 'Inspect 1 matches', exact: true}).waitFor();
        respond({type: 'matched'});
      } else if (command.type === 'pick') {
        await page.getByRole('button', {name: 'Inspect 1 matches', exact: true}).click();
        await page.getByRole('button', {name: 'Pick this', exact: true}).click();
        await expect(page.getByText('Everyone picked it. Enjoy your watch.', {exact: true})).toBeVisible({timeout: 20000});
        await page.screenshot({path: path.join(__dirname, '../artifacts/native/mixed-browser-done.png')});
        respond({type: 'done', frames, errors});
      } else if (command.type === 'close') break;
    }
  } catch (error) {
    // Invitation/cookie/auth details never enter reports or terminal output.
    respond({type: 'failure', error: error.name});
    process.exitCode = 1;
  } finally { await browser.close(); }
})();
