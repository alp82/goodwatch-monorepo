import type { RoomSnapshot } from '@goodwatch/yepwatch-contracts';
export class ApiFailure extends Error {
  constructor(readonly code: string, message: string, readonly snapshot?: RoomSnapshot, readonly status?: number) { super(message); this.name = 'ApiFailure'; }
}

/** HTTP expiry is authoritative; WebSocket lease expiry alone is not. */
export function isRoomExpired(error: unknown) { return error instanceof ApiFailure && (error.code === 'expired' || error.status === 410); }
