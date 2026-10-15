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
	(await import("./preview.server.ts")).createPreview(
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
export const getImport = async (userId: string, id: string) =>
	summarize(await getImportRow(userId, id))
export const getImportItems = (
	userId: string,
	id: string,
	outcome: ImportOutcome | undefined,
	offset: number,
	limit: number,
) => listItems(userId, id, outcome, offset, limit)
export const getSkippedCsv = (userId: string, id: string) =>
	skippedCsv(userId, id)
export { confirmImport, undoImport }
export type { ImportOptions }

/** Fetch adapters return only observations, never credentials or raw API responses. */
export const previewFetchedImport = async (
	userId: string,
	displayName: string,
	fetchObservations: () => Promise<ParsedImport>,
) =>
	(await import("./preview.server.ts")).createObservationPreview(
		userId,
		displayName,
		await fetchObservations(),
	)
