/**
 * The Mood step (GoodWatch start-bar look): one big field, "or try:" presets, "Anything goes" when
 * the room has no idea yet. Enter or a preset continues; Next appears once you type. The same page
 * adds a friend's suggestion and edits or removes your own idea.
 */
import { useState } from 'react';
import { Platform, TextInput, View, type TextStyle } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { GText, Press, glow } from '../glow/theme';
import { IDEA_LIMITS } from './model';
import { leavePage } from './nav';
import { RoomLink } from './parts';
import { useRoom } from './RoomProvider';
import { Button, Screen, Small, TextLink } from './ui';
import { RoomStatus } from './RoomStatus';

/** GoodWatch start page words: same placeholder, same kind of presets (lower case, as typed). */
export const MOOD_PLACEHOLDER = 'Describe a mood, a plot, or a title…';
export const PRESETS = ['cheer me up', 'rainy day whodunit', 'twist ending', 'family night', 'space adventure', 'severance but funny', 'grown up cartoons', 'something short'];

export function MoodPage() {
  const { id, view, cmd, disabled } = useRoom();
  const { idea = 'new' } = useLocalSearchParams<{ idea?: string }>();
  const editing = view?.ideas.find((i) => i.id === idea && i.mine) ?? null;
  const mine = editing?.text ?? '';
  const [own, setOwn] = useState(mine);
  if (!view) return <RoomStatus />;
  const text = own.trim();
  const ready = text.length >= IDEA_LIMITS.min && text !== mine;
  const pick = (value: string) => {
    if (disabled) return;
    if (editing) void (value ? cmd.editIdea(editing.id, value) : cmd.removeIdea(editing.id));
    else if (value) void cmd.addIdea(value);
    leavePage(id);
  };
  const first = view.isHost && !view.ideas.length && !editing;
  return (
    <Screen testID="mood-page" back={() => leavePage(id)} footer={ready ? <Button label="Next" disabled={disabled} onPress={() => pick(text)} /> : undefined}>
      <View style={{ marginTop: 12, minWidth: 0, borderRadius: 12, backgroundColor: '#111827', borderWidth: 1, borderColor: text ? '#fbbf2466' : '#ffffff1f', overflow: 'hidden' }}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 14, minWidth: 0 }}>
          <TextInput autoFocus multiline accessibilityLabel="Mood" value={own} onChangeText={setOwn} maxLength={IDEA_LIMITS.max} placeholder={MOOD_PLACEHOLDER} placeholderTextColor="#6b7280"
            returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => { if (ready) pick(text); }}
            onKeyPress={Platform.OS === 'web' ? (e) => {
              const key = e.nativeEvent as unknown as { key: string; shiftKey?: boolean };
              if (key.key === 'Enter' && !key.shiftKey) { e.preventDefault(); if (ready) pick(text); }
            } : undefined}
            style={{ minWidth: 0, width: '100%', minHeight: 92, color: glow.ink, fontFamily: 'GabaritoBold', fontSize: 24, lineHeight: 30, letterSpacing: -0.4, textAlignVertical: 'top', outlineStyle: 'none' } as unknown as TextStyle} />
        </View>
      </View>
      <View style={{ gap: 10 }}>
        <Small>or try:</Small>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {PRESETS.map((p) => (
            <Press key={p} label={p} disabled={disabled} onPress={() => pick(p)} style={{ height: 30, paddingHorizontal: 11, borderRadius: 6, backgroundColor: '#ffffff0f', borderWidth: 1, borderColor: '#ffffff1a', minWidth: 0, minHeight: 30 }}>
              <GText size={13} color="#e5e7eb">{p}</GText>
            </Press>
          ))}
        </View>
      </View>
      {first ? <TextLink label="Anything goes" color={glow.muted} onPress={() => pick('')} /> : editing ? <TextLink label="Remove this idea" color={glow.muted} disabled={disabled} onPress={() => pick('')} /> : null}
      {first ? <RoomLink /> : null}
    </Screen>
  );
}
