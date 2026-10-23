import type { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Path, Rect, Circle, Polyline } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
export const glow = {
  bg: '#070707',
  panel: '#131313',
  line: 'rgba(255,255,255,.12)',
  muted: '#a3a3a3',
  soft: '#d4d4d4',
  ink: '#fafafa',
  amber: '#fbbf24',
  red: '#ef4444',
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
export type IconName =
  | 'star'
  | 'clock'
  | 'dice'
  | 'cursor'
  | 'tickets'
  | 'close'
  | 'left'
  | 'right'
  | 'undo'
  | 'check'
  | 'play'
  | 'people'
  | 'external'
  | 'settings';
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
      {name === 'star' ? <Path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" /> : name === 'clock' ? <><Circle cx="12" cy="12" r="9" /><Path d="M12 7v5l3 2" /></> : name === 'dice' ? <><Rect x="3" y="3" width="18" height="18" rx="4" /><Circle cx="8" cy="8" r="1" fill={color} /><Circle cx="16" cy="8" r="1" fill={color} /><Circle cx="12" cy="12" r="1" fill={color} /><Circle cx="8" cy="16" r="1" fill={color} /><Circle cx="16" cy="16" r="1" fill={color} /></> : name === 'cursor' ? (
        <Path d="M4 3 19 12 12 14 9 21Z" fill={color} stroke="#fff" strokeWidth={1.4} />
      ) : name === 'tickets' ? (
        <>
          <Path d="M4 11 2 8l8-5 9 14-8 5-2-3" />
          <Path d="M7 6h15v5a2 2 0 0 0 0 4v5H7v-5a2 2 0 0 0 0-4Z" />
          <Path d="M16 8v2m0 3v2m0 2v1" />
        </>
      ) : name === 'close' ? (
        <Path d="m6 6 12 12M18 6 6 18" />
      ) : name === 'left' ? (
        <Polyline points="15,5 8,12 15,19" />
      ) : name === 'right' ? (
        <Polyline points="9,5 16,12 9,19" />
      ) : name === 'check' ? (
        <Polyline points="5,12 10,17 20,6" />
      ) : name === 'undo' ? (
        <>
          <Path d="M4 9h10a6 6 0 1 1 0 12" />
          <Polyline points="9,4 4,9 9,14" />
        </>
      ) : name === 'play' ? (
        <Path d="m9 5 11 7-11 7Z" fill={color} stroke="none" />
      ) : name === 'people' ? (
        <>
          <Circle cx="9" cy="7" r="3" />
          <Path d="M3 20v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m3 9v-3a6 6 0 0 0-3-5" />
        </>
      ) : name === 'external' ? (
        <>
          <Path d="M14 3h7v7m0-7L10 14M10 4H4v16h16v-6" />
        </>
      ) : (
        <>
          <Rect x="5" y="4" width="14" height="16" rx="3" />
          <Path d="M9 9h6m-6 6h6" />
        </>
      )}
    </Svg>
  );
}
export function Press({
  label,
  onPress,
  children,
  disabled = false,
  style,
  selected,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  selected?: boolean;
}) {
  return (
    <Pressable
      {...(!native && selected !== undefined ? { 'aria-pressed': selected } : {})}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.press,
        style,
        disabled && { opacity: 0.42 },
        pressed && { opacity: 0.78 },
      ]}
    >
      {children}
    </Pressable>
  );
}
export function Pill({
  label,
  onPress,
  icon,
  children,
  disabled,
  gold = false,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  children?: ReactNode;
  disabled?: boolean;
  gold?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Press
      label={label}
      onPress={onPress}
      disabled={disabled}
      style={[s.pill, gold && { backgroundColor: glow.amber, borderColor: glow.amber }, style]}
    >
      {icon && <Icon name={icon} color={gold ? '#201400' : glow.ink} />}
      {children && (
        <GText bold color={gold ? '#201400' : glow.ink}>
          {children}
        </GText>
      )}
    </Press>
  );
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
export function VoteButton({
  yes,
  onPress,
  disabled,
  big,
}: {
  yes: boolean;
  onPress: () => void;
  disabled: boolean;
  big: boolean;
}) {
  return (
    <Press
      label={yes ? 'Yep' : 'Nope'}
      onPress={onPress}
      disabled={disabled}
      style={{ flex: 1, borderRadius: 22, overflow: 'hidden', minHeight: big ? 70 : 62 }}
    >
      <LinearGradient
        colors={yes ? ['#4ade80', '#15803d'] : ['#f87171', '#b91c1c']}
        style={{
          flex: 1,
          minHeight: big ? 70 : 62,
          flexDirection: 'row',
          gap: 10,
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <Icon name={yes ? 'check' : 'close'} size={27} />
        <GText size={25} bold>
          {yes ? 'Yep' : 'Nope'}
        </GText>
      </LinearGradient>
    </Press>
  );
}
export const s = StyleSheet.create({
  statusPage: { flex: 1, backgroundColor: glow.bg, justifyContent: 'center', padding: 24 },
  statusContent: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 22 },
  press: { alignItems: 'center', justifyContent: 'center', minWidth: 44, minHeight: 44 },
  pill: {
    borderRadius: 999,
    backgroundColor: '#242424',
    borderColor: glow.line,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    minHeight: 48,
  },
  absolute: { position: 'absolute', left: 0, top: 0, bottom: 0, right: 0 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
});
export function Score({ value, size = 34 }: { value: number; size?: number }) {
  const r = size / 2 - 3;
  const circumference = 2 * Math.PI * r;
  return <ViewScore value={value} size={size} r={r} circumference={circumference} />;
}
function ViewScore({
  value,
  size,
  r,
  circumference,
}: {
  value: number;
  size: number;
  r: number;
  circumference: number;
}) {
  return (
    <Pressable
      accessible
      accessibilityRole="text"
      accessibilityLabel={`GoodWatch score ${value}`}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="#141414"
          stroke="#ffffff24"
          strokeWidth={3}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={value >= 85 ? '#16a34a' : value >= 75 ? '#65a32d' : '#ca8a04'}
          strokeWidth={3}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - Math.max(0, Math.min(100, value)) / 100)}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <GText bold size={size * 0.34}>
        {Math.round(value)}
      </GText>
    </Pressable>
  );
}
