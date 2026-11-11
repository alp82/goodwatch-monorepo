/**
 * A screen or sheet that just appeared ignores the rest of a quick double or triple tap that began
 * before it was there: the extra taps were aimed at the control that opened it (New room, the room
 * pill), not at whatever now sits under the finger (a Mood chip, the sheet's shade).
 *
 * A tap continues a multi-tap when the browser counts it as one (a click's `detail` > 1), or, for
 * touches (no count), when it starts close in time and place to the previous one. A new tap (count 1,
 * or a touch elsewhere or later) always goes through, however soon after the surface appeared.
 */
import { useLayoutEffect } from 'react';
import { Platform, type GestureResponderEvent } from 'react-native';

/** Touch: a second tap within this time and distance of the first is part of the same multi-tap. */
const REPEAT_MS = 450;
const REPEAT_PX = 30;

let appearedAt = -Infinity;
/** When the tap (multi-tap) under way began. */
let gestureAt = -Infinity;
let lastTouch = { at: -Infinity, x: 0, y: 0 };

/** A screen or sheet came to the front: taps of a multi-tap that began before now don't reach it. */
export function surfaceAppeared() {
  appearedAt = Date.now();
}
/** Marks the calling screen or sheet as fresh when it mounts. */
export function useFreshSurface(key?: unknown) {
  useLayoutEffect(() => { surfaceAppeared(); }, [key]);
}

/** A touch at (x, y) now: true when it continues a multi-tap that began before the latest surface. */
function leftoverTouch(x: number, y: number) {
  const now = Date.now();
  const repeat = now - lastTouch.at <= REPEAT_MS && Math.hypot(x - lastTouch.x, y - lastTouch.y) <= REPEAT_PX;
  lastTouch = { at: now, x, y };
  if (!repeat) gestureAt = now;
  return repeat && gestureAt < appearedAt;
}

/**
 * Native: root view props that claim a leftover touch before any child sees it (capture phase), so
 * no press, scroll or text field on the fresh surface reacts to it.
 */
export const leftoverTouchGuard = {
  onStartShouldSetResponderCapture: (e: GestureResponderEvent) => leftoverTouch(e.nativeEvent.pageX, e.nativeEvent.pageY),
  onResponderTerminationRequest: () => true,
};

let installed = false;
/** Web: window capture listeners run before React Native Web's responder and React's own handlers. */
export function installLeftoverTapGuard() {
  if (Platform.OS !== 'web' || installed || typeof window === 'undefined') return;
  installed = true;
  let swallowing = false;
  const stop = (e: Event) => { e.stopImmediatePropagation(); if (e.cancelable) e.preventDefault(); };
  window.addEventListener('mousedown', (e) => {
    if (e.detail <= 1) { gestureAt = Date.now(); swallowing = false; return; }
    swallowing = gestureAt < appearedAt;
    if (swallowing) stop(e);
  }, true);
  window.addEventListener('mouseup', (e) => { if (swallowing) stop(e); }, true);
  window.addEventListener('click', (e) => {
    if (swallowing || (e.detail > 1 && gestureAt < appearedAt)) stop(e);
    swallowing = false;
  }, true);
  window.addEventListener('dblclick', (e) => { if (gestureAt < appearedAt) stop(e); }, true);
  let touchSwallowing = false;
  window.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    if (!t || e.touches.length > 1) return;
    touchSwallowing = leftoverTouch(t.clientX, t.clientY);
    // Cancelling the touch start also cancels the mouse events and click the browser would derive from it.
    if (touchSwallowing) stop(e);
  }, { capture: true, passive: false });
  window.addEventListener('touchend', (e) => { if (touchSwallowing) { stop(e); touchSwallowing = false; } }, { capture: true, passive: false });
}
