import { GoodWatchButton } from '../home/Landing';
import { useState, type ReactNode } from 'react';
import { Image, TextInput, View } from 'react-native';
import { parseInvite } from '../../core/invites';
import type { DecisionRecord } from '../../core/continuous/room-registry-state';
import { GText, Icon, Press, glow } from '../glow/theme';
import { Action, Chip, FaceStack, Label, Panel } from '../shell/parts';
import { R } from '../shell/tokens';
import type { HomeRoom } from './home-model';

const input = { color: glow.ink, backgroundColor: '#0f0f0f', borderWidth: 1, borderColor: '#595959', borderRadius: R.control, padding: 14, fontFamily: 'Gabarito', fontSize: 17 } as const;
const MAX_NAME = 40;

/** Asked once, before the first Create or Join. Every later room reuses it. */
export function NamePanel({ initial = '', action, busy, error, submit, extra }: { initial?: string; action: string; busy: boolean; error?: string; submit: (name: string) => void; extra?: ReactNode }) {
  const [value, setValue] = useState(initial);
  const ok = value.trim().length > 0 && !busy;
  const go = () => { if (ok) submit(value.trim()); };
  return (
    <Panel testID="name-panel" footer={<Action gold label={action} onPress={go} disabled={!ok} />}>
      <Label>Your name</Label>
      <TextInput autoFocus accessibilityLabel="Your name" value={value} onChangeText={setValue} maxLength={MAX_NAME} autoCapitalize="words" autoComplete="nickname"
        placeholder="What friends call you" placeholderTextColor={glow.muted} returnKeyType="go" submitBehavior="blurAndSubmit" onSubmitEditing={go} style={input} />
      <Chip>Asked once · Shown in every room</Chip>
      {error ? <GText size={14} color="#fca5a5">{error}</GText> : null}
      {extra}
    </Panel>
  );
}

/** Join by code or invitation link, as the remembered name. The name is editable in Profile. */
export function JoinPanel({ nickname, initialCode = '', action, busy, error, editName, submit, notice, extra }: { nickname: string | null; initialCode?: string; action: string; busy: boolean; error?: string; editName: () => void; submit: (code: string, nickname: string) => void; notice?: string; extra?: ReactNode }) {
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState(nickname ?? '');
  const valid = Boolean(parseInvite(code)) && (nickname ?? name).trim().length > 0 && !busy;
  const go = () => { if (valid) submit(code, (nickname ?? name).trim()); };
  return (
    <Panel testID="join-panel" footer={<Action gold label={action} onPress={go} disabled={!valid} />}>
      <TextInput autoFocus={!initialCode} accessibilityLabel="Room code or invitation" value={code} onChangeText={setCode} placeholder="Code or link" placeholderTextColor={glow.muted}
        autoCapitalize="characters" autoCorrect={false} returnKeyType={nickname ? 'go' : 'next'} submitBehavior="blurAndSubmit" onSubmitEditing={go}
        style={[input, { fontSize: 22, letterSpacing: 3, textAlign: 'center' }]} />
      {nickname ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Chip>Joining as {nickname}</Chip>
          <Press label="Edit name" onPress={editName} style={{ minHeight: 44, paddingHorizontal: 8 }}><GText size={13} bold color={glow.amber}>Edit</GText></Press>
        </View>
      ) : (
        <>
          <Label>Your name</Label>
          <TextInput accessibilityLabel="Your name" value={name} onChangeText={setName} maxLength={MAX_NAME} autoCapitalize="words" placeholder="What friends call you" placeholderTextColor={glow.muted}
            returnKeyType="go" submitBehavior="blurAndSubmit" onSubmitEditing={go} style={input} />
        </>
      )}
      {notice ? <GText size={14} color={glow.muted}>{notice}</GText> : null}
      {error ? <GText size={14} color="#fca5a5">{error}</GText> : null}
      {extra}
    </Panel>
  );
}

/** Edits the remembered name for future rooms. Names inside existing rooms don't change. */
export function ProfilePanel({ nickname, save, member = false, signIn, busy, error }: { nickname: string | null; save: (name: string) => void; member?: boolean; signIn?: () => void; busy?: boolean; error?: string }) {
  const [value, setValue] = useState(nickname ?? '');
  const ok = value.trim().length > 0;
  const go = () => { if (ok) save(value.trim()); };
  return (
    <Panel testID="profile-panel" footer={<Action gold label="Save" onPress={go} disabled={!ok} />}>
      <Label>Your name</Label>
      <TextInput accessibilityLabel="Your name" value={value} onChangeText={setValue} maxLength={MAX_NAME} autoCapitalize="words" returnKeyType="done" submitBehavior="blurAndSubmit" onSubmitEditing={go} style={input} />
      <Chip>Used for new rooms</Chip>
      {member ? <Chip>Signed in with GoodWatch</Chip> : signIn ? <GoodWatchButton onPress={signIn} disabled={busy} /> : null}
      {error ? <GText size={14} color="#fca5a5">{error}</GText> : null}
    </Panel>
  );
}

const ago = (at: number, now: number) => {
  const m = Math.round((now - at) / 60000);
  if (m < 2) return 'now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
};

/** Past decisions are records; rooms you left can be returned to. */
export function HistoryPanel({ decisions, left, openRoom, canOpen, returnTo, busy }: { decisions: DecisionRecord[]; left: HomeRoom[]; openRoom: (roomId: string) => void; canOpen: (roomId: string) => boolean; returnTo: (room: HomeRoom) => void; busy: boolean }) {
  const [now] = useState(() => Date.now());
  return (
    <Panel testID="history-panel">
      {left.length > 0 && <>
        <Label>Left rooms</Label>
        {left.map((r) => (
          <View key={r.roomId} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: R.card, backgroundColor: '#ffffff08' }}>
            <View style={{ flex: 1, gap: 4 }}>
              <GText bold lines={1}>{r.label}</GText>
              <FaceStack people={r.people} size={22} />
            </View>
            <Action small label="Return" onPress={() => returnTo(r)} disabled={busy} />
          </View>
        ))}
      </>}
      <Label>Decided</Label>
      {!decisions.length && <GText color={glow.muted}>Nothing decided yet</GText>}
      {decisions.map((d) => {
        const body = (
          <>
            <View style={{ width: 46, height: 69, borderRadius: 8, overflow: 'hidden', backgroundColor: '#262626' }}>
              {d.posterUrl ? <Image source={{ uri: d.posterUrl.replace('/w500/', '/w185/') }} accessible={false} style={{ width: '100%', height: '100%' }} /> : null}
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <GText bold lines={1}>{d.title}{d.year ? ` (${d.year})` : ''}</GText>
              <GText size={13} color={glow.soft} lines={1}>{d.roomLabel}{d.people.length ? ` · ${d.people.join(', ')}` : ''}</GText>
              <GText size={12} color={glow.muted}>{ago(d.decidedAt, now)}</GText>
            </View>
          </>
        );
        return canOpen(d.roomId) ? (
          <Press key={d.id} label={`${d.title}, ${d.roomLabel}`} onPress={() => openRoom(d.roomId)} style={{ flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: 14, padding: 10, borderRadius: R.card, backgroundColor: '#ffffff06' }}>
            {body}
            <Icon name="right" size={16} color={glow.muted} />
          </Press>
        ) : (
          <View key={d.id} accessibilityLabel={`${d.title}, ${d.roomLabel}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 10, borderRadius: R.card, backgroundColor: '#ffffff06' }}>{body}</View>
        );
      })}
    </Panel>
  );
}
