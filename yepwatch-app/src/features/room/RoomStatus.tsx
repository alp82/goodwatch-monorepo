import { View } from 'react-native';
import { router } from 'expo-router';
import { developmentNotice } from '../../core/config';
import { GText, glow } from '../glow/theme';
import { toRooms } from './nav';
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
  const { state, entry, notice, setNotice } = useRoom();
  if (!(state.error || state.privateError || entry.error || state.pending || state.connection !== 'live' || notice || developmentNotice)) return null;
  const text = state.retrySeconds > 0 ? `Try again in ${state.retrySeconds}s. Your action is saved.`
    : notice || entry.error || (state.privateError ? 'Refresh to keep choosing.'
      : state.pending ? 'Your choice is awaiting confirmation.'
      : state.error || (state.connection === 'background' ? 'Updates paused while away.' : state.connection !== 'live' ? 'Connecting…' : ''));
  const label = state.retrySeconds > 0 ? `Retry in ${state.retrySeconds}s` : state.pending ? 'Retry' : entry.error ? 'Retry' : 'Refresh';
  return (
    <View style={{ gap: 4 }}>
      {developmentNotice ? <GText size={11} color={glow.muted} style={{ textAlign: 'center' }}>{developmentNotice}</GText> : null}
      {text ? (
        <Note action={{
          label,
          disabled: state.busy || state.retrySeconds > 0,
          onPress: () => {
            setNotice('');
            if (state.pending) void state.send();
            else if (entry.error) void entry.retry();
            else { void state.refetch().catch(() => undefined); state.reconnect(); }
          },
        }}>{text}</Note>
      ) : null}
    </View>
  );
}
