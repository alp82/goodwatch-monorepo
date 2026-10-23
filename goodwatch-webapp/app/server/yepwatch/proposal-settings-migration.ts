import { isDeepStrictEqual } from "node:util"
import { open, readFile } from "node:fs/promises"
import { codec, equal, keyed } from "./crypto.server.ts"
import { RelationalProposalRepository as LegacyReader } from "./storage-v1/repository.ts"
import { RelationalProposalRepository } from "./proposal-relational-repository.ts"
import { tables } from "./proposal-storage-schema.ts"
import { normalizeRoomContext } from "./proposal-context.ts"
import { storeMarker, checkReleaseStore } from "./proposal-release-store.ts"
import type { Sql } from "./repository.server.ts"
import type { ProposalStored } from "./proposal-types.ts"

const aad = "yepwatch-room-settings-migration-v2"
interface Backup {
	format: 2
	keyId: string
	rooms: ProposalStored[]
}
/** All old records are validated before writing a private, encrypted, exclusive backup. No database mutation. */
export async function prepareSettingsMigration(
	sql: Sql,
	secret: string,
	keyId: string,
	filename: string
) {
	const marker = (
		await sql(
			"SELECT format_version,key_id,key_check FROM doc.yepwatch_runtime WHERE id=?",
			["proposal3"]
		)
	).rows[0]
	if (
		!marker ||
		marker[0] !== 1 ||
		marker[1] !== keyId ||
		!equal(String(marker[2]), keyed(secret, "typed-store-key", "relational-v1"))
	)
		throw new Error("Expected the original typed store and matching key")
	await sql("REFRESH TABLE doc.yepwatch_room")
	const ids = (
		await sql("SELECT id FROM doc.yepwatch_room ORDER BY id LIMIT 10001")
	).rows
	if (ids.length > 10000)
		throw new Error(
			"Migration exceeds bounded room count; archive expired rooms first"
		)
	const reader = new LegacyReader(sql, secret)
	const rooms: ProposalStored[] = []
	for (const [id] of ids) {
		const stored = await reader.read(String(id))
		if (!stored) throw new Error("Room changed during preparation")
		const probe = structuredClone(stored.room)
		normalizeRoomContext(probe) // Conflicting old playback contexts need an explicit choice, never a silent merge.
		rooms.push(stored)
	}
	const data: Backup = { format: 2, keyId, rooms }
	const file = await open(filename, "wx", 0o600)
	try {
		await file.writeFile(codec(secret).encode(data, aad))
		await file.sync()
	} finally {
		await file.close()
	}
	return { rooms: rooms.length }
}
/** Requires stopped API writers throughout. Restartable from the same encrypted backup after an interrupted apply. */
export async function applySettingsMigration(
	sql: Sql,
	secret: string,
	keyId: string,
	filename: string
) {
	const backup = codec(secret).decode(
		await readFile(filename, "utf8"),
		aad
	) as Backup
	if (
		backup.format !== 2 ||
		backup.keyId !== keyId ||
		!Array.isArray(backup.rooms) ||
		backup.rooms.length > 10000
	)
		throw new Error("Invalid migration backup")
	const marker = (
		await sql(
			"SELECT format_version,key_id,key_check FROM doc.yepwatch_runtime WHERE id=?",
			["proposal3"]
		)
	).rows[0]
	if (
		!marker ||
		marker[1] !== keyId ||
		![1, 2].includes(Number(marker[0])) ||
		!equal(
			String(marker[2]),
			Number(marker[0]) === 1
				? keyed(secret, "typed-store-key", "relational-v1")
				: storeMarker(secret)
		)
	)
		throw new Error("Migration key/store mismatch")
	await sql("REFRESH TABLE doc.yepwatch_room")
	const heads = (
		await sql(
			"SELECT id,revision,storage_format,_seq_no,_primary_term FROM doc.yepwatch_room ORDER BY id LIMIT 10001"
		)
	).rows
	if (
		heads.length !== backup.rooms.length ||
		heads.some(
			(h) =>
				!backup.rooms.some(
					(s) =>
						s.room.id === h[0] &&
						s.room.revision === h[1] &&
						(h[2] === 2 || (s.seq === Number(h[3]) && s.term === Number(h[4])))
				)
		)
	)
		throw new Error(
			"Rooms changed since backup; stop all writers and prepare a fresh backup"
		)
	const allColumns = (
		await sql(
			"SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='doc' AND table_name LIKE 'yepwatch_%'"
		)
	).rows
	const has = (table: string, column: string) =>
		allColumns.some((r) => r[0] === table && r[1] === column)
	if (Number(marker[0]) === 1) {
		const constraints = (
			await sql(
				"SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema='doc' AND table_name='yepwatch_room' AND constraint_name='check_1'"
			)
		).rows
		if (constraints.length)
			await sql("ALTER TABLE doc.yepwatch_room DROP CONSTRAINT check_1")
		for (const name of [
			"country",
			"service_ids",
			"services_confirmed",
			"intent",
		])
			if (!has("yepwatch_room", name))
				await sql(
					`ALTER TABLE doc.yepwatch_room ADD COLUMN "${name}" ${tables.room.fields[name].sql}`
				)
		if (!has("yepwatch_participant", "left_at"))
			await sql(
				"ALTER TABLE doc.yepwatch_participant ADD COLUMN left_at BIGINT"
			)
		if (has("yepwatch_room", "screen_records"))
			await sql("ALTER TABLE doc.yepwatch_room DROP COLUMN screen_records")
		if (has("yepwatch_participant", "screen_id"))
			await sql("ALTER TABLE doc.yepwatch_participant DROP COLUMN screen_id")
		for (const table of ["yepwatch_candidate", "yepwatch_decision"])
			if (has(table, "availability['screenId']"))
				await sql(
					`ALTER TABLE doc.${table} DROP COLUMN availability['screenId']`
				)
	}
	const repository = new RelationalProposalRepository(sql, secret)
	for (const stored of backup.rooms) {
		const room = structuredClone(stored.room)
		normalizeRoomContext(room)
		room.intent = null
		for (const person of room.participants) person.leftAt = null
		const head = (
			await sql(
				"SELECT revision,storage_format,_seq_no,_primary_term FROM doc.yepwatch_room WHERE id=?",
				[room.id]
			)
		).rows[0]
		if (!head || head[0] !== room.revision)
			throw new Error("Concurrent room modification; keep writers stopped")
		if (
			head[1] === 1 &&
			!(await repository.publishMigration(
				room,
				Number(head[2]),
				Number(head[3]),
				stored.pendingRevision
			))
		)
			throw new Error("Room changed during migration")
		const proof = await repository.read(room.id)
		if (
			!proof ||
			!isDeepStrictEqual(
				JSON.parse(JSON.stringify(proof.room)),
				JSON.parse(JSON.stringify(room))
			) ||
			proof.pendingRevision !== stored.pendingRevision
		)
			throw new Error("Converted room proof failed")
	}
	// No current head or new reader references the old selection table. Credentials and control state are preserved.
	await sql("DROP TABLE IF EXISTS doc.yepwatch_screen")
	await sql(
		"UPDATE doc.yepwatch_runtime SET format_version=?,key_check=? WHERE id=?",
		[2, storeMarker(secret), "proposal3"]
	)
	await checkReleaseStore(sql, keyId, secret)
	return { rooms: backup.rooms.length, format: 2 }
}
