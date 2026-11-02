import { View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { developmentNotice } from '../../core/config';
import { GText, glow } from '../glow/theme';
import { IDEA_LIMITS } from './model';
import { openPage, toRooms } from './nav';
import { useRoom } from './RoomProvider';
import { Button, Hero, Note, Screen } from './ui';

/** Opening, unavailable, ended or expired: the room can't be shown. */
export function RoomStatus() {
  const { state } = useRoom();
  const ended = Boolean(state.terminal) || state.access === null;
  const title = ended
    ? state.terminal === 'expired' ? 'This room has expired' : state.access === null ? 'Reopen your invitation' : 'Your room access ended'
    : state.room.error ? 'Couldn’t load the room' : 'Opening the room…';
  return (
    <Screen testID="room-status" back={toRooms}
      footer={<>
        {!ended && state.room.error ? <Button label="Retry" onPress={() => void state.refetch().catch(() => undefined)} /> : null}
        {ended || state.room.error ? <Button secondary={!ended} label="Your rooms" onPress={() => router.replace('/')} /> : null}
      </>}>
      <View style={{ paddingTop: 80, gap: 12 }}>
        <Hero size={32} color={ended || state.room.error ? glow.ink : glow.soft}>{title}</Hero>
      </View>
    </Screen>
  );
}

/** Connection, saved actions and errors, in one quiet line above the screen's content. */
export function RoomNotes() {
  const { id, view, state, entry, notice, setNotice } = useRoom();
  const onServices = usePathname().endsWith('/services');
  if (!(state.error || state.privateError || entry.error || state.pending || state.connection !== 'live' || notice || developmentNotice)) return null;
  // Nobody brings a service (or the last one would go): ask for services, not an error.
  const noServices = state.errorCode === 'needs_context' && !state.pending;
  const ideaLimit = state.errorCode === 'limit_reached' && !state.pending;
  const text = state.retrySeconds > 0 ? `Try again in ${state.retrySeconds}s. Your action is saved.`
    : notice || entry.error || (state.privateError ? 'Refresh to keep choosing.'
      : state.pending ? 'Your choice is awaiting confirmation.'
      : noServices ? 'Pick a streaming service'
      : ideaLimit ? ((view?.ideas.length ?? 0) >= IDEA_LIMITS.perRoom ? `Up to ${IDEA_LIMITS.perRoom} ideas. Remove one first.` : 'No more new ideas in this room')
      : state.error || connectionText());
  function connectionText() {
    if (state.connection === 'background') return 'Updates paused while away.';
    if (state.connection === 'live') return '';
    if (state.reconnecting) return state.connection === 'connecting' ? 'Connecting…' : 'Reconnecting…';
    if (state.reconnectSeconds > 0) return `Trying again in ${state.reconnectSeconds} s`;
    return state.connection === 'unavailable' ? 'Not connected.' : 'Connecting…';
  }
  // Only the connection line itself spins; saved actions and errors keep their own words.
  const spinning = state.reconnecting && text === connectionText();
  const label = state.retrySeconds > 0 ? `Retry in ${state.retrySeconds}s` : state.pending ? 'Retry' : entry.error ? 'Retry' : noServices ? 'Your services' : ideaLimit ? 'OK' : 'Refresh';
  return (
    <View style={{ gap: 4 }}>
      {developmentNotice ? <GText size={11} color={glow.muted} style={{ textAlign: 'center' }}>{developmentNotice}</GText> : null}
      {text ? (
        <Note action={{
          label,
          disabled: state.busy || state.retrySeconds > 0 || spinning,
          onPress: () => {
            setNotice('');
            if (state.pending) void state.send();
            else if (noServices) { state.clearError(); if (!onServices) openPage(id, 'services'); }
            else if (ideaLimit) state.clearError();
            else if (entry.error) void entry.retry();
            else { void state.refetch().catch(() => undefined); state.reconnect(); }
          },
        }} busy={spinning}>{text}</Note>
      ) : null}
    </View>
  );
}
