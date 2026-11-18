/**
 * How it works, next to the couch's title: a quiet link that opens a dialog (760 px on wide windows, a
 * bottom sheet on phones) with the start page's intro film and the three steps.
 */
import { View } from 'react-native';
import { IntroFilm } from '../home/IntroFilm';
import { GText, glow } from '../glow/theme';
import { HoverPress } from '../shell/hover';
import { useLayout } from '../shell/layout';
import { Sheet } from '../shell/Sheet';
import { R, warm } from '../shell/tokens';
import { useRoom } from './RoomProvider';

export const HOW_STEPS = ['Everyone gets the same cards', 'Say Yep or Nope to each', 'Titles you all said Yep to match'] as const;
const DIALOG_PX = 760;

/** "How it works" with a small question mark. The press area is 48 px tall whatever the type size. */
export function HowLink({ onPress }: { onPress: () => void }) {
  const { phone, z } = useLayout();
  const f = phone ? 13 : z(15);
  const q = Math.round(f * 1.3);
  return (
    <HoverPress label="How it works" hover="tint" repeatable onPress={onPress} style={{ height: 48, paddingHorizontal: 8, marginRight: -8, borderRadius: R.control, flexDirection: 'row', gap: 7 }}>
      <View style={{ width: q, height: q, borderRadius: q / 2, borderWidth: 1.5, borderColor: glow.muted, alignItems: 'center', justifyContent: 'center' }}>
        <GText bold size={f * 0.78} color={glow.muted}>?</GText>
      </View>
      <GText bold size={f} color={glow.muted} lines={1}>How it works</GText>
    </HoverPress>
  );
}

/** The dialog: the intro film (it loops) and the steps. */
export function HowItWorksSheet() {
  const { closeSheet } = useRoom();
  const { phone, width, k, z } = useLayout();
  const panel = phone ? width : Math.min(DIALOG_PX, width - 64);
  const inner = panel - 2 * z(20) - 2;
  const big = !phone;
  return (
    <Sheet testID="how-sheet" title="How it works" onClose={closeSheet} width={phone ? 680 : DIALOG_PX / k}>
      <View style={{ gap: big ? 22 : 14 }}>
        <View testID="how-film" style={{ width: inner, paddingVertical: big ? 28 : 16, borderRadius: R.card, backgroundColor: '#0d0b08', borderWidth: 1, borderColor: warm.line, alignItems: 'center', overflow: 'hidden' }}>
          <IntroFilm obscured={false} height={big ? 300 : 190} width={inner - 40} />
        </View>
        <View style={{ gap: big ? 12 : 8 }}>
          {HOW_STEPS.map((t, i) => (
            <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: big ? 28 : 22, height: big ? 28 : 22, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff12' }}>
                <GText bold size={big ? 15 : 12} color={glow.soft}>{String(i + 1)}</GText>
              </View>
              <GText size={big ? 19 : 15} color={glow.ink}>{t}</GText>
            </View>
          ))}
        </View>
        <GText size={phone ? 14 : 17} color={glow.muted}>Each card asks: Would you watch this tonight? The mood you pick decides which cards get dealt.</GText>
      </View>
    </Sheet>
  );
}
