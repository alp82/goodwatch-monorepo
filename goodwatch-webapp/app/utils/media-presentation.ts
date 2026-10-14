import {
	normalizeLanguageSetting,
	type MediaLanguage,
} from "./media-language.ts"

export type FieldSource = "localized" | "original" | "canonical"
export interface FieldPresentation {
	/** Actual BCP 47 language, or und when the source cannot establish it. */
	language: string
	source: FieldSource
	fallback: boolean
	translationLocale?: string
}
export interface MediaPresentation {
	language: MediaLanguage
	title: FieldPresentation
	poster: FieldPresentation
	overview: FieldPresentation
	tagline: FieldPresentation
}
export interface PresentedMedia {
	prosePresentation?: import("./prose-overlay-core").ProsePresentation
	canonical_title?: string
	presentation?: MediaPresentation
}
export const presentationLanguage = (
	value: string | null | undefined,
): MediaLanguage => {
	const normalized = normalizeLanguageSetting(value ?? "en")
	return normalized === "browser" ? "en" : normalized
}
export function mediaLanguageUrl(url: string, language: string): string {
	const parsed = new URL(url, "https://goodwatch.invalid")
	parsed.searchParams.set("displayLanguage", presentationLanguage(language))
	return parsed.pathname + parsed.search
}
/** Stable slugs use canonical names even when a displayed label is translated. */
export const canonicalMediaTitle = (media: {
	title?: string | null
	canonical_title?: string
}) => media.canonical_title ?? media.title ?? ""

/** UI adapters can read provenance without widening every legacy card shape. */
export function mediaFieldLanguage(
	value: unknown,
	field: "title" | "poster" | "overview" | "tagline" = "title",
): string {
	const media = value as PresentedMedia | null | undefined
	return media?.presentation?.[field]?.language ?? "en"
}

export interface LocalizedTitlePayload {
	essence_text?: string | null
	essence_tags?: string[] | null
	prosePresentation?: import("./prose-overlay-core").ProsePresentation
	media_type: "movie" | "show"
	tmdb_id: number
	canonical_title: string
	title: string
	poster_path: string | null
	overview: string | null
	synopsis: string | null
	tagline: string | null
	presentation: MediaPresentation
}
export interface LocalizedTitleResponse {
	title: LocalizedTitlePayload
}
export const localizedTitleUrl = (
	type: "movie" | "show",
	id: number,
	language: string,
) => mediaLanguageUrl(`/api/media-title?type=${type}&id=${id}`, language)
export const localizedTitleQueryKey = (
	type: "movie" | "show",
	id: number,
	language: string,
) => ["media-title", type, id, presentationLanguage(language)] as const
