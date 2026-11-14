// Every E2E number in one place. Timing moments are p95 over the samples a run collects, measured page-side
// from the input event (or navigation start) to the first animation frame that shows the expected state.
//
// Two kinds of timing number (owner 2026-11-14: "just enough to be confident that everything does not break"):
//   - `local` / `production` below are TARGETS: the UX we aim for. Every run reports them; none fails on them.
//   - `ceilings` are the GATES: coarse limits that only real breakage crosses. Hermetic runs (local stack, CI)
//     gate on 3x the local target of every moment; the production smoke gates on four moments only.
// Frame pacing (frameMaxMs) is a target too, never a gate: `node run.mjs frames` measures it on demand (README).
// `local` applies to the loopback stack; `production` to e2e:smoke against a real origin under fast-4G
// throttling (~9 Mbps, +60 ms RTT, see `network.production`).
export const budgets = {
  local: {
    tapFeedbackMs: 50, // any input → first visible change
    createRoomMs: 300, // Create room on Mood → the room page shows
    newRoomMs: 300, // New room on the start page → the Mood page shows
    inviteOpenMs: 800, // invite link in a fresh browser → the room's join page (host + mood) shows
    voteToPeerMs: 100, // a vote on one phone → its effect shows on another phone
    ideaToPeerMs: 100, // a friend's idea → shows on the host's room page
    startToFirstCardMs: 200, // Start → first card (host)
    startToPeerVotingMs: 200, // Start → first card on a friend's phone
    swipeNextCardMs: 16, // Yep/Nope → next card, next frame
    relaunchToCardMs: 500, // reload / reopened tab mid-vote: the app's first frame → the card
    frameMaxMs: 20, // no animation frame longer than this while something animates
    restartQueuedLandMs: 1000, // server back → queued actions confirmed
    connectingMaxMs: 1000, // "Connecting…" visible at most this long
    connectionQuietMs: 3000, // an outage shows no connection words before this (owner rule Q24a)
    connectionWordsAfterMs: 1000, // and its one line is gone at most this long after the outage ends
  },
  production: {
    tapFeedbackMs: 50,
    createRoomMs: 500,
    newRoomMs: 500,
    inviteOpenMs: 1200,
    voteToPeerMs: 250,
    ideaToPeerMs: 250,
    startToFirstCardMs: 400,
    startToPeerVotingMs: 400,
    swipeNextCardMs: 16,
    relaunchToCardMs: 700,
    frameMaxMs: 20,
    restartQueuedLandMs: 1000,
    connectingMaxMs: 1500,
    connectionQuietMs: 3000,
    connectionWordsAfterMs: 1000,
  },
  network: {
    // Fast 4G for production smoke: CDP Network.emulateNetworkConditions.
    production: { latency: 60, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (9 * 1024 * 1024) / 8 },
    // The "slow network" fault.
    slow: { latency: 300, downloadThroughput: (1.5 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
  },
  layoutShiftMax: 0, // CLS: any unexpected layout shift fails
  flashMaxMs: 250, // a screen state shorter than this between two other states is a flash
  deadButtonMs: 1000, // a tap with no visible change within this is a dead button
  axeTags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
  minTargetPx: 48,
};

// Room notes and on-screen words that mean the user is blocked or told something went wrong.
export const BLOCKING_WORDS = [
  /Couldn[’']t/i, /Refresh to keep choosing/i, /Something went wrong/i, /YepWatch is starting/i, /Opening the room/i,
];
// Words about the connection or a retry. One rule (owner Q24a, app: core/continuous/connection-words.ts):
// none while an outage is younger than connectionQuietMs (so none at all for a shorter fault, a hidden tab,
// a second device or a page without WebSocket), then at most one line, and never a countdown.
export const CONNECTION_WORDS = [
  /Reconnecting/i, /You[’']re offline/i, /Not connected/i, /Connecting…/, /Trying again/i, /Try again in \d/i, /Retry in \d/i,
  /awaiting confirmation/i, /Your (action|choice|request|room request) is saved/i,
];
// Countdowns and retry timers: never, whatever the fault.
export const COUNTDOWN_WORDS = [/\b\d+\s?s\b/, /Trying again/i, /Try again in/i, /Retry in/i, /awaiting confirmation/i];
// Words allowed briefly (up to connectingMaxMs) while a connection is made.
export const TRANSIENT_WORDS = [/^Connecting…$/];

// Hermetic ceilings: 3x each local target (timing moments only; the UX rules above stay as they are).
export const HERMETIC_FACTOR = 3;
const TIMING_MOMENTS = ['tapFeedbackMs', 'createRoomMs', 'newRoomMs', 'inviteOpenMs', 'voteToPeerMs', 'ideaToPeerMs', 'startToFirstCardMs',
  'startToPeerVotingMs', 'swipeNextCardMs', 'relaunchToCardMs', 'restartQueuedLandMs'];
export const ceilings = {
  local: Object.fromEntries(TIMING_MOMENTS.map((m) => [m, budgets.local[m] * HERMETIC_FACTOR])),
  // Production smoke: only these four gate. Every other moment is reported against its target.
  production: {
    createRoomMs: 1500, // Create room on Mood → the room page shows
    inviteOpenMs: 3000, // invite link in a fresh browser → the join page shows
    voteToPeerMs: 1000, // a vote on one phone → its effect shows on another phone
    startToFirstCardMs: 1500, // Start → first card (host)
  },
};

export function budgetsFor(target = process.env.E2E_TARGET ?? 'local') {
  return { ...budgets, ...budgets[target], target };
}
/** The timing gates for a target: moment → ceiling in ms. A moment not listed is reported, never gated. */
export function ceilingsFor(target = process.env.E2E_TARGET ?? 'local') {
  return ceilings[target] ?? ceilings.local;
}
