import { useCallback, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { IDEA_LIMITS } from './model';
import { leavePage } from './nav';
import { useRoom } from './RoomProvider';
import { RoomStatus } from './RoomStatus';
import { MoodComposer } from './MoodComposer';

export function MoodPage() {
  const { id, view, cmd, disabled, state, latest } = useRoom();
  const { idea = 'new' } = useLocalSearchParams<{ idea?: string }>();
  const editing = view?.ideas.find((i) => i.id === idea && i.mine) ?? null;
  const focused = useRef(false);
  useFocusEffect(useCallback(() => { focused.current = true; return () => { focused.current = false; }; }, []));
  const clearError = state.clearError;
  const leave = useCallback(() => { clearError(); leavePage(id); }, [id, clearError]);
  const mutation = useMutation({
    mutationFn: async (intent: { text: string; editId?: string; beforeIds: string[] }) => {
      const failed = () => { throw new Error('Couldn’t save this mood. Try again; your text is kept.'); };
      const recoveryId = state.pending?.command.type === 'add_idea' ? state.pending.commandId : undefined;
      if (state.pending && !await state.send()) failed();
      const snapshot = latest();
      const saved = intent.editId ? snapshot?.shared.ideas.find((i) => i.id === intent.editId)
        : snapshot?.shared.ideas.find((i) => (recoveryId ? i.id === recoveryId : !intent.beforeIds.includes(i.id)) && i.authorId === snapshot.own.participantId);
      if (saved?.text === intent.text || (!saved && intent.editId && !intent.text)) return;
      const ok = saved ? await (intent.text ? cmd.editIdea(saved.id, intent.text) : cmd.removeIdea(saved.id))
        : intent.text ? await cmd.addIdea(intent.text) : true;
      if (!ok) failed();
    },
    onSuccess: () => { if (focused.current) leave(); },
  });
  const recovered = useRef(0);
  // A lost acknowledgement can be recovered by the durable queue while this mutation shows its error.
  useEffect(() => {
    const intent = mutation.variables;
    const confirmed = state.confirmed;
    if (!focused.current || !mutation.isError || !intent || !confirmed || recovered.current === mutation.submittedAt) return;
    const ideas = confirmed.shared.ideas;
    const saved = intent.editId
      ? intent.text ? ideas.some((i) => i.id === intent.editId && i.text === intent.text) : !ideas.some((i) => i.id === intent.editId)
      : ideas.some((i) => !intent.beforeIds.includes(i.id) && i.text === intent.text && i.authorId === confirmed.own.participantId);
    if (saved) { recovered.current = mutation.submittedAt; leave(); }
  }, [mutation.isError, mutation.variables, mutation.submittedAt, state.confirmed, leave]);
  if (!view) return <RoomStatus />;
  const ownPending = mutation.variables && state.pending && ['add_idea', 'edit_idea', 'remove_idea'].includes(state.pending.command.type);
  const error = mutation.isError ? state.errorCode === 'limit_reached'
    ? view.ideas.length >= IDEA_LIMITS.perRoom ? `Up to ${IDEA_LIMITS.perRoom} ideas. Remove one first.` : 'No more new ideas in this room'
    : 'Couldn’t save this mood. Try again; your text is kept.' : undefined;
  const pick = (text: string) => {
    if (editing && text === editing.text) { leave(); return; }
    mutation.mutate({ text, editId: editing?.id, beforeIds: latest()?.shared.ideas.map((i) => i.id) ?? [] });
  };
  return <MoodComposer key={idea} initialText={editing?.text ?? ''} first={view.isHost && !view.ideas.length && !editing}
    action={mutation.isError ? 'Try again' : editing ? 'Save' : view.isHost && !view.ideas.length ? 'Create room' : view.isHost ? 'Add idea' : 'Suggest'} editing={Boolean(editing)}
    disabled={(disabled && !ownPending) || mutation.isPending || state.busy || state.retrySeconds > 0}
    saving={mutation.isPending} error={error} pick={pick} back={leave} />;
}
