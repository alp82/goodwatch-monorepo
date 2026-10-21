import { router, useLocalSearchParams } from 'expo-router';
import { Button, Heading, Notice, Page } from '../../components/ui';
import { safeReturnTo } from '../../core/invites';
export default function AuthCallback() {
  const { returnTo } = useLocalSearchParams<{ returnTo: string }>();
  return <Page><Heading>Return to your room</Heading><Notice>GoodWatch account linking is awaiting server integration. This client has not verified a sign-in or imported your account progress.</Notice><Button onPress={() => router.replace(safeReturnTo(returnTo) as '/')} >Continue to room</Button></Page>;
}
