import { router } from 'expo-router';
import { leaveScreen } from '../shell/sheet-back';
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
  router.dismissTo({ pathname: '/room/[id]', params: { id } });
}
/** Back from the room returns to the start page; the room stays listed there. */
export function toRooms() {
  router.dismissTo('/');
}

/**
 * New room opens one Mood page however often it's pressed: the presses of a double or triple tap land
 * before the page has taken over and would stack a Mood page each. A push waits for its page (or a
 * moment, should the push not lead anywhere); while the Mood page is in front, New room is already done.
 */
let newRoomPushedAt = 0;
let moodInFront = false;
const NEW_ROOM_SETTLE_MS = 1000;
export function openNewRoom() {
  if (moodInFront || Date.now() - newRoomPushedAt < NEW_ROOM_SETTLE_MS) return;
  newRoomPushedAt = Date.now();
  router.push('/new', { inTransition: true });
}
/** The Mood page of a new room came to the front (true) or left it (false). */
export function newRoomInFront(front: boolean) {
  moodInFront = front;
  newRoomPushedAt = 0;
}

/**
 * Rooms that replace the New room page once it has created them. Their screen comes in without the stack's
 * page transition: the page under it was this room's own draft (Saving…), so the room takes its place the
 * frame it is drawn (the web does the same), instead of after Android's cross-fade has started.
 * Read by the root stack's screen options: the room's own params there hold only its id.
 */
const arrivals = new Set<string>();
export const arrivesInPlace = (id: string | undefined) => Boolean(id && arrivals.has(id));
/** The New room page's answer opens its room in the page's place. */
export function openCreatedRoom(id: string) {
  arrivals.add(id);
  router.replace({ pathname: '/room/[id]', params: { id } }, { inTransition: true });
}
/**
 * Fetches the code of the pages a start-page action opens (Mood, the room) ahead of the tap. A route
 * still loading when it is opened holds its page back for React's 300 ms Suspense reveal throttle.
 */
export function preloadStartPages() {
  void Promise.all([import('../../app/new'), import('../../app/room/[id]/_layout'), import('../../app/room/[id]/index')]).catch(() => undefined);
}
/**
 * Out of the room for good (left, archived, ended): back to the start page underneath, where the room
 * is no longer listed. Open sheets close first; the start page isn't mounted again, so it shows its
 * current list from the first frame and Back there leaves the app.
 */
export function exitRoom() {
  leaveScreen(() => router.dismissTo('/'));
}
