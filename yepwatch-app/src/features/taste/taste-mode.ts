import { useSyncExternalStore } from 'react';

/** Where Taste mode opens from: the entry control's box in window coordinates (it grows out of it). */
export interface Origin { x: number; y: number; w: number; h: number }
type State = { open: boolean; origin: Origin | null };
let state: State = { open: false, origin: null };
const listeners = new Set<() => void>();
const set = (next: State) => { state = next; for (const l of [...listeners]) l(); };

/** Taste mode is one layer over every screen (TasteModeLayer in the root layout), opened from the profile. */
export const tasteMode = {
  open: (origin: Origin | null = null) => set({ open: true, origin }),
  close: () => set({ open: false, origin: state.origin }),
};
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useTasteMode = () => useSyncExternalStore(subscribe, () => state, () => state);
