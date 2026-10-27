/**
 * Startup timing (approved "Dissolve into page", issue #779). The boot word never changes position:
 * once its intro has played and the home page is ready, it grows a touch and dissolves in place while
 * the page builds in behind it, block by block in reading order, with the header (logo, people) last.
 * Shared by the web and native boot and by every BootReveal block.
 */
export const BOOT = {
  /** The word's intro (Y turn, arc, "epWatch" slide) has played. */
  holdMs: 1950,
  /** Reduced motion: the word shows still, briefly. */
  quietHoldMs: 450,
  /** After the hold, stop waiting for the home page; it shows its own loading state. */
  pageWaitCapMs: 4000,
  word: { exitMs: 560, quietExitMs: 220, goneAt: 0.55, grow: 1.12 },
  curtainMs: 280,
  block: { firstMs: 160, stepMs: 70, durationMs: 620, rise: 16, maxIndex: 5 },
  header: { atMs: 510, stepMs: 60, durationMs: 520 },
  backdrop: { durationMs: 800, quietDurationMs: 300 },
  quiet: { delayMs: 60, durationMs: 260 },
  /** The amber arc keeps circling the Y while the page is not ready. */
  waitLoopMs: 1500,
} as const;

/** CSS cubic-bezier control points; native maps them to Easing.bezier. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN_OUT = [0.4, 0, 0.2, 1] as const;

export type RevealRole = 'block' | 'header' | 'backdrop';
export interface RevealTiming { delayMs: number; durationMs: number; rise: number }

/** When and how one page part appears after the boot starts to dissolve. Delays count from the dissolve start. */
export function revealTiming(role: RevealRole, index: number, quiet: boolean): RevealTiming {
  if (role === 'backdrop') return { delayMs: 0, durationMs: quiet ? BOOT.backdrop.quietDurationMs : BOOT.backdrop.durationMs, rise: 0 };
  // Reduced motion: plain fades, no rise or stagger; the header logo still waits until the word is gone.
  if (quiet) return { delayMs: role === 'header' ? BOOT.word.quietExitMs : BOOT.quiet.delayMs, durationMs: BOOT.quiet.durationMs, rise: 0 };
  const i = Math.min(Math.max(Math.round(index), 0), BOOT.block.maxIndex);
  if (role === 'header') return { delayMs: BOOT.header.atMs + Math.min(i, 1) * BOOT.header.stepMs, durationMs: BOOT.header.durationMs, rise: 0 };
  return { delayMs: BOOT.block.firstMs + i * BOOT.block.stepMs, durationMs: BOOT.block.durationMs, rise: BOOT.block.rise };
}

/** Milliseconds from the dissolve start until the boot is done and the page is fully interactive. */
export function bootSettleMs(buildsIn: boolean, quiet: boolean) {
  const word = quiet ? BOOT.word.quietExitMs : BOOT.word.exitMs;
  if (!buildsIn) return Math.max(word, BOOT.curtainMs);
  const end = (t: RevealTiming) => t.delayMs + t.durationMs;
  return Math.max(
    word,
    BOOT.curtainMs,
    end(revealTiming('backdrop', 0, quiet)),
    end(revealTiming('block', BOOT.block.maxIndex, quiet)),
    end(revealTiming('header', 1, quiet)),
  );
}

/** Milliseconds from the dissolve start until the boot word is fully transparent. */
export function wordGoneMs(quiet: boolean) {
  return quiet ? BOOT.word.quietExitMs : Math.round(BOOT.word.exitMs * BOOT.word.goneAt);
}
