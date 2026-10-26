import type { CommandEnvelope, GuestAdmissionRequest } from '@goodwatch/yepwatch-contracts/proposal';
import { restoredRetryAt } from './retry';
export interface AdmissionRecovery {
  request: GuestAdmissionRequest;
  code: string;
  intent: string;
  retryAt: number;
  /** Continue GoodWatch sign-in after the exact admission succeeds. */
  member?: boolean;
}
export interface CommandRecovery { envelope: CommandEnvelope | null; retryAt: number }
/** Accept the previous bare-envelope storage format without losing an uncertain action. */
export function decodeCommandRecovery(raw: string | null): CommandRecovery {
  if (!raw) return { envelope: null, retryAt: 0 };
  const value = JSON.parse(raw);
  const envelope = value?.envelope ?? value;
  if (!envelope || typeof envelope.commandId !== 'string' || !Number.isSafeInteger(envelope.sequence) || !envelope.command?.type)
    throw new Error('The saved action could not be restored.');
  return { envelope, retryAt: restoredRetryAt(value.retryAt) };
}
export function decodeAdmissionRecovery(raw: string | null, intent: string): AdmissionRecovery | null {
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (value?.intent !== intent || typeof value.code !== 'string' || value.request?.contractVersion !== 3 ||
      typeof value.request?.commandId !== 'string' || typeof value.request?.admissionSecret !== 'string' ||
      typeof value.request?.nickname !== 'string' || (value.member !== undefined && typeof value.member !== 'boolean')) throw new Error('The saved room request could not be restored.');
  return { ...value, retryAt: restoredRetryAt(value.retryAt) };
}
