import {
	type FileImportSource,
	IMPORT_MAX_BYTES,
	IMPORT_SOURCE_UPLOAD,
} from "~/domain/imports"

/** Builds the import endpoint's multipart request after browser-side validation. */
export function buildSourceImportUpload(
	source: FileImportSource,
	file: File,
	wishlist?: File,
): FormData {
	const descriptor = IMPORT_SOURCE_UPLOAD[source]
	if (wishlist && !descriptor.optionalWishlist)
		throw new Error("Only MovieLens accepts an optional wishlist file.")
	for (const upload of wishlist ? [file, wishlist] : [file]) {
		if (
			!descriptor.extensions.some((extension) =>
				upload.name.toLowerCase().endsWith(extension),
			) &&
			!descriptor.acceptedMimeTypes.includes(upload.type)
		)
			throw new Error(descriptor.invalidFileMessage)
		if (!upload.size) throw new Error("That file is empty.")
	}
	if (file.size + (wishlist?.size ?? 0) > IMPORT_MAX_BYTES)
		throw new Error(
			wishlist
				? `The combined export is larger than ${Math.round(IMPORT_MAX_BYTES / 1024 / 1024)} MB. Choose a smaller export.`
				: `That file is larger than ${Math.round(IMPORT_MAX_BYTES / 1024 / 1024)} MB. ${descriptor.oversizeHint}`,
		)
	const body = new FormData()
	body.append("source", source)
	body.append("file", file)
	if (wishlist) body.append("wishlist", wishlist)
	return body
}
