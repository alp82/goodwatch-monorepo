import { query } from "~/utils/crate"
import { createTropeReferenceReader } from "~/server/profile/trope-pages"
import { candidateCatalogReader } from "./build-reader"

// The background lane never occupies the shared four-wide profile catalog queue.
export const readCandidateCatalog = candidateCatalogReader(
	<T extends {}>(sql: string, params: (string | number | Date)[]) =>
		query<T>(sql, params, { timeoutMs: 15_000 }),
)
export const resolveCandidateReferences =
	createTropeReferenceReader(readCandidateCatalog)
