import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { crateAuthAdapter } from "./crate-adapter.server.ts"
import { maintenanceDatabase } from "./maintenance-fixtures.integration.ts"
import { startAuthMaintenance } from "./maintenance-worker.server.ts"

const sql = maintenanceDatabase()

test("the scheduled worker runs a full bounded maintenance pass and stops cleanly", async () => {
	const adapter = crateAuthAdapter({ sql })({})
	const user = await adapter.create({
		model: "user",
		data: {
			email: `${randomUUID()}@example.test`,
			name: "Member",
			emailVerified: true,
		},
	})
	const session = await adapter.create({
		model: "session",
		data: {
			userId: user.id,
			token: randomUUID(),
			expiresAt: new Date(Date.now() - 1000),
		},
	})
	const worker = startAuthMaintenance({
		sql,
		encryptionSecret: "disposable-local-auth-integration-key-548",
		batchSize: 2,
	})
	try {
		const pass = await worker.runNow()
		assert.equal(
			pass.jobs.find((job) => job.job === "garbage" && job.model === "session")
				?.expired,
			1,
		)
		assert.equal(
			await adapter.findOne({
				model: "session",
				where: [{ field: "token", value: session.token }],
			}),
			null,
		)
	} finally {
		await worker.stop()
	}
})


test("an undecryptable verification row is logged while later jobs reclaim session capacity", async () => {
 const adapter = crateAuthAdapter({sql, populationBounds:{buckets:1,limitPerBucket:1}})({})
 const user = await adapter.create({model:"user",data:{email:`${randomUUID()}@example.test`,name:"Confirmed",emailVerified:true}})
 await adapter.create({model:"session",data:{userId:user.id,token:randomUUID(),expiresAt:new Date(Date.now()-1000)}})
 const id = randomUUID()
 await sql("INSERT INTO doc.auth_verification (id,payload,receipts) VALUES (?,?,?)",[id,"v3.retired.bad.bad.bad","bad"])
 const errors: {table:string;id:string}[] = []
 const {runAuthMaintenancePass} = await import("./maintenance-worker.server.ts")
 const pass = await runAuthMaintenancePass({sql,encryptionSecret:"disposable-local-auth-integration-key-548",onRowError: row => errors.push(row)})
 assert.ok(errors.some(row=>row.table === "doc.auth_verification" && row.id === id))
 assert.ok(pass.jobs.some(job=>Number(job.skipped)>0))
 assert.ok(pass.jobs.some(job=>job.job === "garbage" && job.model === "session" && Number(job.expired)>0))
 assert.ok(await adapter.create({model:"session",data:{userId:user.id,token:randomUUID(),expiresAt:new Date(Date.now()+86400000)}}))
})
