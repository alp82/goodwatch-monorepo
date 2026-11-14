/**
 * The order each Stack declares its screens in: exactly the order expo-router seeds its navigation state with
 * (its route sort: index first, static before dynamic, shorter names first). A navigator whose declared order
 * differs dispatches ROUTE_NAMES_CHANGED in a layout effect right after it mounts, a second synchronous
 * render of the whole tree (11-17 ms on a phone browser as the room stack mounts under Create room or Join).
 * tests/route-order.test.ts checks both lists against expo-router's own sort of src/app.
 */
export const ROOT_SCREENS = ['index', 'new', 'beta', 'terms', 'preview', 'privacy', 'support', 'auth/callback', 'delete-account', 'prototype-burst', 'r/[invite]', 'room/[id]'] as const;
export const ROOM_SCREENS = ['index', 'mood', 'room', 'kinds', 'matches', 'services', 'streaming'] as const;
