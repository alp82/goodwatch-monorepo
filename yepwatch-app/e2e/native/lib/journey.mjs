// Journey building blocks shared by the gate/full scenarios and the mixed-room driver.
import { clearApp } from './device.mjs';
import { sleep } from './env.mjs';
import { measure } from './video.mjs';

export const INVITE_RE = /\/r\/([A-Z0-9]{4,12})\b/;

export async function freshStart(p) {
  p.forceStop(); clearApp(p.serial);
  const launch = p.launch();
  await p.find('New room', { timeout: 20000 });
  return launch;
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
export async function inviteCode(p) {
  for (const n of await p.nodes()) { const m = (n.text || n.desc).match(INVITE_RE); if (m) return m[1]; }
  throw new Error(`${p.name}: no invitation link on screen`);
}
/** Start page -> configured room (mood, Netflix, name). Returns the invitation code. */
export async function createRoom(p, { name = 'Ann', mood = 'cheer me up' } = {}) {
  await p.tap('New room');
  await p.tap(mood, { timeout: 8000 });
  await p.tap('Create room', { timeout: 8000 });
  await p.waitFor('Start', { timeout: 10000 });
  await p.tap(/^Streaming services/);
  await pickNetflix(p);
  if (name) await fillAndSubmit(p, 'Your name', name);
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
