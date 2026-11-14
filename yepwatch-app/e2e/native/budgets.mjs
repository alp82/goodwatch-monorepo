// Android numbers. Timings are targets: a run reports them and never fails on them (owner 2026-11-14: speed is an
// occasional check on the owner's machine). Moments shared with the web come from ../budgets.mjs. All timings are
// wall-clock from the input (touch frame, or host command for launches/links) to the first video frame that shows
// the settled target, +/- 17 ms (60 fps recording).
import { targets } from '../budgets.mjs';

export const budgets = {
  ...targets,
  native: {
    coldStartUsableMs: 1500, // am start (cold process) -> start page tiles settled
    inviteInstalledMs: 500, // invitation link, app installed and in background -> join page settled
    inviteColdMs: 1500, // invitation link, app not running -> join page settled
    relaunchToCardMs: 500, // app killed mid-vote, relaunched -> the card, beyond a cold start to the start page (JS up)
    frameMaxMs: 20, // dumpsys gfxinfo framestats: IntendedVsync -> FrameCompleted, per frame while voting
    minTargetDp: 48,
    backgroundMinutesFull: 3,
  },
};
