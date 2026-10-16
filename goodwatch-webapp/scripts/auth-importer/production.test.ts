import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import type { ImportReport } from "../../app/server/auth/supabase-importer.server.ts"
import { productionImport } from "./production.ts"

const counts = {
	users: 1,
	accounts: 1,
	credential: 1,
	google: 0,
	emailClaims: 1,
}
const report: ImportReport = {
	status: "planned",
	sourceFingerprint: "fake-fingerprint",
	source: {
		users: 1,
		identities: 1,
		credential: 1,
		google: 0,
		verified: 1,
		unverified: 0,
	},
	before: counts,
	after: counts,
	created: { users: 0, accounts: 0 },
	unchanged: { users: 1, accounts: 1 },
	issues: [],
	elapsedMs: 1,
}

test("production receipts enforce dry/apply/rerun, binding, integrity and exclusive use", async (t) => {
	const dir = await mkdtemp(join(tmpdir(), "gw-import-552-"))
	const receiptPath = join(dir, "receipt.json")
	const common = {
		receiptPath,
		secret: "fake-receipt-secret-552",
		binding: { nodes: ["stable-id"], keys: "fake-key" },
	}
	let calls = 0
	const run = async () => {
		calls++
		return { ...report }
	}
	try {
		await assert.rejects(productionImport({ ...common, phase: "apply", run }))
		assert.equal(calls, 0)
		await productionImport({ ...common, phase: "dry", run })
		const dry = await readFile(receiptPath, "utf8")
		const future = Date.now() + 25 * 60 * 60 * 1000
		const clock = t.mock.method(Date, "now", () => future)
		await assert.rejects(productionImport({ ...common, phase: "apply", run }))
		clock.mock.restore()

		await assert.rejects(productionImport({ ...common, phase: "dry", run }))
		await assert.rejects(productionImport({ ...common, phase: "rerun", run }))
		await assert.rejects(
			productionImport({
				...common,
				binding: { nodes: ["other"] },
				phase: "apply",
				run,
			}),
		)
		await assert.rejects(
			productionImport({ ...common, secret: "wrong", phase: "apply", run }),
		)
		const tampered = JSON.parse(dry)
		tampered.receipt.counts.users = 999
		await writeFile(receiptPath, JSON.stringify(tampered))
		await assert.rejects(productionImport({ ...common, phase: "apply", run }))
		await writeFile(receiptPath, dry)
		await writeFile(`${receiptPath}.lock`, "")
		await assert.rejects(productionImport({ ...common, phase: "apply", run }))
		await rm(`${receiptPath}.lock`)
		assert.equal(calls, 1)
		await assert.rejects(
			productionImport({
				...common,
				phase: "apply",
				run: async () => {
					throw new Error("partial write")
				},
			}),
		)
		assert.equal(await readFile(receiptPath, "utf8"), dry)
		await productionImport({
			...common,
			phase: "apply",
			run: async (guards) => {
				assert.equal(guards.expectedSourceFingerprint, report.sourceFingerprint)
				assert.deepEqual(guards.expectedTargetCounts, counts)
				assert.equal(guards.requireExactRerun, false)
				return { ...report, status: "complete" }
			},
		})
		await assert.rejects(productionImport({ ...common, phase: "apply", run }))
		await productionImport({
			...common,
			phase: "rerun",
			run: async (guards) => {
				assert.equal(guards.requireExactRerun, true)
				return { ...report, status: "complete" }
			},
		})
		assert.equal(
			JSON.parse(await readFile(receiptPath, "utf8")).receipt.phase,
			"complete",
		)
	} finally {
		await rm(dir, { recursive: true, force: true })
	}
})
