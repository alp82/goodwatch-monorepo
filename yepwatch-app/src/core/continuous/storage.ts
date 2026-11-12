import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { requireNativeModule } from 'expo';
import type { CommandEnvelope } from '@goodwatch/yepwatch-contracts/proposal';
import { createCommandFiles } from './command-file';
import { decodeCommandRecovery, decodeAdmissionRecovery, type AdmissionRecovery } from './recovery-state';
export const pendingKey = (id: string) => `yepwatch.v3.pending.${id.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
/**
 * Expo's file module (part of `expo` itself, already in every installed build), through its native
 * module directly: listing the package in the app's own dependencies would change the runtime fingerprint.
 */
interface NativeFile { readonly exists: boolean; textSync(): string; writeSync(contents: string): void; delete(): void }
const fs = requireNativeModule<{ documentDirectory: string | null; FileSystemFile: new (uri: string) => NativeFile }>('FileSystem');
export const commandFiles = createCommandFiles(fs.documentDirectory ?? '', {
  read: (uri) => { const f = new fs.FileSystemFile(uri); return f.exists ? f.textSync() : null; },
  write: (uri, contents) => new fs.FileSystemFile(uri).writeSync(contents),
  remove: (uri) => { const f = new fs.FileSystemFile(uri); if (f.exists) f.delete(); },
}, { read: (key) => SecureStore.getItemAsync(key), remove: (key) => SecureStore.deleteItemAsync(key) });
/** The command awaiting confirmation (command-file.ts): saved whole before it is sent. */
export async function readCommandRecovery(id: string, sessionKey?: string) {
  return decodeCommandRecovery(await commandFiles.read(pendingKey(sessionKey ? `${id}.${sessionKey}` : id)));
}
export function writePendingNow(id: string, envelope: CommandEnvelope | null, retryAt = 0, sessionKey?: string) {
  commandFiles.writeNow(pendingKey(sessionKey ? `${id}.${sessionKey}` : id), envelope ? JSON.stringify({ envelope, retryAt }) : null);
}
export async function writePending(id: string, envelope: CommandEnvelope | null, retryAt = 0, sessionKey?: string) {
  writePendingNow(id, envelope, retryAt, sessionKey);
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
