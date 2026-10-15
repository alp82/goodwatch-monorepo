import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { crateAuthAdapter } from "./crate-adapter.server.ts"
import { maintenanceDatabase } from "./maintenance-fixtures.integration.ts"
import { collectAuthGarbage } from "./maintenance.server.ts"

const sql = maintenanceDatabase()
const encryptionSecret = "disposable-local-auth-integration-key-548"
const adapter = crateAuthAdapter({ sql })({})

test("garbage collection expires old sessions while preserving a live session and replay barriers", async () => {
	const userId = randomUUID()
	const token = randomUUID()
	await adapter.create({
		model: "session",
		data: { userId, token, expiresAt: new Date(Date.now() - 1000) },
	})
	const live = await adapter.create({
		model: "session",
		data: {
			userId,
			token: randomUUID(),
			expiresAt: new Date(Date.now() + 86400000),
		},
	})
	const report = await collectAuthGarbage({
		sql,
		encryptionSecret,
		model: "session",
	})
	assert.equal(report.expired, 1)
	assert.equal(
		await adapter.findOne({
			model: "session",
			where: [{ field: "token", value: token }],
		}),
		null,
	)
	assert.equal(
		(
			await adapter.findOne<{ id: string }>({
				model: "session",
				where: [{ field: "token", value: live.token }],
			})
		)?.id,
		live.id,
	)
	await collectAuthGarbage({
		sql,
		encryptionSecret,
		model: "session",
		now: new Date(Date.now() + 3 * 86400000),
	})
	await assert.rejects(
		adapter.create({
			model: "session",
			data: { userId, token, expiresAt: new Date(Date.now() + 86400000) },
		}),
		/duplicate key/,
	)
})

test("a lost consumption acknowledgement whose receipt was collected remains indeterminate", async () => {
	const verification = await adapter.create({
		model: "verification",
		data: {
			identifier: randomUUID(),
			value: "one-use",
			expiresAt: new Date(Date.now() + 86400000),
		},
	})
	const consumer = crateAuthAdapter({
		encryptionSecret,
		sql: async (statement, args) => {
			const result = await sql(statement, args)
			if (statement.startsWith("UPDATE doc.auth_verification SET payload=")) {
				const collected = await collectAuthGarbage({
					sql,
					encryptionSecret,
					model: "verification",
					now: new Date(Date.now() + 2 * 86400000),
				})
				assert.ok(collected.compacted >= 1)
				return { ...result, rowcount: 0 }
			}
			return result
		},
	})({})
	await assert.rejects(
		consumer.consumeOne({
			model: "verification",
			where: [{ field: "id", value: verification.id }],
		}),
		/indeterminate/,
	)
	assert.equal(
		await adapter.consumeOne({
			model: "verification",
			where: [{ field: "id", value: verification.id }],
		}),
		null,
	)
})

test("garbage collection paginates a population that exceeds the adapter's enumeration bound", async () => {
	const restricted = crateAuthAdapter({ sql, maxEnumeration: 2 })({})
	const userId = randomUUID()
	for (let i = 0; i < 7; i++)
		await restricted.create({
			model: "session",
			data: {
				userId,
				token: randomUUID(),
				expiresAt: new Date(Date.now() - 1000),
			},
		})
	await assert.rejects(
		restricted.findMany({
			model: "session",
			where: [{ field: "userId", value: userId }],
		}),
		/safe bound/,
	)
	let cursor: string | undefined
	let expired = 0
	for (;;) {
		const report = await collectAuthGarbage({
			sql,
			encryptionSecret,
			model: "session",
			batchSize: 2,
			cursor,
		})
		assert.ok(report.scanned <= 2)
		expired += report.expired
		if (report.complete) break
		assert.ok(report.cursor)
		cursor = report.cursor
	}
	assert.equal(expired, 7)
	assert.deepEqual(
		await restricted.findMany({
			model: "session",
			where: [{ field: "userId", value: userId }],
		}),
		[],
	)
})

test("maintenance restores a flipped enumeration hint from the authenticated live state", async () => {
	const userId = randomUUID()
	const session = await adapter.create({
		model: "session",
		data: {
			userId,
			token: randomUUID(),
			expiresAt: new Date(Date.now() + 86400000),
		},
	})
	await sql("UPDATE doc.auth_session SET deleted=true WHERE id=?", [session.id])
	const report = await collectAuthGarbage({
		sql,
		encryptionSecret,
		model: "session",
	})
	assert.equal(report.repaired, 1)
	assert.equal(
		await adapter.deleteMany({
			model: "session",
			where: [{ field: "userId", value: userId }],
		}),
		1,
	)
})


test("maintenance repairs a tampered owner lookup so sign-out-everywhere sees the session", async () => {
 const userId = randomUUID()
 const session = await adapter.create({model: "session", data: {userId, token: randomUUID(), expiresAt: new Date(Date.now()+86400000)}})
 await sql("UPDATE doc.auth_session SET lookup['userId']=? WHERE id=?", ["someone-else", session.id])
 assert.equal(await adapter.deleteMany({model: "session", where: [{field: "userId", value: userId}]}), 0)
 await collectAuthGarbage({sql, encryptionSecret, model: "session"})
 assert.equal(await adapter.deleteMany({model: "session", where: [{field: "userId", value: userId}]}), 1)
})


test("a deleted session returns its slot before the maintenance page or pass finishes", async () => {
 const bounded = crateAuthAdapter({sql,populationBounds:{buckets:1,limitPerBucket:1}})({})
 const userId = randomUUID()
 const session = await bounded.create({model:"session",data:{userId,token:randomUUID(),expiresAt:new Date(Date.now()-1000)}})
 await collectAuthGarbage({sql,encryptionSecret,model:"session",batchSize:1,cursor:undefined})
 // Collect every page, without running capacity reconciliation.
 let cursor: string | undefined
 for(;;) {
  const page = await collectAuthGarbage({sql,encryptionSecret,model:"session",batchSize:1,cursor})
  if(page.complete) break
  cursor = page.cursor ?? undefined
 }
 assert.equal(await bounded.findOne({model:"session",where:[{field:"token",value:session.token}]}),null)
 const replacement = await bounded.create({model:"session",data:{userId,token:randomUUID(),expiresAt:new Date(Date.now()+86400000)}})
 assert.ok(replacement)
})


test("thirty-day tombstone retention physically removes session history", async () => {
 const bounded = crateAuthAdapter({sql,populationBounds:true})({})
 const session = await bounded.create({model:"session",data:{userId:randomUUID(),token:randomUUID(),expiresAt:new Date(Date.now()-1000)}})
 await collectAuthGarbage({sql,encryptionSecret,model:"session"})
 await collectAuthGarbage({sql,encryptionSecret,model:"session",now:new Date(Date.now()+31*86400000)})
 assert.equal((await sql("SELECT id FROM doc.auth_session WHERE id=?",[session.id])).rows.length,0)
})
