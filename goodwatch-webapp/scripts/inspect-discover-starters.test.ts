import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import "../app/server/title-filter/test-alias.ts"
const { encodeSnapshot } = await import(
	"../app/server/title-snapshot/format.server.ts"
)
const { VALID_FINGERPRINT_KEYS } = await import(
	"../app/server/utils/fingerprint.ts"
)

test("offline inspector reads the writer's portable snapshot format and prints twelve titles", async (t) => {
	const dir = mkdtempSync(join(tmpdir(), "discover-starters-"))
	try {
		const rows = Array.from({ length: 12 }, (_, i) => ({
			pointId: (i < 6 ? 1e12 : 2e12) + i + 1,
			genres: ["Comedy"],
			releaseDay: 19000,
			votes: 100_000,
			popularity: 100 - i,
			score: 80,
			origin: ["US", "JP", "FR", "GB", "KR", "IN"][i % 6],
			hasPoster: true,
			hasBackdrop: true,
			adult: false,
			anime: false,
			fingerprint: new Array(74).fill(5),
		}))
		const { manifest, chunks } = encodeSnapshot({
			version: "offline-starters",
			rows,
			keyOrder: VALID_FINGERPRINT_KEYS,
		})
		const path = join(dir, "snapshot.json")
		writeFileSync(
			path,
			JSON.stringify({
				manifest,
				chunks: chunks.map((c) => Buffer.from(c).toString("base64")),
				titles: Object.fromEntries(
					rows.map((r, i) => [r.pointId, `Title ${i + 1}`]),
				),
			}),
		)
		let printed: unknown[] = []
		let info = ""
		t.mock.method(console, "table", (rows: unknown[]) => {
			printed = rows
		})
		t.mock.method(console, "info", (text: string) => {
			info = text
		})
		const previousArgv = process.argv
		try {
			process.argv = [
				process.execPath,
				"scripts/inspect-discover-starters.ts",
				path,
			]
			await import("./inspect-discover-starters.ts")
		} finally {
			process.argv = previousArgv
		}
		assert.match(info, /12 titles/)
		assert.match(info, /origin is the first production country/)
		assert.equal(printed.length, 12)
		assert.match(JSON.stringify(printed), /Title 12/)
		assert.match(JSON.stringify(printed), /movie/)
		assert.match(JSON.stringify(printed), /show/)
		assert.match(JSON.stringify(printed), /origin/)
		assert.match(JSON.stringify(printed), /mood/)
	} finally {
		rmSync(dir, { recursive: true, force: true })
	}
})
