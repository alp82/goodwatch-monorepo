/** Room pieces shared by several screens and sheets: ideas, the share and people rows, services, country and kinds. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Platform, Pressable, TextInput, View, type TextStyle } from 'react-native';
import { deviceCountryHint, rankedCountries } from '../../core/lobby';
import { shareInvitation } from '../../core/share-invitation';
import { FaceStack } from '../shell/parts';
import { useLayout } from '../shell/layout';
import { R, warm } from '../shell/tokens';
import { GText, Icon, Press, glow, grow } from '../glow/theme';
import type { Kind } from './model';
import { openPage } from './nav';
import { useRoom } from './RoomProvider';
import { firstTiles, pickedIn, type ServiceChoice } from './services';
import { Glyph, HeroIcon, KindIcons, NewBadge, Small, Switch, TextLink } from './ui';

export const flag = (code: string) =>
  /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0))) : '🌐';

/** Browsers draw their own focus outline and caret; the amber border and caret replace them. */
export const webField = (Platform.OS === 'web' ? { outlineStyle: 'none', caretColor: glow.amber } : {}) as TextStyle;
/** Gabarito Bold: average glyph width per em, with the -3% tracking. */
export const CHAR_EM = 0.52;

/**
 * Size for a headline idea: the whole text on one row while that keeps it at least `oneRowMin`,
 * otherwise sized so the longest word fits and the text takes about two lines.
 */
export function headlineSize(text: string, width: number, max: number, oneRowMin: number, min = 30) {
  const oneRow = Math.floor(width / (Math.max(1, text.length) * CHAR_EM));
  if (oneRow >= oneRowMin) return Math.min(oneRow, max);
  const longest = Math.max(1, ...text.split(/\s+/).map((w) => w.length));
  const byWord = width / (longest * 0.56);
  const byLines = (width * 2) / (Math.max(text.length, 1) * 0.5);
  return Math.round(Math.max(min, Math.min(max, byWord, byLines)));
}

/**
 * The host has seen the friend ideas shown while this is mounted: NEW stays on them during this
 * visit and goes once it ends (switching one acknowledges it at once).
 */
export function useAcknowledgeShownIdeas() {
  const { view, acknowledgeIdeas } = useRoom();
  const shown = useRef(new Set<string>());
  useEffect(() => {
    if (!view?.isHost) return;
    for (const i of view.ideas) if (i.fresh) shown.current.add(i.id);
  }, [view]);
  useEffect(() => () => acknowledgeIdeas([...shown.current]), [acknowledgeIdeas]);
}

/**
 * The ideas as the headline: the first huge, the others big, each with its switch. Everyone sees the
 * same list; only the host's switches work. A friend's idea carries its author's name and, until
 * the host has seen it, NEW. Your own ideas open Mood to edit or remove them.
 */
export function IdeaStack() {
  const { id, view, cmd, disabled } = useRoom();
  const { phone, z } = useLayout();
  const [width, setWidth] = useState(330);
  if (!view) return null;
  const top = phone ? 54 : z(92);
  const rest = phone ? 30 : z(48);
  const many = view.ideas.length > 1;
  const addLabel = view.isHost ? 'Add an idea' : 'Suggest an idea';
  return (
    <View testID="idea-list" onLayout={(e) => { if (e.nativeEvent.layout.width > 0) setWidth(e.nativeEvent.layout.width); }} style={{ gap: phone ? 18 : z(26) }}>
      {!view.ideas.length && <GText bold size={top} color={glow.soft} style={{ letterSpacing: -top * 0.032, lineHeight: top * 1.06 }}>Anything</GText>}
      {view.ideas.map((i, n) => {
        const size = n === 0 ? headlineSize(i.text, Math.max(120, width - 70), top, phone ? 40 : z(60)) : Math.min(rest, headlineSize(i.text, Math.max(120, width - 70), rest, 0, 22));
        const fresh = view.isHost && i.fresh && !i.mine;
        const meta = !i.mine
          ? (i.author?.nickname || fresh ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {i.author?.nickname ? <GText size={z(13)} color={glow.muted}>{i.author.nickname}</GText> : null}
              {fresh ? <NewBadge /> : null}
            </View>
          ) : null)
          : many ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><HeroIcon name="pencil" size={z(14)} color={glow.muted} /><GText size={z(13)} color={glow.muted}>Yours</GText></View> : null;
        const text = <GText bold size={size} color={i.on ? glow.ink : '#8c8478'} style={{ letterSpacing: -size * 0.032, lineHeight: size * 1.06 }}>{i.text}</GText>;
        const body = { flex: 1, minWidth: 0, gap: 6, alignItems: 'flex-start', justifyContent: 'flex-start' } as const;
        return (
          <View key={i.id} style={{ flexDirection: 'row', alignItems: 'center', gap: z(18) }}>
            {i.mine
              ? <Press label={`${i.text}, edit`} onPress={() => openPage(id, 'mood', { idea: i.id })} style={body}>{text}{meta}</Press>
              : <View accessible accessibilityLabel={`${i.text}${i.author?.nickname ? `, from ${i.author.nickname}` : ''}${fresh ? ', new' : ''}`} style={body}>{text}{meta}</View>}
            <Switch on={i.on} disabled={!view.isHost || disabled} label={`Use ${i.text}`} onPress={() => void cmd.setIdea(i.id, !i.on)} />
          </View>
        );
      })}
      {view.canAddIdea && (
        <Press label={addLabel} onPress={() => openPage(id, 'mood', { idea: 'new' })} style={{ alignSelf: 'flex-start', ...grow(z(44)), flexDirection: 'row', gap: 8, paddingRight: 8 }}>
          <Glyph name="plus" size={z(18)} color={glow.amber} /><GText bold size={z(17)} color={glow.amber}>{addLabel}</GText>
        </Press>
      )}
    </View>
  );
}

