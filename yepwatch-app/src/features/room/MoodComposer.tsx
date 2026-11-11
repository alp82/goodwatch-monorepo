import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, TextInput, View, type TextStyle } from 'react-native';
import { useReducedMotion } from '../../components/ui';
import { useLayout } from '../shell/layout';
import { warm } from '../shell/tokens';
import { GText, Icon, Press, glow, native } from '../glow/theme';
import { IDEA_LIMITS } from './model';
import { CHAR_EM, webField } from './parts';
import { Actions, Button, Screen, TextLink, usePinnedActions } from './ui';

/** Moods, themes and plots, not titles. */
export const MOOD_PLACEHOLDER = 'Describe a mood, a theme, or a plot…';
/** The placeholder on narrow windows: two near-equal lines. */
const PLACEHOLDER_LINES = ['Describe a mood,', 'a theme, or a plot…'] as const;
export const PRESETS = ['cheer me up', 'rainy day whodunit', 'twist ending', 'family night', 'space adventure', 'severance but funny', 'grown up cartoons', 'something short'];

/**
 * Placeholder size: the whole line on one row, fitted to the column; two lines when one row would
 * get too small.
 */
export function placeholderFit(col: number, phone: boolean, z: (n: number) => number) {
  const oneRow = Math.floor(col / (MOOD_PLACEHOLDER.length * CHAR_EM));
  const twoLines = oneRow < 30;
  const size = twoLines ? Math.min(phone ? 34 : 44, Math.floor(col / (PLACEHOLDER_LINES[1].length * CHAR_EM))) : Math.min(z(64), oneRow);
  return { size, lines: twoLines ? [...PLACEHOLDER_LINES] : [MOOD_PLACEHOLDER] };
}

/** Typed text: big, a bit smaller once it's long, never so big that its longest word overflows. */
function typedSize(text: string, col: number, phone: boolean, z: (n: number) => number) {
  const base = phone ? (text.length > 26 ? 30 : 38) : z(text.length > 34 ? 46 : 60);
  const longest = Math.max(1, ...text.split(/\s+/).map((w) => w.length));
  return Math.max(20, Math.min(base, Math.floor(col / (longest * 0.6))));
}

