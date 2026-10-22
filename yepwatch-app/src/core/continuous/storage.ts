import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import type { CommandEnvelope } from '@goodwatch/yepwatch-contracts/proposal';
import { decodeCommandRecovery, decodeAdmissionRecovery, type AdmissionRecovery } from './recovery-state';
const key = (id: string) => `yepwatch.v3.pending.${id.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
export async function readCommandRecovery(id: string) {
  return decodeCommandRecovery(await SecureStore.getItemAsync(key(id)));
}
export async function writePending(id: string, envelope: CommandEnvelope | null, retryAt = 0) {
  if (envelope) await SecureStore.setItemAsync(key(id), JSON.stringify({ envelope, retryAt }));
  else await SecureStore.deleteItemAsync(key(id));
}
const admissionKey = async (intent: string) => `yepwatch.v3.admission.${await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, intent)}`;
export async function readAdmission(intent: string) {
  return decodeAdmissionRecovery(await SecureStore.getItemAsync(await admissionKey(intent)), intent);
}
export async function writeAdmission(intent: string, value: AdmissionRecovery | null) {
  const name = await admissionKey(intent);
  if (value) await SecureStore.setItemAsync(name, JSON.stringify(value), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  else await SecureStore.deleteItemAsync(name);
}
