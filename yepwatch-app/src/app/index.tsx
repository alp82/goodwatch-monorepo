import { useLocalSearchParams } from 'expo-router';
import { Entrance, type StartRequest } from '../features/Entrance';

const requests: readonly StartRequest[] = ['profile', 'history', 'join', 'new'];
export default function Start() {
  const { open } = useLocalSearchParams<{ open?: string }>();
  return <Entrance open={requests.find((r) => r === open)} />;
}
