import type { RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
/** Native keeps the room in memory while the app runs, and a relaunch reads it before showing it (resume-room.ts). */
export function readSavedRoom(_roomId: string): RoomSnapshot | null { return null; }
export function saveRoom(_roomId: string, _snapshot: RoomSnapshot | null) { /* nothing kept */ }
