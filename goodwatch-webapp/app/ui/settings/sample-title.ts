// Whether the sample title on the Show titles in tile is in the chosen language. A title without a translation comes
// back in another language (the original, or English), which the tile mustn't show as the chosen one.

// The language a code is written in: its language part, except where script or region tells two offered languages
// apart (Simplified and Traditional Chinese, Brazilian and European Portuguese).
function writtenIn(code: string) {
	const [language, rest = ""] = code.toLowerCase().split("-")
	if (language === "zh")
		return ["tw", "hk", "mo", "hant"].includes(rest) ? "zh-hant" : "zh-hans"
	if (language === "pt") return rest === "br" ? "pt-br" : "pt-pt"
	return language
}

export function titleIsIn(
	title: { language: string; source: string; fallback: boolean } | undefined,
	/** The chosen titles language: "de", "zh-Hans", "pt-BR". */
	language: string,
) {
	if (!title) return false
	// A translation answers with its region ("de-DE", "zh-CN"), so what it is written in is what to compare.
	return !title.fallback || writtenIn(title.language) === writtenIn(language)
}
