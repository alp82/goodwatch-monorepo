import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { randomBytes } from "node:crypto"
import { crateSql } from "./repository.server.ts"
import { tasteProfileTable, tableDdl } from "./proposal-storage-schema.ts"
import {
	SqlProfileStore,
	TasteProfiles,
	FOLLOWUP_MAX_MS,
} from "./proposal-taste-profile.ts"
import {
	tasteDisplays,
	tasteFixture,
	key,
} from "./proposal-taste-test-support.ts"
// Opt-in disposable Docker only. No production credentials/configuration are ever loaded.
test(
	"Crate profile CAS, nullable undo, retention, follow-up pruning and physical delete",
	{ skip: process.env.YEPWATCH_TEST_TASTE_CRATE !== "1", timeout: 120000 },
	async () => {
		const name = `yw-profile-test-${process.pid}`
		const docker = (...args: string[]) =>
			execFileSync("docker", args, {
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
			}).trim()
		docker(
			"run",
			"-d",
			"--rm",
			"--name",
			name,
			"-p",
			"127.0.0.1::4200",
			"-e",
			"CRATE_HEAP_SIZE=512m",
			"crate:5.10.16",
			"-Cdiscovery.type=single-node"
		)
		try {
			const port = docker("port", name, "4200/tcp").split(":").at(-1)
			const sql = crateSql(`http://127.0.0.1:${port}`, "crate", "")
			let ready = false
			for (let i = 0; i < 100; i++) {
				try {
					await sql("SELECT 1")
					ready = true
					break
				} catch {
					await new Promise((r) => setTimeout(r, 500))
				}
			}
			assert.ok(ready)
			await sql(tableDdl(tasteProfileTable, 0))
			let now = Date.now()
			const store = new SqlProfileStore(sql)
			const profiles = new TasteProfiles(
				store,
				"isolated-profile-test-secret-at-least-32",
				() => tasteFixture(),
				tasteDisplays,
				() => now
			)
			const id = profiles.identity(randomBytes(32).toString("base64url"))
			await profiles.answers(id, {
				revision: 0,
				items: [{ key: key(1), answer: "loved", at: now }],
			})
			const old = (await store.read([id]))[0]
			assert.equal(old.profile.answers.items[0].answer, "loved")
			const changed = structuredClone(old.profile)
			changed.revision++
			changed.nopes = [{ key: key(2), at: now }]
			assert.equal(await store.save(changed, old), true)
			assert.equal(await store.save(changed, old), false)
			assert.deepEqual((await store.read([id]))[0].profile.nopes, changed.nopes)
			await sql("UPDATE doc.yepwatch_taste_profile SET nopes=NULL WHERE id=?", [id])
			assert.deepEqual((await store.read([id]))[0].profile.nopes, [], "old NULL rows are empty")
			await profiles.answers(id, {
				revision: 2,
				items: [{ key: key(1), answer: null, at: ++now }],
			})
			assert.equal((await profiles.summary(id)).answered, 0)
			const row = (await store.read([id]))[0]
			row.profile.followups = [
				{ key: key(1), decided_at: now - FOLLOWUP_MAX_MS, state: "pending" },
			]
			await store.save(row.profile, row)
			await sql("REFRESH TABLE doc.yepwatch_taste_profile")
			await store.expire(now)
			assert.deepEqual((await store.read([id]))[0].profile.followups, [])
			await profiles.delete(id)
			assert.deepEqual(await store.read([id]), [])
			await profiles.touch(id)
			now += 181 * 86400000
			await sql("REFRESH TABLE doc.yepwatch_taste_profile")
			await profiles.expire()
			assert.deepEqual(await store.read([id]), [])
		} finally {
			docker("stop", name)
		}
	}
)
