/** IMDb uses the same title-list columns for Watchlist and arbitrary lists. Intent needs a member choice. */
export type ImdbListKind = "watchlist" | "custom-list"
export function classifyImdbHeader(
	header: readonly string[],
): "ratings" | "list" | "unknown" {
	const names = header.map((value) =>
		value
			.trim()
			.replace(/^\uFEFF/, "")
			.toLowerCase(),
	)
	const columns = new Set(names)
	if (
		columns.size !== names.length ||
		!columns.has("const") ||
		!columns.has("title type")
	)
		return "unknown"
	if (columns.has("position") && columns.has("created")) return "list"
	return columns.has("your rating") || columns.has("you rated")
		? "ratings"
		: "unknown"
}
export function imdbCsvKind(csv: string) {
	const first = csv.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0]
	return classifyImdbHeader(
		first.split(",").map((value) => value.trim().replace(/^"|"$/g, "")),
	)
}
