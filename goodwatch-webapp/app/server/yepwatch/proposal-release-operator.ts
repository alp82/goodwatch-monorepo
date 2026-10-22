import {
	tables,
	controlTable,
	columns,
	runtimeTable,
} from "./proposal-storage-schema.ts"
import {
	provisionControl,
	ReleaseControl,
	CONTROL_TABLE,
} from "./proposal-release-control.ts"
import { open } from "node:fs/promises"
import { createHash } from "node:crypto"
import {
	loadReleaseSecrets,
	releaseStoreConfig,
	releaseControlConfig,
} from "./proposal-release-config.ts"
import { crateSql } from "./repository.server.ts"
import {
	checkReleaseStore,
	provisionReleaseStore,
	RELEASE_TABLE,
} from "./proposal-release-store.ts"
await loadReleaseSecrets(process.env)
const config = releaseStoreConfig(process.env)
const sql = crateSql(config.origin, config.username, config.password)
const control = new ReleaseControl(sql, releaseControlConfig(process.env))
const [command = "check", ...args] = process.argv.slice(2)
if (command === "provision") {
	if (!args.includes("--apply"))
		throw new Error(
			"Provisioning requires --apply and explicit operator credentials; never run from API startup"
		)
	const replicas = args.includes("--disposable-single-node") ? 0 : 2
	if (
		replicas === 0 &&
		!["127.0.0.1", "localhost"].includes(new URL(config.origin).hostname)
	)
		throw new Error(
			"Zero replicas is restricted to disposable loopback storage"
		)
	await provisionReleaseStore(sql, replicas, config.keyId, config.secret)
	await provisionControl(sql, control.policy, replicas)
	console.log(JSON.stringify({ operation: "provision", ready: true, replicas }))
} else if (command === "check") {
	await checkReleaseStore(sql, config.keyId, config.secret)
	await control.check()
	console.log(JSON.stringify({ operation: "check", ready: true }))
} else if (command === "inventory") {
	await checkReleaseStore(sql, config.keyId, config.secret)
	const row = (
		await sql(
			`SELECT count(*),count(*) FILTER (WHERE expires_at<=CURRENT_TIMESTAMP),min(expires_at),max(expires_at) FROM ${RELEASE_TABLE}`
		)
	).rows[0]
	console.log(
		JSON.stringify({
			operation: "inventory",
			controls: await control.summary(),
			total: row?.[0] ?? 0,
			logicallyExpired: row?.[1] ?? 0,
			firstExpiry: row?.[2] ?? null,
			lastExpiry: row?.[3] ?? null,
			physicalDeletionImplemented: true,
			cleanupRequiresStoppedWriters: true,
		})
	)
} else if (command === "purge-expired") {
	if (!args.includes("--apply") || !args.includes("--writers-stopped"))
		throw new Error(
			"purge-expired requires --apply --writers-stopped; stop writers and back up first"
		)
	await checkReleaseStore(sql, config.keyId, config.secret)
	const cutoff = Number((await sql("SELECT CURRENT_TIMESTAMP")).rows[0][0])
	if (!Number.isSafeInteger(cutoff)) throw new Error("Store clock unavailable")
	const deleted: Record<string, number> = {}
	// Immutable records carry the original room expiry, including abandoned preparations without a head.
	// Credentials are included; runtime marker and capacity bookkeeping are not reset.
	for (const table of [
		...Object.values(tables).filter((t) => t.name !== RELEASE_TABLE),
		tables.room,
	]) {
		await sql(`REFRESH TABLE ${table.name}`)
		deleted[table.name] = (
			await sql(`DELETE FROM ${table.name} WHERE expires_at<=?`, [cutoff])
		).rowcount
	}
	console.log(JSON.stringify({ operation: "purge-expired", cutoff, deleted }))
} else if (command === "backup") {
	const filename = args[0]
	if (
		!filename ||
		filename.startsWith("--") ||
		!args.includes("--writers-stopped")
	)
		throw new Error(
			"backup requires a new private output filename and --writers-stopped"
		)
	await checkReleaseStore(sql, config.keyId, config.secret)
	await control.check()
	// Stop room writers: include every referenced immutable record and its room head.
	const file = await open(filename, "wx", 0o600)
	let count = 0,
		cursor = ""
	const checksum = createHash("sha256")
	const line = async (value: unknown) => {
		const bytes = JSON.stringify(value) + "\n"
		checksum.update(bytes)
		await file.write(bytes)
	}
	try {
		await line({
			type: "yepwatch-relational-backup",
			format: 3,
			keyId: config.keyId,
			createdAt: new Date().toISOString(),
			requiresMatchingSecret: true,
			globallyConsistentOnlyWithWritersStopped: true,
		})
		const definitions = [
			...Object.values(tables)
				.filter((t) => t.name !== RELEASE_TABLE)
				.map((t) => ({ name: t.name, primary: t.primary, names: columns(t) })),
			{ name: runtimeTable.name, primary: "id", names: columns(runtimeTable) },
			{ name: controlTable.name, primary: "id", names: columns(controlTable) },
			{ name: tables.room.name, primary: "id", names: columns(tables.room) },
		]
		for (const table of definitions) {
			cursor = ""
			await sql(`REFRESH TABLE ${table.name}`)
			for (;;) {
				const rows = (
					await sql(
						`SELECT ${table.names.join(",")} FROM ${table.name} WHERE ${
							table.primary
						}>? ORDER BY ${table.primary} LIMIT 200`,
						[cursor]
					)
				).rows
				if (!rows.length) break
				for (const values of rows) {
					await line({
						table: table.name,
						columns: Object.fromEntries(
							table.names.map((k, i) => [k, values[i]])
						),
					})
					cursor = String(values[table.names.indexOf(table.primary)])
					count++
				}
			}
		}
		await file.sync()
	} finally {
		await file.close()
	}
	console.log(
		JSON.stringify({
			operation: "backup",
			rows: count,
			sha256: checksum.digest("hex"),
			containsPrivateInteractions: true,
			credentialFieldsEncrypted: true,
			controlIncluded: true,
			secretIncluded: false,
		})
	)
} else
	throw new Error(
		"Choose check, provision --apply, inventory, or backup FILE --writers-stopped. purge-expired --apply --writers-stopped. No key rotation is implemented."
	)
