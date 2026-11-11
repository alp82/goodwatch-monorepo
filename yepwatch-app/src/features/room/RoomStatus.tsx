import { ActivityIndicator, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { developmentNotice } from '../../core/config';
import { useLate } from '../../core/useLate';
import { useLayout } from '../shell/layout';
import { GText, Icon, glow } from '../glow/theme';
import { IDEA_LIMITS } from './model';
import { exitRoom, toRooms } from './nav';
import { useRoom } from './RoomProvider';
import { NoteLine, useFrameNote, type FrameNote } from '../shell/floating-note';
import { Actions, Button, Screen } from './ui';

/** While the room's first read is out, nothing but the page itself: most opens never need words. */
const OPENING_WORDS_AFTER_MS = 900;

/** Opening, unavailable, ended or expired: the room can't be shown. Centered, with Your rooms in the content. */
export function RoomStatus() {
  const { state } = useRoom();
  const { phone, z } = useLayout();
  const ended = Boolean(state.terminal) || state.access === null;
  const late = useLate(!ended && !state.room.error, OPENING_WORDS_AFTER_MS);
  const quiet = !ended && !state.room.error && !late;
  const failed = !ended && Boolean(state.room.error);
  const title = ended
    ? state.terminal === 'expired' ? 'This room has expired' : state.access === null ? 'Reopen your invitation' : 'Your room access ended'
    : failed ? 'Couldn’t load the room' : 'Opening the room…';
  return (
    <Screen testID="room-status" back={toRooms} pill={null} width={z(640)}>
      {quiet ? null : (
        <View style={{ alignItems: 'center', gap: z(20), paddingTop: phone ? 24 : z(48) }}>
          {ended || failed ? <Icon name="clock" size={z(44)} color={glow.amber} /> : <ActivityIndicator testID="room-opening" color={glow.amber} size="large" />}
          <GText bold size={phone ? 32 : z(46)} color={ended || failed ? glow.ink : glow.soft} style={{ textAlign: 'center', letterSpacing: -1, lineHeight: (phone ? 32 : z(46)) * 1.1 }}>{title}</GText>
          {ended || failed ? (
            <Actions style={{ width: phone ? '100%' : z(320), paddingTop: 8 }}>
              {failed ? <Button label="Retry" onPress={() => void state.refetch().catch(() => undefined)} /> : null}
              <Button secondary={failed} label="Your rooms" onPress={exitRoom} />
            </Actions>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

/** Connection, saved actions and errors, in one quiet line floating over the screen's content. */
export function RoomNotes() {
  const focused = useIsFocused();
  const { view, state, entry, notice, setNotice, connectionLate, sheet, openSheet, linkFailed, retryLink } = useRoom();
  const any = Boolean(state.error || state.privateError || entry.error || state.pending || state.offline || connectionLate || notice || linkFailed || developmentNotice);
  // Nobody brings a service (or the last one would go): ask for services, not an error.
  const noServices = state.errorCode === 'needs_context' && !state.pending;
  const ideaLimit = state.errorCode === 'limit_reached' && !state.pending;
  function connectionText() {
    if (!connectionLate) return '';
    if (state.reconnecting) return state.connection === 'connecting' ? 'Connecting…' : 'Reconnecting…';
    if (state.reconnectSeconds > 0) return `Trying again in ${state.reconnectSeconds} s`;
    return state.connection === 'unavailable' ? 'Not connected.' : 'Connecting…';
  }
  // No network at all: one calm line. Actions stay saved and go by themselves when it's back.
  const text = !any ? '' : state.offline ? (state.pending ? 'You’re offline. Your action is saved and goes when you’re back.' : 'You’re offline.')
    : state.retrySeconds > 0 ? `Try again in ${state.retrySeconds}s. Your action is saved.`
    : notice || entry.error || (state.privateError ? 'Refresh to keep choosing.'
      : state.pending ? 'Your choice is awaiting confirmation.'
      : noServices ? 'Pick a streaming service'
      : ideaLimit ? ((view?.ideas.length ?? 0) >= IDEA_LIMITS.perRoom ? `Up to ${IDEA_LIMITS.perRoom} ideas. Remove one first.` : 'No more new ideas in this room')
      : state.error || connectionText() || (linkFailed ? 'Couldn’t connect GoodWatch to this room.' : ''));
  // Only the connection line itself spins; saved actions and errors keep their own words.
  const spinning = state.reconnecting && text === connectionText();
  const linkLine = linkFailed && text === 'Couldn’t connect GoodWatch to this room.';
  const label = linkLine ? 'Retry' : state.retrySeconds > 0 ? `Retry in ${state.retrySeconds}s` : state.pending ? 'Retry' : entry.error ? 'Retry' : noServices ? 'Your services' : ideaLimit ? 'OK' : 'Refresh';
  const note: FrameNote | null = focused && any && (text || developmentNotice) ? {
    text,
    detail: developmentNotice || undefined,
    busy: spinning,
    action: state.offline ? undefined : {
      label,
      disabled: state.busy || state.retrySeconds > 0 || spinning,
      onPress: () => {
        setNotice('');
        if (linkLine) retryLink();
        else if (state.pending) void state.send();
        else if (noServices) { state.clearError(); if (sheet !== 'services') openSheet('services'); }
        else if (ideaLimit) state.clearError();
        else if (entry.error) void entry.retry();
        else { void state.refetch().catch(() => undefined); state.reconnect(); }
      },
    },
  } : null;
  // Over the page, under the header: the page never moves when a note comes or goes.
  if (useFrameNote(note) || !note) return null;
  return (
    <View style={{ gap: 4 }}>
      {note.detail ? <GText size={11} color={glow.muted} style={{ textAlign: 'center' }}>{note.detail}</GText> : null}
      {note.text ? <NoteLine note={note} /> : null}
    </View>
  );
}
