import { fetch as serverFetch } from 'undici'
import { codec } from './crypto.server.ts'
import { IndeterminateWrite, RoomError } from './errors.ts'
import { LIMITS, type Room, type RoomRepository, type StoredRoom } from './types.ts'
export interface SqlResult { rows: unknown[][]; rowcount: number }
export type Sql = (stmt: string, args?: unknown[]) => Promise<SqlResult>
export function crateSql(origin: string, username: string, password: string): Sql {
  const endpoint = new URL('/_sql', origin)
  return async (stmt, args = []) => {
    let response
    try { response = await serverFetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` }, body: JSON.stringify({ stmt, args }), signal: AbortSignal.timeout(8000) }) }
    catch { if (!stmt.startsWith('SELECT')) throw new IndeterminateWrite('Crate write response unavailable'); throw new RoomError('busy', 'Room store unavailable', 503, true) }
    const result = await response.json() as SqlResult & { error?: { code: number } }
    if (!response.ok) {
      if (result.error?.code === 4091) return { rows: [], rowcount: 0 }
      if (!stmt.startsWith('SELECT') && response.status >= 500) throw new IndeterminateWrite('Crate write outcome unavailable')
      throw new RoomError('busy', 'Room store rejected operation', 503, true)
    }
    return result
  }
}
/** Explicit installation only; NEVER auto-run DDL on app startup. Use replicas=0 only on disposable local Crate. */
export async function installRoomTable(sql: Sql, replicas: 0 | 2) {
  await sql(`CREATE TABLE IF NOT EXISTS doc.yepwatch_room (
    id TEXT PRIMARY KEY, payload TEXT NOT NULL INDEX OFF STORAGE WITH (columnstore=false),
    expires_at BIGINT NOT NULL, pending_revision BIGINT NOT NULL
  ) CLUSTERED INTO 4 SHARDS WITH (number_of_replicas=${replicas}, "write.wait_for_active_shards"='${replicas + 1}', refresh_interval=1000)`)
}
export class CrateRoomRepository implements RoomRepository {
  private crypto: ReturnType<typeof codec>
  private sql: Sql
  constructor(sql: Sql, secret: string) { this.sql = sql; this.crypto = codec(secret) }
  private encode(room: Room) { const raw = JSON.stringify(room); if (Buffer.byteLength(raw) > LIMITS.aggregateBytes) throw new RoomError('limit_reached', 'Room state limit reached', 409); return this.crypto.encode(room, room.id) }
  async read(id: string): Promise<StoredRoom | null> {
    // A complete equality predicate on the primary key is required; never replace with discovery search.
    const row = (await this.sql('SELECT payload,_seq_no,_primary_term,pending_revision FROM doc.yepwatch_room WHERE id=?', [id])).rows[0]
    return row ? { room: this.crypto.decode<Room>(String(row[0]), id), seq: Number(row[1]), term: Number(row[2]), pendingRevision: Number(row[3]) } : null
  }
  async insert(room: Room) {
    const result = await this.sql('INSERT INTO doc.yepwatch_room (id,payload,expires_at,pending_revision) VALUES (?,CASE WHEN CURRENT_TIMESTAMP < ? THEN ? ELSE NULL END,?,?)', [room.id, room.expiresAt, this.encode(room), room.expiresAt, room.revision])
    return result.rowcount === 1
  }
  async compareAndSwap(previous: StoredRoom, room: Room, notify: boolean) {
    const pending = notify ? Math.max(previous.pendingRevision, room.revision) : previous.pendingRevision
    return (await this.sql('UPDATE doc.yepwatch_room SET payload=?,expires_at=?,pending_revision=? WHERE id=? AND _seq_no=? AND _primary_term=?', [this.encode(room), room.expiresAt, pending, room.id, previous.seq, previous.term])).rowcount === 1
  }
  async pending(limit: number) { return (await this.sql('SELECT id FROM doc.yepwatch_room WHERE pending_revision>0 AND expires_at>CURRENT_TIMESTAMP LIMIT ?', [Math.min(100, limit)])).rows.map(r => String(r[0])) }
  async acknowledge(id: string, revision: number) {
    const current = await this.read(id)
    if (current?.pendingRevision && current.pendingRevision <= revision) await this.sql('UPDATE doc.yepwatch_room SET pending_revision=0 WHERE id=? AND _seq_no=? AND _primary_term=?', [id, current.seq, current.term])
  }
}
