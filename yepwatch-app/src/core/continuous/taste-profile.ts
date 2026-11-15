import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { continuousApi } from './api';
import { forgetProfileSecret } from './profile-secret';
import { readOutbox, writeOutbox } from './taste-outbox-store';
import { TasteProfileStore } from './taste-profile-store';

export type { FollowUp, TasteProfileView } from './taste-profile-store';

/** The device's one taste profile (taste-profile-store.ts). */
export const tasteProfile = new TasteProfileStore({
  api: continuousApi,
  read: readOutbox,
  write: writeOutbox,
  forgetSecret: forgetProfileSecret,
});

// Waiting answers go when the app leaves the front; a failed send waits for the app to be back.
AppState.addEventListener('change', (state) => tasteProfile.setFront(state === 'active'));
if (Platform.OS === 'web' && typeof document !== 'undefined')
  document.addEventListener('visibilitychange', () => tasteProfile.setFront(document.visibilityState === 'visible'));

/**
 * The profile's counts and next-day questions; reads it once when first used (`maxAgeMs`: read again when older).
 * `enabled` false only listens (a first visit asks the server nothing).
 */
export function useTasteProfile(maxAgeMs = Infinity, enabled = true) {
  const view = useSyncExternalStore(tasteProfile.subscribe, tasteProfile.snapshot, tasteProfile.snapshot);
  useEffect(() => { if (enabled) void tasteProfile.load(maxAgeMs); }, [maxAgeMs, enabled]);
  return view;
}
