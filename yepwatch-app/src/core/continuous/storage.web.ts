import type { CommandEnvelope } from '@goodwatch/yepwatch-contracts/proposal';
import { decodeCommandRecovery, decodeAdmissionRecovery, type AdmissionRecovery } from './recovery-state';
const key = (id: string) => `yepwatch.v3.pending.${id}`;
/** Own pending command only; HttpOnly cookies authenticate room HTTP. */
export async function readCommandRecovery(id: string) {
  return decodeCommandRecovery(sessionStorage.getItem(key(id)));
}
export async function writePending(id: string, envelope: CommandEnvelope | null, retryAt = 0) {
  if (envelope) sessionStorage.setItem(key(id), JSON.stringify({ envelope, retryAt }));
  else sessionStorage.removeItem(key(id));
}
const admissionKey = (intent: string) => `yepwatch.v3.admission.${intent}`;
/** Own pending bootstrap secret survives this tab's reload only; remove after definitive recovery.
 * It is never a room bearer/account grant and never enters URLs, activity or telemetry. */
export async function readAdmission(intent: string) {
  return decodeAdmissionRecovery(sessionStorage.getItem(admissionKey(intent)), intent);
}
export async function writeAdmission(intent: string, value: AdmissionRecovery | null) {
  if (value) sessionStorage.setItem(admissionKey(intent), JSON.stringify(value));
  else sessionStorage.removeItem(admissionKey(intent));
}
