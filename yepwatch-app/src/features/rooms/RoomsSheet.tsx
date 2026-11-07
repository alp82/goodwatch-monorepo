/**
 * Your rooms, opened from the header's room switcher pill: this room (it opens the Room page), the
 * other open rooms, then New room and Join a room.
 */
import { View } from 'react-native';
import { GText, Icon, Press, glow } from '../glow/theme';
import { Action, FaceStack, LiveDot } from '../shell/parts';
import { Sheet } from '../shell/Sheet';
import { useLayout } from '../shell/layout';
import { R, warm } from '../shell/tokens';
import type { HomeRoom } from './home-model';
import { useHome } from './useHome';

/** The room the header belongs to. */
export interface CurrentRoom {
  roomId: string;
  label: string;
  decided: boolean;
  /** Opens this room's Room page (its menu). */
  openRoomPage?: () => void;
}
export interface RoomsSheetActions {
  open: (roomId: string) => void;
  newRoom: () => void;
  join: () => void;
}

export function YourRoomsSheet({ current, rooms, loading = false, actions, onClose }: {
  current?: CurrentRoom;
  /** Open rooms on this device. */
  rooms: readonly HomeRoom[];
  loading?: boolean;
  actions: RoomsSheetActions;
  onClose: () => void;
}) {
  const { z } = useLayout();
  const others = rooms.filter((r) => r.live && r.roomId !== current?.roomId);
  const then = (fn: () => void) => () => { onClose(); fn(); };
  const here = current ? (
    <>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <GText bold size={z(18)} lines={1}>{current.label}</GText>
        <GText size={z(13)} color={glow.amber}>This room</GText>
      </View>
      {current.openRoomPage ? <GText bold size={z(13)} color={glow.muted}>Room</GText> : null}
      <Icon name={current.openRoomPage ? 'right' : 'check'} size={18} color={current.openRoomPage ? glow.muted : glow.amber} />
    </>
  ) : null;
  const hereStyle = { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: 12, padding: 14, borderRadius: R.card, backgroundColor: warm.amberSoft, borderWidth: 1, borderColor: warm.amberLine } as const;
  return (
    <Sheet testID="rooms-sheet" title="Your rooms" onClose={onClose}
      actions={<>
        <Action label="Join a room" onPress={then(actions.join)} style={{ flex: 1 }} />
        <Action gold label="New room" onPress={then(actions.newRoom)} style={{ flex: 1 }} />
      </>}>
      <View style={{ gap: 8 }}>
        {current ? (current.openRoomPage
          ? <Press label={`${current.label}, Room page`} onPress={then(current.openRoomPage)} style={hereStyle}>{here}</Press>
          : <View accessible accessibilityLabel={`${current.label}, this room`} style={hereStyle}>{here}</View>) : null}
        {others.map((r) => (
          <Press key={r.roomId} label={`${r.label}, ${r.status}`} onPress={then(() => actions.open(r.roomId))}
            style={{ flexDirection: 'row', justifyContent: 'flex-start', gap: 12, padding: 14, borderRadius: R.card, backgroundColor: warm.faint, borderWidth: 1, borderColor: warm.line }}>
            <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
              <GText bold size={z(18)} lines={1}>{r.label}</GText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <LiveDot />
                <GText size={z(13)} color={r.hot ? glow.amber : glow.muted} lines={1} style={{ flexShrink: 1 }}>{r.status}</GText>
              </View>
            </View>
            <FaceStack people={r.people} size={24} max={3} />
            <Icon name="right" size={16} color={glow.muted} />
          </Press>
        ))}
        {!current && !others.length ? <GText color={glow.muted}>{loading ? 'Opening your rooms…' : 'No open rooms'}</GText> : null}
      </View>
    </Sheet>
  );
}

/** Your rooms where the page doesn't already have them (room screens): reads this device's rooms. */
export function HomeRoomsSheet(props: { current?: CurrentRoom; actions: RoomsSheetActions; onClose: () => void }) {
  const home = useHome();
  return <YourRoomsSheet {...props} rooms={home.active} loading={home.loadingRooms} />;
}
