/** Android back for screens, behind the open sheets (see sheet-stack). */
import { useCallback, useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { screenBack } from './sheet-stack';

/**
 * The screen's Android back action while it's focused. An open sheet always wins: it closes first,
 * however the handlers were registered (sheets and screens re-register as they re-render).
 */
export function useBackAction(action: () => void, enabled = true) {
  const latest = useRef(action);
  useEffect(() => { latest.current = action; });
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android' || !enabled) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => screenBack(() => latest.current()));
    return () => sub.remove();
  }, [enabled]));
}
