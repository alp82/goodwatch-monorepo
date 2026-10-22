const key = (roomId: string) => `yepwatch.v3.exposure.${roomId}`;
export async function readObserved(roomId: string): Promise<string[]> {
  const raw = sessionStorage.getItem(key(roomId));
  return raw ? JSON.parse(raw) : [];
}
export async function writeObserved(roomId: string, keys: string[]) {
  sessionStorage.setItem(key(roomId), JSON.stringify(keys));
}
