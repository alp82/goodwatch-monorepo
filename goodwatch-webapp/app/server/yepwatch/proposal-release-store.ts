import { keyed, equal } from "./crypto.server.ts"
import { CONTINUOUS_LIMITS } from "./continuous-types.ts"
import { installRoomTable, type Sql } from "./repository.server.ts"
export const RELEASE_TABLE = "doc.yepwatch_room"
export const RELEASE_CONFIG_TABLE = "doc.yepwatch_runtime"
export function storeMarker(secret: string) {
	return keyed(secret, "proposal3-store-key", "guest-release")
}
/** Read-only on every process start/probe. Provisioning belongs to an explicit operator command. */
export async function checkReleaseStore(
	sql: Sql,
	keyId: string,
	secret: string
) {
	const row = (
		await sql(
			`SELECT format_version,key_id,key_check,room_ttl_ms FROM ${RELEASE_CONFIG_TABLE} WHERE id=?`,
			["proposal3"]
		)
	).rows[0]
	if (
		!row ||
		row[0] !== 3 ||
		row[1] !== keyId ||
		!equal(String(row[2]), storeMarker(secret)) ||
		Number(row[3]) !== CONTINUOUS_LIMITS.roomMs
	)
		throw new Error(
			"Room store configuration/key mismatch; use the operator preflight"
		)
	// Check required columns and full-PK read support without creating a room or reading a real participant.
	await sql(
		`SELECT id,payload,expires_at,pending_revision,pending_agreement,_seq_no,_primary_term FROM ${RELEASE_TABLE} WHERE id=?`,
		["__proposal_release_health__"]
	)
}
export async function provisionReleaseStore(
	sql: Sql,
	replicas: 0 | 2,
	keyId: string,
	secret: string
) {
	await installRoomTable(sql, replicas, RELEASE_TABLE, true)
	await sql(
		`CREATE TABLE IF NOT EXISTS ${RELEASE_CONFIG_TABLE} (id TEXT PRIMARY KEY,format_version INTEGER NOT NULL,key_id TEXT NOT NULL,key_check TEXT NOT NULL,room_ttl_ms BIGINT NOT NULL) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas=${replicas}, "write.wait_for_active_shards"='${
			replicas + 1
		}')`
	)
	const existing = (
		await sql(`SELECT id FROM ${RELEASE_CONFIG_TABLE} WHERE id=?`, [
			"proposal3",
		])
	).rows[0]
	if (!existing)
		await sql(
			`INSERT INTO ${RELEASE_CONFIG_TABLE} (id,format_version,key_id,key_check,room_ttl_ms) VALUES (?,?,?,?,?)`,
			["proposal3", 3, keyId, storeMarker(secret), CONTINUOUS_LIMITS.roomMs]
		)
	await checkReleaseStore(sql, keyId, secret)
}
