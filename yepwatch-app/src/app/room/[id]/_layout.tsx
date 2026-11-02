import { Stack, useLocalSearchParams } from 'expo-router';
import { RoomProvider } from '../../../features/room/RoomProvider';

const arrivalPage = ({ route }: { route: { params?: object } }) =>
  (route.params as { arrival?: string } | undefined)?.arrival === '1' ? { animation: 'none' as const } : {};

/** The room and its pages share one live connection. */
export default function RoomLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <RoomProvider key={id} id={id}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#070707' } }}>
        {/* The voting card owns horizontal swipes. */}
        <Stack.Screen name="index" options={{ gestureEnabled: false }} />
        {/* The first page of an arrival is the arrival: the room isn't seen sliding away underneath it. */}
        <Stack.Screen name="mood" options={arrivalPage} />
        <Stack.Screen name="services" options={arrivalPage} />
      </Stack>
    </RoomProvider>
  );
}
