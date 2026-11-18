import type { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
export const glow = {
  bg: '#070707',
  panel: '#131313',
  line: 'rgba(255,255,255,.12)',
  muted: '#a3a3a3',
  soft: '#d4d4d4',
  ink: '#fafafa',
  amber: '#fbbf24',
  /** Nope, the game answer paired with amber Yep: fills, lines, glow, stamps and the trailer play disc. */
  nope: '#ef4444',
  /** Nope words and icons. */
  nopeText: '#f87171',
  /** Nope's dark shade for the vote looks: band centers, stamp and wall shadows, the bleed tint. */
  nopeDeep: '#7f1d1d',
  /** Status, not the game: every inline error, Leave and Reset. */
  error: '#ffa59e',
  green: '#22c55e',
};
export const native = Platform.OS !== 'web';
export function GText({
  children,
  size = 16,
  bold = false,
  color = glow.ink,
  lines,
  selectable = false,
  style,
}: {
  children: ReactNode;
  size?: number;
  bold?: boolean;
  color?: string;
  lines?: number;
  selectable?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      selectable={selectable}
      numberOfLines={lines}
      style={[
        {
          fontFamily: bold ? 'GabaritoBold' : 'Gabarito',
          color,
          fontSize: size,
          lineHeight: size * 1.28,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
/** An inline error message in the status color; nothing when there is no message. */
export function ErrorText({ children, size = 14, lines, style }: { children?: ReactNode; size?: number; lines?: number; style?: StyleProp<TextStyle> }) {
  return children ? <GText size={size} color={glow.error} lines={lines} style={style}>{children}</GText> : null;
}
const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const box = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
const HEART = 'M12 20s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z';
/** Line icons: one stroked path each. */
const LINES = {
  check: 'M5 12 10 17 20 6',
  close: 'm6 6 12 12M18 6 6 18',
  left: 'M15 5 8 12 15 19',
  right: 'M9 5 16 12 9 19',
  down: 'm7 10 5 5 5-5',
  up: 'M12 19V5M6 11l6-6 6 6',
  plus: 'M12 5v14M5 12h14',
  undo: 'M4 9h10a6 6 0 1 1 0 12M9 4 4 9 9 14',
  external: 'M14 3h7v7m0-7L10 14M10 4H4v16h16v-6',
  arrowUpRight: 'M7 17 17 7M8 7h9v9',
  people: `${circle(9, 7, 3)}M3 20v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m3 9v-3a6 6 0 0 0-3-5`,
  clock: `${circle(12, 12, 9)}M12 7v5l3 2`,
  tickets: 'M4 11 2 8l8-5 9 14-8 5-2-3M7 6h15v5a2 2 0 0 0 0 4v5H7v-5a2 2 0 0 0 0-4ZM16 8v2m0 3v2m0 2v1',
  share: 'M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  qr: 'M4 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM15 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM4 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1zM14 14h3v3h-3zM18 18h3v3h-3zM14 20h1M20 14h1',
  copy: 'M11 9h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  door: 'M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l4-4-4-4M14 12H3',
  heart: HEART,
  thumbDown: 'M16 14V3M6 10l3.6 10.2A1.8 1.8 0 0 0 13 19.5V15h4.6a2 2 0 0 0 2-2.3l-1.2-7.4A2 2 0 0 0 16.4 3.6H6M3 3.6h3v10H3z',
  unseen: 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12ZM4 4l16 16',
  sliders: `M4 7h9M17 7h3M4 17h3M11 17h9${circle(15, 7, 2)}${circle(9, 17, 2)}`,
  film: `${box(3, 4, 18, 16, 3)}M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4M7 12h10`,
  tv: `${box(3, 4, 18, 13, 3)}M8 21h8M12 17v4`,
  archive: `${box(3, 4, 18, 5, 1.5)}M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4`,
  pencil: 'M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16Zm9.5-13.5 4 4',
} as const;
/** Icons with a filled part, drawn in the icon's color. */
const FILLED = {
  play: (color: string) => <Path d="m9 5 11 7-11 7Z" fill={color} stroke="none" />,
  heartFilled: (color: string) => <Path d={HEART} fill={color} />,
  dice: (color: string) => (
    <>
      <Path d={box(3, 3, 18, 18, 4)} />
      <Path d={[[8, 8], [16, 8], [12, 12], [8, 16], [16, 16]].map(([x, y]) => circle(x, y, 1)).join('')} fill={color} />
    </>
  ),
  // The presence cursor: the color with a white edge, so it reads on any poster.
  cursor: (color: string) => <Path d="M4 3 19 12 12 14 9 21Z" fill={color} stroke="#fff" strokeWidth={1.4} />,
} as const;
/** YepWatch's one icon set: a 24 px grid, a 2 px stroke and round caps. Size and color come from the call site. */
export type IconName = keyof typeof LINES | keyof typeof FILLED;
export function Icon({
  name,
  size = 22,
  color = glow.ink,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}
    >
      {name in FILLED ? FILLED[name as keyof typeof FILLED](color) : <Path d={LINES[name as keyof typeof LINES]} />}
    </Svg>
  );
}
/**
 * A quick double or triple click at one spot (the web counts them in the click's `detail`) is one
 * press: the control acts once, and the extra clicks never land on whatever replaced it under the
 * pointer (Done closing a sheet over Start, History opening its sheet over the backdrop).
 */
export function onePress(onPress: () => void) {
  return (e?: { nativeEvent?: unknown }) => {
    if (!native && ((e?.nativeEvent as { detail?: number } | undefined)?.detail ?? 1) > 1) return;
    onPress();
  };
}
export function Press({
  label,
  onPress,
  children,
  disabled = false,
  quiet = false,
  style,
  selected,
  hint,
  repeatable = false,
  visual,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  disabled?: boolean;
  /** Inert for a moment without dimming: the next screen is about to take over. */
  quiet?: boolean;
  style?: StyleProp<ViewStyle>;
  selected?: boolean;
  /** What pressing it does, read after the name. */
  hint?: string;
  /** Each tap of a quick double tap counts on its own (Yep and Nope: fast voting answers card after card). */
  repeatable?: boolean;
  /**
   * The control's look when it's smaller than its touch target: the press area (`style`) stays at
   * least 48 × 48 and transparent, and this box inside it carries the background, border and content.
   */
  visual?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      {...(!native && selected !== undefined ? { 'aria-pressed': selected } : {})}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: disabled || quiet, selected }}
      disabled={disabled || quiet}
      onPress={repeatable ? onPress : onePress(onPress)}
      // The web shows the press at once (its default waits 50 ms): every tap of a quick double or triple
      // tap gets its own feedback.
      {...(native ? null : { delayPressIn: 0 })}
      style={({ pressed }) => [
        s.press,
        style,
        disabled && { opacity: 0.42 },
        pressed && { opacity: 0.78 },
      ]}
    >
      {visual ? <View style={visual}>{children}</View> : children}
    </Pressable>
  );
}

/**
 * Space toggles a checkbox or switch (WAI-ARIA keyboard pattern). react-native-web's Pressable presses
 * on Space only for buttons, so on the web a focused checkbox or switch answers Enter alone. Spread it
 * on the Pressable that carries the checkbox or switch role.
 */
export function spaceToggles(onPress: () => void, disabled = false) {
  if (native) return null;
  return {
    onKeyDown: (e: { key?: string; repeat?: boolean; preventDefault(): void; nativeEvent?: { key?: string; repeat?: boolean } }) => {
      const key = e.key ?? e.nativeEvent?.key;
      if (key !== ' ' && key !== 'Spacebar') return;
      e.preventDefault(); // no page scroll
      if (!disabled && !(e.repeat ?? e.nativeEvent?.repeat)) onPress();
    },
  };
}

/** The smallest touch target (WCAG 2.2 target size, Android's 48 dp). */
export const TARGET = 48;
/**
 * A press area of at least the touch target around a smaller look (pair it with Press `visual`).
 * It takes its real size in the layout: Android neither reports nor reliably delivers touches outside
 * a parent's bounds, so negative margins would only shrink it back. With only `height` it grows vertically.
 */
export function grow(height: number, width?: number): ViewStyle {
  const h = Math.max(TARGET, height);
  if (width === undefined) return { minHeight: h };
  const w = Math.max(TARGET, width);
  return { minHeight: h, minWidth: w, width: w, height: h };
}
export function Wordmark({ size = 24 }: { size?: number }) {
  return (
    <Text
      accessibilityLabel="YepWatch"
      style={{ color: glow.ink, fontFamily: 'GabaritoBold', fontSize: size, letterSpacing: -0.8 }}
    >
      Yep<Text style={{ color: glow.amber }}>Watch</Text>
    </Text>
  );
}
export const s = StyleSheet.create({
  statusPage: { flex: 1, backgroundColor: glow.bg, justifyContent: 'center', padding: 24 },
  statusContent: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 22 },
  press: { alignItems: 'center', justifyContent: 'center', minWidth: 48, minHeight: 48 },
  absolute: { position: 'absolute', left: 0, top: 0, bottom: 0, right: 0 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
});
