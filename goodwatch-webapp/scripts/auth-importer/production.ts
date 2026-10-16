import { createHmac, timingSafeEqual } from "node:crypto"
import { open, readFile, rename, stat, unlink } from "node:fs/promises"
import { dirname, isAbsolute } from "node:path"
import type { Client } from "pg"
import type { AuthSql } from "../../app/server/auth/crate-adapter.server.ts"
import type { AuthEncryptionKeys } from "../../app/server/auth/payload-codec.server.ts"
import type {
	ImportReport,
	TargetCounts,
} from "../../app/server/auth/supabase-importer.server.ts"

export type ProductionPhase = "dry" | "apply" | "rerun"
type Receipt = {
	version: 1
	phase: "dry" | "applied" | "complete"
	issuedAt: number
	binding: string
	sourceFingerprint: string
	counts: TargetCounts
}
const mac = (secret: string, value: unknown) =>
	createHmac("sha256", secret)
		.update(JSON.stringify(["production-import-552", value]))
		.digest("hex")

// Receipts attest a successful preflight, not owner permission. The operator
// freezes the source and stops every target writer for the whole sequence.
export async function productionImport({
	phase,
	receiptPath,
	secret,
	binding,
	run,
}: {
	phase: ProductionPhase
	receiptPath: string
	secret: string
	binding: unknown
	run: (guards: {
		expectedSourceFingerprint?: string
		expectedTargetCounts?: TargetCounts
		requireExactRerun: boolean
	}) => Promise<ImportReport>
}): Promise<ImportReport> {
	if (!isAbsolute(receiptPath)) throw new Error("Invalid receipt path")
	const parent = await stat(dirname(receiptPath))
	if ((parent.mode & 0o077) !== 0 || parent.uid !== process.getuid?.())
		throw new Error("Private receipt directory required")
	const lock = await open(`${receiptPath}.lock`, "wx", 0o600)
	try {
		let previous: Receipt | undefined
		if (phase === "dry") {
			try {
				await stat(receiptPath)
				throw new Error("Receipt already exists")
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
			}
		} else {
			const { receipt, signature } = JSON.parse(
				await readFile(receiptPath, "utf8"),
			)
			const expected = mac(secret, receipt)
			if (
				typeof signature !== "string" ||
				signature.length !== expected.length ||
				!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
			)
				throw new Error("Invalid receipt")
			previous = receipt as Receipt
			if (
				previous.version !== 1 ||
				previous.binding !== mac(secret, binding) ||
				Date.now() - previous.issuedAt > 24 * 60 * 60 * 1000 ||
				previous.issuedAt > Date.now() ||
				(phase === "apply"
					? previous.phase !== "dry"
					: !["applied", "complete"].includes(previous.phase))
			)
				throw new Error("Receipt sequence refused")
		}
		const report = await run({
			expectedSourceFingerprint: previous?.sourceFingerprint,
			expectedTargetCounts: previous?.counts,
			requireExactRerun: phase === "rerun",
		})
		if (
			report.status !== (phase === "dry" ? "planned" : "complete") ||
			report.issues.length ||
			!report.sourceFingerprint ||
			(phase === "rerun" && (report.created.users || report.created.accounts))
		)
			throw new Error("Incomplete import")
		const receipt: Receipt = {
			version: 1,
			phase:
				phase === "apply" ? "applied" : phase === "rerun" ? "complete" : "dry",
			issuedAt: previous?.issuedAt ?? Date.now(),
			binding: mac(secret, binding),
			sourceFingerprint: report.sourceFingerprint,
			counts: report.after,
		}
		const temp = await open(`${receiptPath}.next`, "wx", 0o600)
		try {
			await temp.writeFile(
				JSON.stringify({ receipt, signature: mac(secret, receipt) }),
			)
			await temp.sync()
		} finally {
			await temp.close()
		}
		await rename(`${receiptPath}.next`, receiptPath)
		return report
	} finally {
		await lock.close()
		await unlink(`${receiptPath}.lock`)
	}
}

export async function productionBinding(
	source: Client,
	sql: AuthSql,
	encryptionKeys: AuthEncryptionKeys,
) {
	const frozen = (
		await source.query(
			"SELECT kind, snapshot_id, frozen_at FROM public.goodwatch_auth_import_copy WHERE id=551",
		)
	).rows[0]
	const frozenAt = new Date(frozen.frozen_at).getTime()
	if (
		frozen.kind !== "frozen-production-552" ||
		!/^[a-zA-Z0-9_-]{8,100}$/.test(frozen.snapshot_id ?? "") ||
		!Number.isFinite(frozenAt) ||
		frozenAt > Date.now() ||
		Date.now() - frozenAt > 24 * 60 * 60 * 1000
	)
		throw new Error()
	const permissions = (
		await source.query(`SELECT
			current_user = 'auth_copy_reader' AND NOT rolsuper AND NOT rolcreaterole AND NOT rolcreatedb
			AND NOT rolreplication AND NOT rolbypassrls AS safe
			FROM pg_roles WHERE rolname = current_user`)
	).rows
	const tables = [
		"auth.users",
		"auth.identities",
		"public.goodwatch_auth_import_copy",
	]
	if (permissions.length !== 1 || permissions[0].safe !== true)
		throw new Error()
	for (const table of tables) {
		const rights = (
			await source.query(
				`SELECT has_table_privilege(current_user,$1,'SELECT') AS readable,
				has_table_privilege(current_user,$1,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER') AS writable`,
				[table],
			)
		).rows[0]
		if (rights.readable !== true || rights.writable !== false) throw new Error()
	}
	if ((await sql("SELECT current_user")).rows[0][0] !== "goodwatch_auth")
		throw new Error()
	return {
		frozen,
		nodes: (await sql("SELECT id,name FROM sys.nodes ORDER BY name")).rows,
		encryptionKeys,
	}
}
