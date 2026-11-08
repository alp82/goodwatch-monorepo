/** Back for screens, behind the open sheets (see sheet-stack): Android back and navigation away. */
import { useCallback, useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useFocusEffect, useNavigationContainerRef, usePreventRemove } from 'expo-router';
import { closeTopSheet, screenBack } from './sheet-stack';

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

/** Navigation actions that are a Back: with a sheet open they close it instead. */
const BACK_ACTIONS = new Set(['GO_BACK', 'POP', 'POP_TO', 'POP_TO_TOP', 'RESET']);

/**
 * While a sheet is open over this screen, leaving the screen is held: a Back of any kind (browser
 * history, the router's back, the iOS swipe) closes the sheet on top instead; anything else (Leave
 * room, being removed from it) closes the sheets (`closeAll`) and then goes ahead.
 */
export function useSheetsHoldNavigation(active: boolean, closeAll: () => void) {
  const root = useNavigationContainerRef();
  // Held until the sheets are gone and the hold is lifted; then it goes as it was asked for.
  const held = useRef<Parameters<typeof root.dispatch>[0] | null>(null);
  usePreventRemove(active, ({ data }) => {
    if (BACK_ACTIONS.has(data.action.type)) { closeTopSheet(); return; }
    held.current = data.action;
    closeAll();
  });
  useEffect(() => {
    const action = held.current;
    if (active || !action) return;
    held.current = null;
    // From the root, as the router sent it (the screen's own navigation can't replay a root action).
    root.current?.dispatch(action);
  }, [active, root]);
  // Holding navigation also asks before the page unloads (web); an open sheet is no reason to ask on reload.
  useEffect(() => {
    if (!active || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const quiet = (e: Event) => e.stopImmediatePropagation();
    window.addEventListener('beforeunload', quiet, { capture: true });
    return () => window.removeEventListener('beforeunload', quiet, { capture: true });
  }, [active]);
}
