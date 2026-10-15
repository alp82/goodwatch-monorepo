import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from "node:crypto"
import { run, select } from "./store.server.ts"
import {
	CONNECTION_WINDOW_MS,
	type Connection,
	type ConnectionStore,
} from "./tmdb-connect.server.ts"

/** Credentials never enter SQL parameters in plaintext (the DB client logs parameters). */
export function createConnectionStore(
	secret: () => string,
	previousSecret: () => string = () => "",
	source: "tmdb" | "plex" = "tmdb",
): ConnectionStore {
	const key = (value: string) => {
		if (!/^[a-f0-9]{64}$/i.test(value))
			throw new Error("TMDB Connect encryption key is not configured")
		return Buffer.from(value, "hex")
	}
	const keyId = (bytes: Buffer) =>
		createHash("sha256").update(bytes).digest("hex").slice(0, 16)
	const seal = (value: Connection) => {
		const iv = randomBytes(12)
		const current = key(secret())
		const cipher = createCipheriv("aes-256-gcm", current, iv)
		cipher.setAAD(Buffer.from(value.id))
		const bytes = Buffer.concat([
			cipher.update(JSON.stringify(value), "utf8"),
			cipher.final(),
		])
		return `v1:${keyId(current)}:${Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64")}`
	}
	const open = (id: string, payload: string): Connection => {
		const [version, idKey, encoded] = payload.split(":")
		const keys = [secret(), previousSecret()].filter(Boolean).map(key)
		const selected = keys.find((value) => keyId(value) === idKey)
		if (version !== "v1" || !selected || !encoded)
			throw new Error("TMDB Connect encryption key is unavailable")
		const bytes = Buffer.from(encoded, "base64")
		const decipher = createDecipheriv(
			"aes-256-gcm",
			selected,
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
			const payload = seal(value)
			// The primary key reserves one of three slots atomically across page processes.
			for (let slot = 0; slot < 3; slot++) {
				const result = await run(
					"INSERT INTO doc.user_import_connection (id,user_id,slot,payload,cleanup_at,lease_until) VALUES (?,?,?,?,?,?) ON CONFLICT (user_id,slot) DO NOTHING",
					[
						value.id,
						value.userId,
						slot,
						payload,
						new Date(available),
						new Date(0),
					],
				)
				if (result.rowcount === 1) {
					await refresh()
					return true
				}
			}
			return false
		},
		async claim(id, userId, now) {
			await refresh()
			const [row] = await select<{
				user_id: string
				slot: number
				payload: string
				lease_until: Date
				_seq_no: number
				_primary_term: number
			}>(
				"SELECT user_id,slot,payload,lease_until,_seq_no,_primary_term FROM doc.user_import_connection WHERE id = ?",
				[id],
			)
			if (
				!row ||
				(userId !== undefined && row.user_id !== userId) ||
				new Date(row.lease_until).getTime() > now
			)
				return null
			// A replayed browser request must not steal cleanup-only work or bypass Retry-After.
			const value = open(id, row.payload)
			if ((value.source ?? "tmdb") !== source) return null
			const interactive = userId === undefined ? null : value
			if (interactive?.canceled || interactive?.accessToken) return null
			const result = await run(
				"UPDATE doc.user_import_connection SET lease_until = ? WHERE user_id = ? AND slot = ? AND _seq_no = ? AND _primary_term = ?",
				[
					new Date(now + CONNECTION_WINDOW_MS),
					row.user_id,
					row.slot,
					row._seq_no,
					row._primary_term,
				],
			)
			return result.rowcount === 1 ? value : null
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
					[
						seal(value),
						available === null ? null : new Date(available),
						new Date(0),
						value.id,
					],
				)
			await refresh()
		},
		async pause(id) {
			await run(
				"UPDATE doc.user_import_connection SET cleanup_at = NULL WHERE id = ?",
				[id],
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
