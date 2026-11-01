/** Room pieces shared by several screens: ideas, the share card, the room control, services, country and kinds. */
import { useState, type ReactNode } from 'react';
import { Image, Pressable, TextInput, View } from 'react-native';
import { deviceCountryHint, rankedCountries } from '../../core/lobby';
import { shareInvitation } from '../../core/share-invitation';
import { FaceStack } from '../shell/parts';
import { GText, Icon, Press, glow } from '../glow/theme';
import { fitSize, type Kind } from './model';
import { openPage } from './nav';
import { useRoom } from './RoomProvider';
import { firstTiles, pickedIn, type ServiceChoice } from './services';
import { HeroIcon, NewBadge, Small, Switch, T, TextLink, card, fieldStyle } from './ui';

export const flag = (code: string) =>
  /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0))) : '🌐';

/**
 * Every idea in one box per row: the text gets the width, the author's face (or your pencil) sits at
 * the end, and the switch decides which ideas count. Everyone sees the same list; only the host's
 * switches work. A friend's idea the host hasn't switched on carries an inline NEW for the host.
 */
export function IdeaList({ size }: { size?: number }) {
  const { id, view, cmd, disabled } = useRoom();
  const [width, setWidth] = useState(330);
  if (!view) return null;
  const max = size ?? (view.ideas.length > 1 ? 28 : T.hero);
  const addLabel = view.isHost ? 'Add an idea' : 'Suggest an idea';
  return (
    <View testID="idea-list" onLayout={(e) => { if (e.nativeEvent.layout.width > 0) setWidth(e.nativeEvent.layout.width); }} style={{ gap: 8 }}>
      {!view.ideas.length && <GText bold size={max} color={glow.soft} style={{ letterSpacing: -max * 0.035, lineHeight: max * 1.05 }}>Anything</GText>}
      {view.ideas.map((i) => {
        const fs = fitSize(i.text, Math.max(120, width - 120), max);
        const inner = (
          <>
            <GText bold size={fs} color={i.on ? glow.ink : glow.muted} style={{ flex: 1, letterSpacing: -fs * 0.03, lineHeight: fs * 1.1 }}>{i.text}</GText>
            {view.isHost && i.fresh && !i.mine ? <NewBadge /> : null}
            {i.mine ? <HeroIcon name="pencil" size={16} color={glow.muted} /> : i.author ? <FaceStack people={[{ id: i.author.id, nickname: i.author.nickname || '?' }]} size={20} /> : null}
          </>
        );
        const box = { flex: 1, minWidth: 0, flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: i.mine ? '#ffffff24' : 'transparent', backgroundColor: i.mine ? '#ffffff08' : 'transparent' } as const;
        return (
          <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: -12 }}>
            {i.mine ? <Press label={`${i.text}, edit`} onPress={() => openPage(id, 'mood', { idea: i.id })} style={box}>{inner}</Press> : <View accessible accessibilityLabel={`${i.text}${i.author?.nickname ? `, from ${i.author.nickname}` : ''}${view.isHost && i.fresh ? ', new' : ''}`} style={box}>{inner}</View>}
            <Switch on={i.on} disabled={!view.isHost || disabled} label={`Use ${i.text}`} onPress={() => void cmd.setIdea(i.id, !i.on)} />
          </View>
        );
      })}
      {view.canAddIdea && (
        <Press label={addLabel} onPress={() => openPage(id, 'mood', { idea: 'new' })} style={{ alignSelf: 'flex-start', flexDirection: 'row', gap: 8, height: 38, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#fbbf2466', backgroundColor: '#fbbf2414' }}>
          <GText bold size={16} color={glow.amber}>+</GText>
          <GText bold size={14} color={glow.amber}>{addLabel}</GText>
        </Press>
      )}
    </View>
  );
}

