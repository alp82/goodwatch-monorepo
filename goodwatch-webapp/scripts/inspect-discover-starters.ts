// Offline only; reads the portable --file output of write-title-snapshot.ts. No env file or services needed.
// npx vite-node --config scripts/arena-vite.config.mjs scripts/inspect-discover-starters.ts /tmp/title-snapshot.json
import { readFile } from "node:fs/promises"
import { starterTitleKeys } from "../app/server/discover-starter-titles"
import {
	type Manifest,
	joinChunks,
} from "../app/server/title-snapshot/format.server"
import { buildSnapshot } from "../app/server/title-snapshot/snapshot.server"

const path = process.argv[2]
if (!path)
	throw new Error("Usage: inspect-discover-starters.ts <snapshot.json>")
const file = JSON.parse(await readFile(path, "utf8")) as {
	manifest: Manifest
	chunks: string[]
	titles?: Record<string, string>
}
const snapshot = buildSnapshot(
	file.manifest,
	joinChunks(
		file.manifest,
		file.chunks.map((s) => Buffer.from(s, "base64")),
	),
)
const keys = starterTitleKeys(snapshot)
console.table(
	keys.map((key) => {
		const facts = snapshot.factsAt(snapshot.rowOf(key))
		return {
			key,
			title: file.titles?.[key] ?? "(name unavailable)",
			kind: facts.mediaType,
			origin: facts.origin ?? "Unknown",
			mood: facts.moods[0] ?? "None",
		}
	}),
)
console.info(
	`${keys.length} titles; origin is the first production country, with original language as fallback.`,
)
