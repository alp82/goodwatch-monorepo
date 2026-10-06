// Loading the title snapshot's ratings sidecar (what the age and content filter reads). The sidecar is optional, and
// nothing about it may keep the snapshot from loading: whatever goes wrong here, the snapshot loads without ratings.
// Redis reads are separate from decoding so the production loader can check the sidecar in its worker.
import {
	type Manifest,
	type RatingColumns,
	type RatingsManifest,
	SnapshotRefused,
	checkRatingsManifest,
	joinRatingsChunks,
	ratingsChunkKey,
} from "./format.server"

/**
 * The ratings chunks of a snapshot as Redis holds them, with their checked manifest, or null without them: the
 * manifest names none or a bad one, a chunk is missing, or Redis fails while reading them. Each is logged once per
 * load, and the snapshot then stays without ratings until the next version. The checksum and the column checks come
 * later, in prepareSnapshot or loadRatings.
 *
 * With `enabled` false it reads nothing: while REC_AGE_FILTER is off for everyone the ratings (about 16 MB, and as
 * much again while they load) would sit in every instance's memory unused. Flags are read when the container starts,
 * so turning the flag on already takes a restart, and the restart loads the ratings.
 */
export async function readRatingsChunks(
	redis: { getBuffer(key: string): Promise<Uint8Array | null> },
	manifest: Manifest,
	enabled: boolean,
): Promise<{ manifest: RatingsManifest; chunks: Uint8Array[] } | null> {
	if (!enabled) return null
	if (manifest.ratings === undefined || manifest.ratings === null) return null
	try {
		const ratings = checkRatingsManifest(manifest.ratings)
		const chunks = await Promise.all(
			Array.from({ length: ratings.chunks }, (_, n) =>
				redis.getBuffer(ratingsChunkKey(manifest.version, n)),
			),
		)
		const missing = chunks.findIndex((chunk) => !chunk)
		if (missing >= 0)
			throw new SnapshotRefused(
				`Title snapshot ratings refused: chunk ${missing} is missing`,
			)
		return { manifest: ratings, chunks: chunks as Uint8Array[] }
	} catch (error) {
		console.error(
			`Title snapshot ${manifest.version} loads without ratings:`,
			error instanceof SnapshotRefused ? error.message : error,
		)
		return null
	}
}

/**
 * The ratings of a snapshot, read and decoded on the calling thread, or null without them: the manifest names none, a
 * chunk is missing, they are refused (a bad shape, size, or checksum), or Redis fails while reading them. Each is
 * logged once per load. The webapp's loader reads with readRatingsChunks and decodes in its worker instead.
 */
export async function loadRatings(
	redis: { getBuffer(key: string): Promise<Uint8Array | null> },
	manifest: Manifest,
	enabled: boolean,
): Promise<RatingColumns | null> {
	const input = await readRatingsChunks(redis, manifest, enabled)
	if (!input) return null
	try {
		return joinRatingsChunks(input.manifest, manifest.count, input.chunks)
	} catch (error) {
		console.error(
			`Title snapshot ${manifest.version} loads without ratings:`,
			error instanceof SnapshotRefused ? error.message : error,
		)
		return null
	}
}
