import * as SecureStore from 'expo-secure-store';
import { loadAccess } from '../credentials';
/** Only YepWatch keys are touched. GoodWatch credentials are never in this store. */
export async function eraseDevice(roomIds: string[]) {
  for (const id of roomIds) {
    const access = await loadAccess(id);
    const safe = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_');
    for (const key of [`yepwatch.room.${safe(id)}`, `yepwatch.v3.invite.${safe(id)}`, `yepwatch.v3.exposure.${safe(id)}`, `yepwatch.v3.pending.${safe(id)}`,
      ...(access?.sessionKey ? [`yepwatch.v3.pending.${safe(`${id}.${access.sessionKey}`)}`] : [])]) await SecureStore.deleteItemAsync(key);
  }
  for (const key of ['yepwatch.recent-room', 'yepwatch.v2.member-intent', 'yepwatch.v3.account-intent', 'yepwatch.v3.member-session', 'yepwatch.v3.member-name']) await SecureStore.deleteItemAsync(key);
}
