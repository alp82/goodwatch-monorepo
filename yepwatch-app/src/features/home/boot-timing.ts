/**
 * Startup timing (owner decision Q21a). The "YepWatch" word only covers loading and never adds time:
 * the page appears as soon as it is ready. Loading that finishes within `wordDelayMs` shows no word at
 * all: the cover is simply gone (a cut), so the first frame after it is the ready page. Slower loading
 * shows the word (its intro, then the amber arc circling the Y) until the page is ready, then the cover
 * and the word dissolve into the page in `dissolveMs` (opacity only).
 * Invitation links never show the word. Shared by the web and native boot.
 */
export const BOOT = {
  /** Loading shorter than this shows no word: the page appears at once. */
  wordDelayMs: 400,
  /** The word's intro (Y turn, arc, "epWatch" slide) has played; still loading, the arc keeps circling. */
  introMs: 1950,
  /** After the word: the cover and the word fade out over the ready page. */
  dissolveMs: 150,
  /** Stop waiting for the page after this; it shows its own loading state. */
  pageWaitCapMs: 4000,
  /** One turn of the amber arc around the Y while the page is not ready. */
  waitLoopMs: 1500,
} as const;

/** CSS cubic-bezier control points; native maps them to Easing.bezier. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
