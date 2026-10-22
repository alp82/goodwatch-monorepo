import { type ReactNode, useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { developmentNotice } from '../core/config';

export const colors = { bg: '#060606', panel: '#171717', raised: '#262626', line: '#383838', ink: '#fafafa', muted: '#b6b6b6', amber: '#fbbf24', amberInk: '#1c1404', green: '#86d4aa', danger: '#ffb2ad' };
export function Words({ children, muted = false, style }: { children: ReactNode; muted?: boolean; style?: TextStyle }) {
  return <Text style={[s.text, muted && { color: colors.muted }, style]}>{children}</Text>;
}
export function Heading({ children }: { children: ReactNode }) { return <Text accessibilityRole="header" style={s.heading}>{children}</Text>; }
export function Panel({ children }: { children: ReactNode }) { return <View style={s.panel}>{children}</View>; }
export function Row({ children }: { children: ReactNode }) { return <View style={s.row}>{children}</View>; }
export function Button({ children, onPress, disabled = false, secondary = false, selected, label }: { children: ReactNode; onPress: () => void; disabled?: boolean; secondary?: boolean; selected?: boolean; label?: string }) {
  return <Pressable {...(Platform.OS === 'web' && selected !== undefined ? { 'aria-pressed': selected } : {})} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, selected && s.selected, pressed && { opacity: 0.72 }, disabled && { opacity: 0.45 }]}><Text style={[s.buttonText, secondary && { color: colors.ink }]}>{children}</Text></Pressable>;
}
export function Field({ label, value, onChange, placeholder, numeric = false, secret = false }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; numeric?: boolean; secret?: boolean }) {
  return <View style={s.field}><Words>{label}</Words><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#999" keyboardType={numeric ? 'number-pad' : 'default'} autoCapitalize="none" autoCorrect={false} secureTextEntry={secret} style={s.input} /></View>;
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <View accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[s.notice, error && { borderColor: colors.danger }]}><Words style={{ color: error ? colors.danger : colors.muted }}>{children}</Words></View>;
}
export function Page({ children, eyebrow }: { children: ReactNode; eyebrow?: string }) {
  return <SafeAreaView style={s.safe}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}><View style={s.content}><View style={s.brandRow}><Text accessibilityLabel="YepWatch" style={s.brand}>Yep<Text style={{ color: colors.amber }}>Watch</Text></Text><Words muted style={{ fontSize: 13 }}>By GoodWatch</Words></View>{developmentNotice && <Notice>{developmentNotice}</Notice>}{eyebrow && <Words muted style={{ fontSize: 13, letterSpacing: 1 }}>{eyebrow.toUpperCase()}</Words>}{children}<Words muted style={s.footer}>Choose together. Play on your own screens.</Words></View></ScrollView></SafeAreaView>;
}
export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => { let active = true; AccessibilityInfo.isReduceMotionEnabled().then(v => { if (active) setReduced(v); }); const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced); return () => { active = false; sub.remove(); }; }, []);
  return reduced;
}
/** Neutral presence only: this pulse never depends on a vote or current title. */
export function ActivityDot({ active }: { active: boolean }) {
  const reduced = useReducedMotion(); const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => { if (!active || reduced) { opacity.setValue(1); return; } const animation = Animated.loop(Animated.sequence([Animated.timing(opacity, { toValue: 0.35, duration: 1100, useNativeDriver: true }), Animated.timing(opacity, { toValue: 1, duration: 1100, useNativeDriver: true })])); animation.start(); return () => animation.stop(); }, [active, reduced, opacity]);
  return <Animated.View accessible={false} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: active ? colors.green : colors.muted, opacity }} />;
}
export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg }, scroll: { flexGrow: 1 }, content: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 24, gap: 20, paddingBottom: 40 },
  text: { fontFamily: 'Gabarito', fontSize: 16, lineHeight: 23, color: colors.ink }, heading: { fontFamily: 'GabaritoBold', fontSize: 34, lineHeight: 39, color: colors.ink, letterSpacing: -0.5 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 14, marginBottom: 14 }, brand: { fontFamily: 'GabaritoBold', fontSize: 27, color: colors.ink, letterSpacing: -1 },
  panel: { backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: 16, padding: 18, gap: 14 }, row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  button: { minHeight: 48, borderRadius: 12, backgroundColor: colors.amber, paddingVertical: 13, paddingHorizontal: 18, justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' }, secondary: { backgroundColor: colors.raised, borderColor: colors.line }, selected: { borderColor: colors.amber, borderWidth: 2, paddingVertical: 12, paddingHorizontal: 17 }, buttonText: { fontFamily: 'GabaritoBold', fontSize: 16, color: colors.amberInk, textAlign: 'center' },
  field: { gap: 8 }, input: { minHeight: 48, backgroundColor: '#0f0f0f', borderWidth: 1, borderColor: '#595959', borderRadius: 10, color: colors.ink, padding: 12, fontFamily: 'Gabarito', fontSize: 17 },
  notice: { padding: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: '#101010' }, footer: { textAlign: 'center', fontSize: 13, marginTop: 20 },
});
