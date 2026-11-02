/**
 * Room settings edited on a page (Your services, Movies and shows) are drafts until the server
 * confirms them. A page holds its draft while open; once it closes (Done, Back, browser or system
 * back) the draft is saved after any command already in flight, retried if the send doesn't go
 * through, and dropped only when the confirmed room shows it. Pages show the draft while it
 * exists, the room's own state after that.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RoomConstraints, RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import { previewCommand } from '../../core/continuous/optimistic';
import { roomView, type Kind, type RoomCommands, type RoomView } from './model';

export interface ServicesDraft {
  /** The host's room country, when it changes. */
  country: string | null;
  /** Your services, when you changed them. */
  picked: number[] | null;
}
export interface Drafts { services?: ServicesDraft; kinds?: Kind[] }
export type DraftKey = keyof Drafts;
const KEYS: DraftKey[] = ['services', 'kinds'];

export type SaveStep =
  | { type: 'country'; country: string }
  | { type: 'services'; serviceIds: number[] }
  | { type: 'kinds'; constraints: RoomConstraints };

const sameSet = <T,>(a: readonly T[], b: readonly T[]) => {
  const x = new Set(a);
  const y = new Set(b);
  return x.size === y.size && [...x].every((v) => y.has(v));
};

/** What a closing Your services page saves: null when nothing changed. */
export function servicesOnLeave(draft: ServicesDraft | undefined, view: RoomView, shown: string): ServicesDraft | undefined {
  if (!draft) return undefined;
  const servicesChanged = draft.picked !== null && (view.myServiceIds === null || !sameSet(draft.picked, view.myServiceIds));
  const country = view.isHost && ((draft.country !== null && draft.country !== view.country) || (!view.country && servicesChanged)) ? shown : null;
  return country || servicesChanged ? { country, picked: servicesChanged ? draft.picked : null } : undefined;
}

/** What a closing Movies and shows page saves: undefined when nothing changed (or nothing is picked). */
export function kindsOnLeave(kinds: Kind[] | undefined, view: RoomView): Kind[] | undefined {
  return kinds && kinds.length && !sameSet(kinds, view.kinds) ? kinds : undefined;
}

/** The next command a closed draft still needs against the confirmed room; null once the room shows it. */
export function nextSaveStep(key: DraftKey, drafts: Drafts, view: RoomView, snapshot: RoomSnapshot): SaveStep | null {
  if (key === 'services') {
    const d = drafts.services;
    if (!d) return null;
    if (d.country && view.isHost && d.country !== view.country) return { type: 'country', country: d.country };
    if (d.picked && (view.myServiceIds === null || !sameSet(d.picked, view.myServiceIds))) return { type: 'services', serviceIds: d.picked };
    return null;
  }
  const kinds = drafts.kinds;
  if (!kinds || !kinds.length || sameSet(kinds, view.kinds)) return null;
  const constraints = snapshot.shared.constraints;
  const others = constraints.kinds.filter((k) => k !== 'movie' && k !== 'show_start');
  return { type: 'kinds', constraints: { ...constraints, kinds: [...kinds, ...others] } };
}

/** The room with closed drafts already in it: a page's change shows everywhere the moment it closes. */
export function previewDrafts<T extends RoomSnapshot>(room: T, drafts: Drafts): T {
  let shown = room;
  const { services, kinds } = drafts;
  if (services?.country) shown = previewCommand(shown, '', { type: 'configure', expectedContextVersion: shown.shared.contextVersion, country: services.country });
  if (services?.picked) shown = previewCommand(shown, '', { type: 'set_services', serviceIds: services.picked });
  if (kinds?.length) {
    const others = shown.shared.constraints.kinds.filter((k) => k !== 'movie' && k !== 'show_start');
    shown = previewCommand(shown, '', { type: 'configure', expectedContextVersion: shown.shared.contextVersion, constraints: { ...shown.shared.constraints, kinds: [...kinds, ...others] } });
  }
  return shown;
}