/** The invitation link as one control: the whole row copies or shares it and says Copied or Shared. */
export function ShareRow() {
  const { inviteUrl } = useRoom();
  const { z } = useLayout();
  const [state, setState] = useState<'' | 'copied' | 'shared' | 'manual'>('');
  useEffect(() => {
    if (state !== 'copied' && state !== 'shared') return;
    const timer = setTimeout(() => setState(''), 2400);
    return () => clearTimeout(timer);
  }, [state]);
  const link = inviteUrl ? inviteUrl.replace(/^https?:\/\//, '') : 'Link unavailable';
  const done = state === 'copied' || state === 'shared';
  const word = state === 'copied' ? 'Copied' : state === 'shared' ? 'Shared' : 'Share';
  return (
    <View testID="share-row" style={{ gap: 6 }}>
      <Press label={word} disabled={!inviteUrl} onPress={() => { if (inviteUrl) void shareInvitation(inviteUrl).then((r) => setState(r === 'cancelled' ? '' : r)); }}
        style={{ minHeight: z(56), borderRadius: 12, paddingLeft: 14, paddingRight: 8, flexDirection: 'row', justifyContent: 'flex-start', gap: 12, backgroundColor: done ? warm.amberSoft : warm.faint, borderWidth: 1, borderColor: done ? warm.amberLine : warm.line }}>
        <Glyph name="link" size={z(18)} color={done ? glow.amber : glow.muted} />
        <GText size={z(15)} color={glow.soft} lines={1} style={{ flex: 1 }}>{link}</GText>
        {inviteUrl ? (
          <View style={{ height: z(40), paddingHorizontal: 14, borderRadius: R.control, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: done ? 'transparent' : glow.amber }}>
            {done ? <Icon name="check" size={z(16)} color={glow.amber} /> : <Glyph name="share" size={z(16)} color={warm.ink} />}
            <GText bold size={z(15)} color={done ? glow.amber : warm.ink}>{word}</GText>
          </View>
        ) : null}
      </Press>
      {state === 'manual' && inviteUrl ? <><Small>Select and copy the link</Small><GText size={z(15)} selectable>{inviteUrl}</GText></> : null}
    </View>
  );
}

/** Who's in (and who's still picking services); opens People. */
export function PeopleRow({ onPress }: { onPress: () => void }) {
  const { view } = useRoom();
  const { z } = useLayout();
  if (!view) return null;
  const people = view.faces;
  const text = people.length < 2 ? 'Just you' : `${people.length} people`;
  const picking = view.picking.map((p) => p.nickname || '?');
  return (
    <Press label={`${text}, people`} onPress={onPress}
      style={{ minHeight: z(56), borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'flex-start', gap: 12, backgroundColor: warm.faint, borderWidth: 1, borderColor: warm.line }}>
      <FaceStack people={people} size={z(30)} max={5} />
      <GText size={z(15)} color={glow.soft} lines={1} style={{ flex: 1 }}>
        {text}
        {picking.length ? <GText size={z(15)} color={glow.muted}>{` · ${picking.join(', ')} picking`}</GText> : null}
      </GText>
      <Icon name="right" size={16} color={glow.muted} />
    </Press>
  );
}

/** A setting as a whole-row control: content, then Change (amber when something is missing). */
export function Chip({ label, onPress, children, warn = false, action }: { label: string; onPress?: () => void; children: ReactNode; warn?: boolean; /** The word at the end ("Change"); none when absent. */ action?: string }) {
  const { z } = useLayout();
  const style = { minHeight: z(52), borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: 10, backgroundColor: warn ? warm.amberSoft : 'transparent', borderWidth: 1, borderColor: warn ? warm.amberLine : warm.line } as const;
  const inner = <>{children}{action ? <GText bold size={z(13)} color={warn ? glow.amber : glow.muted}>{action}</GText> : null}</>;
  return onPress ? <Press label={label} onPress={onPress} style={style}>{inner}</Press> : <View accessible accessibilityLabel={label} style={style}>{inner}</View>;
}

/** A row in a sheet: content, then a switch or a chevron. */
export function SettingRow({ label, onPress, children, right }: { label: string; onPress?: () => void; children: ReactNode; right?: ReactNode }) {
  const style = { minHeight: 52, flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', gap: 12 } as const;
  // A control on the right (a switch) sits beside the row's press area, never inside it: controls don't nest.
  if (onPress && right) return <View style={style}><Press label={label} onPress={onPress} style={{ ...style, flex: 1, minWidth: 0 }}>{children}</Press>{right}</View>;
  const inner = <>{children}{right ?? (onPress ? <Icon name="right" size={16} color={glow.muted} /> : null)}</>;
  return onPress ? <Press label={label} onPress={onPress} style={style}>{inner}</Press> : <View style={style}>{inner}</View>;
}

/** A warm text field. */
export function fieldStyleFor(z: (n: number) => number, focus = false): TextStyle {
  return { height: z(52), borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: focus ? glow.amber : warm.lineStrong, backgroundColor: warm.faint, color: glow.ink, fontFamily: 'Gabarito', fontSize: z(17), ...webField };
}

/** Logo tiles: the 8 biggest first, the rest and search after More. */
export function ServiceGrid({ all, loading, selected, toggle }: { all: ServiceChoice[]; loading: boolean; selected: number[]; toggle: (s: ServiceChoice) => void }) {
  const { phone, z } = useLayout();
  const [more, setMore] = useState(false);
  const [q, setQ] = useState('');
  if (loading && !all.length) return <Small>Loading…</Small>;
  const shown = more ? all.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase())) : firstTiles(all, selected);
  const cell = { width: `${100 / (phone ? 3 : 4)}%`, padding: 5 } as const;
  const logo = phone ? 52 : z(60);
  const tile = { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, minHeight: logo + 46, borderRadius: R.card, borderWidth: 2 } as const;
  return (
    <View testID="service-grid" style={{ gap: 12 }}>
      {more && <TextInput autoFocus accessibilityLabel="Find a service" value={q} onChangeText={setQ} placeholder="Find a service" placeholderTextColor={warm.placeholder} autoCapitalize="none" autoCorrect={false} selectionColor={glow.amber} style={fieldStyleFor(z)} />}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 }}>
        {shown.map((s) => {
          const on = pickedIn(s, selected);
          return (
            <View key={s.id} style={cell}>
              <Pressable accessibilityRole="checkbox" accessibilityLabel={s.name} accessibilityState={{ checked: on }} aria-checked={on} onPress={() => toggle(s)}
                style={({ pressed }) => ({ ...tile, borderColor: on ? glow.amber : warm.line, backgroundColor: on ? warm.amberSoft : warm.faint, opacity: pressed ? 0.7 : 1 })}>
                <View style={{ opacity: on || !selected.length ? 1 : 0.55 }}>
                  {s.logoUrl ? <Image source={{ uri: s.logoUrl }} accessible={false} style={{ width: logo, height: logo, borderRadius: logo * 0.22 }} />
                    : <View style={{ width: logo, height: logo, borderRadius: logo * 0.22, backgroundColor: '#2a2621', alignItems: 'center', justifyContent: 'center' }}><GText bold size={logo * 0.36}>{s.name.slice(0, 2)}</GText></View>}
                </View>
                <GText size={13} bold={on} color={on ? glow.ink : glow.muted} lines={1}>{s.name}</GText>
                {on ? <View style={{ position: 'absolute', right: 6, top: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: glow.amber, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={12} color={warm.ink} /></View> : null}
              </Pressable>
            </View>
          );
        })}
        {!more && (
          <View style={cell}>
            <Press label="More services" onPress={() => setMore(true)} style={{ ...tile, borderWidth: 1, borderStyle: 'dashed', borderColor: '#ffffff33' }}>
              <View style={{ width: logo, height: logo, alignItems: 'center', justifyContent: 'center' }}><Glyph name="plus" size={logo * 0.5} color={glow.soft} /></View>
              <GText size={13} color={glow.muted}>More</GText>
            </Press>
          </View>
        )}
      </View>
      {more && !shown.length ? <Small>No matching services</Small> : null}
    </View>
  );
}

