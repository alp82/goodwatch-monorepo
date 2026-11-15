import { View } from 'react-native';
import { GText, glow } from '../glow/theme';
import { useLayout } from '../shell/layout';
import { strength } from './answers';

/**
 * Taste profile progress. With `goal` (the first run): one segment per card toward a profile good enough to start.
 * Without: profile strength in five steps with its word ("Taking shape").
 */
export function StrengthMeter({ rated, goal, compact = false, detail = !compact }: { rated: number; goal?: number; compact?: boolean; detail?: boolean }) {
  const { z } = useLayout();
  const title = 'Your taste profile';
  if (goal) {
    const n = Math.min(rated, goal);
    const word = n >= goal ? 'Good enough to start' : n === 0 ? 'Answer a few cards' : n < goal / 2 ? 'Getting started' : 'Taking shape';
    return (
      <View accessible accessibilityRole="image" accessibilityLabel={`${title}: ${n} of ${goal}, ${word}`} style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <GText bold size={z(compact ? 13 : 15)} style={{ flex: 1 }}>{title}</GText>
          <GText size={z(13)} color={n >= goal ? glow.amber : glow.muted}>{word}</GText>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>{Array.from({ length: goal }, (_, k) => <View key={k} style={{ flex: 1, height: compact ? 5 : 7, borderRadius: 3, backgroundColor: k < n ? glow.amber : '#ffffff1a' }} />)}</View>
      </View>
    );
  }
  const st = strength(rated);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`${title}: ${st.word}${detail ? `, ${rated} rated` : ''}`} style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <GText bold size={z(compact ? 13 : 15)} style={{ flex: 1 }}>{title}</GText>
        <GText bold size={z(13)} color={glow.amber}>{st.word}</GText>
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>{[1, 2, 3, 4, 5].map((k) => <View key={k} style={{ flex: 1, height: compact ? 5 : 7, borderRadius: 3, backgroundColor: k <= st.segments ? glow.amber : '#ffffff1a' }} />)}</View>
      {detail ? (
        <GText size={z(13)} color={glow.muted}>
          {`${rated} rated`}{st.next !== null ? ` · ${st.next - rated} more to ${strength(st.next).word.toLowerCase()}` : ''}
        </GText>
      ) : null}
    </View>
  );
}
