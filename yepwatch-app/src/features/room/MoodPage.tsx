import { useCallback, useRef } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { noun } from '../shell/noun';
import { leavePage } from './nav';
import { useIdeaSave } from './idea-save';
import { useRoom } from './RoomProvider';
import { RoomStatus } from './RoomStatus';
import { MoodComposer } from './MoodComposer';

/** /room/<id>/mood: your idea on a page of its own (one each: an existing one is edited, never a second added). */
export function MoodPage() {
  const { id, view, cmd, disabled, state, latest } = useRoom();
  const { idea = 'new' } = useLocalSearchParams<{ idea?: string }>();
  const editing = view?.ideas.find((i) => i.id === idea && i.mine) ?? null;
  const focused = useRef(false);
  useFocusEffect(useCallback(() => { focused.current = true; return () => { focused.current = false; }; }, []));
  const clearError = state.clearError;
  const leave = useCallback(() => { clearError(); leavePage(id); }, [id, clearError]);
  const ideaSave = useIdeaSave({ view, cmd, disabled, latest, state, editId: editing?.id, onSaved: leave, inFront: () => focused.current });
  if (!view) return <RoomStatus />;
  const pick = (text: string) => {
    if (editing && text === editing.text && editing.on) { leave(); return; }
    ideaSave.save(text);
  };
  return <MoodComposer key={idea} initialText={editing?.text ?? ''} first={view.isHost && !view.ideas.length && !editing}
    action={ideaSave.failed ? 'Try again' : editing ? 'Save' : view.isHost && !view.ideas.length ? noun.make : view.isHost ? 'Add idea' : 'Suggest'} editing={Boolean(editing)}
    disabled={ideaSave.blocked} saving={ideaSave.saving} error={ideaSave.error} pick={pick} back={leave} />;
}
