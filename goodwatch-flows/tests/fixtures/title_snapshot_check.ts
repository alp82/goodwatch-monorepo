// Checks a title snapshot the Python publisher encoded with the webapp's own decoder, and encodes the same rows with
// the webapp's encoder to compare the bytes. Run by tests/test_title_snapshot.py:
//
//   node tests/fixtures/title_snapshot_check.ts <dir with manifest.json, rows.json, chunk-<n>.bin>
//
// Prints one JSON line: the decoded columns' first values and whether the webapp's encoding is identical.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
	checkManifest,
	encodeSnapshot,
	joinChunks,
	type SnapshotRow,
} from "../../../goodwatch-webapp/app/server/title-snapshot/format.server.ts"
import { VALID_FINGERPRINT_KEYS } from "../../../goodwatch-webapp/app/server/utils/fingerprint.ts"

const dir = process.argv[2]
const manifest = checkManifest(
	JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")),
	VALID_FINGERPRINT_KEYS,
)
const chunks = Array.from(
	{ length: manifest.chunks },
	(_, n) => new Uint8Array(readFileSync(join(dir, `chunk-${n}.bin`))),
)
const columns = joinChunks(manifest, chunks)

const rows = JSON.parse(readFileSync(join(dir, "rows.json"), "utf8")) as SnapshotRow[]
const webapp = encodeSnapshot({
	version: manifest.version,
	rows,
	keyOrder: VALID_FINGERPRINT_KEYS,
	builtAt: new Date(manifest.builtAt),
})

const row = (r: number) => ({
	pointId: columns.pointIds[r],
	genres: columns.genres[r],
	releaseDay: columns.releaseDays[r],
	votes: columns.votes[r],
	popularity: columns.popularity[r],
	fingerprint: Array.from(columns.fingerprints.subarray(r * 74, r * 74 + 74)),
	score: columns.scores[r],
	origin: columns.origins[r],
	flags: columns.flags[r],
})

console.log(
	JSON.stringify({
		count: columns.count,
		rows: Array.from({ length: columns.count }, (_, r) => row(r)),
		sameSha256: webapp.manifest.sha256 === manifest.sha256,
		sameGenres:
			JSON.stringify(webapp.manifest.genres) === JSON.stringify(manifest.genres),
		sameOrigins:
			JSON.stringify(webapp.manifest.origins) ===
			JSON.stringify(manifest.origins),
	}),
)
