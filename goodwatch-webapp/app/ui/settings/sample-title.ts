// Whether the sample title on the Show titles in tile is in the chosen language. A title without a translation comes
// back in another language (the original, or English), which the tile mustn't show as the chosen one.

const base = (code: string) => code.split("-")[0].toLowerCase()

export function titleIsIn(
	title: { language: string; source: string; fallback: boolean } | undefined,
	/** The chosen titles language: "de", "zh-Hans", "pt-BR". */
	language: string,
) {
	if (!title) return false
	// A translation answers with its region ("de-DE", "zh-CN"), so its language part is what to compare.
	return !title.fallback || base(title.language) === base(language)
}
