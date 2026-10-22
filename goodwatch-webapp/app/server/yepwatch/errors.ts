import type { ErrorCode, FailureDetails } from '../../../packages/yepwatch-contracts/index.ts'
export class RoomError extends Error {
  code: ErrorCode; status: number; retryable: boolean; details?: FailureDetails
  constructor(code: ErrorCode, message: string, status = 409, retryable = false, details?: FailureDetails) { super(message); this.code = code; this.status = status; this.retryable = retryable; this.details = details }
}
export function requireRoom(condition: unknown, code: ErrorCode, message: string, status = 409): asserts condition {
  if (!condition) throw new RoomError(code, message, status)
}
/** A transport failure after sending a write cannot be labelled not applied. */
export class IndeterminateWrite extends Error {}
export function memberProgressRequired(): never {
  throw new RoomError('member_required', 'Continuing shows requires GoodWatch sign-in and saved progress. Sign-in is not connected yet; choose movies and shows to start for now.', 403, false, { type: 'access', reason: 'member_auth_unavailable', actions: ['use_guest_modes'] })
}
export function rejectManualProgress(): never {
  throw new RoomError('invalid_request', 'Manual viewing history is not supported. Show progress must come from your linked GoodWatch account.', 400, false, { type: 'access', reason: 'manual_progress_not_supported', actions: ['use_guest_modes'] })
}
