import * as SecureStore from 'expo-secure-store';
import type { GuestCredential } from '@goodwatch/yepwatch-contracts';
export interface RoomAccess { roomId: string; participantId: string; token: string; expiresAt: number }
const key = (id: string) => `yepwatch.room.${id.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
export const nativeClient = true;
export async function saveAccess(access: GuestCredential) { await SecureStore.setItemAsync(key(access.roomId), JSON.stringify(access), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); }
export async function loadAccess(roomId: string): Promise<RoomAccess | null> { const raw = await SecureStore.getItemAsync(key(roomId)); return raw ? JSON.parse(raw) : null; }
export async function forgetAccess(roomId: string) { await SecureStore.deleteItemAsync(key(roomId)); }
