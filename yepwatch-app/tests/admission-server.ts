import { paths, type RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import { ContinuousApi } from '../src/core/continuous/api-client';
import { continuousFixture } from './continuous-fixture';

/**
 * A fake YepWatch server behind the real ContinuousApi (api-client.ts), for the admission flows' integrated
 * tests: one room per create command id + secret, one seat per join command id + secret, a command applied
 * once per command id (the real server's idempotency). Every request first asks `script` how to answer:
 * 'ok' (the real answer), 'lost' (the server acts, then the connection drops: no answer), 'stalled' (the
 * server acts and its 200 headers arrive, but the body never does until the request is aborted, e.g. by the
 * app's own timeout), 'body-lost' (the same, then the connection drops while the body is read), or a refusal
 * (with a Retry-After header when `retryAfter` is set). Answers carry a renewed member session, and storing
 * it (the app's SecureStore write) waits on `store`.
 */
export type Reply = 'ok' | 'lost' | 'stalled' | 'body-lost' | { status: number; code: string; message?: string; retryable?: boolean; retryAfter?: number };
export type Seen = { path: string; body: { commandId?: string; command?: { type: string; text?: string; country?: string }; [k: string]: unknown } };

export function admissionServer(script: (seen: Seen, n: number) => Reply | Promise<Reply>, o: { store?: () => Promise<void> } = {}) {
  const rooms = new Map<string, RoomSnapshot>();
  const byKey = new Map<string, string>();
  const applied = new Set<string>();
  const seen: Seen[] = [];
  const stored: string[] = [];
  let seats = 0;
  const reply = (status: number, body: unknown, o: { retryAfter?: number; json?: () => Promise<unknown> } = {}) => ({
    ok: status >= 200 && status < 300, status,
    headers: { get: (name: string) => {
      const key = name.toLowerCase();
      if (key === 'x-yepwatch-session') return `session-${seen.length}`;
      return key === 'retry-after' && o.retryAfter !== undefined ? String(o.retryAfter) : null;
    } },
    json: o.json ?? (async () => body),
  });
  const room = (id: string) => rooms.get(id)!;
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const entry: Seen = { path, body };
    seen.push(entry);
    const answer = await script(entry, seen.filter((s) => s.path === path).length);
    if (init?.signal?.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
    if (typeof answer === 'object')
      return reply(answer.status, { error: { code: answer.code, message: answer.message ?? answer.code, retryable: answer.retryable === true } });
    let result: unknown;
    if (path === paths.rooms) {
      const key = `${body.commandId}:${body.admissionSecret}`;
      const id = byKey.get(key) ?? `room-${rooms.size + 1}`;
      if (!rooms.has(id)) {
        byKey.set(key, id);
        const snapshot = continuousFixture();
        snapshot.shared.roomId = id;
        snapshot.shared.screens[0].country = body.setup?.country ?? (null as unknown as string);
        snapshot.shared.ideas = body.setup?.idea ? [{ id: 'idea-1', text: body.setup.idea, authorId: 'host', on: true, attributes: [] as never }] : [];
        rooms.set(id, snapshot);
      }
      result = { credential: { roomId: id, participantId: 'host', token: 't', expiresAt: Date.now() + 3600000, sessionKey: 'k' }, invite: { code: 'CODE1', path: '/r/CODE1' }, snapshot: structuredClone(room(id)) };
    } else if (path === paths.resolveInvite) {
      result = { roomId: 'room-1', credential: false };
    } else if (path.endsWith('/join')) {
      seats += 1;
      result = { credential: { roomId: 'room-1', participantId: 'p', token: 't', expiresAt: Date.now() + 3600000, sessionKey: 'k' }, invite: { code: 'INVITE1', path: '/r/INVITE1' }, snapshot: continuousFixture() };
    } else if (path.endsWith('/commands')) {
      const id = path.split('/').at(-2)!;
      const snapshot = room(id);
      if (!applied.has(body.commandId)) {
        applied.add(body.commandId);
        const c = body.command;
        if (c.type === 'configure') snapshot.shared.screens[0].country = c.country;
        if (c.type === 'add_idea') snapshot.shared.ideas.push({ id: `idea-${body.commandId}`, text: c.text, authorId: 'host', on: true, attributes: [] as never });
        if (c.type === 'edit_idea') snapshot.shared.ideas = snapshot.shared.ideas.map((i) => (i.id === c.ideaId ? { ...i, text: c.text } : i));
        snapshot.shared.revision += 1;
        snapshot.own.nextSequence += 1;
      }
      result = { receipt: { commandId: body.commandId }, snapshot: structuredClone(snapshot) };
    } else throw new Error(`unexpected request ${path}`);
    if (answer === 'lost') throw new TypeError('Network request failed');
    if (answer === 'body-lost') return reply(200, result, { json: async () => { throw new TypeError('Network request failed'); } });
    if (answer === 'stalled') {
      const signal = init?.signal;
      return reply(200, result, { json: () => new Promise((_, reject) => {
        const aborted = () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        if (signal?.aborted) aborted(); else signal?.addEventListener('abort', aborted, { once: true });
      }) });
    }
    return reply(200, result);
  };
  const api = new ContinuousApi(fetcher as typeof fetch, true, {
    read: async () => null, peek: () => null,
    save: async (value: string) => { await o.store?.(); stored.push(value); },
  }, { read: async () => null });
  const posts = (suffix: string) => seen.filter((s) => s.path.endsWith(suffix));
  return { api, seen, stored, rooms, posts, seats: () => seats };
}
