import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { createPlayStoreUpdateState } from './play-store-update-state';

interface PlayUpdates { isUpdateAvailable(): Promise<boolean> }
// Existing installed runtimes and Expo Go do not contain this optional native module.
const native = Platform.OS === 'android' ? requireOptionalNativeModule<PlayUpdates>('YepWatchPlayUpdates') : null;
const updates = createPlayStoreUpdateState(() => native?.isUpdateAvailable() ?? Promise.resolve(false));
const notAvailable = () => false;

export function usePlayStoreUpdate() {
  const available = useSyncExternalStore(updates.subscribe, updates.getSnapshot, notAvailable);
  useEffect(() => {
    if (!native) return;
    void updates.refresh();
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void updates.refresh(); });
    return () => listener.remove();
  }, []);
  return available;
}

export async function openPlayStoreUpdate() {
  try { await Linking.openURL('market://details?id=com.yepwatch.app'); }
  catch {
    try { await Linking.openURL('https://play.google.com/store/apps/details?id=com.yepwatch.app'); }
    catch { /* The link remains available if opening an external app failed. */ }
  }
}
