import { useLocalSearchParams } from 'expo-router';
import { Entrance } from '../../features/Entrance';
export default function Invite() { const { invite } = useLocalSearchParams<{ invite: string }>(); return <Entrance key={invite} invite={invite} />; }
