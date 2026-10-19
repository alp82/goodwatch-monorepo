import type { ImportResultSectionKey } from "~/domain/import-result"
import type {
	ImportOptions,
	ImportOutcome,
	ImportSource,
	ImportSummary,
	ParsedImport,
} from "~/domain/imports"
import { confirmImport, undoImport } from "./apply.server.ts"
import {
	getImportRow,
	listImportRows,
	listItems,
	skippedCsv,
	summarize,
} from "./store.server.ts"

export const previewImport = async (
	userId: string,
	source: ImportSource,
	fileName: string,
	bytes: Uint8Array,
	wishlist?: Uint8Array,
) =>
	source === "tvtime"
		? (await import("./resolution-runtime.server.ts")).previewTvtime(
				userId,
				fileName,
				bytes,
			)
		: (await import("./preview.server.ts")).createPreview(
				userId,
				source,
				fileName,
				bytes,
				wishlist,
			)
/** Server-only normalized adapter boundary, sharing the upload preview/apply/receipt/undo. */
export const previewParsedImport = async (
	userId: string,
	fileName: string,
	parsed: ParsedImport,
	fileHash?: string,
) =>
	(await import("./preview.server.ts")).createParsedPreview(
		userId,
		fileName,
		structuredClone(parsed),
		fileHash,
	)

export const listImports = async (userId: string): Promise<ImportSummary[]> =>
	(await listImportRows(userId)).map(summarize)
export const getImport = async (userId: string, id: string) => {
	const row = await getImportRow(userId, id)
	return {
		...summarize(row),
		...(row.source === "tvtime"
			? {
					resolution: await (
						await import("./resolution-runtime.server.ts")
					).resolutionSummary(userId, id),
				}
			: {}),
	}
}
export const getImportItems = (
	userId: string,
	id: string,
	outcome: ImportOutcome | undefined,
	offset: number,
	limit: number,
) => listItems(userId, id, outcome, offset, limit)
/** What the import changed, or what its Undo changed back, grouped by title. */
export const getImportResult = async (userId: string, id: string) =>
	(await import("./result.server.ts")).importResult(userId, id)
export const getImportResultPage = async (
	userId: string,
	id: string,
	section: ImportResultSectionKey,
	offset: number,
	limit: number,
) =>
	(await import("./result.server.ts")).importResultPage(
		userId,
		id,
		section,
		offset,
		limit,
	)
export const getSkippedCsv = (userId: string, id: string) =>
	skippedCsv(userId, id)
export { confirmImport, undoImport }
export type { ImportOptions }

/** Fetch adapters return only observations, never credentials or raw API responses. */
export const previewFetchedImport = (
	userId: string,
	displayName: string,
	observations: ParsedImport,
) => previewParsedImport(userId, displayName, observations)

/** A member's explicit catalog choices produce a new immutable preview. */
export const resolveWishlistImport = async (
	userId: string,
	id: string,
	input: unknown,
) =>
	(await import("./wishlist-resolution.server.ts")).resolveWishlistImport(
		userId,
		id,
		input,
	)

export const getWishlistMatchingGroups = async (
	userId: string,
	id: string,
	offset = 0,
) =>
	(await import("./wishlist-resolution.server.ts")).getWishlistMatchingGroups(
		userId,
		id,
		offset,
	)
export const searchWishlistMatches = async (
	userId: string,
	id: string,
	input: unknown,
) =>
	(await import("./wishlist-resolution.server.ts")).searchWishlistMatches(
		userId,
		id,
		input,
	)

export const getWishlistMatchGroup = async (
	userId: string,
	id: string,
	index: number,
) =>
	(await import("./wishlist-resolution.server.ts")).getWishlistMatchGroup(
		userId,
		id,
		index,
	)

/** Read-only proposals; only explicit member choices change an import preview. */
export const getWishlistSuggestions = async (
	userId: string,
	id: string,
	offset = 0,
	signal?: AbortSignal,
) =>
	(await import("./wishlist-suggestions.server.ts")).getWishlistSuggestions(
		userId,
		id,
		offset,
		signal,
	)

export const acceptSuggestedImport = (
	userId: string,
	id: string,
	input: unknown,
) =>
	import("./resolution-runtime.server.ts").then((runtime) =>
		runtime.acceptResolutionSuggestions(userId, id, input),
	)
export const discardImport = (userId: string, id: string) =>
	import("./resolution-runtime.server.ts").then((runtime) =>
		runtime.cancelResolution(userId, id),
	)