/** Share card: who's in, the link, Share. Visible from the moment the room exists. */
export function RoomLink({ here = false }: { here?: boolean }) {
  const { id, view, inviteUrl } = useRoom();
  const [shared, setShared] = useState<'' | 'copied' | 'shared' | 'manual'>('');
  if (!view) return null;
  const people = view.faces;
  const picking = view.picking.map((p) => p.nickname || '?');
  const summary = (
    <GText size={T.small} color={glow.soft} lines={1} style={{ flex: 1 }}>
      {people.length < 2 ? 'Just you' : `${people.length} people`}
      {picking.length ? <GText size={T.small} color={glow.muted}>{` · ${picking.join(', ')} picking`}</GText> : null}
    </GText>
  );
  const done = shared === 'copied' || shared === 'shared';
  return (
    <View testID="room-link" style={{ ...card, padding: 12, gap: 10 }}>
      {here ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32 }}><FaceStack people={people} size={26} max={5} />{summary}</View>
      ) : (
        <Press label={people.length < 2 ? 'Just you' : `${people.length} people`} onPress={() => openPage(id, 'room')} style={{ flexDirection: 'row', justifyContent: 'flex-start', gap: 10, minHeight: 32 }}>
          <FaceStack people={people} size={26} max={5} />{summary}<Icon name="right" size={14} color={glow.muted} />
        </Press>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <GText size={15} color={glow.muted} selectable lines={1} style={{ flex: 1 }}>{inviteUrl ? inviteUrl.replace(/^https?:\/\//, '') : 'Link unavailable'}</GText>
        {inviteUrl ? (
          <Press label={done ? (shared === 'copied' ? 'Copied' : 'Shared') : 'Share'} onPress={() => void shareInvitation(inviteUrl).then((r) => setShared(r === 'cancelled' ? '' : r))}
            style={{ height: 36, paddingHorizontal: 14, borderRadius: 10, flexDirection: 'row', gap: 6, backgroundColor: done ? '#ffffff12' : '#fbbf2424', borderWidth: 1, borderColor: done ? '#ffffff1f' : '#fbbf2466' }}>
            <Icon name={done ? 'check' : 'people'} size={15} color={done ? glow.soft : glow.amber} />
            <GText bold size={14} color={done ? glow.soft : glow.amber}>{done ? (shared === 'copied' ? 'Copied' : 'Shared') : 'Share'}</GText>
          </Press>
        ) : null}
      </View>
      {shared === 'manual' ? <Small>Select and copy the link</Small> : null}
    </View>
  );
}

/** One control for the room: its ideas, new suggestions for the host, its people. Opens the Room page. */
export function RoomBar({ faces }: { faces?: ReactNode } = {}) {
  const { id, view } = useRoom();
  if (!view) return null;
  const fresh = view.newSuggestions;
  return (
    <Press label={`${view.label}${fresh ? `, ${fresh} new` : ''}`} onPress={() => openPage(id, 'room')}
      style={{ flex: 1, minWidth: 0, height: 44, flexDirection: 'row', justifyContent: 'flex-start', gap: 8, paddingLeft: 12, paddingRight: 6, borderRadius: 10, backgroundColor: '#ffffff0a', borderWidth: 1, borderColor: fresh ? '#fbbf2499' : '#ffffff1f' }}>
      <GText bold size={15} lines={1} style={{ flexShrink: 1 }}>{view.label}</GText>
      {fresh ? <View style={{ minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: glow.amber, alignItems: 'center', justifyContent: 'center' }}><GText bold size={11} color="#201400">{fresh}</GText></View> : null}
      <View style={{ flex: 1 }} />
      {faces ?? <FaceStack people={view.faces} size={24} max={4} />}
    </Press>
  );
}

/** A quiet row: content, then Change (or Add when something is missing). */
export function ChangeRow({ label, children, onPress, warn = false }: { label: string; children: ReactNode; onPress?: () => void; warn?: boolean }) {
  const content = <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 }}>{children}</View>;
  if (!onPress) return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>{content}</View>;
  return (
    <Press label={label} onPress={onPress} style={{ flexDirection: 'row', justifyContent: 'flex-start', gap: 10, minHeight: 44 }}>
      {content}
      <GText size={T.small} bold color={warn ? glow.amber : glow.muted}>{warn ? 'Add' : 'Change'}</GText>
    </Press>
  );
}

