import { useContext, useRef, type ComponentRef, type ReactNode } from 'react';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BootPhase, BootTarget } from '../home/boot-phase';
import { Backdrop } from '../glow/Backdrop';
import { GText, Icon, Press, glow } from '../glow/theme';
import { FRAME, R, column } from './tokens';

/** Three header sizes: big on desktop, regular on phones and tablets, compact on short windows. */
export function useFrameSize() {
  const { width, height } = useWindowDimensions();
  const compact = height < 480;
  const big = !compact && width >= 900 && height >= 640;
  return {
    big, compact,
    bar: big ? 80 : compact ? 46 : 56,
    brand: big ? 30 : compact ? 20 : 22,
    people: big ? 44 : compact ? 30 : 36,
    faces: big ? 38 : compact ? 28 : 32,
    edge: big ? 32 : 16,
    sub: compact ? 48 : big ? 72 : 64,
  };
}

/**
 * Launch flight destination. Wraps only the glyphs (Y, ep, Watch) with the boot word's letter-spacing
 * ratio so the scaled boot word lands exactly on it; invisible (size kept) until the boot is ready.
 */
export function BrandMark({ size }: { size: number }) {
  const phase = useContext(BootPhase);
  const { setTarget } = useContext(BootTarget);
  const ref = useRef<ComponentRef<typeof View>>(null);
  const font = { fontFamily: 'GabaritoBold', fontSize: size, lineHeight: size * 1.2, letterSpacing: (-0.8 * size) / 64, color: glow.ink } as const;
  const web = Platform.OS === 'web' ? ({ dataSet: { homeBrand: '' } } as object) : {};
  return (
    <View
      ref={ref}
      {...web}
      onLayout={() => { if (Platform.OS !== 'web') ref.current?.measureInWindow((x, y, width, height) => setTarget({ x, y, width, height })); }}
      accessibilityLabel="YepWatch"
      style={{ flexDirection: 'row', alignSelf: 'center', opacity: phase === 'ready' ? 1 : 0 }}
    >
      <Text style={font}>Y</Text>
      <Text style={font}>ep</Text>
      <Text style={[font, { color: glow.amber }]}>Watch</Text>
    </View>
  );
}

/**
 * The page frame used by every screen: one background, a constant top bar (logo left, people right),
 * an optional subheader, and the body. Phones use the full height; large windows center the content
 * inside invisible 1120 × 920 bounds.
 */
export function AppFrame({ people, onLogo, subheader, children, testID }: { people?: ReactNode; onLogo?: () => void; subheader?: ReactNode; children: ReactNode; testID?: string }) {
  const size = useFrameSize();
  return (
    <SafeAreaView testID={testID} edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: glow.bg }}>
      <Backdrop />
      <View style={{ flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ flex: 1, width: '100%', minHeight: 0, maxWidth: FRAME.maxWidth, maxHeight: FRAME.maxHeight }}>
          <View style={{ height: size.bar, flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: size.edge }}>
            {onLogo ? <Press label="Your rooms" onPress={onLogo} style={{ alignItems: 'flex-start', paddingRight: 8 }}><BrandMark size={size.brand} /></Press> : <BrandMark size={size.brand} />}
            {people}
          </View>
          {subheader}
          <View style={{ flex: 1, minHeight: 0 }}>{children}</View>
        </View>
      </View>
    </SafeAreaView>
  );
}

export interface BackTarget { label: string; short: string; onPress: () => void }
/** Back and context live below the constant top bar. Back always names the view it returns to. */
export function SubHeader({ back, title, subtitle, right, large = false }: { back?: BackTarget | null; title: string; subtitle?: ReactNode; right?: ReactNode; large?: boolean }) {
  const size = useFrameSize();
  return (
    <View testID="subheader" style={{ height: size.sub, flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 10, ...column }}>
      {back && (
        <Press label={`Back to ${back.label}`} onPress={back.onPress} style={{ flexDirection: 'row', gap: 2, height: 40, paddingLeft: 6, paddingRight: 12, borderRadius: R.control, backgroundColor: '#ffffff0d', borderWidth: 1, borderColor: '#ffffff14' }}>
          <Icon name="left" size={18} color={glow.soft} />
          <GText size={13} bold color={glow.soft} lines={1} style={{ maxWidth: 110 }}>{back.short}</GText>
        </Press>
      )}
      <View style={{ flex: 1, minWidth: 0, gap: size.compact ? 0 : 2 }}>
        <GText size={large ? (size.compact ? 20 : size.big ? 32 : 26) : size.big ? 22 : 18} bold lines={1} style={{ letterSpacing: large ? -0.7 : -0.2 }}>{title}</GText>
        {!size.compact || !back ? subtitle : null}
      </View>
      {right}
    </View>
  );
}
