import { router } from 'expo-router';

/** Sub-pages of a room: each is a route under /room/<id>, so browser and Android back follow them. */
export type RoomPage = 'mood' | 'room' | 'streaming' | 'services' | 'kinds' | 'matches';

export function openPage(id: string, page: RoomPage, params: Record<string, string> = {}) {
  router.push({ pathname: `/room/[id]/${page}`, params: { id, ...params } });
}
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
