import { imdbCsvKind, type ImdbListKind } from "../../domain/imdb-file.ts"
import type { ImdbImportSummary } from "../../domain/imdb-import.ts"
import type { ImportSummary } from "../../domain/imports.ts"
import { ImdbImportError, readImdbListFile } from "./file.server.ts"

/** Ratings keep their existing API/storage. List imports use the shared kinds, conflict and Undo contract. */
export async function createImdbFilePreview(
	userId: string,
	fileName: string,
	csv: string,
	listKind?: ImdbListKind,
): Promise<ImdbImportSummary | ImportSummary> {
	const kind = imdbCsvKind(csv)
	if (kind === "ratings") {
		const { createPreview } = await import("./preview.server.ts")
		return createPreview(userId, fileName, csv)
	}
	if (kind !== "list")
		throw new ImdbImportError(
			400,
			"Choose an IMDb Ratings, Watchlist or title-list CSV export.",
		)
	if (!listKind)
		throw new ImdbImportError(
			400,
			"IMDb uses the same columns for Watchlist and custom lists. Choose which list this file came from.",
		)
	const parsed = readImdbListFile(csv, listKind)
	const { createParsedPreview } = await import("../imports/preview.server.ts")
	return createParsedPreview(userId, fileName, parsed)
}
