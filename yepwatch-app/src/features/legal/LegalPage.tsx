import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { AppFrame } from '../shell/Frame';
import { GText, Press, glow } from '../glow/theme';
import { legalUpdated, type LegalSection } from './content';
import { LegalLinks } from './LegalLinks';
export function LegalPage({ title, sections }: { title: string; sections: LegalSection[] }) {
  return <AppFrame header={{ back: () => router.canGoBack() ? router.back() : router.replace('/') }} gap={22} width={760}>
    <GText bold size={32}>{title}</GText>
    <GText size={13} color={glow.muted}>Updated {legalUpdated}</GText>
    {sections.map(s => <View key={s.title} style={{ gap: 10 }}><GText bold size={21}>{s.title}</GText>{s.paragraphs.map(p => <GText key={p} size={16} style={{ lineHeight: 25 }}>{p}</GText>)}</View>)}
    <Press label="Email support" onPress={() => void Linking.openURL('mailto:hello@goodwatch.app')}><GText color={glow.amber}>hello@goodwatch.app</GText></Press>
    <LegalLinks />
  </AppFrame>;
}
