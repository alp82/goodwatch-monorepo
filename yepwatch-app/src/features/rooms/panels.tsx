import { GoodWatchButton } from '../home/Landing';
import { useState, type ReactNode } from 'react';
import { Image, TextInput, View } from 'react-native';
import { parseInvite } from '../../core/invites';
import type { DecisionRecord } from '../../core/continuous/room-registry-state';
import type { InvitePreview } from '@goodwatch/yepwatch-contracts/proposal';
import { fitSize, type Kind } from '../room/model';
import { Hero, KindIcons, Small, T, kindsLabel } from '../room/ui';
import { GText, Icon, Press, glow } from '../glow/theme';
import { Action, Chip, FaceStack, Label, Panel } from '../shell/parts';
import { GoodWatchMark } from '../shell/marks';
import { R } from '../shell/tokens';
import type { HomeRoom } from './home-model';

const input = { color: glow.ink, backgroundColor: '#ffffff0a', borderWidth: 1, borderColor: '#ffffff1f', borderRadius: 8, paddingHorizontal: 14, minHeight: 48, fontFamily: 'Gabarito', fontSize: 16 } as const;
const MAX_NAME = 40;

/** A room request that hasn't been confirmed yet: retry it as-is (same identity, same request). */
export function RetryPanel({ action, busy, error, retry, extra }: { action: string; busy: boolean; error?: string; retry: () => void; extra?: ReactNode }) {
  return (
    <Panel testID="retry-panel" footer={<Action gold label={action} onPress={retry} disabled={busy} />}>
      {error ? <GText size={14} color="#fca5a5">{error}</GText> : null}
      {extra}
    </Panel>
  );
}

/** Room label, ideas and people take this much before the preview arrives, so the form doesn't move. */
const HEAD_HEIGHT = 150;
/** The host's possessive for the room label: "ALP’S ROOM", or "YOUR FRIEND’S ROOM" without a name. */
export const roomLabel = (hostName: string | null) => `${(hostName || 'Your friend').toUpperCase()}’S ROOM`;

/**
 * What a friend sees before joining (owner-approved prototype 9a2241e3e, RoomHead): whose room it
 * is, the switched-on ideas as the headline (one idea at hero size, several stacked and fitted,
 * none "Anything"), then the people and the kinds. `undefined` is still loading: the space is kept.
 */
export function InviteHead({ preview }: { preview: InvitePreview | undefined }) {
  const [width, setWidth] = useState(330);
  if (!preview) return <View testID="invite-head-pending" style={{ minHeight: HEAD_HEIGHT }} />;
  const kinds = preview.kinds.filter((k): k is Kind => k === 'movie' || k === 'show_start');
  const many = preview.ideas.length > 1;
  // Only the host has a name here; everyone else is a plain face.
  const faces = Array.from({ length: Math.min(preview.people, 50) }, (_, i) => ({ id: `p${i}`, nickname: i === 0 && preview.hostName ? preview.hostName : ' ' }));
  return (
    <View testID="invite-head" onLayout={(e) => { if (e.nativeEvent.layout.width > 0) setWidth(e.nativeEvent.layout.width); }} style={{ minHeight: HEAD_HEIGHT, justifyContent: 'flex-end', gap: 10 }}>
      <Small bold>{roomLabel(preview.hostName)}</Small>
      <View testID="invite-ideas" style={{ gap: 6 }}>
        {!preview.ideas.length ? <Hero color={glow.soft}>Anything</Hero> : preview.ideas.map((idea, i) => {
          const fs = fitSize(idea.text, width, many ? 28 : T.hero);
          return <GText key={i} bold size={fs} color={glow.ink} style={{ letterSpacing: -fs * 0.035, lineHeight: fs * 1.08 }}>{idea.text}</GText>;
        })}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {faces.length ? <FaceStack people={faces} size={24} max={6} /> : null}
        {kinds.length ? <><KindIcons kinds={kinds} size={16} color={glow.muted} /><Small>{kindsLabel(kinds)}</Small></> : null}
      </View>
    </View>
  );
}

/**
 * Join by link or code: your name (or Join as the remembered name), or Continue with GoodWatch.
 * An invitation link carries its code, so only manual joins show the code field.
 */
export function JoinPanel({ invite, nickname, member = false, initialCode = '', action, busy, error, editName, submit, signIn, extra, head }: {
  invite: boolean; nickname: string | null; member?: boolean; initialCode?: string; action: string; busy: boolean; error?: string;
  editName: () => void; submit: (code: string, nickname: string) => void; signIn?: (code: string) => void; extra?: ReactNode;
  /** The invited room's head (InviteHead) above the form. */
  head?: ReactNode;
}) {
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState('');
  const validCode = Boolean(parseInvite(code));
  const valid = validCode && (nickname ?? name).trim().length > 0 && !busy;
  const go = () => { if (valid) submit(code, (nickname ?? name).trim()); };
  const label = nickname && action === 'Join' ? `Join as ${nickname}` : action;
  return (
    <Panel testID="join-panel" footer={<Press label={label} onPress={go} disabled={!valid} style={{ height: 56, borderRadius: 10, flexDirection: 'row', gap: 10, backgroundColor: glow.amber }}>
      {member ? <GoodWatchMark size={22} /> : null}
      <GText bold size={17} color="#201400">{label}</GText>
    </Press>}>
      {head}
      {!invite || !initialCode ? (
        <TextInput autoFocus={!initialCode} accessibilityLabel="Room code or invitation" value={code} onChangeText={setCode} placeholder="Code or link" placeholderTextColor={glow.muted}
          autoCapitalize="characters" autoCorrect={false} returnKeyType={nickname ? 'go' : 'next'} submitBehavior="blurAndSubmit" onSubmitEditing={go}
          style={[input, { fontSize: 22, letterSpacing: 3, textAlign: 'center' }]} />
      ) : null}
      {nickname ? (
        <Press label="Change name" onPress={editName} style={{ alignSelf: 'flex-start', minHeight: 32 }}><GText size={13} bold color={glow.muted}>Change name</GText></Press>
      ) : (
        <View style={{ gap: 6 }}>
          <GText size={13} color={glow.muted}>Your name</GText>
          <TextInput autoFocus={Boolean(initialCode)} accessibilityLabel="Your name" value={name} onChangeText={setName} maxLength={MAX_NAME} autoCapitalize="words" autoComplete="nickname" placeholder="Your name" placeholderTextColor={glow.muted}
            returnKeyType="go" submitBehavior="blurAndSubmit" onSubmitEditing={go} style={input} />
          {signIn ? <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: '#ffffff14' }} /><GText size={13} color={glow.muted}>or</GText><View style={{ flex: 1, height: 1, backgroundColor: '#ffffff14' }} />
            </View>
            <GoodWatchButton disabled={busy || !validCode} onPress={() => signIn(code)} />
          </> : null}
        </View>
      )}
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
