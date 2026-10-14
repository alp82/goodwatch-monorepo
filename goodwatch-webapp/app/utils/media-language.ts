/** Bounded presentation locales; country and query language are independent. */
export const MEDIA_LANGUAGES = [
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
export type MediaLanguage = (typeof MEDIA_LANGUAGES)[number]
export type LanguageSetting = MediaLanguage | "browser"
export interface LocalizationPair {
	country: string
	language: LanguageSetting
}
export interface LocalizationWriter {
	clientId: string
	sequence: number
}
export interface LocalizationRecord extends LocalizationPair {
	schemaVersion: 1
	/** Opaque saved-record revision, distinct from the client's request sequence. */
	version: string
	writer?: LocalizationWriter
	/** Cookie ownership: null proves a guest choice; absence is an older, unproved cookie. */
	sourceUserId?: string | null
}
export type CountryProvenance =
	| "url"
	| "account"
	| "cookie"
	| "legacy"
	| "browser"
	| "default"
	| "identity-header"
export interface EffectiveMediaContext {
	country: string
	countryProvenance: CountryProvenance
	language: MediaLanguage
	languageProvenance: "explicit" | "browser" | "default"
	languageSetting: LanguageSetting
}

export function normalizeCountry(value: unknown): string | null {
	if (typeof value !== "string") return null
	const country = value.trim().toUpperCase()
	return /^[A-Z]{2}$/.test(country) ? country : null
}

function canonicalTag(value: string): string | null {
	// No extensions/private-use tags; there is no translation coverage contract for them.
	if (!/^[a-z]{2,3}(?:-[a-z]{4})?(?:-(?:[a-z]{2}|\d{3}))?$/i.test(value))
		return null
	const [base, ...parts] = value.split("-")
	return [
		base.toLowerCase(),
		...parts.map((part) =>
			part.length === 4
				? part[0].toUpperCase() + part.slice(1).toLowerCase()
				: part.toUpperCase(),
		),
	].join("-")
}

function matchLanguage(raw: string): MediaLanguage | null {
	const tag = canonicalTag(raw.trim())
	if (!tag) return null
	const exact = MEDIA_LANGUAGES.find((locale) => locale === tag)
	if (exact) return exact
	const [base, ...parts] = tag.split("-")
	const script = parts.find((part) => part.length === 4)
	const region = parts.find((part) => part.length === 2 || /^\d{3}$/.test(part))
	if (base === "zh") {
		if (
			script === "Hant" ||
			(!script && (region === "TW" || region === "HK" || region === "MO"))
		)
			return "zh-Hant"
		if (script === "Hans" || !script) return "zh-Hans"
		return null
	}
	if (base === "pt") return "pt-BR"
	return MEDIA_LANGUAGES.find((locale) => locale === base) ?? null
}

/** Unsupported explicit values remain explicit, normalized to English. */
export const normalizeLanguageSetting = (value: string): LanguageSetting =>
	value === "browser" ? "browser" : (matchLanguage(value) ?? "en")

interface LanguageRange {
	tag: string
	quality: number
	index: number
}
function languageRanges(
	input: string | readonly string[] | null | undefined,
): LanguageRange[] {
	const header = Array.isArray(input) ? input.join(",") : (input ?? "")
	return (header as string)
		.slice(0, 8192)
		.split(",")
		.slice(0, 100)
		.flatMap((entry, index) => {
			const [raw, ...params] = entry.trim().split(";")
			const tag = raw === "*" ? "*" : canonicalTag(raw)
			if (!tag || params.length > 1) return []
			let quality = 1
			if (params.length) {
				const q = /^\s*q=(0(?:\.\d{0,3})?|1(?:\.0{0,3})?)\s*$/i.exec(params[0])
				if (!q) return []
				quality = Number(q[1])
			}
			return [{ tag, quality, index }]
		})
}

export function negotiateMediaLanguage(
	input: string | readonly string[] | null | undefined,
): {
	language: MediaLanguage
	languageProvenance: "browser" | "default"
} {
	const ranges = languageRanges(input)
	const allowed = (locale: MediaLanguage, requested: string) => {
		const specificity = requested === "*" ? 0 : requested.split("-").length
		return !ranges.some(
			(range) =>
				range.quality === 0 &&
				(range.tag === "*" ||
					locale.toLowerCase() === range.tag.toLowerCase() ||
					locale.toLowerCase().startsWith(range.tag.toLowerCase() + "-")) &&
				(range.tag === "*" ? 0 : range.tag.split("-").length) >= specificity,
		)
	}
	for (const range of ranges
		.filter((range) => range.quality > 0)
		.sort((a, b) => b.quality - a.quality || a.index - b.index)) {
		const locale =
			range.tag === "*"
				? MEDIA_LANGUAGES.find((locale) => allowed(locale, "*"))
				: matchLanguage(range.tag)
		if (locale && allowed(locale, range.tag))
			return { language: locale, languageProvenance: "browser" }
	}
	// Product default even when all supported languages (including English) were excluded.
	return { language: "en", languageProvenance: "default" }
}

export function parseLocalizationPair(value: unknown): LocalizationPair | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null
	const pair = value as Record<string, unknown>
	const country = normalizeCountry(pair.country)
	if (
		!country ||
		typeof pair.language !== "string" ||
		!pair.language.trim() ||
		pair.language.length > 64
	)
		return null
	return { country, language: normalizeLanguageSetting(pair.language) }
}
export function parseLocalizationRecord(
	value: unknown,
): LocalizationRecord | null {
	if (typeof value === "string") {
		try {
			value = JSON.parse(value)
		} catch {
			return null
		}
	}
	const pair = parseLocalizationPair(value)
	if (!pair) return null
	const record = value as Record<string, unknown>
	if (
		record.schemaVersion !== 1 ||
		typeof record.version !== "string" ||
		!/^[\w-]{1,80}$/.test(record.version)
	)
		return null
	let writer: LocalizationWriter | undefined
	if (record.writer !== undefined) {
		if (!record.writer || typeof record.writer !== "object") return null
		const candidate = record.writer as Record<string, unknown>
		if (
			typeof candidate.clientId !== "string" ||
			!/^[\w-]{8,80}$/.test(candidate.clientId) ||
			!Number.isSafeInteger(candidate.sequence) ||
			(candidate.sequence as number) < 0
		)
			return null
		writer = {
			clientId: candidate.clientId,
			sequence: candidate.sequence as number,
		}
	}
	if (
		record.sourceUserId !== undefined &&
		record.sourceUserId !== null &&
		(typeof record.sourceUserId !== "string" ||
			!/^[\w-]{1,128}$/.test(record.sourceUserId))
	)
		return null
	return {
		...pair,
		schemaVersion: 1,
		version: record.version,
		...(record.sourceUserId !== undefined
			? { sourceUserId: record.sourceUserId as string | null }
			: {}),
		...(writer ? { writer } : {}),
	}
}

