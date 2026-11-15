/** Room pieces shared by several screens and sheets: idea acknowledgement, rows, services, country and kinds. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Platform, Pressable, TextInput, View, useWindowDimensions, type TextStyle } from 'react-native';
import { deviceCountryHint, rankedCountries } from '../../core/lobby';
import { FaceStack } from '../shell/parts';
import { useLayout } from '../shell/layout';
import { R, warm } from '../shell/tokens';
import { GText, Icon, Press, glow, grow, spaceToggles } from '../glow/theme';
import type { Kind, RoomView } from './model';
import { useRoom } from './RoomProvider';
import { firstTiles, pickedIn, type ServiceChoice } from './services';
import { Glyph, KindIcons, Small, TextLink } from './ui';

export const flag = (code: string) =>
  /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0))) : '🌐';

/** Browsers draw their own focus outline and caret; the amber border and caret replace them. */
export const webField = (Platform.OS === 'web' ? { outlineStyle: 'none', caretColor: glow.amber } : {}) as TextStyle;
/** Gabarito Bold: average glyph width per em, with the -3% tracking. */
export const CHAR_EM = 0.52;

/**
 * The host has seen the friend ideas shown while this is mounted: NEW stays on them during this
 * visit and goes once it ends (switching one acknowledges it at once).
 */
export function useAcknowledgeShownIdeas(view: RoomView | null, acknowledgeIdeas: (ids: readonly string[]) => void) {
  const shown = useRef(new Set<string>());
  useEffect(() => {
    if (!view?.isHost) return;
    for (const i of view.ideas) if (i.fresh) shown.current.add(i.id);
  }, [view]);
  useEffect(() => () => acknowledgeIdeas([...shown.current]), [acknowledgeIdeas]);
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
  // Large text (the system font size) makes the label line taller; the tiles grow with it.
  const { fontScale } = useWindowDimensions();
  const [more, setMore] = useState(false);
  const [q, setQ] = useState('');
  const cell = { width: `${100 / (phone ? 3 : 4)}%`, padding: 5 } as const;
  const logo = phone ? 52 : z(60);
  // One height (border 4, padding 20, logo, gap 8, one 13 px label line at the font scale), so loading tiles
  // and service tiles match exactly.
  const tile = { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 10, height: logo + 33 + Math.ceil(13 * 1.28 * Math.max(1, fontScale || 1)), borderRadius: R.card, borderWidth: 2 } as const;
  // The loading grid's height (9 tiles) is the least the first tiles take: a country with fewer big
  // services keeps that space instead of pulling what's below up when they arrive.
  const firstRowsHeight = Math.ceil(9 / (phone ? 3 : 4)) * (tile.height + 10);
  // Loading: empty tiles in the grid's usual shape (8 services and More), so the sheet already has its
  // height and doesn't jump when the services arrive.
  if (loading && !all.length) return (
    <View aria-hidden style={{ gap: 12 }}>
      {null /* the search field's place */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 }}>
        {Array.from({ length: 9 }, (_, i) => <View key={`loading-${i}`} style={cell}><View style={{ ...tile, borderColor: warm.line, backgroundColor: warm.faint }} /></View>)}
      </View>
    </View>
  );
  const shown = more ? all.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase())) : firstTiles(all, selected);
  return (
    <View testID="service-grid" style={{ gap: 12 }}>
      {more && <TextInput autoFocus accessibilityLabel="Find a service" value={q} onChangeText={setQ} placeholder="Find a service" placeholderTextColor={warm.placeholder} autoCapitalize="none" autoCorrect={false} selectionColor={glow.amber} style={fieldStyleFor(z)} />}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start', marginHorizontal: -5, minHeight: more ? undefined : firstRowsHeight }}>
        {shown.map((s) => {
          const on = pickedIn(s, selected);
          return (
            <View key={s.id} style={cell}>
              <Pressable accessibilityRole="checkbox" accessibilityLabel={s.name} accessibilityState={{ checked: on }} aria-checked={on} onPress={() => toggle(s)} {...spaceToggles(() => toggle(s))}
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
        const flip = () => set(on ? kinds.filter((x) => x !== k) : [...kinds, k]);
        return (
          <Pressable key={k} accessibilityRole="checkbox" accessibilityLabel={k === 'movie' ? 'Movies' : 'Shows'} accessibilityState={{ checked: on, disabled }} aria-checked={on} aria-disabled={disabled} disabled={disabled}
            onPress={flip} {...spaceToggles(flip, disabled)}
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
