/**
 * The native command outbox: small files in the app's own storage. A command is written here completely
 * before it is sent (state.ts), so a relaunch retries the identical command. The keystore (SecureStore)
 * took 40-130 ms per write on Android, and any asynchronous native call waits for the JS thread to be
 * free again (busy with the card animation right after a vote): writes here are synchronous file writes
 * of a few hundred bytes. An envelope holds no secret (command id, sequence, the command itself): room
 * tokens and the GoodWatch session stay in the keystore.
 *
 * Whole or not at all, without a rename: each key has two files written in turn, each record numbered.
 * A read takes the highest-numbered whole record, so a write cut off by a crash leaves the other file's
 * value, and clearing writes an empty record numbered above it (an older value never comes back).
 */
export interface Files {
  /** null when the file doesn't exist. */
  read: (uri: string) => string | null;
  write: (uri: string, contents: string) => void;
  /** No error when it doesn't exist. */
  remove: (uri: string) => void;
}
/** Where earlier app versions kept the outbox: read once, moved here, then removed there. */
export interface LegacyStore { read: (key: string) => Promise<string | null>; remove: (key: string) => Promise<void> }

interface Slot { seq: number; value: string | null }

export function createCommandFiles(dir: string, files: Files, legacy: LegacyStore) {
  const uris = (key: string) => [`${dir}${key}.0.json`, `${dir}${key}.1.json`] as const;
  const slot = (raw: string | null): Slot | null => {
    try {
      const v = raw === null ? null : (JSON.parse(raw) as Partial<Slot>);
      return v && Number.isSafeInteger(v.seq) && (v.value === null || typeof v.value === 'string') ? { seq: v.seq!, value: v.value } : null;
    } catch { return null; }
  };
  const latest = (key: string) => {
    const [a, b] = uris(key).map((u) => slot(files.read(u)));
    if (!a && !b) return { at: -1, seq: 0, value: null, any: false };
    const at = !b || (a && a.seq >= b.seq) ? 0 : 1;
    const s = (at === 0 ? a : b)!;
    return { at, seq: s.seq, value: s.value, any: true };
  };
  const put = (key: string, value: string | null) => {
    const now = latest(key);
    if (!now.any && value === null) return;
    files.write(uris(key)[now.at === 0 ? 1 : 0], JSON.stringify({ seq: now.seq + 1, value }));
  };
  return {
    async read(key: string): Promise<string | null> {
      const now = latest(key);
      if (now.any) return now.value;
      const old = await legacy.read(key);
      if (old === null) return null;
      put(key, old);
      await legacy.remove(key);
      return old;
    },
    async write(key: string, value: string | null) { put(key, value); },
    /** Saved by the time this returns. */
    writeNow: put,
    /** Removes every trace of the key (Erase device). */
    async erase(key: string) { for (const u of uris(key)) files.remove(u); await legacy.remove(key); },
  };
}
