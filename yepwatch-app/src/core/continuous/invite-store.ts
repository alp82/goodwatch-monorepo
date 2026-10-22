import * as SecureStore from 'expo-secure-store';
export interface StoredInvite {
  code: string;
  path: string;
}
const key = (id: string) => `yepwatch.v2.invite.${id.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
export async function saveInvite(id: string, invite: StoredInvite) {
  await SecureStore.setItemAsync(key(id), JSON.stringify(invite), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}
export async function loadInvite(id: string): Promise<StoredInvite | null> {
  const raw = await SecureStore.getItemAsync(key(id));
  return raw ? JSON.parse(raw) : null;
}