export const LOCALIZATION_COOKIE = "gw_loc"
export function parseLocalizationCookie(
	header: string | null | undefined,
): LocalizationRecord | null {
	const values = (header ?? "")
		.split(";")
		.map((part) => part.trim())
		.filter((part) => part.startsWith(LOCALIZATION_COOKIE + "="))
	if (values.length !== 1) return null
	const value = values[0].slice(LOCALIZATION_COOKIE.length + 1)
	if (value.length > 2048) return null
	try {
		return parseLocalizationRecord(decodeURIComponent(value))
	} catch {
		return null
	}
}
export function serializeLocalizationCookie(
	record: LocalizationRecord,
	secure = true,
	sourceUserId?: string | null,
): string {
	const normalized = parseLocalizationRecord({
		...record,
		...(sourceUserId !== undefined ? { sourceUserId } : {}),
	})
	if (!normalized) throw new Error("Invalid localization record")
	return `${LOCALIZATION_COOKIE}=${encodeURIComponent(JSON.stringify(normalized))}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`
}

/** Pure resolver for SSR and prospective client previews. No persistence or country-to-language coupling. */
export function resolveEffectiveMediaContext({
	account,
	cookie,
	browserLanguages,
	urlCountry,
	legacyCountry,
	fallbackCountry = "US",
	fallbackCountryProvenance = "default",
}: {
	account?: LocalizationRecord | null
	cookie?: LocalizationRecord | null
	browserLanguages?: string | readonly string[] | null
	urlCountry?: string | null
	legacyCountry?: string | null
	fallbackCountry?: string
	fallbackCountryProvenance?: CountryProvenance
}): EffectiveMediaContext {
	const saved = account ?? cookie
	const choices: [unknown, CountryProvenance][] = [
		[urlCountry, "url"],
		[account?.country, "account"],
		[cookie?.country, "cookie"],
		[legacyCountry, "legacy"],
		[fallbackCountry, fallbackCountryProvenance],
	]
	const choice = choices.find(([country]) => normalizeCountry(country))!
	const languageSetting = saved?.language ?? "browser"
	const negotiated = negotiateMediaLanguage(browserLanguages)
	return {
		country: normalizeCountry(choice?.[0]) ?? "US",
		countryProvenance: choice?.[1] ?? "default",
		language:
			languageSetting === "browser" ? negotiated.language : languageSetting,
		languageProvenance:
			languageSetting === "browser"
				? negotiated.languageProvenance
				: "explicit",
		languageSetting,
	}
}

/** Only a guest-origin Keep (explicit confirmation of the whole pair) can be adopted. */
export function signInAdoption(
	account: LocalizationRecord | null,
	cookie: LocalizationRecord | null,
): LocalizationPair | null {
	if (account || !cookie || cookie.sourceUserId !== null) return null
	return {
		country: cookie.country,
		language: cookie.language,
	}
}

export interface GetMediaPreferencesResponse {
	effectiveContext: EffectiveMediaContext
	mediaPreferences: LocalizationRecord | null
	destination: "device" | "account"
}

export interface SaveLocalizationRequest {
	/** A fresh UUID for each picker/page session; sequences are scoped to this client. */
	clientId: string
	pair: LocalizationPair
	sequence: number
	expectedVersion?: string | null
}
export interface SaveLocalizationConflictResponse {
	error: string
	/** Request sequence, used to reject a stale error response. */
	sequence: number
	current: { pair: LocalizationPair; version: string; sequence: number } | null
}
export interface SaveLocalizationResponse {
	pair: LocalizationPair
	version: string
	sequence: number
	effectiveContext: EffectiveMediaContext
	destination: "device" | "account"
}
/** Compare with latest issued intent, not last response received. Saves must also be serialized (cookie writes). */
export function isCurrentLocalizationResponse(
	response: Pick<SaveLocalizationResponse, "sequence">,
	latestIssuedSequence: number,
): boolean {
	return (
		Number.isSafeInteger(response.sequence) &&
		response.sequence >= 0 &&
		response.sequence === latestIssuedSequence
	)
}
