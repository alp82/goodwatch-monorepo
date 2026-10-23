import { imdbCsvKind, type ImdbFileChoice } from "../../domain/imdb-file.ts"
import type { ImdbImportSummary } from "../../domain/imdb-import.ts"
import type { ImportSummary } from "../../domain/imports.ts"
import { ImdbImportError, readImdbListFile } from "./file.server.ts"

/** Ratings keep their existing API/storage. List imports use the shared kinds, conflict and Undo contract. */
export async function createImdbFilePreview(
	userId: string,
	fileName: string,
	csv: string,
	listKind?: ImdbFileChoice,
): Promise<ImdbImportSummary | ImportSummary> {
	const kind = imdbCsvKind(csv)
	if (
		kind === "ratings" ||
		(kind === "legacy-ambiguous" && listKind === "ratings")
	) {
		const { createPreview } = await import("./preview.server.ts")
		return createPreview(userId, fileName, csv)
	}
	if (kind === "legacy-ambiguous" && !listKind)
		throw new ImdbImportError(
			400,
			"This may be an old ratings or Watchlist export. Choose Ratings or My Watchlist before previewing it.",
		)
	if (kind !== "list" && kind !== "legacy-ambiguous")
		throw new ImdbImportError(
			400,
			"Choose an IMDb Ratings, Watchlist or title-list CSV export.",
		)
	if (!listKind || listKind === "ratings")
		throw new ImdbImportError(
			400,
			"IMDb uses the same columns for Watchlist and custom lists. Choose which list this file came from.",
		)
	const parsed = readImdbListFile(csv, listKind)
	const { createParsedPreview } = await import("../imports/preview.server.ts")
	return createParsedPreview(userId, fileName, parsed)
}
