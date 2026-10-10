import type {
	ImportOptions,
	ImportOutcome,
	ImportSource,
	ImportSummary,
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
) =>
	(await import("./preview.server.ts")).createPreview(
		userId,
		source,
		fileName,
		bytes,
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
