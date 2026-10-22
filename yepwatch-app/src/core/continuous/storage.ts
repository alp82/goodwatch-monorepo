import * as SecureStore from 'expo-secure-store';
import type { CommandEnvelope } from '@goodwatch/yepwatch-contracts/continuous';
const key = (id: string) => `yepwatch.v2.pending.${id.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
export async function readPending(id: string): Promise<CommandEnvelope | null> {
  const raw = await SecureStore.getItemAsync(key(id));
  return raw ? JSON.parse(raw) : null;
}
export async function writePending(id: string, value: CommandEnvelope | null) {
  if (value) await SecureStore.setItemAsync(key(id), JSON.stringify(value));
  else await SecureStore.deleteItemAsync(key(id));
}
