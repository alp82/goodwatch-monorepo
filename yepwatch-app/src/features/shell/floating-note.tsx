/**
 * The room's one-line notes (connection, saved actions, errors) float over the page under the header
 * instead of taking a row in it: the page never moves when a note comes or goes. A note fades in and
 * out, and Dismiss hides it until its words change. Opacity and transform only.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, View } from 'react-native';
import { useReducedMotion } from '../../components/ui';
import { GText, Icon, Press, glow, grow, native } from '../glow/theme';

export interface FrameNote {
  text: string;
  action?: { label: string; disabled?: boolean; onPress: () => void };
  busy?: boolean;
  /** A small line above the note (development builds). */
  detail?: string;
}

type Slot = (owner: object, note: FrameNote | null) => void;
const NoteSlot = createContext<Slot | null>(null);

/** The frame's note layer: the newest note any of its screens or sheets asked for. */
export function useNoteLayer() {
  const [notes, setNotes] = useState<readonly { owner: object; note: FrameNote }[]>([]);
  const slot = useCallback<Slot>((owner, note) => setNotes((list) => {
    const rest = list.filter((n) => n.owner !== owner);
    return note ? [...rest, { owner, note }] : rest.length === list.length ? list : rest;
  }), []);
  return { slot, note: notes.at(-1)?.note ?? null };
}
export function NoteLayerProvider({ slot, children }: { slot: Slot; children: ReactNode }) {
  return <NoteSlot.Provider value={slot}>{children}</NoteSlot.Provider>;
}

/**
 * Shows `note` in the frame's note layer while mounted. Returns false outside a frame, so the caller
 * can show it in place instead.
 */
export function useFrameNote(note: FrameNote | null) {
  const slot = useContext(NoteSlot);
  const [owner] = useState(() => ({}));
  // The action's handler changes every render; the layer calls the latest one.
  const press = useRef(note?.action?.onPress);
  useEffect(() => { press.current = note?.action?.onPress; });
  const key = note ? JSON.stringify([note.text, note.detail, note.busy, note.action?.label, note.action?.disabled, Boolean(note.action)]) : null;
  useEffect(() => {
    if (!slot) return;
    slot(owner, note ? { ...note, action: note.action ? { ...note.action, onPress: () => press.current?.() } : undefined } : null);
  }, [slot, owner, key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => slot?.(owner, null), [slot, owner]);
  return Boolean(slot);
}

/** One quiet line: spinner, words, its action, Dismiss. */
export function NoteLine({ note, onDismiss }: { note: FrameNote; onDismiss?: () => void }) {
  const { text, action, busy } = note;
  return (
    <View accessibilityLiveRegion="polite" aria-busy={busy} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, paddingRight: onDismiss ? 4 : 12, paddingVertical: 4, borderRadius: 10, backgroundColor: '#201c13', borderWidth: 1, borderColor: '#ffffff14' }}>
      {busy ? <ActivityIndicator testID="note-spinner" size="small" color={glow.amber} /> : null}
      <GText size={12} lines={2} style={{ flex: 1 }}>{text}</GText>
      {action ? <Press label={action.label} onPress={action.onPress} disabled={action.disabled} style={{ ...grow(36), paddingHorizontal: 6 }}><GText size={12} bold>{action.label}</GText></Press> : null}
      {onDismiss ? <Press label="Dismiss" onPress={onDismiss} style={{ ...grow(36, 36), borderRadius: 8 }}><Icon name="close" size={14} color={glow.muted} /></Press> : null}
    </View>
  );
}

/** The layer itself: floats at the top of the frame body, over the page and any sheet. */
export function FloatingNote({ note, width, top = 8 }: { note: FrameNote | null; width: number; top?: number }) {
  const reduced = useReducedMotion();
  const [dismissed, setDismissed] = useState<string | null>(null);
  // Dismiss lasts until the note goes away or its words change.
  if (!note && dismissed !== null) setDismissed(null);
  const visible = note && note.text !== dismissed ? note : null;
  // The words stay while they fade out.
  const [shown, setShown] = useState<FrameNote | null>(visible);
  if (visible && visible !== shown) setShown(visible);
  const [v] = useState(() => new Animated.Value(visible ? 1 : 0));
  useEffect(() => {
    const a = Animated.timing(v, { toValue: visible ? 1 : 0, duration: reduced ? 0 : visible ? 180 : 220, easing: Easing.out(Easing.cubic), useNativeDriver: native });
    a.start(({ finished }) => { if (finished && !visible) setShown(null); });
    return () => a.stop();
  }, [visible, v, reduced]);
  if (!shown) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', top, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 12, zIndex: 60, elevation: 6 }}>
      <Animated.View testID="room-note" pointerEvents={visible ? 'auto' : 'none'}
        style={{ width: '100%', maxWidth: width, gap: 4, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
          shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
        {shown.detail ? <GText size={11} color={glow.muted} style={{ textAlign: 'center' }}>{shown.detail}</GText> : null}
        {shown.text ? <NoteLine note={shown} onDismiss={() => setDismissed(shown.text)} /> : null}
      </Animated.View>
    </View>
  );
}
