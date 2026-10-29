// Optional facts reads follow the ratings sidecar: failures are logged once per load.
// Both formats decode here: format 1 exposes sources: null; format 2 exposes five source columns.
import {
	type FactColumns,
	type FactsManifest,
	type Manifest,
	SnapshotRefused,
	checkFactsManifest,
	factsChunkKey,
	joinFactsChunks,
} from "./format.server"

/**
 * The facts chunks of a snapshot as Redis holds them, with their checked manifest, or null without them: the
 * manifest names none or a bad one, a chunk is missing, or Redis fails while reading them. Each is logged once per
 * load, and the snapshot then stays without facts until the next version. The checksum and the column checks come
 * later, in prepareSnapshot or loadFacts.
 */
export async function readFactsChunks(
	redis: { getBuffer(key: string): Promise<Uint8Array | null> },
	manifest: Manifest,
): Promise<{ manifest: FactsManifest; chunks: Uint8Array[] } | null> {
	if (manifest.facts === undefined || manifest.facts === null) return null
	try {
		const facts = checkFactsManifest(manifest.facts)
		const chunks = await Promise.all(
			Array.from({ length: facts.chunks }, (_, n) =>
				redis.getBuffer(factsChunkKey(manifest.version, n)),
			),
		)
		const missing = chunks.findIndex((chunk) => !chunk)
		if (missing >= 0)
			throw new SnapshotRefused(
				`Title snapshot facts refused: chunk ${missing} is missing`,
			)
		return { manifest: facts, chunks: chunks as Uint8Array[] }
	} catch (error) {
		console.error(
			`Title snapshot ${manifest.version} loads without facts:`,
			error instanceof SnapshotRefused ? error.message : error,
		)
		return null
	}
}

/**
 * The facts of a snapshot, read and decoded on the calling thread, or null without them: the manifest names none, a
 * chunk is missing, they are refused (a bad shape, size, or checksum), or Redis fails while reading them. Each is
 * logged once per load. The webapp's loader reads with readFactsChunks and decodes in its worker instead.
 */
export async function loadFacts(
	redis: { getBuffer(key: string): Promise<Uint8Array | null> },
	manifest: Manifest,
): Promise<FactColumns | null> {
	const input = await readFactsChunks(redis, manifest)
	if (!input) return null
	try {
		return joinFactsChunks(input.manifest, manifest.count, input.chunks)
	} catch (error) {
		console.error(
			`Title snapshot ${manifest.version} loads without facts:`,
			error instanceof SnapshotRefused ? error.message : error,
		)
		return null
	}
}
