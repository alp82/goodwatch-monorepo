import { crateAuthTransport, authModels } from "../../app/server/auth/crate-adapter.server.ts"
import { parseAuthEncryptionKeys } from "../../app/server/auth/payload-codec.server.ts"
import { rotateAuthEncryption } from "../../app/server/auth/maintenance.server.ts"
import { runAuthMaintenancePass } from "../../app/server/auth/maintenance-worker.server.ts"

// No dotenv loading, startup side effects, SMTP, external APIs or credential output.
const required = (name: string) => {
	const value = process.env[name]
	if (!value) throw new Error(`Missing auth maintenance configuration: ${name}`)
	return value
}
try {
	const command = process.argv[2] ?? "audit"
	if (!["audit", "run-once", "rotate"].includes(command) || process.argv.length > 3) throw new Error("Usage: cli.ts [audit|run-once|rotate]")
	const options = {
		sql: crateAuthTransport(required("AUTH_CRATEDB_ORIGINS").split(",").map(url => url.trim()), 15000, { username: required("AUTH_CRATEDB_USERNAME"), password: required("AUTH_CRATEDB_PASSWORD") }),
		encryptionSecret: required("AUTH_CRATEDB_ENCRYPTION_SECRET"),
		encryptionKeys: parseAuthEncryptionKeys(required("AUTH_CRATEDB_ENCRYPTION_KEYS")),
		batchSize: 100,
	}
	if (command === "rotate") {
		for (const model of [...authModels, "capacity"]) {
			let cursor: string | undefined
			let rotated = 0, conflicted = 0
			for (;;) {
				const report = await rotateAuthEncryption({ ...options, model, cursor })
				rotated += report.rotated; conflicted += report.conflicted
				if (report.complete) break
				cursor = report.cursor!
			}
			console.log(JSON.stringify({ job: "encryption", model, rotated, conflicted }))
			if (conflicted) process.exitCode = 2
		}
	} else {
		const report = await runAuthMaintenancePass({ ...options, auditOnly: command === "audit" })
		console.log(JSON.stringify(report))
		if (report.jobs.some(job => Number(job.unsafe ?? 0) > 0)) process.exitCode = 2
	}
} catch {
	console.error("Auth maintenance failed. Check configuration and authenticated-store availability; no SQL or secrets are logged.")
	process.exitCode = 1
}
