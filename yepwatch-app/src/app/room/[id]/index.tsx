import { Stack, useLocalSearchParams } from 'expo-router';
import { GlowRoom } from '../../features/glow/Room';
export default function Room() {
  const { id, signin } = useLocalSearchParams<{ id: string; signin?: string }>();
  return <><Stack.Screen options={{ gestureEnabled: false }} /><GlowRoom key={id} id={id} signin={signin === '1'} /></>;
}
