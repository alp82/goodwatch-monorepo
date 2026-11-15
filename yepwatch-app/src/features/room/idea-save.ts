/**
 * Saving your idea (one each): the setup's describe field and the Mood page both send through here. You
 * have an idea: the text replaces it (`edit_idea`, which also switches it back on). You don't: it's added.
 * An empty text removes yours (the Mood page's Remove this idea).
 *
 * Owner rule Q16b holds: a send the server hasn't answered stays in the room's outbox and goes again by
 * itself, as the exact command. A save started while that send is still uncertain resends it first and then
 * reads what landed, so an add whose answer was lost is never added twice: it's found and replaced instead.
 * A save whose acknowledgement got lost while this showed an error counts as saved once the confirmed room
 * shows it. Another of your changes still on its way (a switch on a slow network): the idea waits its turn.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { noun } from '../shell/noun';
import { IDEA_LIMITS, type RoomCommands, type RoomView } from './model';
import { useRoomLive, type RoomContextValue } from './RoomProvider';

export const IDEA_SAVE_FAILED = 'Couldn’t save this mood. Try again; your text is kept.';

interface Intent { text: string; editId?: string; beforeIds: string[] }

export interface IdeaSaveDeps {
  view: RoomView | null;
  cmd: RoomCommands;
  disabled: boolean;
  latest: RoomContextValue['latest'];
  state: Pick<RoomContextValue['state'], 'pending' | 'send' | 'privateError' | 'retrySeconds' | 'errorCode'>;
  /** The idea this save replaces; defaults to your own idea in the room. */
  editId?: string;
  /** Saved (or found saved after a lost answer). `screenInFront` false: the person left meanwhile. */
  onSaved: () => void;
  /** Whether a save that completes now may act on the screen (the screen is still in front). */
  inFront?: () => boolean;
}

export function useIdeaSave({ view, cmd, disabled, latest, state, editId, onSaved, inFront = () => true }: IdeaSaveDeps) {
  const live = useRoomLive();
  const front = useRef(inFront);
  const saved = useRef(onSaved);
  useEffect(() => { front.current = inFront; saved.current = onSaved; });
  const mutation = useMutation({
    mutationFn: async (intent: Intent) => {
      const failed = () => { throw new Error(IDEA_SAVE_FAILED); };
      const recoveryId = state.pending?.command.type === 'add_idea' ? state.pending.commandId : undefined;
      if (state.pending && !await state.send()) failed();
      const snapshot = latest();
      const own = snapshot?.own.participantId;
      const landed = intent.editId ? snapshot?.shared.ideas.find((i) => i.id === intent.editId)
        : snapshot?.shared.ideas.find((i) => (recoveryId ? i.id === recoveryId : !intent.beforeIds.includes(i.id)) && i.authorId === own)
          // One idea each: yours already in the room (its add's answer got lost, or another device of yours) is replaced.
          ?? snapshot?.shared.ideas.find((i) => i.authorId === own);
      if ((landed?.text === intent.text && landed.on) || (!landed && intent.editId && !intent.text)) return;
      const ok = landed ? await (intent.text ? cmd.editIdea(landed.id, intent.text) : cmd.removeIdea(landed.id))
        : intent.text ? await cmd.addIdea(intent.text) : true;
      if (!ok) failed();
    },
    onSuccess: () => { if (front.current()) saved.current(); },
  });
  const recovered = useRef(0);
  useEffect(() => {
    const intent = mutation.variables;
    const confirmed = live.confirmed;
    if (!front.current() || !mutation.isError || !intent || !confirmed || recovered.current === mutation.submittedAt) return;
    const ideas = confirmed.shared.ideas;
    const done = intent.editId
      ? intent.text ? ideas.some((i) => i.id === intent.editId && i.text === intent.text) : !ideas.some((i) => i.id === intent.editId)
      : ideas.some((i) => !intent.beforeIds.includes(i.id) && i.text === intent.text && i.authorId === confirmed.own.participantId);
    if (done) { recovered.current = mutation.submittedAt; mutation.reset(); saved.current(); }
  }, [mutation, live.confirmed]);
  const ownPending = Boolean(mutation.variables && state.pending && ['add_idea', 'edit_idea', 'remove_idea'].includes(state.pending.command.type));
  const othersFirst = !mutation.isPending && !state.privateError && (live.busy || (disabled && !ownPending));
  const [waiting, setWaiting] = useState<string | null>(null);
  const target = editId ?? view?.myIdea?.id;
  const send = (text: string, after?: () => void) => mutation.mutate({ text, editId: target, beforeIds: latest()?.shared.ideas.map((i) => i.id) ?? [] }, { onSettled: after });
  const sendRef = useRef(send);
  useEffect(() => { sendRef.current = send; });
  const sentWaiting = useRef<string | null>(null);
  useEffect(() => {
    if (waiting === null || othersFirst || sentWaiting.current === waiting) return;
    sentWaiting.current = waiting;
    sendRef.current(waiting, () => { sentWaiting.current = null; setWaiting(null); });
  }, [waiting, othersFirst]);
  const save = useCallback((text: string) => {
    if (othersFirst) setWaiting(text);
    else sendRef.current(text);
  }, [othersFirst]);
  const error = mutation.isError ? state.errorCode === 'limit_reached'
    ? (view?.ideas.length ?? 0) >= IDEA_LIMITS.perRoom ? `Up to ${IDEA_LIMITS.perRoom} ideas. Remove one first.` : `No more new ideas in ${noun.this}`
    : IDEA_SAVE_FAILED : undefined;
  const saving = mutation.isPending || waiting !== null;
  return {
    save,
    saving,
    failed: mutation.isError,
    error,
    /** No save can go right now (one is out, or the server asked to wait). */
    blocked: saving || state.privateError || state.retrySeconds > 0,
  };
}
