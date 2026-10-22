import { runtimeTable, tableDdl } from "./proposal-storage-schema.ts"
import { keyed, equal } from "./crypto.server.ts"
import { CONTINUOUS_LIMITS } from "./continuous-types.ts"
import type { Sql } from "./repository.server.ts"
import {
	provisionRelationalRooms,
	checkRelationalRooms,
} from "./proposal-relational-repository.ts"
export const RELEASE_TABLE = "doc.yepwatch_room"
export const RELEASE_CONFIG_TABLE = "doc.yepwatch_runtime"
export function storeMarker(secret: string) {
	return keyed(secret, "typed-store-key", "relational-v1")
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
		row[0] !== 1 ||
		row[1] !== keyId ||
		!equal(String(row[2]), storeMarker(secret)) ||
		Number(row[3]) !== CONTINUOUS_LIMITS.roomMs
	)
		throw new Error(
			"Room store configuration/key mismatch; use the operator preflight"
		)
	await checkRelationalRooms(sql)
}
export async function provisionReleaseStore(
	sql: Sql,
	replicas: 0 | 2,
	keyId: string,
	secret: string
) {
	await provisionRelationalRooms(sql, replicas)
	await sql(tableDdl(runtimeTable, replicas))
	const existing = (
		await sql(`SELECT id FROM ${RELEASE_CONFIG_TABLE} WHERE id=?`, [
			"proposal3",
		])
	).rows[0]
	if (!existing)
		await sql(
			`INSERT INTO ${RELEASE_CONFIG_TABLE} (id,format_version,key_id,key_check,room_ttl_ms) VALUES (?,?,?,?,?)`,
			["proposal3", 1, keyId, storeMarker(secret), CONTINUOUS_LIMITS.roomMs]
		)
	await checkReleaseStore(sql, keyId, secret)
}
