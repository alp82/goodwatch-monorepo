import { SqlAccountRooms } from "./proposal-account-store.ts"
import type { MemberSession } from "./continuous-members.server.ts"
import { codec, keyed } from "./crypto.server.ts"
import { IndeterminateWrite } from "./errors.ts"
import type { Sql } from "./repository.server.ts"

/** A pending refresh is durable too: a crashed writer may only retry inside the issuer's reuse window. */
export interface StoredMemberSession {
	session: MemberSession
	/** Refresh lifetime, extended only when tokens rotate. */
	expiresAt?: number
	refused?: true
	owner?: string
	rotating?: boolean
	startedAt?: number
	leaseUntil?: number
}
export interface MemberSessionRow {
	value: StoredMemberSession
	version: number
	seqNo: number
	primaryTerm: number
}
export interface MemberSessionStore {
	active(id: string): Promise<boolean>
	refuse(id: string, expiresAt: number): Promise<void>
	delete(id: string): Promise<void>
	read(id: string): Promise<MemberSessionRow | null>
	compareAndSwap(
		id: string,
		old: MemberSessionRow | null,
		value: StoredMemberSession,
	): Promise<boolean>
}
export class MemoryMemberSessions implements MemberSessionStore {
	private rows = new Map<string, MemberSessionRow>()
	private refused = new Set<string>()
	async active(id: string) {
		return !this.refused.has(id)
	}
	async refuse(id: string, _expiresAt: number) {
		this.refused.add(id)
		await this.delete(id)
	}
	async delete(id: string) {
		this.rows.delete(id)
	}
	async read(id: string) {
		return structuredClone(this.rows.get(id) ?? null)
	}
	async compareAndSwap(id: string, old: MemberSessionRow | null, value: StoredMemberSession) {
		if ((this.rows.get(id)?.seqNo ?? null) !== (old?.seqNo ?? null)) return false
		const version = (old?.version ?? 0) + 1
		this.rows.set(id, structuredClone({ value, version, seqNo: version, primaryTerm: 1 }))
		return true
	}
}
/** Keyed identifiers and authenticated encryption keep identities and OAuth credentials out of SQL logs. */
export class SqlMemberSessions implements MemberSessionStore {
	private cipher: ReturnType<typeof codec>
	private sql: Sql
	private secret: string
	constructor(sql: Sql, secret: string) {
		if (secret.length < 32)
			throw new Error("Member session secret must contain at least 32 characters")
		this.sql = sql
		this.secret = secret
		this.cipher = codec(`member-store\0${secret}`)
	}
	async active(id: string) {
		return new SqlAccountRooms(this.sql, this.secret).sessionActive(`member:${id}`)
	}
	async refuse(id: string, expiresAt: number) {
		// Keep only the existing credential-free deny receipt, so old cookies cannot seed spent tokens again.
		await new SqlAccountRooms(this.sql, this.secret).revokeSession(`member:${id}`, expiresAt)
		await this.delete(id)
	}
	private key(id: string) {
		return keyed(this.secret, "member-session", id)
	}
	async delete(id: string) {
		await this.sql("DELETE FROM doc.yepwatch_member_session WHERE id=?", [this.key(id)])
	}
	async deleteUser(userId: string) {
		await this.sql("REFRESH TABLE doc.yepwatch_member_session")
		await this.sql("DELETE FROM doc.yepwatch_member_session WHERE user_key=?", [
			keyed(this.secret, "member-user", userId),
		])
	}
	/** One bounded page per cleanup round; OCC preserves concurrent rotations. */
	async purgeExpired(now: number) {
		await this.sql("REFRESH TABLE doc.yepwatch_member_session")
		const rows = (
			await this.sql(
				"SELECT id,_seq_no,_primary_term,session_ciphertext FROM doc.yepwatch_member_session WHERE expires_at<=? ORDER BY expires_at LIMIT 100",
				[now],
			)
		).rows
		for (const row of rows) {
			const value = this.cipher.decode<StoredMemberSession>(String(row[3]), String(row[0]))
			// A refresh claimed just before expiry may still be saving its new pair.
			if (value.owner && (value.leaseUntil ?? 0) > now) continue
			await this.sql(
				"DELETE FROM doc.yepwatch_member_session WHERE id=? AND _seq_no=? AND _primary_term=?",
				row.slice(0, 3),
			)
		}
	}
	async read(id: string): Promise<MemberSessionRow | null> {
		const key = this.key(id)
		const row = (
			await this.sql(
				"SELECT session_ciphertext,version,_seq_no,_primary_term FROM doc.yepwatch_member_session WHERE id=?",
				[key],
			)
		).rows[0]
		return row
			? {
					value: this.cipher.decode<StoredMemberSession>(String(row[0]), key),
					version: Number(row[1]),
					seqNo: Number(row[2]),
					primaryTerm: Number(row[3]),
				}
			: null
	}
	async compareAndSwap(id: string, old: MemberSessionRow | null, value: StoredMemberSession) {
		const key = this.key(id)
		const expiresAt = value.expiresAt ?? old?.value.expiresAt ?? Date.now() + 90 * 86400_000
		const ciphertext = this.cipher.encode({ ...value, expiresAt }, key)
		const userKey = keyed(this.secret, "member-user", value.session.userId)
		const version = (old?.version ?? 0) + 1
		try {
			const result = old
				? await this.sql(
						"UPDATE doc.yepwatch_member_session SET session_ciphertext=?,version=?,user_key=?,expires_at=? WHERE id=? AND _seq_no=? AND _primary_term=?",
						[ciphertext, version, userKey, expiresAt, key, old.seqNo, old.primaryTerm],
					)
				: await this.sql(
						"INSERT INTO doc.yepwatch_member_session (id,session_ciphertext,version,user_key,expires_at) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING",
						[key, ciphertext, version, userKey, expiresAt],
					)
			return result.rowcount === 1
		} catch (e) {
			if (!(e instanceof IndeterminateWrite)) throw e
			// The caller re-reads; never repeat the remote refresh because a write's reply was lost.
			return false
		}
	}
}
