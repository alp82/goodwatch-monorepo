// Pure CPU preparation shared by the per-load worker and the development fallback.
import {
	type Manifest,
	type RatingsManifest,
	type RatingColumns,
	joinChunks,
	joinRatingsChunks,
} from "./format.server"
import { deriveSnapshot } from "./snapshot.server"

export interface PrepareInput {
	manifest: Manifest
	chunks: Uint8Array[]
	ratings: { manifest: RatingsManifest; chunks: Uint8Array[] } | null
}

export function prepareSnapshot(input: PrepareInput) {
	const columns = joinChunks(input.manifest, input.chunks)
	const derived = deriveSnapshot(input.manifest, columns)
	let ratings: RatingColumns | null = null
	let ratingsRefusal: string | null = null
	if (input.ratings) {
		try {
			ratings = joinRatingsChunks(
				input.ratings.manifest,
				input.manifest.count,
				input.ratings.chunks,
			)
		} catch (error) {
			ratingsRefusal = error instanceof Error ? error.message : String(error)
		}
	}
	return { columns, derived, ratings, ratingsRefusal }
}

/** Column views share buffers; transfer each backing buffer once. */
export function snapshotTransferables(value: unknown): ArrayBuffer[] {
	const buffers = new Set<ArrayBuffer>()
	function visit(value: unknown) {
		if (ArrayBuffer.isView(value)) buffers.add(value.buffer as ArrayBuffer)
		else if (value && typeof value === "object")
			for (const child of Object.values(value)) visit(child)
	}
	visit(value)
	return [...buffers]
}
