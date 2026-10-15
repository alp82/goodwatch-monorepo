import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from "node:crypto"
import { run, select } from "./store.server.ts"
import type { Connection, ConnectionStore } from "./tmdb-connect.server.ts"

/** Credentials never enter SQL parameters in plaintext (the DB client logs parameters). */
export function createConnectionStore(secret: () => string): ConnectionStore {
	const key = () => {
		const value = secret()
		if (!value) throw new Error("TMDB Connect is not configured")
		return createHash("sha256")
			.update(`goodwatch:tmdb-connect:v1:${value}`)
			.digest()
	}
	const seal = (value: Connection) => {
		const iv = randomBytes(12)
		const cipher = createCipheriv("aes-256-gcm", key(), iv)
		cipher.setAAD(Buffer.from(value.id))
		const bytes = Buffer.concat([
			cipher.update(JSON.stringify(value), "utf8"),
			cipher.final(),
		])
		return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64")
	}
	const open = (id: string, payload: string): Connection => {
		const bytes = Buffer.from(payload, "base64")
		const decipher = createDecipheriv(
			"aes-256-gcm",
			key(),
			bytes.subarray(0, 12),
		)
		decipher.setAAD(Buffer.from(id))
		decipher.setAuthTag(bytes.subarray(12, 28))
		return JSON.parse(
			Buffer.concat([
				decipher.update(bytes.subarray(28)),
				decipher.final(),
			]).toString("utf8"),
		)
	}
	const refresh = () => run("REFRESH TABLE doc.user_import_connection")
	return {
		async create(value, available) {
			await run(
				"INSERT INTO doc.user_import_connection (id,user_id,payload,cleanup_at,lease_until) VALUES (?,?,?,?,?)",
				[value.id, value.userId, seal(value), new Date(available), new Date(0)],
			)
			await refresh()
		},
		async claim(id, userId, now) {
			await refresh()
			const [row] = await select<{
				user_id: string
				payload: string
				lease_until: Date
				_seq_no: number
				_primary_term: number
			}>(
				"SELECT user_id,payload,lease_until,_seq_no,_primary_term FROM doc.user_import_connection WHERE id = ?",
				[id],
			)
			if (
				!row ||
				(userId !== undefined && row.user_id !== userId) ||
				new Date(row.lease_until).getTime() > now
			)
				return null
			const result = await run(
				"UPDATE doc.user_import_connection SET lease_until = ? WHERE id = ? AND _seq_no = ? AND _primary_term = ?",
				[new Date(now + 10 * 60_000), id, row._seq_no, row._primary_term],
			)
			return result.rowcount === 1 ? open(id, row.payload) : null
		},
		async save(value, available) {
			if (available === undefined)
				await run(
					"UPDATE doc.user_import_connection SET payload = ? WHERE id = ?",
					[seal(value), value.id],
				)
			else
				await run(
					"UPDATE doc.user_import_connection SET payload = ?, cleanup_at = ?, lease_until = ? WHERE id = ?",
					[seal(value), new Date(available), new Date(0), value.id],
				)
			await refresh()
		},
		async remove(id) {
			await run("DELETE FROM doc.user_import_connection WHERE id = ?", [id])
			await refresh()
		},
		async due(now) {
			await refresh()
			return (
				await select<{ id: string }>(
					"SELECT id FROM doc.user_import_connection WHERE cleanup_at <= ? AND lease_until <= ? ORDER BY cleanup_at LIMIT 100",
					[new Date(now), new Date(now)],
				)
			).map((row) => row.id)
		},
	}
}
