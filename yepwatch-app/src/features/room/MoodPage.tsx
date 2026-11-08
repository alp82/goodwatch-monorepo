/**
 * The Mood step (direction D): one big centered field with an amber caret and underline, the "or try"
 * presets as a balanced chip cloud, and Create room (pinned on phones). The same page adds an idea
 * (or a friend's suggestion) and edits or removes your own.
 */
import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, TextInput, View, type TextStyle } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useReducedMotion } from '../../components/ui';
import { useLayout } from '../shell/layout';
import { warm } from '../shell/tokens';
import { GText, Icon, Press, glow, native } from '../glow/theme';
import { IDEA_LIMITS } from './model';
import { leavePage } from './nav';
import { CHAR_EM, webField } from './parts';
import { useRoom } from './RoomProvider';
import { Actions, Button, Screen, TextLink, usePinnedActions } from './ui';
import { RoomStatus } from './RoomStatus';

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

export function MoodPage() {
  const { id, view, cmd, disabled } = useRoom();
  const { phone, max, z } = useLayout();
  const pinned = usePinnedActions();
  const reduced = useReducedMotion();
  const { idea = 'new' } = useLocalSearchParams<{ idea?: string }>();
  const editing = view?.ideas.find((i) => i.id === idea && i.mine) ?? null;
  const mine = editing?.text ?? '';
  const [own, setOwn] = useState(mine);
  const [focus, setFocus] = useState(true);
  // Widths measured from the rendered words, so the underline is never narrower than them.
  const [placeholderWidths, setPlaceholderWidths] = useState<Record<string, number>>({});
  const [typedWidth, setTypedWidth] = useState(0);
  const [line] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useEffect(() => {
    if (reduced) { line.setValue(1); return; }
    Animated.timing(line, { toValue: 1, duration: 500, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [line, reduced]);
  if (!view) return <RoomStatus />;
  const text = own.trim();
  // Unchanged text still saves: Save then just goes back, so an opened idea never shows a dead button.
  const ready = text.length >= IDEA_LIMITS.min;
  const pick = (value: string) => {
    if (disabled) return;
    if (editing && value === mine) { leavePage(id); return; }
    if (editing) void (value ? cmd.editIdea(editing.id, value) : cmd.removeIdea(editing.id));
    else if (value) void cmd.addIdea(value);
    leavePage(id);
  };
  const submit = () => { if (ready) pick(text); };
  const first = view.isHost && !view.ideas.length && !editing;
  const col = Math.min(max, z(980));
  const placeholder = placeholderFit(col, phone, z);
  const size = own ? typedSize(own, col, phone, z) : placeholder.size;
  const lines = own ? Math.max(1, Math.min(4, Math.ceil((typedWidth * 1.06) / col))) : placeholder.lines.length;
  const placeholderWidth = Math.max(0, ...placeholder.lines.map((l) => placeholderWidths[l] ?? 0));
  const underline = Math.min(col, Math.max(placeholderWidth, own ? typedWidth : 0, z(240)) + z(24));
  const action = first ? 'Create room' : editing ? 'Save' : view.isHost ? 'Add idea' : 'Suggest';
  const create = <Button label={action} disabled={!ready || disabled} icon={<Icon name="right" size={18} color={warm.ink} />} onPress={submit} />;
  const chip = (preset: string) => {
    const on = text.toLowerCase() === preset;
    return (
      <Press key={preset} label={preset} selected={on} disabled={disabled} onPress={() => setOwn(on ? '' : preset)}
        style={{ minHeight: z(44), paddingHorizontal: z(17), borderRadius: 14, flexDirection: 'row', gap: 7, backgroundColor: on ? warm.amberSoft : '#ffffff07', borderWidth: 1, borderColor: on ? glow.amber : warm.line }}>
        {on ? <Icon name="check" size={z(15)} color={glow.amber} /> : null}
        <GText size={phone ? 15 : z(17)} bold={on} color={on ? glow.amber : glow.soft}>{preset}</GText>
      </Press>
    );
  };
  const font = { fontFamily: 'GabaritoBold', fontSize: size, lineHeight: size * 1.2, letterSpacing: -size * 0.03 } as const;
  return (
    <Screen testID="mood-page" back={() => leavePage(id)} pill={first ? { label: 'New room', state: 'new' } : undefined} width={col} gap={0}
      footer={pinned ? create : undefined}>
      <View style={{ gap: phone ? 30 : z(44), alignItems: 'center' }}>
        <View style={{ width: '100%', alignItems: 'center' }}>
          <View style={{ width: '100%' }}>
            <TextInput autoFocus multiline accessibilityLabel="Mood" value={own} onChangeText={setOwn} maxLength={IDEA_LIMITS.max} spellCheck={false} autoCorrect={false}
              onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} selectionColor={glow.amber} cursorColor={glow.amber}
              returnKeyType={first ? 'go' : 'done'} submitBehavior="submit" onSubmitEditing={submit}
              onKeyPress={Platform.OS === 'web' ? (e) => {
                const key = e.nativeEvent as unknown as { key: string; shiftKey?: boolean };
                if (key.key === 'Enter' && !key.shiftKey) { e.preventDefault(); submit(); }
              } : undefined}
              style={{ width: '100%', height: size * 1.2 * lines + 16, paddingVertical: 8, paddingHorizontal: 0, color: glow.ink, ...font, textAlign: 'center', textAlignVertical: 'top', ...webField, ...(Platform.OS === 'web' ? { resize: 'none', overflow: 'hidden' } : null) } as TextStyle} />
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
        {!pinned ? <Actions style={{ width: Math.min(col, z(340)) }}>{create}</Actions> : null}
        {first || editing ? (
          <View>
            {first ? <TextLink label="Anything goes" color={glow.muted} onPress={() => pick('')} />
              : <TextLink label="Remove this idea" color={glow.muted} disabled={disabled} onPress={() => pick('')} />}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
