/**
 * React Native port of GoodWatch's poster score pill
 * (goodwatch-webapp/app/ui/poster-card/ScorePill.tsx, GoodWatch number only, no member score or state icon here).
 * Same rules: dark 90% pill with a hairline ring, a block in the score's vibe colour (tailwind --color-vibe-*),
 * floor(score) in heavy white, the white GoodWatch G (img/goodwatch-logo.webp, copied) only beside a lone
 * number from 8rem card width. Sizes S (h 20, 12 px) under 6.5rem, else M (h 24, 14 px).
 */
import { Image, View } from 'react-native';
import { GText } from './theme';

const vibe: Record<number, string> = { 0: '#7f1d1d', 10: '#991b1b', 20: '#b91c1c', 30: '#c2410c', 40: '#d97706', 50: '#ca8a04', 60: '#a3a323', 70: '#65a32d', 80: '#16934a', 90: '#15803d', 100: '#166534' };
const logo = require('../../../assets/goodwatch-logo-white.webp');

export function ScorePill({ score, cardWidth }: { score: number; cardWidth: number }) {
  if (!(score > 0)) return null;
  const small = cardWidth < 104;
  const h = small ? 20 : 24;
  return (
    <View accessibilityLabel={`GoodWatch score ${Math.floor(score)}`} style={{ flexDirection: 'row', padding: 2, borderRadius: 6, backgroundColor: 'rgba(3,7,18,0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}>
      <View style={{ height: h, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4, borderRadius: 5, backgroundColor: vibe[Math.min(100, Math.floor(score / 10) * 10)] }}>
        {cardWidth >= 128 && <Image source={logo} accessible={false} style={{ height: h - 8, width: h - 8 }} resizeMode="contain" />}
        <GText bold size={small ? 12 : 14} style={{ fontVariant: ['tabular-nums'], lineHeight: h }}>{Math.floor(score)}</GText>
      </View>
    </View>
  );
}
