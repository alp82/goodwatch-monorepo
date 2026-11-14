import { Stack, useLocalSearchParams } from 'expo-router';
import { RoomProvider } from '../../../features/room/RoomProvider';
import { renderRoomSheet } from '../../../features/room/Sheets';
import { ROOM_SCREENS } from '../../../features/shell/route-order';

const arrivalPage = ({ route }: { route: { params?: object } }) =>
  (route.params as { arrival?: string } | undefined)?.arrival === '1' ? { animation: 'none' as const } : {};

const ROOM_SCREEN_OPTIONS: Record<(typeof ROOM_SCREENS)[number], object | typeof arrivalPage | undefined> = {
  // The voting card owns horizontal swipes.
  index: { gestureEnabled: false },
  // The first page of an arrival is the arrival: the room isn't seen sliding away underneath it.
  mood: arrivalPage,
  // Old sheet addresses hand over to the room without an animation.
  room: { animation: 'none' },
  services: { animation: 'none' },
  streaming: { animation: 'none' },
  kinds: { animation: 'none' },
  matches: undefined,
};

/** The room and its pages share one live connection; its sheets open over whichever room screen is in front. */
export default function RoomLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <RoomProvider key={id} id={id} renderSheet={renderRoomSheet}>
      {/* Declared in expo-router's own order (route-order.ts): a different order re-renders the tree once more as the room mounts. */}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#070707' } }}>
        {ROOM_SCREENS.map((name) => <Stack.Screen key={name} name={name} options={ROOM_SCREEN_OPTIONS[name]} />)}
      </Stack>
    </RoomProvider>
  );
}
