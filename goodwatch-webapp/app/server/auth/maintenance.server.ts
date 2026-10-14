import { createHmac, createHash, randomUUID } from "node:crypto"
import { type AuthSql, CrateAuthRequestError, IndeterminateAuthWriteError, authModels, authModelTable } from "./crate-adapter.server.ts"
import { readCapacity, launchPopulationBounds, type AuthAdmission } from "./population.server.ts"
import { authPayloadCodec, type AuthEncryptionKeys } from "./payload-codec.server.ts"

export type AuthMaintenanceOptions = { sql: AuthSql; encryptionSecret: string; encryptionKeys?: AuthEncryptionKeys; cursor?: string; batchSize?: number; now?: Date }
type Options = AuthMaintenanceOptions
type Envelope = { row: Record<string, unknown>; deleted: boolean; emailClaim?: string; deletedAt?: string; admission?: AuthAdmission; admissionFence?: number }
type Receipt = { operation: string; baseSeq: number; at?: string }

function batchSize(value = 1000) {
	if (!Number.isSafeInteger(value) || value < 1 || value > 10000) throw new Error("Invalid maintenance batch size")
	return value
}

/** Fence the owner row before releasing a reservation. Time alone never proves orphanhood. */
export async function recoverEmailClaims(options: Options) {
	const { sql, encryptionSecret, cursor } = options
	const size = batchSize(options.batchSize)
	const now = options.now ?? new Date()
	if (!Number.isFinite(now.getTime())) throw new Error("Invalid maintenance time")
	const codec = authPayloadCodec(encryptionSecret, options.encryptionKeys)
	await sql("REFRESH TABLE doc.auth_user_email")
	const page = await sql(`SELECT email_norm FROM doc.auth_user_email ${cursor === undefined ? "" : "WHERE email_norm > ?"} ORDER BY email_norm LIMIT ${size + 1}`, cursor === undefined ? [] : [cursor])
	const report = { scanned: 0, released: 0, retained: 0, conflicted: 0, cursor: null as string | null, complete: page.rows.length <= size }
	for (const [value] of page.rows.slice(0, size)) {
		const email = String(value)
		report.cursor = email
		report.scanned++
		const claim = (await sql("SELECT user_id,operation_id,_seq_no,_primary_term,created_at FROM doc.auth_user_email WHERE email_norm=?", [email])).rows[0]
		if (!claim) continue
		if (now.getTime() - new Date(claim[4] as string).getTime() < 15 * 60000) { report.retained++; continue }
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
			const fenced = await sql("UPDATE doc.auth_user SET receipts=? WHERE id=? AND _seq_no=? AND _primary_term=?", [codec.encode([...receipts, { operation: randomUUID(), baseSeq: Number(current[2]), at: new Date().toISOString() }].slice(-256), `${aad}:receipts`), id, current[2], current[3]])
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

const retentionMs = 24 * 3600000
const expiringModels = new Set(["session", "verification", "oauthAccessToken", "oauthRefreshToken", "oauthClientAssertion"])
const reusableModels = new Set(["account", "oauthConsent", "oauthClientResource", "oauthResource", "rateLimit"])

/** Each page is bounded independently of table size; all decisions use authenticated PK reads. */
export async function collectAuthGarbage(options: Options & { model: string; now?: Date }) {
 const { sql, model, cursor } = options
 if (!authModels.includes(model)) throw new Error("Unsupported maintenance model")
 const size = batchSize(options.batchSize)
 const now = options.now ?? new Date()
 if (!Number.isFinite(now.getTime())) throw new Error("Invalid maintenance time")
 const codec = authPayloadCodec(options.encryptionSecret, options.encryptionKeys)
 const name = authModelTable(model)
 await sql(`REFRESH TABLE ${name}`)
 const page = await sql(`SELECT id FROM ${name} ${cursor === undefined ? "" : "WHERE id > ?"} ORDER BY id LIMIT ${size + 1}`, cursor === undefined ? [] : [cursor])
 const report = { scanned: 0, expired: 0, compacted: 0, purged: 0, conflicted: 0, cursor: null as string | null, complete: page.rows.length <= size }
 for (const [value] of page.rows.slice(0, size)) {
  const id = String(value)
  report.cursor = id
  report.scanned++
  const current = (await sql(`SELECT payload,receipts,_seq_no,_primary_term,lookup FROM ${name} WHERE id=?`, [id])).rows[0]
  if (!current) continue
  const envelope: Envelope = codec.decode(current[0], `${name}:${id}:payload`)
  if (envelope.row.id !== id || typeof envelope.deleted !== "boolean") throw new Error("Invalid authenticated auth row")
  const receipts: Receipt[] = codec.decode(current[1], `${name}:${id}:receipts`)
  const expired = !envelope.deleted && (expiringModels.has(model) || model === "jwks") && typeof envelope.row.expiresAt === "string" && new Date(envelope.row.expiresAt).getTime() + (model === "jwks" ? 86400000 : 0) <= now.getTime()
  if (envelope.deleted && envelope.deletedAt && now.getTime() - new Date(envelope.deletedAt).getTime() >= retentionMs && reusableModels.has(model) && !envelope.admission && !envelope.admissionFence) {
   const result = await sql(`DELETE FROM ${name} WHERE id=? AND _seq_no=? AND _primary_term=?`, [id, current[2], current[3]])
   if (result.rowcount === 1) report.purged++
   else report.conflicted++
   continue
  }
  const kept = receipts.filter(receipt => !receipt.at || now.getTime() - new Date(receipt.at).getTime() < retentionMs).map(receipt => receipt.at ? receipt : { ...receipt, at: now.toISOString() })
  const next: Envelope = expired ? { ...envelope, row: { id }, emailClaim: undefined, deleted: true, deletedAt: now.toISOString() } : envelope.deleted && !envelope.deletedAt ? { ...envelope, deletedAt: now.toISOString() } : envelope
  if (!expired && next === envelope && JSON.stringify(kept) === JSON.stringify(receipts)) continue
  const compacted = kept.length < receipts.length
  const result = await sql(`UPDATE ${name} SET payload=?,receipts=?,deleted=?,lookup=?,created_at=?,expires_at=? WHERE id=? AND _seq_no=? AND _primary_term=?`, [codec.encode(next, `${name}:${id}:payload`), codec.encode(kept, `${name}:${id}:receipts`), next.deleted, next.deleted ? {} : current[4], next.deleted ? null : envelope.row.createdAt ?? null, next.deleted ? null : envelope.row.expiresAt ?? null, id, current[2], current[3]])
  if (result.rowcount === 1) { if (expired) report.expired++; if (compacted) report.compacted++ }
  else report.conflicted++
 }
 return report
}

/** Reclaim admission slots only after a permanent generation fence prevents late insertion. */
export async function reconcileAuthCapacity(options: Options) {
 const { sql, cursor } = options
 const codec = authPayloadCodec(options.encryptionSecret, options.encryptionKeys)
 const size = batchSize(options.batchSize)
 const now = options.now ?? new Date()
 if (!Number.isFinite(now.getTime())) throw new Error("Invalid maintenance time")
 await sql("REFRESH TABLE doc.auth_capacity")
 const page = await sql(`SELECT id FROM doc.auth_capacity ${cursor === undefined ? "" : "WHERE id > ?"} ORDER BY id LIMIT ${size + 1}`, cursor === undefined ? [] : [cursor])
 const report = { scanned: 0, released: 0, retained: 0, conflicted: 0, cursor: null as string | null, complete: page.rows.length <= size }
 for (const [value] of page.rows.slice(0, size)) {
  const bucket = String(value)
  report.cursor = bucket
  const model = bucket.split(":")[0]
  if (!authModels.includes(model) || model === "user") throw new Error("Invalid auth capacity bucket")
  const name = authModelTable(model)
  const capacity = await readCapacity(sql, codec, bucket)
  if (!capacity) continue
  for (const [id, slot] of Object.entries(capacity.ledger.slots)) {
   report.scanned++
   const aad = `${name}:${id}`
   const current = (await sql(`SELECT payload,_seq_no,_primary_term FROM ${name} WHERE id=?`, [id])).rows[0]
   if (current) {
    const envelope: Envelope = codec.decode(current[0], `${aad}:payload`)
    if (envelope.row.id !== id || typeof envelope.deleted !== "boolean") throw new Error("Invalid authenticated auth row")
    if (!envelope.deleted) { report.retained++; continue }
    const fenced = await sql(`UPDATE ${name} SET payload=? WHERE id=? AND _seq_no=? AND _primary_term=?`, [codec.encode({ ...envelope, admissionFence: Math.max(envelope.admissionFence ?? 0, slot.generation) }, `${aad}:payload`), id, current[1], current[2]])
    if (fenced.rowcount !== 1) { report.conflicted++; continue }
   } else {
    if (now.getTime() - new Date(slot.createdAt).getTime() < 15 * 60000) { report.retained++; continue }
    try {
     const fenced = await sql(`INSERT INTO ${name} (id,payload,deleted,receipts) VALUES (?,?,true,?)`, [id, codec.encode({ row: { id }, deleted: true, deletedAt: now.toISOString(), admissionFence: slot.generation }, `${aad}:payload`), codec.encode([], `${aad}:receipts`)])
     if (fenced.rowcount !== 1) throw new IndeterminateAuthWriteError()
    } catch (error) {
     if (error instanceof CrateAuthRequestError && error.code === 4091) { report.conflicted++; continue }
     throw error
    }
   }
   let released = false
   for (let attempt = 0; attempt < 64; attempt++) {
    const latest = await readCapacity(sql, codec, bucket)
    if (!latest || latest.ledger.slots[id]?.generation !== slot.generation) { released = true; break }
    const slots = { ...latest.ledger.slots }
    delete slots[id]
    const result = await sql("UPDATE doc.auth_capacity SET payload=? WHERE id=? AND _seq_no=? AND _primary_term=?", [codec.encode({ row: { ...latest.ledger, slots }, deleted: false }, `doc.auth_capacity:${bucket}:payload`), bucket, latest.seq, latest.term])
    if (result.rowcount === 1) { released = true; break }
   }
   if (released) report.released++
   else report.conflicted++
  }
 }
 return report
}

/** Launch requires every page to be safe. Existing prerelease/import rows must be admitted offline. */
export async function auditAuthPopulation(options: Options & { model: string }) {
 const { sql, model, cursor } = options
 if (!authModels.includes(model)) throw new Error("Unsupported maintenance model")
 const codec = authPayloadCodec(options.encryptionSecret, options.encryptionKeys)
 const size = batchSize(options.batchSize)
 const name = authModelTable(model)
 await sql(`REFRESH TABLE ${name}`)
 const page = await sql(`SELECT id FROM ${name} ${cursor === undefined ? "" : "WHERE id > ?"} ORDER BY id LIMIT ${size + 1}`, cursor === undefined ? [] : [cursor])
 const report = { scanned: 0, live: 0, unadmitted: 0, inconsistent: 0, safe: true, cursor: null as string | null, complete: page.rows.length <= size }
 for (const [value] of page.rows.slice(0, size)) {
  const id = String(value)
  report.scanned++
  report.cursor = id
  const current = (await sql(`SELECT payload,deleted,receipts FROM ${name} WHERE id=?`, [id])).rows[0]
  if (!current) continue
  const envelope: Envelope = codec.decode(current[0], `${name}:${id}:payload`)
  if (envelope.row.id !== id || typeof envelope.deleted !== "boolean") throw new Error("Invalid authenticated auth row")
  codec.decode(current[2], `${name}:${id}:receipts`)
  if (envelope.deleted !== current[1]) report.inconsistent++
  if (envelope.deleted) continue
  report.live++
  if (model === "user") continue // User lookups use physical ids or the unique email claim.
  if (!envelope.admission) { report.unadmitted++; continue }
  const capacity = await readCapacity(sql, codec, envelope.admission.bucket)
  if (capacity?.ledger.slots[id]?.generation !== envelope.admission.generation || capacity.ledger.bounds.buckets !== launchPopulationBounds.buckets || capacity.ledger.bounds.limitPerBucket !== launchPopulationBounds.limitPerBucket || Object.keys(capacity.ledger.slots).length > launchPopulationBounds.limitPerBucket) report.inconsistent++
 }
 report.safe = report.unadmitted === 0 && report.inconsistent === 0
 return report
}

/** Rewrite encrypted envelopes by CAS; do not change logical records, indexes or receipt ownership. */
export async function rotateAuthEncryption(options: Options & { model: string }) {
 const { sql, model, cursor } = options
 if (![...authModels, "capacity"].includes(model)) throw new Error("Unsupported maintenance model")
 if (!options.encryptionKeys) throw new Error("A versioned auth encryption key ring is required for rotation")
 const codec = authPayloadCodec(options.encryptionSecret, options.encryptionKeys)
 const size = batchSize(options.batchSize)
 const name = authModelTable(model)
 await sql(`REFRESH TABLE ${name}`)
 const page = await sql(`SELECT id FROM ${name} ${cursor === undefined ? "" : "WHERE id > ?"} ORDER BY id LIMIT ${size + 1}`, cursor === undefined ? [] : [cursor])
 const report = { scanned: 0, rotated: 0, conflicted: 0, cursor: null as string | null, complete: page.rows.length <= size }
 for (const [value] of page.rows.slice(0, size)) {
  const id = String(value)
  report.scanned++
  report.cursor = id
  const current = (await sql(`SELECT payload,receipts,_seq_no,_primary_term FROM ${name} WHERE id=?`, [id])).rows[0]
  if (!current) continue
  const aad = `${name}:${id}`
  // Authenticate both even when already at the active key. An audit must not
  // certify a forged key id or leave an undecryptable receipt behind.
  const envelope: Envelope = codec.decode(current[0], `${aad}:payload`)
  if (envelope.row.id !== id || typeof envelope.deleted !== "boolean") throw new Error("Invalid authenticated auth row")
  const receipts = codec.decode(current[1], `${aad}:receipts`)
  if (codec.usesActiveKey(current[0]) && codec.usesActiveKey(current[1])) continue
  const result = await sql(`UPDATE ${name} SET payload=?,receipts=? WHERE id=? AND _seq_no=? AND _primary_term=?`, [codec.encode(envelope, `${aad}:payload`), codec.encode(receipts, `${aad}:receipts`), id, current[2], current[3]])
  if (result.rowcount === 1) report.rotated++
  else report.conflicted++
 }
 return report
}

export const reconcilableAuthModels = ["account", "session", "oauthClient", "oauthConsent", "oauthClientResource", "oauthRefreshToken", "oauthAccessToken"]

/** Remove leftovers of multi-row auth operations. Authorization remains authoritative between sweeps. */
export async function reconcileAuthRows(options: Options & { model: string; storage?: { delete(key: string): Promise<unknown> } }) {
 const { sql, model, cursor } = options
 if (!reconcilableAuthModels.includes(model)) throw new Error("Unsupported reconciliation model")
 const codec = authPayloadCodec(options.encryptionSecret, options.encryptionKeys)
 const size = batchSize(options.batchSize)
 const now = options.now ?? new Date()
 if (!Number.isFinite(now.getTime())) throw new Error("Invalid maintenance time")
 const read = async (parentModel: string, id: string) => {
  const name = authModelTable(parentModel)
  const stored = (await sql(`SELECT payload,receipts,_seq_no,_primary_term FROM ${name} WHERE id=?`, [id])).rows[0]
  if (!stored) return null
  const envelope: Envelope = codec.decode(stored[0], `${name}:${id}:payload`)
  if (envelope.row.id !== id || typeof envelope.deleted !== "boolean") throw new Error("Invalid authenticated auth row")
  return { envelope, receipts: codec.decode(stored[1], `${name}:${id}:receipts`) as Receipt[], seq: stored[2], term: stored[3] }
 }
 const remove = async (targetModel: string, id: string, stored: NonNullable<Awaited<ReturnType<typeof read>>>) => {
  const name = authModelTable(targetModel)
  const envelope: Envelope = { ...stored.envelope, row: { id }, deleted: true, deletedAt: now.toISOString(), emailClaim: undefined }
  const receipts = [...stored.receipts, { operation: randomUUID(), baseSeq: Number(stored.seq), at: now.toISOString() }].slice(-256)
  return (await sql(`UPDATE ${name} SET payload=?,receipts=?,deleted=true,lookup=?,created_at=NULL,expires_at=NULL WHERE id=? AND _seq_no=? AND _primary_term=?`, [codec.encode(envelope, `${name}:${id}:payload`), codec.encode(receipts, `${name}:${id}:receipts`), {}, id, stored.seq, stored.term])).rowcount === 1
 }
 const name = authModelTable(model)
 await sql(`REFRESH TABLE ${name}`)
 const page = await sql(`SELECT id FROM ${name} ${cursor === undefined ? "" : "WHERE id > ?"} ORDER BY id LIMIT ${size + 1}`, cursor === undefined ? [] : [cursor])
 const report = { scanned: 0, removed: 0, conflicted: 0, cursor: null as string | null, complete: page.rows.length <= size }
 for (const [value] of page.rows.slice(0, size)) {
  const id = String(value)
  report.scanned++
  report.cursor = id
  const current = await read(model, id)
  if (!current || current.envelope.deleted) continue
  const row = current.envelope.row
  const user = typeof row.userId === "string" ? await read("user", row.userId) : null
  let orphan = (model === "account" || model === "session") && (!user || user.envelope.deleted || model === "session" && !user.envelope.row.emailVerified)
  if (model === "oauthClient" && typeof row.userId === "string") orphan = !user || user.envelope.deleted
  if (["oauthConsent", "oauthRefreshToken", "oauthAccessToken", "oauthClientResource"].includes(model)) {
   const client = typeof row.clientId === "string" ? await read("oauthClient", row.clientId) : null
   orphan = !client || client.envelope.deleted || client.envelope.row.disabled === true
   if (model !== "oauthClientResource") orphan ||= !user || user.envelope.deleted || !user.envelope.row.emailVerified
   else {
    const resource = typeof row.resourceId === "string" ? await read("oauthResource", row.resourceId) : null
    orphan ||= !resource || resource.envelope.deleted
   }
  }
  if (["oauthRefreshToken", "oauthAccessToken"].includes(model) && !orphan) {
   const grantId = createHash("sha256").update(JSON.stringify([row.clientId, row.userId, row.referenceId ?? null])).digest("hex")
   const consent = await read("oauthConsent", grantId)
   orphan = !consent || consent.envelope.deleted
   if (consent && !orphan) {
    const grant = consent.envelope.row
    if (model === "oauthRefreshToken") {
     if (row.grantVersion) orphan ||= row.grantVersion !== grant.grantVersion
     else if (typeof row.createdAt === "string") orphan ||= now.getTime() - new Date(row.createdAt).getTime() >= 15 * 60000
     // Reconcile pre-fence/failed revocations too. Do not confuse ordinary
     // rotation with terminal revocation; replay parents stay until expiry.
     if (row.revoked && !row.rotatedAt && row.grantVersion === grant.grantVersion) {
      if (!await remove("oauthConsent", grantId, consent)) { report.conflicted++; continue }
      orphan = true
     }
    }
    if (Array.isArray(row.scopes)) orphan ||= !row.scopes.every(scope => Array.isArray(grant.scopes) && grant.scopes.includes(scope))
    if (Array.isArray(row.resources)) orphan ||= !row.resources.every(resource => Array.isArray(grant.resources) && grant.resources.includes(resource))
   }
   if (typeof row.sessionId === "string" && !(Array.isArray(row.scopes) && row.scopes.includes("offline_access"))) {
    const session = await read("session", row.sessionId)
    orphan ||= !session || session.envelope.deleted || typeof session.envelope.row.expiresAt !== "string" || new Date(session.envelope.row.expiresAt).getTime() <= now.getTime()
   }
  }
  if (!orphan) continue
  if (await remove(model, id, current)) {
   report.removed++
   if (model === "session" && typeof row.token === "string") await options.storage?.delete(row.token)
  } else report.conflicted++
 }
 return report
}
