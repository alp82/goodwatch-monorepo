import { ImportDb } from "./import-db.test-support.ts"
import type { Param } from "./store.server.ts"

/** Database boundary used by endpoint tests, including encryption and the lease CAS. */
export class ConnectDb extends ImportDb {
	connections = new Map<
		string,
		{
			user_id: string
			payload: string
			cleanup_at: Date
			lease_until: Date
			_seq_no: number
			_primary_term: number
		}
	>()
	connectionWrites: Param[][] = []
	failCredentialSave = false
	override async run(sql: string, params: Param[]) {
		if (!sql.includes("user_import_connection")) return super.run(sql, params)
		this.connectionWrites.push(params)
		if (sql === "REFRESH TABLE doc.user_import_connection")
			return { rowcount: 0 }
		if (
			sql ===
			"INSERT INTO doc.user_import_connection (id,user_id,payload,cleanup_at,lease_until) VALUES (?,?,?,?,?)"
		) {
			this.connections.set(String(params[0]), {
				user_id: String(params[1]),
				payload: String(params[2]),
				cleanup_at: new Date(params[3] ?? 0),
				lease_until: new Date(params[4] ?? 0),
				_seq_no: 1,
				_primary_term: 1,
			})
			return { rowcount: 1 }
		}
		if (sql === "DELETE FROM doc.user_import_connection WHERE id = ?")
			return { rowcount: Number(this.connections.delete(String(params[0]))) }
		if (
			sql ===
			"UPDATE doc.user_import_connection SET lease_until = ? WHERE id = ? AND _seq_no = ? AND _primary_term = ?"
		) {
			const row = this.connections.get(String(params[1]))
			if (!row || row._seq_no !== params[2] || row._primary_term !== params[3])
				return { rowcount: 0 }
			row.lease_until = new Date(params[0] ?? 0)
			row._seq_no++
			return { rowcount: 1 }
		}
		if (
			sql === "UPDATE doc.user_import_connection SET payload = ? WHERE id = ?"
		) {
			if (this.failCredentialSave)
				throw new Error("credential persistence unavailable")
			const row = this.connections.get(String(params[1]))
			if (!row) return { rowcount: 0 }
			row.payload = String(params[0])
			row._seq_no++
			return { rowcount: 1 }
		}
		if (
			sql ===
			"UPDATE doc.user_import_connection SET payload = ?, cleanup_at = ?, lease_until = ? WHERE id = ?"
		) {
			const row = this.connections.get(String(params[3]))
			if (!row) return { rowcount: 0 }
			row.payload = String(params[0])
			row.cleanup_at = new Date(params[1] ?? 0)
			row.lease_until = new Date(params[2] ?? 0)
			row._seq_no++
			return { rowcount: 1 }
		}
		throw new Error(`Unexpected connection SQL: ${sql}`)
	}
	override async select<T extends {}>(
		sql: string,
		params: Param[],
	): Promise<T[]> {
		if (!sql.includes("user_import_connection"))
			return super.select<T>(sql, params)
		if (
			sql ===
			"SELECT user_id,payload,lease_until,_seq_no,_primary_term FROM doc.user_import_connection WHERE id = ?"
		) {
			const row = this.connections.get(String(params[0]))
			return (row ? [{ ...row }] : []) as unknown as T[]
		}
		if (
			sql ===
			"SELECT id FROM doc.user_import_connection WHERE cleanup_at <= ? AND lease_until <= ? ORDER BY cleanup_at LIMIT 100"
		)
			return [...this.connections.entries()]
				.filter(
					([, row]) =>
						row.cleanup_at <= new Date(params[0] ?? 0) &&
						row.lease_until <= new Date(params[1] ?? 0),
				)
				.map(([id]) => ({ id })) as unknown as T[]
		throw new Error(`Unexpected connection SQL: ${sql}`)
	}
}
