/**
 * The reduced-motion preference, asked once per app run and read synchronously after that, so a screen that
 * mounts later plays its entry motion from its first frame instead of starting as "reduced" while the answer
 * travels. The web knows it at once (matchMedia); native caches AccessibilityInfo's first answer, which
 * arrives well before the startup cover leaves. Null until that first answer: callers treat it as reduced, so
 * nothing moves (and nothing flashes) before the preference is known.
 */
type Listener = () => void;
interface Media { matches: boolean; addEventListener?: (type: 'change', cb: (e: { matches: boolean }) => void) => void }
export interface MotionSource {
  /** The web's synchronous answer, or null where there is none (native). */
  media: () => Media | null;
  ask: () => Promise<boolean>;
  onChange: (cb: (reduced: boolean) => void) => void;
}

export function createMotionPreference(source: MotionSource) {
  const listeners = new Set<Listener>();
  let current: boolean | null = null;
  const set = (value: boolean) => {
    if (current === value) return;
    current = value;
    listeners.forEach(l => l());
  };
  const media = source.media();
  if (media) {
    current = media.matches;
    media.addEventListener?.('change', e => set(e.matches));
  } else {
    let changed = false;
    source.onChange(value => { changed = true; set(value); });
    source.ask().then(value => { if (!changed) set(value); }, () => { if (!changed) set(true); });
  }
  return {
    read: () => current,
    subscribe: (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}
