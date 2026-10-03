// Loading the title snapshot's ratings sidecar (what the age and content filter reads). The sidecar is optional, and
// nothing about it may keep the snapshot from loading: whatever goes wrong here, the snapshot loads without ratings.
import {
	type Manifest,
	type RatingColumns,
	SnapshotRefused,
	checkRatingsManifest,
	joinRatingsChunks,
	ratingsChunkKey,
} from "./format.server"

/**
 * The ratings of a snapshot, or null without them: the manifest names none, a chunk is missing, they are refused (a
 * bad shape, size, or checksum), or Redis fails while reading them. Each is logged once per load, and the snapshot
 * then stays without ratings until the next version.
 *
 * With `enabled` false it reads nothing: while REC_AGE_FILTER is off for everyone the ratings (about 16 MB, and as
 * much again while they load) would sit in every instance's memory unused. Flags are read when the container starts,
 * so turning the flag on already takes a restart, and the restart loads the ratings.
 */
export async function loadRatings(
	redis: { getBuffer(key: string): Promise<Uint8Array | null> },
	manifest: Manifest,
	enabled: boolean,
): Promise<RatingColumns | null> {
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
		return joinRatingsChunks(ratings, manifest.count, chunks as Uint8Array[])
	} catch (error) {
		console.error(
			`Title snapshot ${manifest.version} loads without ratings:`,
			error instanceof SnapshotRefused ? error.message : error,
		)
		return null
	}
}
