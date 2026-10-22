import { open } from "node:fs/promises"
import { createHash } from "node:crypto"
import {
	loadReleaseSecrets,
	releaseStoreConfig,
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
	console.log(JSON.stringify({ operation: "provision", ready: true, replicas }))
} else if (command === "check") {
	await checkReleaseStore(sql, config.keyId, config.secret)
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
			total: row?.[0] ?? 0,
			logicallyExpired: row?.[1] ?? 0,
			firstExpiry: row?.[2] ?? null,
			lastExpiry: row?.[3] ?? null,
			physicalDeletionImplemented: false,
		})
	)
} else if (command === "backup") {
	const filename = args[0]
	if (!filename || filename.startsWith("--"))
		throw new Error("backup requires a new private output filename")
	await checkReleaseStore(sql, config.keyId, config.secret)
	// Stop room writers for a consistent whole-table backup. Individual ciphertext rows are always intact aggregates.
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
			type: "yepwatch-proposal3-backup",
			format: 1,
			keyId: config.keyId,
			createdAt: new Date().toISOString(),
			requiresMatchingSecret: true,
			globallyConsistentOnlyWithWritersStopped: true,
		})
		for (;;) {
			const rows = (
				await sql(
					`SELECT id,payload,expires_at,pending_revision,pending_agreement FROM ${RELEASE_TABLE} WHERE id>? ORDER BY id LIMIT 200`,
					[cursor]
				)
			).rows
			if (!rows.length) break
			for (const [
				id,
				payload,
				expiresAt,
				pendingRevision,
				pendingAgreement,
			] of rows) {
				await line({
					id,
					payload,
					expiresAt,
					pendingRevision,
					pendingAgreement,
				})
				cursor = String(id)
				count++
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
			encrypted: true,
			secretIncluded: false,
		})
	)
} else
	throw new Error(
		"Choose check, provision --apply, inventory, or backup FILE. No purge/rotation is implemented."
	)
