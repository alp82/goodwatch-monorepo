import {
	IMPORT_SOURCE_NAMES,
	type ImportSource,
	isFileImportSource,
} from "~/domain/imports"

export function sourceImportCopy(source: ImportSource) {
	const file = isFileImportSource(source)
	const data = file ? "export" : `${IMPORT_SOURCE_NAMES[source]} data`
	const connect = `Connect ${IMPORT_SOURCE_NAMES[source]} again`
	// A wishlist import reads a file that isn't always an export.
	if (source === "wishlist")
		return {
			data: "file",
			details: "About this file",
			conflict: "",
			conflictDetail: "",
			watchDates: "",
			restart: "Choose another file",
			another: "Import another file",
			newer: "Upload a newer file",
		}
	return {
		data,
		details: file ? "Check these export details" : "Check these import details",
		conflict: file ? "Use the export instead" : `Use ${data} instead`,
		conflictDetail: file
			? "Replaces conflicting ratings and reviews with the source export."
			: `Replaces conflicting ratings and reviews with ${data}.`,
		watchDates: file
			? "Uses each exported watch date with its stated precision."
			: "Uses each source watch date with its stated precision.",
		restart: file ? "Choose another file" : connect,
		another: file ? "Import another export" : connect,
		newer: file ? "Upload a newer export" : connect,
	}
}
