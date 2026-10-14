import { hasExpectedMediaScript } from "./media-script.ts"
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
	canonical_title?: string
	presentation?: MediaPresentation
}
/** Preserve optional provenance through thin DTO adapters without adding fields to legacy payloads. */
export function copyMediaPresentation(value: unknown): PresentedMedia {
	const media = value as PresentedMedia | null | undefined
	return {
		...(media?.canonical_title !== undefined
			? { canonical_title: media.canonical_title }
			: {}),
		...(media?.presentation ? { presentation: media.presentation } : {}),
	}
}
/** A cached presentation is reusable only if its visible field text still agrees with its actual language. */
export function hasValidMediaPresentation(
	value: unknown,
	language: string,
): value is PresentedMedia & {
	canonical_title: string
	presentation: MediaPresentation
} {
	if (!value || typeof value !== "object") return false
	const row = value as Record<string, unknown> & PresentedMedia
	const metadata = row.presentation
	if (
		typeof row.canonical_title !== "string" ||
		metadata?.language !== presentationLanguage(language)
	)
		return false
	if (
		!["title", "poster", "overview", "tagline"].every((field) => {
			const info = metadata[field as keyof Omit<MediaPresentation, "language">]
			return (
				!!info &&
				typeof info.language === "string" &&
				typeof info.fallback === "boolean" &&
				["canonical", "original", "localized"].includes(info.source)
			)
		})
	)
		return false
	return (["title", "overview", "tagline"] as const).every((field) => {
		const text = row[field] ?? (field === "overview" ? row.synopsis : undefined)
		if (typeof text !== "string") return true
		const info = metadata[field]
		if (!info?.language || !hasExpectedMediaScript(text, info.language))
			return false
		if (info.source === "canonical") return true
		const sameBase =
			info.language.toLowerCase().split("-")[0] === language.split("-")[0]
		if (info.source === "original")
			return sameBase && hasExpectedMediaScript(text, language)
		return (
			info.source === "localized" &&
			sameBase &&
			normalizeLanguageSetting(info.language) === metadata.language &&
			hasExpectedMediaScript(text, language)
		)
	})
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
) =>
	mediaLanguageUrl(
		`/api/media-title?type=${type}&id=${id}&presentationVersion=4`,
		language,
	)
export const localizedTitleQueryKey = (
	type: "movie" | "show",
	id: number,
	language: string,
) => ["media-title-v4", type, id, presentationLanguage(language)] as const
