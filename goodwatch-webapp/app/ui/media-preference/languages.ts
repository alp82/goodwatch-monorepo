// The titles languages the header pair offers, their names, and which languages a country offers alongside it.
//
// PLACEHOLDER until the backend's resolver lands: the list mirrors MEDIA_LANGUAGES of `app/utils/media-language.ts`
// on branch feat/media-language, and should be replaced by an import of it (with its `negotiateMediaLanguage` in
// place of `browserLanguageOf`). The country suggestions are not product policy either (see the handover's open
// decisions): they only feed the unticked offer under the pair.
import { languageName } from "~/utils/display-names"

export const TITLE_LANGUAGES = [
	"en",
	"de",
	"fr",
	"es",
	"it",
	"pt-BR",
	"pt-PT",
	"ja",
	"ko",
	"zh-Hans",
	"zh-Hant",
	"pl",
	"ru",
	"ar",
] as const

const SUGGESTED: Record<string, string[]> = {
	US: ["en"],
	GB: ["en"],
	IE: ["en"],
	AU: ["en"],
	NZ: ["en"],
	CA: ["en", "fr"],
	DE: ["de"],
	AT: ["de"],
	CH: ["de", "fr", "it"],
	FR: ["fr"],
	BE: ["fr"],
	ES: ["es"],
	MX: ["es"],
	AR: ["es"],
	CO: ["es"],
	CL: ["es"],
	IT: ["it"],
	BR: ["pt-BR"],
	PT: ["pt-PT"],
	JP: ["ja"],
	KR: ["ko"],
	CN: ["zh-Hans"],
	TW: ["zh-Hant"],
	HK: ["zh-Hant"],
	PL: ["pl"],
	RU: ["ru"],
	SA: ["ar"],
	AE: ["ar"],
	EG: ["ar"],
}

/** The languages a country offers alongside it, without the one the page already shows. */
export function countryOffers(country: string, shown: string): string[] {
	return (SUGGESTED[country] ?? []).filter((l) => l !== shown)
}

/** The first offered language of the browser's list, matching a region-less tag to its language, else English. */
export function browserLanguageOf(tags: readonly string[]): string {
	for (const raw of tags) {
		const tag = raw.trim()
		const exact = TITLE_LANGUAGES.find(
			(l) => l.toLowerCase() === tag.toLowerCase(),
		)
		if (exact) return exact
		const [base, ...rest] = tag.toLowerCase().split("-")
		if (base === "zh")
			return rest.some((p) => ["hant", "tw", "hk", "mo"].includes(p))
				? "zh-Hant"
				: "zh-Hans"
		if (base === "pt") return rest.includes("pt") ? "pt-PT" : "pt-BR"
		const match = TITLE_LANGUAGES.find((l) => l === base)
		if (match) return match
	}
	return "en"
}

/** "German": the interface stays English. */
export const englishName = (code: string) => languageName(code, "en")

/** "Deutsch", or nothing when it is the English name. */
export function ownName(code: string) {
	const own = languageName(code, code)
	return own.toLowerCase() === englishName(code).toLowerCase() ? "" : own
}

/** "DE", "PT", "ZH": the language part of the code, for the pair on a phone. */
export const shortCode = (code: string) => code.split("-")[0].toUpperCase()
