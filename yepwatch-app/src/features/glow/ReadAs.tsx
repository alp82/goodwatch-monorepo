import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { RoomDescription } from '@goodwatch/yepwatch-contracts/proposal';
import { getFingerprintMeta } from '@goodwatch/yepwatch-contracts/fingerprint';
import { GText, glow } from './theme';

// The same fingerprint palette and concept ordering as GoodWatch's ReadAsChips.
export function ReadAs({ attributes }: { attributes: RoomDescription['attributes'] }) {
  const wanted = attributes.filter(a => a.kind === 'want' || a.kind === 'attribute').slice(0, 4);
  const avoided = attributes.filter(a => a.kind === 'avoid' || a.kind === 'excluded').slice(0, 2);
  const chips = wanted.length || avoided.length ? [...wanted, ...avoided] : attributes.filter(a => a.kind === 'phrase').slice(0, 4);
  if (!chips.length) return null;
  return (
    <View accessibilityLabel="Search interpretation" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
      <View testID="reading-fingerprint" style={{ paddingTop: 3 }}>
        {/* Heroicons FingerPrint, matching GoodWatch search. */}
        <Svg width={18} height={18} viewBox="0 0 24 24" fill={glow.amber} accessible={false}>
          <Path fillRule="evenodd" clipRule="evenodd" d="M12 3.75a6.715 6.715 0 0 0-3.722 1.118.75.75 0 1 1-.828-1.25 8.25 8.25 0 0 1 12.8 6.883c0 3.014-.574 5.897-1.62 8.543a.75.75 0 0 1-1.395-.551A21.69 21.69 0 0 0 18.75 10.5 6.75 6.75 0 0 0 12 3.75ZM6.157 5.739a.75.75 0 0 1 .21 1.04A6.715 6.715 0 0 0 5.25 10.5c0 1.613-.463 3.12-1.265 4.393a.75.75 0 0 1-1.27-.8A6.715 6.715 0 0 0 3.75 10.5c0-1.68.503-3.246 1.367-4.55a.75.75 0 0 1 1.04-.211ZM12 7.5a3 3 0 0 0-3 3c0 3.1-1.176 5.927-3.105 8.056a.75.75 0 1 1-1.112-1.008A10.459 10.459 0 0 0 7.5 10.5a4.5 4.5 0 1 1 9 0c0 .547-.022 1.09-.067 1.626a.75.75 0 0 1-1.495-.123c.041-.495.062-.996.062-1.503a3 3 0 0 0-3-3Zm0 2.25a.75.75 0 0 1 .75.75c0 3.908-1.424 7.485-3.781 10.238a.75.75 0 0 1-1.14-.975A14.19 14.19 0 0 0 11.25 10.5a.75.75 0 0 1 .75-.75Zm3.239 5.183a.75.75 0 0 1 .515.927 19.417 19.417 0 0 1-2.585 5.544.75.75 0 0 1-1.243-.84 17.915 17.915 0 0 0 2.386-5.116.75.75 0 0 1 .927-.515Z" />
        </Svg>
      </View>
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {chips.map((chip, i) => {
          const excluded = chip.kind === 'avoid' || chip.kind === 'excluded';
          const fingerprint = chip.kind === 'want' && chip.key ? getFingerprintMeta(chip.key) : undefined;
          const label = excluded
            ? chip.key ? getFingerprintMeta(chip.key).label : chip.text.replace(/^(not|low)\s+/i, '').replace(/^./, c => c.toUpperCase())
            : fingerprint?.label ?? chip.text;
          const background = excluded ? '#ffffff0d' : fingerprint?.color ?? 'rgba(56,189,248,0.15)';
          return (
            <View key={`${chip.kind}:${chip.key ?? chip.text}:${i}`} accessible accessibilityLabel={excluded ? `Not ${label}` : label} style={{ borderRadius: 16, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: background, borderWidth: 1, borderColor: excluded ? '#ffffff1a' : fingerprint ? 'transparent' : 'rgba(56,189,248,0.3)' }}>
              <GText bold size={12} color={excluded ? '#9ca3af' : fingerprint ? contrastText(fingerprint.color) : '#e0f2fe'}
                style={excluded ? { textDecorationLine: 'line-through', textDecorationColor: '#fb7185' } : undefined}>
                {label}
              </GText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// Match GoodWatch's contrast choice for translucent fingerprint colors on a dark surface.
function contrastText(rgba: string) {
  const [r, g, b, a = 1] = (rgba.match(/[\d.]+/g) ?? []).map(Number);
  const linear = [r, g, b].map((c, i) => {
    const s = (c * a + [3, 7, 18][i] * (1 - a)) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05 ? '#ffffff' : '#030712';
}
