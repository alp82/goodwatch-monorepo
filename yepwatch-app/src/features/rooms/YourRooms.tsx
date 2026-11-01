import { Image, ScrollView, View } from 'react-native';
import { BootReveal } from '../home/BootReveal';
import { GText, Icon, Press, glow } from '../glow/theme';
import { Button, Hero, LiveBadge, Small, TextLink, card } from '../room/ui';
import { FaceStack } from '../shell/parts';
import { COLUMN } from '../shell/tokens';
import type { HomeRoom } from './home-model';

/** One room: Tonight's poster (or a ticket), its ideas, LIVE while open, its status and people. */
function RoomRow({ room, open }: { room: HomeRoom; open: () => void }) {
  return (
    <Press label={room.label} onPress={open} style={{ ...card, alignSelf: 'stretch', minWidth: 0, flexDirection: 'row', justifyContent: 'flex-start', gap: 14, padding: 14 }}>
      {room.poster
        ? <Image source={{ uri: room.poster.replace('/w500/', '/w185/') }} accessible={false} style={{ width: 44, height: 66, borderRadius: 8 }} />
        : <View style={{ width: 44, height: 66, borderRadius: 8, backgroundColor: '#ffffff0d', alignItems: 'center', justifyContent: 'center' }}><Icon name="tickets" size={20} color={glow.amber} /></View>}
      <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <GText bold size={20} lines={1} style={{ letterSpacing: -0.4, flexShrink: 1, minWidth: 0 }}>{room.label}</GText>
          {room.live ? <LiveBadge /> : null}
        </View>
        <Small color={room.hot ? glow.amber : glow.muted} lines={1}>{room.status}</Small>
        <FaceStack people={room.people} size={20} max={5} />
      </View>
      <Icon name="right" size={16} color={glow.muted} />
    </Press>
  );
}

/** Returning visitors: greeting, Your rooms (LIVE while open), New room and Join a room pinned below. */
export function YourRooms({ title, rooms, unavailable, loading, open, newRoom, join, retry, history, disabled }: {
  title: string;
  rooms: HomeRoom[];
  unavailable: { roomId: string }[];
  loading: boolean;
  open: (roomId: string) => void;
  newRoom: () => void;
  join: () => void;
  retry: () => void;
  history?: () => void;
  disabled: boolean;
}) {
  return (
    <View style={{ flex: 1, minHeight: 0, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
      <ScrollView testID="home-rooms" style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: COLUMN.inset + 4, paddingTop: 24, paddingBottom: 12, gap: 18 }}>
        <BootReveal index={0}><Hero>{title}</Hero></BootReveal>
        {rooms.length ? (
          <BootReveal index={1} style={{ gap: 10 }}>
            <Small bold>YOUR ROOMS</Small>
            {rooms.map((r) => <RoomRow key={r.roomId} room={r} open={() => open(r.roomId)} />)}
          </BootReveal>
        ) : loading ? <Small>Opening your rooms…</Small> : null}
        {unavailable.length > 0 && (
          <TextLink color={glow.muted} onPress={retry} label={unavailable.length === 1 ? 'One room didn’t load. Retry' : `${unavailable.length} rooms didn’t load. Retry`} />
        )}
        {history ? <TextLink color={glow.muted} label="History" onPress={history} /> : null}
      </ScrollView>
      <BootReveal index={2} style={{ paddingHorizontal: COLUMN.inset + 4, paddingTop: 10, paddingBottom: 18, gap: 10 }}>
        <Button label="New room" disabled={disabled} onPress={newRoom} />
        <Button secondary label="Join a room" disabled={disabled} onPress={join} />
      </BootReveal>
    </View>
  );
}
