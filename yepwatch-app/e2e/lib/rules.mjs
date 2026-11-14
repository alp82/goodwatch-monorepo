// The UX rules every run judges (gates.ts, a11y.ts, harness.ts). No speed here: speed targets live in
// ../budgets.mjs and only `node run.mjs speed` reads them.
const production = process.env.E2E_TARGET === 'production';
export const rules = {
  layoutShiftMax: 0, // CLS: any unexpected layout shift fails
  flashMaxMs: 250, // a screen state shorter than this between two other states is a flash
  deadButtonMs: 1000, // a tap with no visible change by the end of the recording (and at least this old) is a dead button
  axeTags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
  minTargetPx: 48,
  connectingMaxMs: production ? 1500 : 1000, // "Connecting…" visible at most this long
  connectionQuietMs: 3000, // an outage shows no connection words before this (owner rule Q24a)
  connectionWordsAfterMs: 1000, // and its one line is gone at most this long after the outage ends
  // The "slow" fault: CDP Network.emulateNetworkConditions.
  slowNetwork: { latency: 300, downloadThroughput: (1.5 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
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
