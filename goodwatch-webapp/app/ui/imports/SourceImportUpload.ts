import { IMPORT_MAX_BYTES, type ImportSource } from "~/domain/imports"

/** Builds the native import endpoint's multipart request after browser-side validation. */
export function buildSourceImportUpload(
	source: ImportSource,
	file: File,
): FormData {
	if (source === "csv" && !/\.csv$/i.test(file.name))
		throw new Error("Choose a CSV file in Letterboxd import format.")
	if (
		source !== "csv" &&
		!/\.zip$/i.test(file.name) &&
		!["application/zip", "application/x-zip-compressed"].includes(file.type)
	)
		throw new Error(
			"Choose the ZIP file you downloaded from Letterboxd or Trakt.",
		)
	if (file.size > IMPORT_MAX_BYTES)
		throw new Error(
			`That file is larger than ${Math.round(IMPORT_MAX_BYTES / 1024 / 1024)} MB. Choose a smaller export file.`,
		)
	if (file.size === 0) throw new Error("That file is empty.")
	const body = new FormData()
	body.append("source", source)
	body.append("file", file)
	return body
}
