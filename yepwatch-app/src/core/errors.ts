import type { RoomSnapshot } from '@goodwatch/yepwatch-contracts';
export class ApiFailure extends Error {
  constructor(readonly code: string, message: string, readonly snapshot?: RoomSnapshot, readonly status?: number) { super(message); this.name = 'ApiFailure'; }
}