/** The room's country: the host's opens a short search list; everyone else just sees it. */
export function CountryLine({ country, countries, onChange }: { country: string; countries: { code: string; name: string }[]; onChange?: (code: string) => void }) {
  const { z } = useLayout();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const name = countries.find((c) => c.code === country)?.name ?? country;
  if (!onChange) return <GText color={glow.soft}>{`${flag(country)} ${name}`}</GText>;
  if (!open) {
    return (
      <Press label={`${flag(country)} ${name}`} onPress={() => setOpen(true)} style={{ ...grow(36), flexDirection: 'row', gap: 6, alignSelf: 'flex-start' }}>
        <GText color={glow.soft}>{`${flag(country)} ${name}`}</GText><Glyph name="down" size={16} color={glow.muted} />
      </Press>
    );
  }
  const list = rankedCountries(countries, country, deviceCountryHint()).filter((c) => !q || `${c.name} ${c.code}`.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  return (
    <View style={{ gap: 6 }}>
      <TextInput autoFocus accessibilityLabel="Find country" value={q} onChangeText={setQ} placeholder="Find country" placeholderTextColor={warm.placeholder} selectionColor={glow.amber} style={fieldStyleFor(z)} />
      {list.map((c) => <TextLink key={c.code} label={`${flag(c.code)} ${c.name}`} color={c.code === country ? glow.amber : glow.soft} onPress={() => { onChange(c.code); setOpen(false); setQ(''); }} />)}
    </View>
  );
}

/** Movies, Shows, or both: two big tiles (the host's; everyone else sees them disabled). */
export function KindsPick({ kinds, set, disabled = false }: { kinds: Kind[]; set: (k: Kind[]) => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {(['movie', 'show_start'] as const).map((k) => {
        const on = kinds.includes(k);
        return (
          <Pressable key={k} accessibilityRole="checkbox" accessibilityLabel={k === 'movie' ? 'Movies' : 'Shows'} accessibilityState={{ checked: on, disabled }} aria-checked={on} aria-disabled={disabled} disabled={disabled}
            onPress={() => set(on ? kinds.filter((x) => x !== k) : [...kinds, k])}
            style={{ flex: 1, height: 120, gap: 10, borderRadius: R.card, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: on ? glow.amber : warm.line, backgroundColor: on ? warm.amberSoft : warm.faint, opacity: disabled && !on ? 0.6 : 1 }}>
            <KindIcons kinds={[k]} size={32} color={on ? glow.amber : glow.soft} />
            <GText bold size={18}>{k === 'movie' ? 'Movies' : 'Shows'}</GText>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Voting's room control: the room label, new suggestions for the host, its people. Opens the Room
 * sheet. Transitional: the header pill names the room on every screen.
 */
export function RoomBar({ faces }: { faces?: ReactNode } = {}) {
  const { view, openSheet } = useRoom();
  if (!view) return null;
  const fresh = view.newSuggestions;
  return (
    <Press label={`${view.label}${fresh ? `, ${fresh} new` : ''}`} onPress={() => openSheet('room')}
      style={{ flex: 1, minWidth: 0, height: 44, flexDirection: 'row', justifyContent: 'flex-start', gap: 8, paddingLeft: 12, paddingRight: 6, borderRadius: R.control, backgroundColor: '#ffffff0a', borderWidth: 1, borderColor: fresh ? '#fbbf2499' : '#ffffff1f' }}>
      <GText bold size={15} lines={1} style={{ flexShrink: 1 }}>{view.label}</GText>
      {fresh ? <View style={{ minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: glow.amber, alignItems: 'center', justifyContent: 'center' }}><GText bold size={11} color={warm.ink}>{fresh}</GText></View> : null}
      <View style={{ flex: 1 }} />
      {faces ?? <FaceStack people={view.faces} size={24} max={4} />}
    </Press>
  );
}
