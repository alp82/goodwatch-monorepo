// Speed targets for `node run.mjs speed` (README "Speed and smoothness, on demand"): the UX we aim for on the local
// stack. Only that command reads them; CI, the Android journey and the production smoke never judge speed
// (owner 2026-11-14). A timing is the p95 over a run's samples, measured page-side from the input event (or
// navigation start) to the first animation frame that shows the expected state.
export const targets = {
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
};
