import { ScrollView, View } from 'react-native';
import { GText, Icon, Press, glow } from '../glow/theme';
import { Action, FaceStack, Thumb } from '../shell/parts';
import { COLUMN } from '../shell/tokens';
import type { HomeRoom } from './home-model';

/** One active room: mood, status, people and its match posters. A proposal gets an amber rule. */
function Row({ room, first, open }: { room: HomeRoom; first: boolean; open: () => void }) {
  const hot = room.status.key === 'proposal';
  const color = hot ? glow.amber : room.status.key === 'matches' ? '#fcd34d' : glow.muted;
  return (
    <Press label={`Open ${room.label}`} onPress={open} style={{ alignItems: 'stretch', paddingVertical: 16, borderTopWidth: first ? 0 : 1, borderTopColor: '#ffffff12' }}>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: hot ? glow.amber : 'transparent' }} />
        <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
          <GText size={25} bold lines={1} style={{ letterSpacing: -0.6 }}>{room.label}</GText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
            <GText size={13} bold={room.status.key !== 'choosing'} color={room.status.key === 'choosing' ? glow.soft : color} lines={1}>{room.status.label}</GText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <FaceStack people={room.people.map((p) => ({ id: p.id, nickname: p.nickname, dropped: p.dropped, self: p.self }))} size={24} />
            <GText size={12} color={glow.muted} lines={1} style={{ flex: 1 }}>{room.own ? 'Yours' : room.hostNickname ? `${room.hostNickname}’s` : ''}{room.prompt && room.prompt.toLowerCase() !== room.label.toLowerCase() ? ` · ${room.prompt}` : ''}</GText>
          </View>
        </View>
        <View style={{ width: 74, height: 72, justifyContent: 'center' }}>
          {room.posters.map((uri, i) => <Thumb key={uri} uri={uri} width={40} style={{ position: 'absolute', right: i * 15, transform: [{ rotate: `${(i - 1) * 6}deg` }], zIndex: 3 - i }} />)}
          {!room.posters.length && <View style={{ position: 'absolute', right: 0 }}><Icon name="right" size={18} color={glow.muted} /></View>}
        </View>
      </View>
    </Press>
  );
}

/** Selected home (A · Ledger): an editorial list of active rooms, New room and Join pinned below. */
export function Ledger({ rooms, unavailable, loading, open, newRoom, join, retry, disabled }: {
  rooms: HomeRoom[];
  unavailable: { roomId: string }[];
  loading: boolean;
  open: (roomId: string) => void;
  newRoom: () => void;
  join: () => void;
  retry: () => void;
  disabled: boolean;
}) {
  return (
    <View style={{ flex: 1, minHeight: 0, width: '100%', maxWidth: COLUMN.maxWidth, alignSelf: 'center' }}>
      {rooms.length ? (
        <ScrollView testID="home-rooms" style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: COLUMN.inset, paddingBottom: 12 }}>
          {rooms.map((r, i) => <Row key={r.roomId} room={r} first={i === 0} open={() => open(r.roomId)} />)}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32 }}>
          {!loading && <Icon name="tickets" size={44} color={glow.amber} />}
          <GText size={22} bold color={loading ? glow.muted : glow.ink}>{loading ? 'Opening your rooms…' : 'Start tonight’s room'}</GText>
        </View>
      )}
      {unavailable.length > 0 && (
        <Press label="Retry rooms that didn’t load" onPress={retry} style={{ marginHorizontal: COLUMN.inset, minHeight: 44, flexDirection: 'row', gap: 8 }}>
          <Icon name="undo" size={16} color={glow.muted} />
          <GText size={13} color={glow.muted}>{unavailable.length === 1 ? 'One room didn’t load. Retry' : `${unavailable.length} rooms didn’t load. Retry`}</GText>
        </Press>
      )}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: COLUMN.inset, paddingTop: 10, paddingBottom: 12, borderTopWidth: rooms.length ? 1 : 0, borderTopColor: '#ffffff12' }}>
        <Action gold label="New room" icon="tickets" onPress={newRoom} disabled={disabled} style={{ flex: 3 }} />
        <Action label="Join" icon="people" onPress={join} disabled={disabled} style={{ flex: 2 }} />
      </View>
    </View>
  );
}
