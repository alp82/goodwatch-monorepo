import { router } from 'expo-router';
import type { RoomSheet } from './RoomProvider';

/**
 * Pages of a room: each is a route under /room/<id>, so browser and Android back follow them. Room,
 * Your services, Streaming, Movies and shows and People are sheets over the room screen instead
 * (their old addresses still open them, see `sheetHref`).
 */
export type RoomPage = 'mood' | 'matches';

export function openPage(id: string, page: RoomPage, params: Record<string, string> = {}) {
  router.push({ pathname: `/room/[id]/${page}`, params: { id, ...params } });
}
/** The room with one of its sheets open: what /room/<id>/<sheet> addresses lead to. */
export const sheetHref = (id: string, sheet: RoomSheet) => ({ pathname: '/room/[id]' as const, params: { id, sheet } });
/** Back from a sub-page: the page underneath, or the room itself when the page was opened directly. */
export function leavePage(id: string) {
  if (router.canGoBack()) router.back();
  else router.replace({ pathname: '/room/[id]', params: { id } });
}
/** Back from the room: where you came from, else the start page (the room stays listed there). */
export function toRooms() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
