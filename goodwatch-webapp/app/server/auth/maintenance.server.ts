import { createHmac, randomUUID } from "node:crypto"
import { type AuthSql, CrateAuthRequestError, IndeterminateAuthWriteError } from "./crate-adapter.server.ts"
import { authPayloadCodec } from "./payload-codec.server.ts"

type Options = { sql: AuthSql; encryptionSecret: string; cursor?: string; batchSize?: number }
type Envelope = { row: Record<string, unknown>; deleted: boolean; emailClaim?: string; deletedAt?: string }
type Receipt = { operation: string; baseSeq: number }

function batchSize(value = 1000) {
	if (!Number.isSafeInteger(value) || value < 1 || value > 10000) throw new Error("Invalid maintenance batch size")
	return value
}

/** Fence the owner row before releasing a reservation. Time alone never proves orphanhood. */
export async function recoverEmailClaims(options: Options) {
	const { sql, encryptionSecret, cursor } = options
	const size = batchSize(options.batchSize)
	const codec = authPayloadCodec(encryptionSecret)
	await sql("REFRESH TABLE doc.auth_user_email")
	const page = await sql(`SELECT email_norm FROM doc.auth_user_email ${cursor === undefined ? "" : "WHERE email_norm > ?"} ORDER BY email_norm LIMIT ${size + 1}`, cursor === undefined ? [] : [cursor])
	const report = { scanned: 0, released: 0, retained: 0, conflicted: 0, cursor: null as string | null, complete: page.rows.length <= size }
	for (const [value] of page.rows.slice(0, size)) {
		const email = String(value)
		report.cursor = email
		report.scanned++
		const claim = (await sql("SELECT user_id,operation_id,_seq_no,_primary_term FROM doc.auth_user_email WHERE email_norm=?", [email])).rows[0]
		if (!claim) continue
		const id = String(claim[0])
		const aad = `doc.auth_user:${id}`
		const current = (await sql("SELECT payload,receipts,_seq_no,_primary_term FROM doc.auth_user WHERE id=?", [id])).rows[0]
		if (current) {
			const envelope: Envelope = codec.decode(current[0], `${aad}:payload`)
			if (envelope.row.id !== id || typeof envelope.deleted !== "boolean") throw new Error("Invalid authenticated auth row")
			const key = createHmac("sha256", encryptionSecret).update(JSON.stringify(["email-claim", String(envelope.row.email).trim().toLowerCase()])).digest("hex")
			if (!envelope.deleted && key === email) { report.retained++; continue }
			// Advancing the user version makes any delayed adoption CAS lose. Keep
			// operation receipts so its recovery cannot mistake uncertainty for success.
			const receipts: Receipt[] = codec.decode(current[1], `${aad}:receipts`)
			const fenced = await sql("UPDATE doc.auth_user SET receipts=? WHERE id=? AND _seq_no=? AND _primary_term=?", [codec.encode([...receipts, { operation: randomUUID(), baseSeq: Number(current[2]) }].slice(-256), `${aad}:receipts`), id, current[2], current[3]])
			if (fenced.rowcount !== 1) { report.conflicted++; continue }
		} else {
			// A permanent user tombstone prevents a paused INSERT from appearing
			// after release. User ids must never be recycled, including by GC.
			try {
				const fenced = await sql("INSERT INTO doc.auth_user (id,payload,deleted,receipts) VALUES (?,?,true,?)", [id, codec.encode({ row: { id }, deleted: true, deletedAt: new Date().toISOString() }, `${aad}:payload`), codec.encode([], `${aad}:receipts`)])
				if (fenced.rowcount !== 1) throw new IndeterminateAuthWriteError()
			} catch (error) {
				if (error instanceof CrateAuthRequestError && error.code === 4091) { report.conflicted++; continue }
				throw error
			}
		}
		const released = await sql("DELETE FROM doc.auth_user_email WHERE email_norm=? AND _seq_no=? AND _primary_term=?", [email, claim[2], claim[3]])
		if (released.rowcount === 1) report.released++
		else report.conflicted++
	}
	return report
}
