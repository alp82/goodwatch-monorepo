/** Back for screens, behind the open sheets (see sheet-stack): Android back and navigation away. */
import { useCallback, useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';
import { useFocusEffect, useNavigationContainerRef, usePreventRemove } from 'expo-router';
import { closeAllSheets, closeTopSheet, screenBack } from './sheet-stack';

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
type NavAction = { type: string };
/**
 * Actions already answered: a screen can hold navigation from more than one place (a page over the
 * screen holds it too), and one Back closes one sheet.
 */
const answered = new WeakSet<NavAction>();
/**
 * The action waiting for the sheets to close. Kept outside the screen that held it: the room can
 * swap its screen while it waits (Leave ends your access, and the room then shows its status), and
 * whichever room screen is in front once the sheets are gone sends it.
 */
let held: NavAction | null = null;
/** Where `leaveScreen` goes once the sheets it closed are gone. */
let leave: (() => void) | null = null;

/**
 * Navigates away from this screen on purpose (Leave room, Archive room, the room ended): the open
 * sheets close first, then it goes, even when the navigation is shaped like a Back.
 */
export function leaveScreen(go: () => void) {
  if (!closeAllSheets()) { go(); return; }
  leave = go;
}

/**
 * While a sheet is open over this screen, leaving the screen is held: a Back of any kind (browser
 * history, the router's back, the iOS swipe) closes the sheet on top instead; anything else (Leave
 * room, being removed from it) closes the sheets (`closeAll`) and then goes ahead.
 */
export function useSheetsHoldNavigation(active: boolean, closeAll: () => void) {
  const root = useNavigationContainerRef();
  usePreventRemove(active, ({ data }) => {
    const first = !answered.has(data.action);
    answered.add(data.action);
    if (BACK_ACTIONS.has(data.action.type)) { if (first) closeTopSheet(); return; }
    held = data.action;
    closeAll();
  });
  // Held until the sheets are gone and the hold is lifted; then it goes as it was asked for.
  useEffect(() => {
    if (active) return;
    const go = leave;
    leave = null;
    go?.();
    const action = held;
    if (!action) return;
    held = null;
    // From the root, as the router sent it (the screen's own navigation can't replay a root action).
    root.current?.dispatch(action as Parameters<typeof root.dispatch>[0]);
  }, [active, root]);
  // Holding navigation also asks before the page unloads (web); an open sheet is no reason to ask on reload.
  useEffect(() => {
    if (!active || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const quiet = (e: Event) => e.stopImmediatePropagation();
    window.addEventListener('beforeunload', quiet, { capture: true });
    return () => window.removeEventListener('beforeunload', quiet, { capture: true });
  }, [active]);
}
