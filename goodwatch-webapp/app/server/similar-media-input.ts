/** One selected title of the "similar to" search, as the URL sends it. */
export interface SimilarSelection {
	tmdbId: string;
	mediaType: "movie" | "show";
	[key: string]: unknown;
}

// The ids become part of the statement text and come from the URL: only entries with a numeric id and a known media
// type get there. Anything else, including text that isn't JSON or isn't a list, counts as no selection.
export function parseWithSimilar(withSimilarJson: string): SimilarSelection[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(withSimilarJson);
	} catch {
		return [];
	}
	if (!Array.isArray(parsed)) return [];
	return parsed.flatMap((entry) => {
		const tmdbId = String(entry?.tmdbId ?? "");
		const mediaType = entry?.mediaType;
		if (!/^\d{1,10}$/.test(tmdbId)) return [];
		if (mediaType !== "movie" && mediaType !== "show") return [];
		return [{ ...entry, tmdbId, mediaType }];
	});
}
