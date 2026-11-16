// Journey building blocks shared by the gate/full scenarios and the mixed-room driver.
import { clearApp } from './device.mjs';
import { sleep } from './env.mjs';
import { measure } from './video.mjs';

export const INVITE_RE = /\/r\/([A-Z0-9]{4,12})\b/;
/** The start page: a first visit's (Start with you) or a set-up device's (New couch). */
export const START_RE = /^(Start with you|New couch)$/;

export async function freshStart(p) {
  p.forceStop(); clearApp(p.serial);
  const launch = p.launch();
  await p.find(START_RE, { timeout: 20000 });
  return launch;
}
/** Get to the start page without clearing data (relaunch if Back would leave the app). */
export async function toStart(p) {
  for (let i = 0; i < 3; i++) {
    if (await p.has(START_RE) && !(await p.has(/switch couch$/))) return;
    if (!p.foreground().includes('dev.yepwatch.e2e')) break;
    p.back(); await sleep(700);
  }
  p.launch(); await p.find(START_RE, { timeout: 20000 });
}
/** A first visit's setup: Start with you, the name (the IME action continues), Skip for now, back on the start page. */
export async function setUpDevice(p, name = 'Ann') {
  if (!(await p.has('Start with you'))) return;
  await p.tap('Start with you');
  await p.waitFor('first-run', { timeout: 8000 });
  await fillAndSubmit(p, 'Your name', name);
  await p.tap(/^(Skip for now|That’s enough)$/, { timeout: 15000 });
  await p.find('New couch', { timeout: 10000 });
}
/** Commit a text field the way a keyboard user does (IME action). */
export async function fillAndSubmit(p, sel, text) {
  await p.fill(sel, text); await sleep(100); p.key('KEYCODE_ENTER'); await sleep(250);
}
export async function pickNetflix(p) {
  await p.waitFor('services-sheet', { timeout: 10000 });
  const box = await p.find({ desc: 'Netflix', cls: 'android.widget.CheckBox' });
  if (!box.checked) await p.tapXY(box.cx, box.cy);
  await p.tap('Done');
  await p.waitGone('services-sheet', { timeout: 5000 });
}
/** The invitation code from the couch setup's Invite sheet (the QR code's name carries the link); the sheet closes. */
export async function inviteCode(p) {
  await p.tap('Invite friends, show QR code and link');
  await p.waitFor('invite-sheet', { timeout: 5000 });
  let code = null;
  for (const n of await p.nodes()) { const m = (n.text || n.desc).match(INVITE_RE); if (m) { code = m[1]; break; } }
  p.back(); await p.waitGone('invite-sheet', { timeout: 3000 });
  if (!code) throw new Error(`${p.name}: no invitation link in Invite`);
  return code;
}
/** Start page -> setup on a first visit -> New couch -> configured couch (your idea, Netflix). Returns the invitation code. */
export async function createRoom(p, { name = 'Ann', mood = 'cheer me up' } = {}) {
  await setUpDevice(p, name);
  await p.tap('New couch');
  await p.waitFor(/^Start( with \d+| on my own)$/, { timeout: 10000 });
  if (mood) await fillAndSubmit(p, 'Describe what you want to watch', mood);
  await p.tap(/^Settings/);
  await p.waitFor('room-sheet');
  await p.tap(/^Streaming services/);
  await pickNetflix(p);
  p.back();
  await p.waitGone('room-sheet');
  // A set-up device brings its name; the field shows only for a host without one.
  if (name && (await p.has('Your name'))) await fillAndSubmit(p, 'Your name', name);
  return inviteCode(p);
}
export async function joinFromJoinScreen(p, name) {
  await p.waitFor('join-screen', { timeout: 10000 });
  await fillAndSubmit(p, 'Your name', name); // the IME action joins
  if (!(await p.has('services-sheet')) && (await p.has('Join'))) await p.tap('Join');
  await pickNetflix(p);
  await p.waitFor(/^Waiting for /, { timeout: 10000 });
}
export const inviteUrl = code => `https://yepwatch.com/r/${code}`;

/** Wraps a measured tap: `adb input tap` lands down+up together; the anchor is the touch dot frame. */
export function tapAction(p, node) {
  return async () => { const hostMs = Date.now(); p.sh(`input tap ${node.cx} ${node.cy}`); return { anchor: 'touch', tap: { x: node.cx, y: node.cy }, hostMs }; };
}
export function hostAction(fn) { return async () => { const hostMs = Date.now(); await fn(); return { anchor: 'host', hostMs }; }; }
export const roiOf = (p, sel, timeout = 8000) => async () => (await p.waitFor(sel, { timeout })).bounds;
export { measure };

export async function posterTitle(p) {
  const n = (await p.nodes()).find(x => x.desc.endsWith('. Swipe or use the choice buttons.'));
  return n ? n.desc.replace('. Swipe or use the choice buttons.', '') : null;
}
