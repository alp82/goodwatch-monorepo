import type { ErrorCode } from '../../../packages/yepwatch-contracts/index.ts'
export class RoomError extends Error {
  code: ErrorCode; status: number; retryable: boolean
  constructor(code: ErrorCode, message: string, status = 409, retryable = false) { super(message); this.code = code; this.status = status; this.retryable = retryable }
}
export function requireRoom(condition: unknown, code: ErrorCode, message: string, status = 409): asserts condition {
  if (!condition) throw new RoomError(code, message, status)
}
/** A transport failure after sending a write cannot be labelled not applied. */
export class IndeterminateWrite extends Error {}
