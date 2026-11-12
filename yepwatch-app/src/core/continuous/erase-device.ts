import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { loadAccess } from '../credentials';
import { forgetSessionCache } from './member';
import { commandFiles, pendingKey } from './storage';
/** Only YepWatch keys are touched. GoodWatch credentials are never in this store. */
export async function eraseDevice(roomIds: string[]) {
  for (const id of roomIds) {
    const access = await loadAccess(id);
    const safe = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_');
    for (const key of [`yepwatch.room.${safe(id)}`, `yepwatch.v3.invite.${safe(id)}`, `yepwatch.v3.exposure.${safe(id)}`, `yepwatch.v3.pending.${safe(id)}`, `yepwatch.v3.ideas-seen.${safe(id)}`,
      ...(access?.sessionKey ? [`yepwatch.v3.pending.${safe(`${id}.${access.sessionKey}`)}`] : [])]) await SecureStore.deleteItemAsync(key);
    // The command outbox lives in a file (storage.ts).
    for (const key of [pendingKey(id), ...(access?.sessionKey ? [pendingKey(`${id}.${access.sessionKey}`)] : [])]) await commandFiles.erase(key);
  }
  await SecureStore.deleteItemAsync(`yepwatch.v3.admission.${await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, '')}`);
  for (const key of ['yepwatch.recent-room', 'yepwatch.v3.front-room', 'yepwatch.v2.member-intent', 'yepwatch.v3.account-intent', 'yepwatch.v3.member-session', 'yepwatch.v3.member-name']) await SecureStore.deleteItemAsync(key);
  forgetSessionCache();
}
