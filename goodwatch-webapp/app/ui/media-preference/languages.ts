// Which languages a country offers alongside it in the header pair's question, and the names of languages. The
// offered languages and the browser negotiation are `MEDIA_LANGUAGES` and `negotiateMediaLanguage` of
// `~/utils/media-language`. The country suggestions are not a country-language policy (see
// docs/implementation/media-language-decisions.md): they only feed the unticked offer, from the offered set.
import { languageName } from "~/utils/display-names"
import { MEDIA_LANGUAGES } from "~/utils/media-language"

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
	return (SUGGESTED[country] ?? []).filter(
		(l) => l !== shown && (MEDIA_LANGUAGES as readonly string[]).includes(l),
	)
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

/** The country whose flag stands for a language on Settings: where most of its titles come from. */
const LANGUAGE_FLAG: Record<string, string> = {
	en: "US",
	de: "DE",
	fr: "FR",
	es: "ES",
	it: "IT",
	"pt-BR": "BR",
	"pt-PT": "PT",
	ja: "JP",
	ko: "KR",
	"zh-Hans": "CN",
	"zh-Hant": "TW",
	pl: "PL",
	ru: "RU",
	ar: "SA",
}
export const languageFlag = (code: string) => LANGUAGE_FLAG[code] ?? "US"
