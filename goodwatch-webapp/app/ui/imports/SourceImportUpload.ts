import {
	IMPORT_MAX_BYTES,
	IMPORT_SOURCE_FILE,
	type ImportSource,
} from "~/domain/imports"

/** Builds the import endpoint's multipart request after browser-side validation. */
export function buildSourceImportUpload(
	source: ImportSource,
	file: File,
	wishlist?: File,
): FormData {
	const csv = IMPORT_SOURCE_FILE[source] === "csv"
	if (wishlist && source !== "movielens")
		throw new Error("Only MovieLens accepts an optional wishlist file.")
	for (const upload of wishlist ? [file, wishlist] : [file]) {
		if (csv && !/\.csv$/i.test(upload.name))
			throw new Error("Choose a CSV export file.")
		if (
			!csv &&
			!/\.zip$/i.test(upload.name) &&
			!["application/zip", "application/x-zip-compressed"].includes(upload.type)
		)
			throw new Error(
				"Choose the ZIP file you downloaded from Letterboxd or Trakt.",
			)
		if (!upload.size) throw new Error("That file is empty.")
	}
	if (file.size + (wishlist?.size ?? 0) > IMPORT_MAX_BYTES)
		throw new Error(
			wishlist
				? `The combined export is larger than ${Math.round(IMPORT_MAX_BYTES / 1024 / 1024)} MB. Choose a smaller export.`
				: `That file is larger than ${Math.round(IMPORT_MAX_BYTES / 1024 / 1024)} MB. Choose a smaller export ${IMPORT_SOURCE_FILE[source].toUpperCase()} file.`,
		)
	const body = new FormData()
	body.append("source", source)
	body.append("file", file)
	if (wishlist) body.append("wishlist", wishlist)
	return body
}
