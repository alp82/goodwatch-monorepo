import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { crateAuthAdapter } from "./crate-adapter.server.ts"
import { maintenanceDatabase } from "./maintenance-fixtures.integration.ts"
import { recoverEmailClaims } from "./maintenance.server.ts"

const sql = maintenanceDatabase()
const encryptionSecret = "disposable-local-auth-integration-key-548"
const adapter = crateAuthAdapter({ sql })({})

test("claim recovery lets a member retry signup after a crash between reservation and user insertion", async () => {
	const email = `${randomUUID()}@example.test`
	const crashed = crateAuthAdapter({
		encryptionSecret,
		sql: (statement, args) => {
			if (statement.startsWith("INSERT INTO doc.auth_user ("))
				throw new Error("Simulated process loss")
			return sql(statement, args)
		},
	})({})
	await assert.rejects(
		crashed.create({ model: "user", data: { email, name: "Member" } }),
		/indeterminate/,
	)
	await assert.rejects(
		adapter.create({ model: "user", data: { email, name: "Retry" } }),
		/duplicate key/,
	)
	const report = await recoverEmailClaims({
		sql,
		encryptionSecret,
		now: new Date(Date.now() + 3600000),
	})
	assert.equal(report.released, 1)
	const member = await adapter.create({
		model: "user",
		data: { email, name: "Retry" },
	})
	assert.equal(
		(
			await adapter.findOne<{ id: string }>({
				model: "user",
				where: [{ field: "email", value: email }],
			})
		)?.id,
		member.id,
	)
	assert.equal(
		(
			await recoverEmailClaims({
				sql,
				encryptionSecret,
				now: new Date(Date.now() + 3600000),
			})
		).released,
		0,
	)
})

test("a signup paused after reserving its email cannot appear after recovery releases it", async () => {
	const email = `${randomUUID()}@example.test`
	let recovered = false
	const delayed = crateAuthAdapter({
		encryptionSecret,
		sql: async (statement, args) => {
			if (!recovered && statement.startsWith("INSERT INTO doc.auth_user (")) {
				recovered = true
				assert.equal(
					(
						await recoverEmailClaims({
							sql,
							encryptionSecret,
							now: new Date(Date.now() + 3600000),
						})
					).released,
					1,
				)
				await adapter.create({
					model: "user",
					data: { email, name: "New owner" },
				})
			}
			return sql(statement, args)
		},
	})({})
	await assert.rejects(
		delayed.create({ model: "user", data: { email, name: "Delayed owner" } }),
		/duplicate key/,
	)
	assert.equal(
		(
			await adapter.findOne<{ name: string }>({
				model: "user",
				where: [{ field: "email", value: email }],
			})
		)?.name,
		"New owner",
	)
})

test("recovery releases an abandoned address change without disturbing the member's current email", async () => {
	const currentEmail = `${randomUUID()}@example.test`
	const abandonedEmail = `${randomUUID()}@example.test`
	const user = await adapter.create({
		model: "user",
		data: { email: currentEmail, name: "Member" },
	})
	const crashed = crateAuthAdapter({
		encryptionSecret,
		sql: (statement, args) => {
			if (statement.startsWith("UPDATE doc.auth_user SET payload="))
				throw new Error("Simulated process loss")
			return sql(statement, args)
		},
	})({})
	await assert.rejects(
		crashed.update({
			model: "user",
			where: [{ field: "id", value: user.id }],
			update: { email: abandonedEmail },
		}),
		/indeterminate/,
	)
	assert.equal(
		(
			await recoverEmailClaims({
				sql,
				encryptionSecret,
				now: new Date(Date.now() + 3600000),
			})
		).released,
		1,
	)
	assert.equal(
		(
			await adapter.findOne<{ id: string }>({
				model: "user",
				where: [{ field: "email", value: currentEmail }],
			})
		)?.id,
		user.id,
	)
	await adapter.create({
		model: "user",
		data: { email: abandonedEmail, name: "Available again" },
	})
})

test("claim recovery gives a new signup reservation fifteen minutes before fencing it", async () => {
	const email = `${randomUUID()}@example.test`
	const crashed = crateAuthAdapter({
		encryptionSecret,
		sql: (statement, args) => {
			if (statement.startsWith("INSERT INTO doc.auth_user ("))
				throw new Error("Simulated process loss")
			return sql(statement, args)
		},
	})({})
	await assert.rejects(
		crashed.create({ model: "user", data: { email, name: "Member" } }),
		/indeterminate/,
	)
	assert.equal(
		(await recoverEmailClaims({ sql, encryptionSecret })).released,
		0,
	)
	assert.equal(
		(
			await recoverEmailClaims({
				sql,
				encryptionSecret,
				now: new Date(Date.now() + 3600000),
			})
		).released,
		1,
	)
})


test("a crashed forced-ID import can retry the same Supabase identity after claim recovery", async () => {
 const id = randomUUID()
 const email = `${id}@example.test`
 const crashed = crateAuthAdapter({encryptionSecret, sql: (statement, args) => {
  if(statement.startsWith("INSERT INTO doc.auth_user (")) throw new Error("socket hang up")
  return sql(statement,args)
 }})({})
 await assert.rejects(crashed.create({model:"user", data:{id,email,name:"Imported"}, forceAllowId:true}), /indeterminate/)
 await recoverEmailClaims({sql,encryptionSecret,now:new Date(Date.now()+3600000)})
 const imported = await adapter.create({model:"user", data:{id,email,name:"Imported"}, forceAllowId:true})
 assert.equal(imported.id,id)
 assert.equal((await adapter.findOne<{id:string}>({model:"user",where:[{field:"email",value:email}]}))?.id,id)
})


test("a delayed create cannot resurrect a user after its thirty-day barrier is purged", async (t) => {
 const realNow = Date.now()
 const id = randomUUID()
 const email = `${id}@example.test`
 t.mock.timers.enable({apis:["Date"],now:realNow-31*86400000})
 let intercepted = false
 const delayed = crateAuthAdapter({encryptionSecret,sql:async(statement,args)=>{
  if(!intercepted && statement.startsWith("INSERT INTO doc.auth_user (")) {
   intercepted = true
   await recoverEmailClaims({sql,encryptionSecret,now:new Date(realNow)})
   const {collectAuthGarbage} = await import("./maintenance.server.ts")
   assert.equal((await collectAuthGarbage({sql,encryptionSecret,model:"user",now:new Date(realNow)})).purged,1)
   t.mock.timers.reset()
  }
  return sql(statement,args)
 }})({})
 await assert.rejects(delayed.create({model:"user",data:{id,email,name:"Delayed"},forceAllowId:true}))
 assert.equal(await adapter.findOne({model:"user",where:[{field:"id",value:id}]}),null)
 assert.equal((await adapter.create({model:"user",data:{id,email,name:"Fresh import"},forceAllowId:true})).id,id)
})