/** Logo grid: the 8 biggest first, the rest and search after More. */
export function ServiceGrid({ all, loading, selected, toggle }: { all: ServiceChoice[]; loading: boolean; selected: number[]; toggle: (s: ServiceChoice) => void }) {
  const [more, setMore] = useState(false);
  const [q, setQ] = useState('');
  if (loading && !all.length) return <Small>Loading…</Small>;
  const shown = more ? all.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase())) : firstTiles(all, selected);
  const cell = { width: '25%', padding: 5 } as const;
  return (
    <View testID="service-grid" style={{ gap: 12 }}>
      {more && <TextInput autoFocus accessibilityLabel="Find a service" value={q} onChangeText={setQ} placeholder="Find a service" placeholderTextColor={glow.muted} autoCapitalize="none" autoCorrect={false} style={fieldStyle} />}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 }}>
        {shown.map((s) => {
          const on = pickedIn(s, selected);
          return (
            <View key={s.id} style={cell}>
              <Pressable accessibilityRole="checkbox" accessibilityLabel={s.name} accessibilityState={{ checked: on }} aria-checked={on} onPress={() => toggle(s)} style={({ pressed }) => ({ alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}>
                <View style={{ width: '100%', aspectRatio: 1, borderRadius: 10, padding: 3, borderWidth: 2, borderColor: on ? glow.amber : 'transparent' }}>
                  {s.logoUrl ? <Image source={{ uri: s.logoUrl }} style={{ flex: 1, borderRadius: 8, opacity: on || !selected.length ? 1 : 0.55 }} />
                    : <View style={{ flex: 1, borderRadius: 8, backgroundColor: '#ffffff12', alignItems: 'center', justifyContent: 'center' }}><GText bold>{s.name.slice(0, 2)}</GText></View>}
                  {on ? <View style={{ position: 'absolute', right: -4, top: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: glow.amber, borderWidth: 2, borderColor: glow.bg, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={12} color="#201400" /></View> : null}
                </View>
                <GText size={11} color={on ? glow.ink : glow.muted} lines={1}>{s.name}</GText>
              </Pressable>
            </View>
          );
        })}
        {!more && (
          <View style={cell}>
            <Press label="More services" onPress={() => setMore(true)} style={{ width: '100%', aspectRatio: 1, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: '#ffffff33' }}>
              <GText size={24} color={glow.soft}>+</GText>
            </Press>
            <GText size={11} color={glow.muted} style={{ textAlign: 'center', marginTop: 6 }}>More</GText>
          </View>
        )}
      </View>
      {more && !shown.length ? <Small>No matching services</Small> : null}
    </View>
  );
}

/** The room's country: a quiet link that opens a short search list. */
export function CountryLine({ country, countries, onChange }: { country: string; countries: { code: string; name: string }[]; onChange?: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const name = countries.find((c) => c.code === country)?.name ?? country;
  if (!onChange) return <Small color={glow.soft}>{`${flag(country)} ${name}`}</Small>;
  if (!open) return <TextLink label={`${flag(country)} ${name}`} color={glow.soft} onPress={() => setOpen(true)} />;
  const list = rankedCountries(countries, country, deviceCountryHint()).filter((c) => !q || `${c.name} ${c.code}`.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  return (
    <View style={{ gap: 6 }}>
      <TextInput autoFocus accessibilityLabel="Find country" value={q} onChangeText={setQ} placeholder="Find country" placeholderTextColor={glow.muted} style={fieldStyle} />
      {list.map((c) => <TextLink key={c.code} label={`${flag(c.code)} ${c.name}`} color={c.code === country ? glow.amber : glow.soft} onPress={() => { onChange(c.code); setOpen(false); setQ(''); }} />)}
    </View>
  );
}

export function KindsPick({ kinds, set }: { kinds: Kind[]; set: (k: Kind[]) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {(['movie', 'show_start'] as const).map((k) => {
        const on = kinds.includes(k);
        return (
          <Pressable key={k} accessibilityRole="checkbox" accessibilityLabel={k === 'movie' ? 'Movies' : 'Shows'} accessibilityState={{ checked: on }} aria-checked={on} onPress={() => set(on ? kinds.filter((x) => x !== k) : [...kinds, k])}
            style={{ flex: 1, height: 112, gap: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: on ? glow.amber : '#ffffff1a', backgroundColor: on ? '#fbbf241a' : '#ffffff08' }}>
            <HeroIcon name={k === 'movie' ? 'film' : 'tv'} size={30} color={on ? glow.amber : glow.soft} />
            <GText bold size={18}>{k === 'movie' ? 'Movies' : 'Shows'}</GText>
          </Pressable>
        );
      })}
    </View>
  );
}
