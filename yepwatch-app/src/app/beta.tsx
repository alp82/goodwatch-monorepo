import { useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feedback } from '../features/beta/Feedback';
import distribution from '../features/beta/invitations.json';
import { GText, Pill, Wordmark, glow } from '../features/glow/theme';

const checks = [
  'Create a room and invite a friend on another device.',
  'Choose a mood and your services. Try Yep, Nope and Undo.',
  'Find a match, propose it, and agree together.',
  'Watch a trailer, leave the app briefly, then come back.',
  'Try GoodWatch sign-in, then leave and rejoin your room.',
];

export default function Beta() {
  const [error, setError] = useState('');
  async function open(url: string) {
    try { setError(''); await Linking.openURL(url); }
    catch { setError('Couldn’t open the invitation. Please try again.'); }
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: glow.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 560, gap: 24 }}>
          <Wordmark />
          <View style={{ gap: 8 }}>
            <GText size={36} bold>Test YepWatch</GText>
            <GText color={glow.muted}>Bring a friend. Find something you both want to watch.</GText>
          </View>
          {(['android', 'ios'] as const).map(platform => {
            const url: string | null = distribution[platform];
            const title = platform === 'android' ? 'Android' : 'iPhone';
            return <View key={platform} style={{ backgroundColor: glow.panel, borderColor: glow.line, borderWidth: 1, borderRadius: 20, padding: 20, gap: 12 }}>
              <GText size={22} bold>{title}</GText>
              <GText size={14} color={glow.muted}>{url
                ? platform === 'android' ? 'Join the test, then install from Google Play.' : 'Install Apple’s TestFlight app, then accept the invitation.'
                : 'App invitations are coming soon. You can try the browser version today.'}</GText>
              <Pill label={url ? `Install on ${title}` : `${title} invitations coming soon`} gold={Boolean(url)} disabled={!url} onPress={() => { if (url) void open(url); }}>
                {url ? platform === 'android' ? 'Get it on Google Play' : 'Join on TestFlight' : 'Coming soon'}
              </Pill>
            </View>;
          })}
          {error && <GText color="#fca5a5" size={14}>{error}</GText>}
          <Pill label="Try in your browser" onPress={() => router.push('/')}>Try in your browser</Pill>
          <View style={{ gap: 12 }}>
            <GText size={22} bold>A quick test together</GText>
            {checks.map((check, i) => <View key={check} style={{ flexDirection: 'row', gap: 12 }}>
              <GText bold color={glow.amber}>{i + 1}</GText>
              <GText size={15} style={{ flex: 1 }}>{check}</GText>
            </View>)}
          </View>
          <Feedback />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
