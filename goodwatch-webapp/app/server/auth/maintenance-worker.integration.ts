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
