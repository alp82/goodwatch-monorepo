/**
 * The open sheets of the screen in front, newest last: one place that knows a sheet covers the page.
 * Every Sheet registers here while its screen is focused (room sheets and the header's Your rooms
 * alike), so
 * - Android back closes the sheet on top before the screen's own back runs, whichever handler was
 *   registered last (screens re-register as they re-render; see `useBackAction`);
 * - a screen can ask whether it's covered (voting stops taking answers and stops its exposure clock).
 */
import { useSyncExternalStore } from 'react';

export interface SheetEntry { close: () => void }

let stack: readonly SheetEntry[] = [];
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** A sheet opened (it's on top until another opens); the returned function takes it off again. */
export function registerSheet(close: () => void): { entry: SheetEntry; remove: () => void } {
  const entry: SheetEntry = { close };
  stack = [...stack, entry];
  emit();
  return { entry, remove: () => { if (!stack.includes(entry)) return; stack = stack.filter((e) => e !== entry); emit(); } };
}

export const isTopSheet = (entry: SheetEntry) => stack.at(-1) === entry;

/** Closes the sheet on top; false when no sheet is open (the Back goes where it was going). */
export function closeTopSheet(): boolean {
  const top = stack.at(-1);
  if (!top) return false;
  top.close();
  return true;
}

/** A sheet covers the screen in front. */
export function useSheetOpen(): boolean {
  return useSyncExternalStore(subscribe, () => stack.length > 0, () => false);
}

/** A screen's back press: the sheet on top closes if there is one, else the screen's own back runs. Always handled. */
export function screenBack(action: () => void): true {
  if (!closeTopSheet()) action();
  return true;
}