/** The editor is local: room creation and saves never prevent typing or picking a preset. */
export function MoodComposer({ initialText = '', text: controlledText, first = false, action = 'Create room', editing = false, disabled = false, saving = false, error, details, pick, back, onTextChange }: {
  initialText?: string; first?: boolean; action?: string; editing?: boolean; disabled?: boolean;
  text?: string;
  saving?: boolean; error?: string; details?: ReactNode;
  pick: (text: string) => void; back?: () => void; onTextChange?: (text: string) => void;
}) {
  const { phone, max, z } = useLayout();
  const pinned = usePinnedActions();
  const reduced = useReducedMotion();
  const [localText, setOwn] = useState(initialText);
  const own = controlledText ?? localText;
  const change = (text: string) => { setOwn(text); onTextChange?.(text); };
  const [focus, setFocus] = useState(true);
  // Widths measured from the rendered words, so the underline is never narrower than them.
  const [placeholderWidths, setPlaceholderWidths] = useState<Record<string, number>>({});
  const [typedWidth, setTypedWidth] = useState(0);
  const [line] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useEffect(() => {
    if (reduced) { line.setValue(1); return; }
    Animated.timing(line, { toValue: 1, duration: 500, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [line, reduced]);
  const text = own.trim();
  const ready = text.length >= IDEA_LIMITS.min;
  const submit = () => { if (ready && !disabled) pick(text); };
  const col = Math.min(max, z(980));
  const placeholder = placeholderFit(col, phone, z);
  const size = own ? typedSize(own, col, phone, z) : placeholder.size;
  const lines = own ? Math.max(1, Math.min(4, Math.ceil((typedWidth * 1.06) / col))) : placeholder.lines.length;
  // The field keeps one height while typing (the placeholder's, or room for a usual mood: two lines on
  // phones, one on wider windows), so the presets below don't move under the finger. Only a longer
  // text grows it.
  const reserved = Math.max(placeholder.size * 1.2 * placeholder.lines.length, (phone ? 38 : z(60)) * 1.2 * (phone ? 2 : 1)) + 16;
  const fieldHeight = Math.max(reserved, size * 1.2 * lines + 16);
  const placeholderWidth = Math.max(0, ...placeholder.lines.map((l) => placeholderWidths[l] ?? 0));
  const underline = Math.min(col, Math.max(placeholderWidth, own ? typedWidth : 0, z(240)) + z(24));
  const create = <Button label={saving ? 'Saving…' : action} disabled={!ready || disabled} icon={<Icon name="right" size={18} color={warm.ink} />} onPress={submit} />;
  const chip = (preset: string) => {
    const on = text.toLowerCase() === preset;
    return (
      <Press key={preset} label={preset} selected={on} disabled={saving} onPress={() => change(on ? '' : preset)}
        style={{ minHeight: z(44), paddingHorizontal: z(17), borderRadius: 14, flexDirection: 'row', gap: 7, backgroundColor: on ? warm.amberSoft : '#ffffff07', borderWidth: 1, borderColor: on ? glow.amber : warm.line }}>
        {on ? <Icon name="check" size={z(15)} color={glow.amber} /> : null}
        <GText size={phone ? 15 : z(17)} bold={on} color={on ? glow.amber : glow.soft}>{preset}</GText>
      </Press>
    );
  };
  const font = { fontFamily: 'GabaritoBold', fontSize: size, lineHeight: size * 1.2, letterSpacing: -size * 0.03 } as const;
  return (
    <Screen testID="mood-page" back={back} pill={first ? { label: 'New room', state: 'new' } : undefined} width={col} gap={0}
      footer={pinned ? create : undefined}>
      <View style={{ gap: phone ? 30 : z(44), alignItems: 'center' }}>
        <View style={{ width: '100%', alignItems: 'center' }}>
          <View style={{ width: '100%' }}>
            <TextInput autoFocus multiline accessibilityLabel="Mood" editable={!saving} value={own} onChangeText={change} maxLength={IDEA_LIMITS.max} spellCheck={false} autoCorrect={false}
              onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} selectionColor={glow.amber} cursorColor={glow.amber}
              returnKeyType={first ? 'go' : 'done'} submitBehavior="submit" onSubmitEditing={submit}
              onKeyPress={Platform.OS === 'web' ? (e) => {
                const key = e.nativeEvent as unknown as { key: string; shiftKey?: boolean };
                if (key.key === 'Enter' && !key.shiftKey) { e.preventDefault(); submit(); }
              } : undefined}
              style={{ width: '100%', height: fieldHeight, paddingVertical: 8, paddingHorizontal: 0, color: glow.ink, ...font, textAlign: 'center', textAlignVertical: 'top', ...webField, ...(Platform.OS === 'web' ? { resize: 'none', overflow: 'hidden' } : null) } as TextStyle} />
            {!own ? (
              <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 8, alignItems: 'center' }}>
                {placeholder.lines.map((l) => (
                  <View key={l} onLayout={(e) => { const w = e.nativeEvent.layout.width; setPlaceholderWidths((m) => (m[l] === w ? m : { ...m, [l]: w })); }}>
                    <GText bold size={size} color={warm.placeholder} lines={1} style={{ ...font, textAlign: 'center' }}>{l}</GText>
                  </View>
                ))}
              </View>
            ) : null}
            {/* The typed words on one unbroken row, invisible: their width sizes the field and the underline. */}
            <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden style={{ position: 'absolute', left: 0, top: 0, width: 100000, flexDirection: 'row', opacity: 0 }}>
              <View onLayout={(e) => setTypedWidth(e.nativeEvent.layout.width)}><GText bold size={size} style={font}>{own || ' '}</GText></View>
            </View>
          </View>
          <Animated.View testID="mood-underline" style={{ width: underline, height: 3, borderRadius: 1.5, marginTop: 8, backgroundColor: focus || own ? glow.amber : '#ffffff1f', opacity: line }} />
        </View>
        <View style={{ gap: z(14), alignItems: 'center', alignSelf: 'stretch' }}>
          <GText size={z(14)} color={glow.muted}>or try</GText>
          {phone
            ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>{PRESETS.map(chip)}</View>
            : [PRESETS.slice(0, 4), PRESETS.slice(4)].map((row) => <View key={row[0]} style={{ flexDirection: 'row', justifyContent: 'center', gap: z(10) }}>{row.map(chip)}</View>)}
        </View>
        {error ? <View accessibilityLiveRegion="polite"><GText color="#fca5a5" size={15} style={{ textAlign: 'center' }}>{error}</GText></View> : null}
        {details}
        {!pinned ? <Actions style={{ width: Math.min(col, z(340)) }}>{create}</Actions> : null}
        {first || editing ? (
          <View>
            {first ? <TextLink label="Anything goes" color={glow.muted} disabled={disabled} onPress={() => pick('')} />
              : <TextLink label="Remove this idea" color={glow.muted} disabled={disabled} onPress={() => pick('')} />}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
