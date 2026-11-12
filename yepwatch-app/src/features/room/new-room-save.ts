import type { RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import { type ResendResume, resendOutcome, sendFailure } from '../../core/continuous/resend-resume';

type Draft = { text: string; retryAt: number };

/** What the New room page's save needs from the page (NewRoom.tsx connects them each render). */
export interface NewRoomSaveDeps {
  flow: {
    save(text: string, options: { nickname: string; member: boolean; signal: AbortSignal; onTrouble?: (since: number) => void }): Promise<RoomSnapshot>;
    draft(): Promise<Draft>;
    readonly retryAt: number;
  };
  resume: ResendResume<string>;
  client: { setQueryData(key: readonly unknown[], data: Draft): unknown };
  draftKey: readonly unknown[];
  /** The text field's current value (null: untouched). */
  text: () => string | null;
  setText: (text: string) => void;
  /** When the first failed attempt of this save began (null: none failed): drives the one connection line. */
  setTroubleSince: (since: number | null) => void;
  /** The save going, so ResendResume's abort can cancel it (a plain holder: it is written while saving). */
  attempt: { current: AbortController | null };
  /** Nickname and member flag, read when the save starts. */
  identity: () => Promise<{ nickname: string; member: boolean }>;
  /** The answer opens the room. */
  open: (roomId: string) => void;
}

/**
 * The New room page's save as React Query mutation options: the code NewRoom runs (and the tests drive
 * through a real MutationObserver). A failure is classified the moment it happens (sendFailure): a definitive
 * refusal stays one although the page cancelled meanwhile, and an unanswered one keeps being offline even if
 * the browser is back by the time onError has refreshed the draft (ResendResume.settled starts it then).
 */
export function newRoomSave(d: NewRoomSaveDeps) {
  return {
    networkMode: 'always' as const,
    mutationFn: async (text: string) => {
      const controller = new AbortController();
      d.attempt.current = controller;
      d.setTroubleSince(null);
      try {
        const identity = await d.identity();
        return await d.flow.save(text, { ...identity, signal: controller.signal, onTrouble: d.setTroubleSince });
      } catch (error) {
        d.setTroubleSince(null);
        throw sendFailure(error, controller.signal.aborted);
      }
    },
    onSuccess: (_snapshot: RoomSnapshot, submittedText: string) => {
      d.setText(submittedText);
      d.client.setQueryData(d.draftKey, { text: submittedText, retryAt: 0 });
    },
    onError: async () => {
      try { d.client.setQueryData(d.draftKey, await d.flow.draft()); }
      catch { d.client.setQueryData(d.draftKey, { text: d.text() ?? '', retryAt: d.flow.retryAt }); }
    },
    // After onError has settled the draft: a save paused by the app leaving the front, or one that went
    // offline while the browser is back by now, starts again here.
    onSettled: (snapshot: RoomSnapshot | undefined, error: Error | null) => {
      if (d.resume.settled(resendOutcome(error)) && snapshot) d.open(snapshot.shared.roomId);
    },
  };
}
