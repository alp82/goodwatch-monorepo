import { Stack, useLocalSearchParams } from 'expo-router';
import { RoomProvider } from '../../../features/room/RoomProvider';

/** The room and its pages share one live connection. */
export default function RoomLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <RoomProvider key={id} id={id}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#070707' } }}>
        {/* The voting card owns horizontal swipes. */}
        <Stack.Screen name="index" options={{ gestureEnabled: false }} />
      </Stack>
    </RoomProvider>
  );
}
