import { ActivityIndicator, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { developmentNotice } from '../../core/config';
import { useLate } from '../../core/useLate';
import { useLayout } from '../shell/layout';
import { GText, Icon, glow } from '../glow/theme';
import { IDEA_LIMITS } from './model';
import { exitRoom, toRooms } from './nav';
import { useRoom, useRoomLive } from './RoomProvider';
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

/** Connection, refusals and notices, in one quiet line floating over the screen's content. */
export function RoomNotes() {
  const focused = useIsFocused();
  const { view, state, entry, notice, setNotice, connectionWords, sheet, openSheet, linkFailed, retryLink } = useRoom();
  const { busy } = useRoomLive();
  // Nobody brings a service (or the last one would go): ask for services, not an error.
  const noServices = state.errorCode === 'needs_context' && !state.pending;
  const ideaLimit = state.errorCode === 'limit_reached' && !state.pending;
  // A saved action waits quietly: it shows at once and goes by itself. Only an outage past the quiet
  // period says anything, in one line without a countdown (connection-words.ts). Offline says only that.
  const text = state.offline ? connectionWords
    : notice || entry.error || (state.privateError ? 'Refresh to keep choosing.'
      : noServices ? 'Pick a streaming service'
      : ideaLimit ? ((view?.ideas.length ?? 0) >= IDEA_LIMITS.perRoom ? `Up to ${IDEA_LIMITS.perRoom} ideas. Remove one first.` : 'No more new ideas in this room')
      : state.error || connectionWords || (linkFailed ? 'Couldn’t connect GoodWatch to this room.' : ''));
  const connectionLine = Boolean(text) && text === connectionWords;
  const linkLine = linkFailed && text === 'Couldn’t connect GoodWatch to this room.';
  // The connection line's action says Retry for the whole outage, whether it resends a saved action or reconnects: a
  // label that changed when an action got saved mid-outage moved the line's words (layout shift).
  const label = linkLine || entry.error || connectionLine ? 'Retry' : noServices ? 'Your services' : ideaLimit ? 'OK' : 'Refresh';
  const note: FrameNote | null = focused && (text || developmentNotice) ? {
    text,
    detail: developmentNotice || undefined,
    busy: connectionLine && !state.offline,
    // Refresh (or Retry for a saved action) tries at once; the line never counts down.
    action: state.offline ? undefined : {
      label,
      // A server's pause disables Retry without a countdown.
      disabled: busy || state.retrySeconds > 0,
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
