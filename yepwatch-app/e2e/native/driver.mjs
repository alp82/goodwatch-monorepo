// Driver API for other harnesses (the web/Playwright fixtures): Android phones as room peers.
//
//   import { openAndroid } from '../native/driver.mjs';
//   const [phone] = await openAndroid({ count: 1 });           // boots/reuses emulators, installs the APK
//   const code = await phone.createRoom({ name: 'Ann' });      // or: await phone.join(inviteUrl, 'Bob')
//   await phone.start(); await phone.yep(); await phone.agree(); await phone.waitTonight();
//   await phone.close();
// Every verb waits for its visible result and throws with the on-screen labels when it can't finish.
import { ensureApk } from './lib/build.mjs';
import { boot, install, reverse } from './lib/device.mjs';
import { createRoom, freshStart, inviteCode, joinFromJoinScreen, posterTitle } from './lib/journey.mjs';
import { Phone } from './lib/phone.mjs';
import { resolveStack, stackPorts } from './lib/stack.mjs';

export class AndroidPeer {
  constructor(phone) { this.phone = phone; }
  async reset() { await freshStart(this.phone); }
  async createRoom(opts) { await this.reset(); return createRoom(this.phone, opts); }
  async join(url, name = 'Droid') { this.phone.home(); this.phone.openLink(url); await joinFromJoinScreen(this.phone, name); }
  inviteCode() { return inviteCode(this.phone); }
  async start() { await this.phone.tap('Start'); await this.phone.waitFor('poster', { timeout: 10000 }); }
  async waitVoting() { await this.phone.waitFor('poster', { timeout: 15000 }); }
  async yep() { await this.phone.tap('Yep'); }
  async nope() { await this.phone.tap('Nope'); }
  card() { return posterTitle(this.phone); }
  async openMatches() { await this.phone.tap(/^\d+ match(es)?$/); await this.phone.waitFor('matches'); }
  async propose() { await this.phone.tap('Propose this'); }
  async agree() { await this.phone.tap('Agree', { timeout: 8000 }); }
  async waitTonight() { await this.phone.waitFor('tonight-poster', { timeout: 15000 }); }
  screenshot(file) { return this.phone.screenshot(file); }
  close() { this.phone.close(); }
}

export async function openAndroid({ count = 1, stack = resolveStack() } = {}) {
  const apk = await ensureApk(stack);
  const devs = await boot(count);
  const out = [];
  for (const [i, d] of devs.entries()) {
    reverse(d.serial, stackPorts(stack)); install(d.serial, apk.apk);
    out.push(new AndroidPeer(await new Phone(d.serial, i, `android${i}`).start()));
  }
  return out;
}
export { Phone };
