import { View } from 'react-native';
import { router } from 'expo-router';
import { GText, Press, glow } from '../glow/theme';
export function LegalLinks() {
  return <View style={{ gap: 2 }}>
    {([['Privacy policy', '/privacy'], ['Help and support', '/support'], ['Terms of use', '/terms'], ['Delete YepWatch account', '/delete-account']] as const).map(([label, href]) =>
      <Press key={href} label={label} onPress={() => router.push(href)} style={{ alignSelf: 'flex-start', minHeight: 44 }}><GText size={14} color={glow.soft}>{label}</GText></Press>)}
  </View>;
}