/** Tries per draft before it is given up (each one waits a little longer). */
export const SAVE_TRIES = 6;
export const saveBackoffMs = (failures: number) => Math.min(5_000, 400 * 2 ** (failures - 1));

export interface SettingsSaves {
  drafts: Drafts;
  /** Drafts whose page has closed, on their way to the server. */
  saving: Drafts;
  edit: <K extends DraftKey>(key: K, value: Drafts[K]) => void;
  /** A page opened: its draft waits until it closes. */
  hold: (key: DraftKey) => void;
  /** A page closed with its final draft (undefined: nothing to save). */
  release: <K extends DraftKey>(key: K, value: Drafts[K]) => void;
}

export function useSettingsSaves(o: {
  cmd: RoomCommands;
  view: RoomView | null;
  latest: () => RoomSnapshot | undefined;
  /** A command is in flight or awaiting confirmation: wait. */
  blocked: boolean;
  failed: (key: DraftKey) => void;
}): SettingsSaves {
  const { cmd, view, latest, blocked, failed } = o;
  const [drafts, setDrafts] = useState<Drafts>({});
  const [open, setOpen] = useState<Partial<Record<DraftKey, number>>>({});
  const [tick, setTick] = useState(0);
  const sending = useRef(false);
  const failures = useRef(0);
  /** The step the server last confirmed: if the room still differs after it, the server's version stands. */
  const confirmed = useRef('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const edit = useCallback(<K extends DraftKey>(key: K, value: Drafts[K]) => setDrafts((d) => ({ ...d, [key]: value })), []);
  const hold = useCallback((key: DraftKey) => setOpen((o) => ({ ...o, [key]: (o[key] ?? 0) + 1 })), []);
  const release = useCallback(<K extends DraftKey>(key: K, value: Drafts[K]) => {
    setDrafts((d) => ({ ...d, [key]: value }));
    setOpen((o) => ({ ...o, [key]: Math.max(0, (o[key] ?? 0) - 1) }));
  }, []);

  useEffect(() => {
    if (sending.current || blocked || !view) return;
    // The confirmed room as the cache holds it right now (a send applies its snapshot before it resolves).
    const snapshot = latest();
    if (!snapshot) return;
    const now = roomView(snapshot);
    for (const key of KEYS) {
      const draft = drafts[key];
      if (!draft || open[key]) continue;
      const step = nextSaveStep(key, drafts, now, snapshot);
      const stepKey = step ? `${key}:${JSON.stringify(step)}` : '';
      if (!step || stepKey === confirmed.current) {
        confirmed.current = '';
        // Confirmed: the page shows the room from now on.
        failures.current = 0;
        setDrafts((d) => (d[key] === draft ? { ...d, [key]: undefined } : d));
        return;
      }
      sending.current = true;
      const run = step.type === 'country' ? cmd.configure({ country: step.country })
        : step.type === 'services' ? cmd.setServices(step.serviceIds)
          : cmd.configure({ constraints: step.constraints });
      void run.catch(() => false).then((ok) => {
        sending.current = false;
        if (!alive.current) return;
        if (ok) {
          failures.current = 0;
          confirmed.current = stepKey;
          setTick((t) => t + 1);
          return;
        }
        failures.current++;
        if (failures.current >= SAVE_TRIES) {
          failures.current = 0;
          setDrafts((d) => (d[key] === draft ? { ...d, [key]: undefined } : d));
          failed(key);
          return;
        }
        setTimeout(() => { if (alive.current) setTick((t) => t + 1); }, saveBackoffMs(failures.current));
      });
      return;
    }
  }, [drafts, open, view, blocked, tick, cmd, latest, failed]);

  const saving = useMemo(() => Object.fromEntries(KEYS.filter((key) => !open[key]).map((key) => [key, drafts[key]])) as Drafts, [drafts, open]);
  return { drafts, saving, edit, hold, release };
}
