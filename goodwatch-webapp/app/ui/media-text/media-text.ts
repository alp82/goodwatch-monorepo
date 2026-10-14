// The HTML attributes for one piece of media text (a title, a tagline, a description) in the language it is in.
// The interface stays English and left to right; a piece of content carries its own language, so that:
// - the browser picks fitting system fonts for its script (Japanese, Simplified or Traditional Chinese share code
//   points and differ in glyphs: only `lang` tells them apart) and hyphenates and breaks lines by its rules;
// - Arabic runs right to left inside its own box (`dir` also isolates it from the English text around it);
// - a script whose marks reach far above and below the line gets room inside a clipping box (see tailwind.css).
// No web font is loaded for any of this: the system's fonts cover these scripts.

/** A field of a title as the server laid it out: its text with `presentation.<field>.language`. */
export function presentedText(
	media: { presentation?: { [F in PresentedField]?: { language: string } } } | null | undefined,
	field: PresentedField,
	text: string | null | undefined,
): MediaTextValue {
	// Without presentation metadata the field is the canonical (English) catalog text.
	return { text: text ?? "", lang: media?.presentation?.[field]?.language ?? "en" }
}
export type PresentedField = "title" | "poster" | "overview" | "tagline"

/** An episode's or season's name or description with `textPresentation.<field>.language`. */
export const episodeText = (
	episode: {
		name?: string | null
		overview?: string | null
		textPresentation?: { name: { language: string }; overview: { language: string } }
	},
	field: "name" | "overview",
): MediaTextValue => ({
	text: episode[field] ?? "",
	lang: episode.textPresentation?.[field].language ?? "en",
})

/** A field of media text with the language it is actually in, as the localized data gives it. */
export interface MediaTextValue {
	text: string
	/** A BCP 47 tag ("ja", "zh-Hant", "pt-BR"); null or missing when unknown. */
	lang?: string | null
}

const RIGHT_TO_LEFT = new Set(["ar", "fa", "he", "ur", "yi", "ps", "dv", "ckb"])
/** Scripts whose marks overflow a tight line box: clipped by `truncate` or `line-clamp` without room. */
const TALL = new Set([
	"ar",
	"fa",
	"ur",
	"ps",
	"th",
	"lo",
	"my",
	"hi",
	"bn",
	"ta",
])

export interface MediaTextAttributes {
	lang?: string
	dir?: "rtl" | "auto"
	"data-media-script"?: "tall"
}

export function mediaTextAttributes(lang?: string | null): MediaTextAttributes {
	const tag = lang?.trim()
	// Unknown language: say nothing about it, and let the text's first letters decide its direction.
	if (!tag || !/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(tag))
		return { dir: "auto" }
	const base = tag.split("-")[0].toLowerCase()
	// "und": the source could not establish the language. Say so, and let the text decide its direction.
	if (base === "und") return { lang: "und", dir: "auto" }
	return {
		lang: tag,
		...(RIGHT_TO_LEFT.has(base) && { dir: "rtl" as const }),
		...(TALL.has(base) && { "data-media-script": "tall" as const }),
	}
}

/** The same attributes as HTML, for surfaces built as strings (the related map): ` lang="ar-SA" dir="rtl"`. */
export function mediaTextHtml(lang?: string | null): string {
	return Object.entries(mediaTextAttributes(lang))
		.map(([name, value]) => ` ${name}="${String(value).replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`)}"`)
		.join("")
}
