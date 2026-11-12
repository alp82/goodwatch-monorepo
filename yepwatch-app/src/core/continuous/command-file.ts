/**
 * The native command outbox: small files in a directory of its own in the app's storage. A command is
 * written here completely before it is sent (state.ts), so a relaunch retries the identical command. The
 * keystore (SecureStore) took 40-130 ms per write on Android, and any asynchronous native call waits for
 * the JS thread to be free again (busy with the card animation right after a vote): writes here are
 * synchronous file writes of a few hundred bytes. An envelope holds no secret (command id, sequence, the
 * command itself): room tokens and the GoodWatch session stay in the keystore.
 *
 * Whole or not at all, without a rename: each key has two files written in turn, each record numbered.
 * A read takes the highest-numbered whole record, so a write cut off by a crash leaves the other file's
 * value. Clearing writes an empty record numbered above it (an older value never comes back, from the
 * other file or from the keystore) and then deletes the other file: a settled command leaves nothing.
 */
export interface Files {
  /** null when the file doesn't exist. */
  read: (uri: string) => string | null;
  write: (uri: string, contents: string) => void;
  /** No error when it doesn't exist. */
  remove: (uri: string) => void;
  /** Creates the directory when it doesn't exist. */
  makeDir: (uri: string) => void;
  /** Removes the directory and everything in it; no error when it doesn't exist. */
  removeDir: (uri: string) => void;
}
/** Where earlier app versions kept the outbox: read once, moved here, then removed there. */
export interface LegacyStore { read: (key: string) => Promise<string | null>; remove: (key: string) => Promise<void> }

interface Slot { seq: number; value: string | null }

/** `dir` ends with a slash and holds nothing else. */
export function createCommandFiles(dir: string, files: Files, legacy: LegacyStore) {
  const uris = (key: string) => [`${dir}${key}.0.json`, `${dir}${key}.1.json`] as const;
  let dirReady = false;
  /** Moves erase. A keystore read asked before an erase never writes after it. */
  let erased = 0;
  /** One keystore move per key at a time: every first read of the key waits for the same one. */
  const moving = new Map<string, Promise<string | null>>();
  /** Keys whose keystore entry is known to be gone (read or removed in this process). */
  const legacyGone = new Set<string>();
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
    if (!dirReady) { files.makeDir(dir); dirReady = true; }
    const now = latest(key);
    const [older, next] = now.at === 0 ? [0, 1] : [1, 0];
    files.write(uris(key)[next], JSON.stringify({ seq: now.seq + 1, value }));
    if (value === null) {
      // The clear is saved: the previous command's payload goes too.
      files.remove(uris(key)[older]);
      // An entry an earlier version left in the keystore is outdated by the clear; removing it isn't
      // waited for (the record above already keeps it from coming back).
      if (!legacyGone.has(key)) { legacyGone.add(key); legacy.remove(key).catch(() => legacyGone.delete(key)); }
    }
  };
  const move = async (key: string) => {
    const asked = erased;
    const old = await legacy.read(key);
    if (asked !== erased) return null;
    // Saved or cleared here while the keystore answered: that is newer than the keystore's entry.
    const now = latest(key);
    if (now.any) return now.value;
    if (old === null) { legacyGone.add(key); return null; }
    put(key, old);
    await legacy.remove(key);
    legacyGone.add(key);
    return old;
  };
  return {
    async read(key: string): Promise<string | null> {
      const now = latest(key);
      if (now.any) return now.value;
      let running = moving.get(key);
      if (!running) {
        running = move(key).finally(() => { if (moving.get(key) === running) moving.delete(key); });
        moving.set(key, running);
      }
      return running;
    },
    async write(key: string, value: string | null) { put(key, value); },
    /** Saved by the time this returns. */
    writeNow: put,
    /** Erase device: every key's files, including keys no list remembers, and no keystore move writes after it. */
    async eraseAll() {
      erased++;
      moving.clear();
      legacyGone.clear();
      dirReady = false;
      files.removeDir(dir);
    },
  };
}
