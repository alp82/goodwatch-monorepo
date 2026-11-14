// Android budgets. Shape mirrors yepwatch-app/e2e/budgets.mjs (the web harness): when that file is present
// its shared `local` numbers win, so web and Android gate on the same targets. Android-only budgets sit in
// `native`. All timings are wall-clock from the input (touch frame, or host command for launches/links) to
// the first video frame that shows the settled target, +/- 17 ms (60 fps recording).
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const fallback = {
  local: { newRoomMs: 300, createRoomMs: 300, voteToPeerMs: 100, startToFirstCardMs: 200, startToPeerVotingMs: 200, frameMaxMs: 20, connectingMaxMs: 1000 },
  flashMaxMs: 250, deadButtonMs: 1000, minTargetPx: 48,
};
const native = {
  coldStartUsableMs: 1500, // am start (cold process) -> start page tiles settled
  inviteInstalledMs: 500, // invitation link, app installed and in background -> join page settled
  inviteColdMs: 1500, // invitation link, app not running -> join page settled
  relaunchToCardMs: 500, // app killed mid-vote, relaunched -> the card, beyond a cold start to the start page (JS up)
  frameMaxMs: 20, // dumpsys gfxinfo framestats: IntendedVsync -> FrameCompleted, per frame while voting
  minTargetDp: 48,
  backgroundMinutesGate: 0, // gate skips the long background; full uses backgroundMinutesFull
  backgroundMinutesFull: 3,
  allowIntermediatePlateaus: 1, // stable in-between screens per transition (a loading look) before it counts as a flash
};

let shared = fallback;
// Timings are targets (reported); a timing fails only past HERMETIC_FACTOR x its target (web budgets.mjs `ceilings`).
let hermeticFactor = 3;
const webBudgets = fileURLToPath(new URL('../budgets.mjs', import.meta.url));
if (fs.existsSync(webBudgets)) ({ budgets: shared, HERMETIC_FACTOR: hermeticFactor } = await import(webBudgets));
export const CEILING_FACTOR = hermeticFactor;

export const budgets = { ...shared, local: { ...fallback.local, ...shared.local }, native };
export function budgetsFor() { return { ...budgets, ...budgets.local, native }; }
