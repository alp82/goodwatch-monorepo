import assert from "node:assert/strict"
import { beforeEach, describe, it } from "node:test"
import {
	negotiateMediaLanguage,
	normalizeLanguageSetting,
	parseLocalizationCookie,
	parseLocalizationPair,
	parseLocalizationRecord,
	resolveEffectiveMediaContext,
	serializeLocalizationCookie,
	signInAdoption,
	isCurrentLocalizationResponse,
	type LocalizationRecord,
} from "./media-language.ts"
const record = (
	country = "DE",
	language: LocalizationRecord["language"] = "de",
): LocalizationRecord => ({
	country,
	language,
	schemaVersion: 1,
	version: "v1",
})

describe("negotiation", () => {
	for (const fixture of [
		["de-DE;q=0.3,fr-CA;q=0.9,en-US;q=0.5", "fr", "browser"],
		["sv,de;q=0.8,en;q=0.5", "de", "browser"],
		["de;q=0,en;q=0.5", "en", "browser"],
		["fr;q=0.5,de;q=0.5", "fr", "browser"],
		["de;q=oops,fr;q=0.7", "fr", "browser"],
		["de;q=1.2,fr;q=0.7", "fr", "browser"],
		["de;q=-1,fr;q=0.7", "fr", "browser"],
		["de;q=0.1234,fr;q=0.7", "fr", "browser"],
		["de;q=0,de;q=1,fr;q=0.5", "fr", "browser"],
		["*;q=0,de;q=0.5", "de", "browser"],
		["en;q=0,*;q=0.5", "de", "browser"],
		["*;q=0", "en", "default"],
		["en;q=0,xx", "en", "default"],
		["zh-TW", "zh-Hant", "browser"],
		["zh-HK", "zh-Hant", "browser"],
		["zh-CN", "zh-Hans", "browser"],
		["zh-SG", "zh-Hans", "browser"],
		["zh-Hant-CN", "zh-Hant", "browser"],
		["zh-Hans-TW", "zh-Hans", "browser"],
		["zh", "zh-Hans", "browser"],
		["pt", "pt-BR", "browser"],
		["pt-PT", "pt-PT", "browser"],
		["pt-BR", "pt-BR", "browser"],
		["fil-PH", "en", "default"],
		["en-x-private,de", "de", "browser"],
		["garbage", "en", "default"],
		["", "en", "default"],
	])
		it("%s → %s (%s)" + " " + JSON.stringify(fixture).slice(0, 120), () => {
			const [input, language, languageProvenance] = fixture
			assert.deepEqual(negotiateMediaLanguage(input), {
				language,
				languageProvenance,
			})
		})
	it("uses navigator.languages with the same ordered rule", () => {
		assert.deepEqual(
			negotiateMediaLanguage(["sv-SE", "de-DE", "en"]),
			negotiateMediaLanguage("sv-SE,de-DE,en"),
		)
	})
	it("normalizes removed/unsupported explicit choices to English", () => {
		assert.equal(normalizeLanguageSetting("sv"), "en")
		assert.equal(normalizeLanguageSetting("DE-de"), "de")
		assert.equal(normalizeLanguageSetting("browser"), "browser")
	})
})

describe("effective context and sign-in", () => {
	it("keeps member pair ahead of cookie and browser, with country URL independent", () => {
		assert.deepEqual(
			resolveEffectiveMediaContext({
				account: record("US", "fr"),
				cookie: record(),
				browserLanguages: "ja-JP",
				urlCountry: "jp",
			}),
			{
				country: "JP",
				countryProvenance: "url",
				language: "fr",
				languageProvenance: "explicit",
				languageSetting: "fr",
			},
		)
	})
	it("uses the whole cookie ahead of a legacy country and browser", () => {
		assert.equal(
			resolveEffectiveMediaContext({
				cookie: record(),
				legacyCountry: "US",
				browserLanguages: "ja",
			}).countryProvenance,
			"cookie",
		)
		assert.equal(
			resolveEffectiveMediaContext({ cookie: record(), browserLanguages: "ja" })
				.language,
			"de",
		)
	})
	it("browser reset follows language without changing country", () => {
		assertSubset(
			resolveEffectiveMediaContext({
				account: record("DE", "browser"),
				cookie: record("JP", "ja"),
				browserLanguages: "fr-CA",
			}),
			{
				country: "DE",
				language: "fr",
				languageProvenance: "browser",
				languageSetting: "browser",
			},
		)
	})
	it("uses legacy country, then existing region fallback, then US/en", () => {
		assertSubset(
			resolveEffectiveMediaContext({
				legacyCountry: "de",
				browserLanguages: "en",
			}),
			{
				country: "DE",
				countryProvenance: "legacy",
				language: "en",
			},
		)
		assertSubset(
			resolveEffectiveMediaContext({
				fallbackCountry: "AT",
				fallbackCountryProvenance: "browser",
				browserLanguages: "fr",
			}),
			{
				country: "AT",
				countryProvenance: "browser",
				language: "fr",
			},
		)
		assertSubset(resolveEffectiveMediaContext({}), {
			country: "US",
			language: "en",
			languageProvenance: "default",
		})
	})
	it("adopts a kept guest choice only for an account without a pair", () => {
		assert.deepEqual(
			signInAdoption(null, { ...record(), sourceUserId: null }),
			{
				country: "DE",
				language: "de",
			},
		)
		assert.deepEqual(
			signInAdoption(null, { ...record("DE", "browser"), sourceUserId: null }),
			{
				country: "DE",
				language: "browser",
			},
		)
		assert.equal(signInAdoption(record("US", "en"), record()), null)
		assert.equal(signInAdoption(null, null), null)
	})
})

describe("cookie and payload robustness", () => {
	it("round trips script/region choices and browser mode, dropping unknown properties", () => {
		for (const language of ["zh-Hant", "pt-BR", "browser"] as const) {
			const saved = record("TW", language)
			assert.deepEqual(
				parseLocalizationCookie(`_ga=x; ${serializeLocalizationCookie(saved)}`),
				saved,
			)
		}
		assert.equal(
			serializeLocalizationCookie(record()).includes(
				"HttpOnly; SameSite=Lax; Secure",
			),
			true,
		)
		assert.equal(
			serializeLocalizationCookie(record(), false).includes("Secure"),
			false,
		)
	})
	for (const fixture of [
		null,
		"",
		"gw_loc=%ZZ",
		"gw_loc=%7B",
		"gw_loc=null",
		"gw_loc=[]",
		"gw_loc=" + "x".repeat(3000),
		"gw_loc={}; gw_loc={}",
		'gw_loc={"schemaVersion":2,"country":"DE","language":"de","version":"v1"}',
		'gw_loc={"schemaVersion":1,"country":"DE","language":"de","version":"bad;value"}',
	])
		it("rejects malformed cookie %s" +
			" " +
			JSON.stringify(fixture).slice(0, 120), () => {
			const header = fixture
			assert.equal(parseLocalizationCookie(header), null)
		})
	for (const fixture of [
		{},
		[],
		null,
		{ country: "Germany", language: "de" },
		{ country: "DE" },
		{ country: "DE", language: "" },
		{ country: "DE", language: 123 },
	])
		it("rejects invalid pairs %j" +
			" " +
			JSON.stringify(fixture).slice(0, 120), () => {
			const pair = fixture
			assert.equal(parseLocalizationPair(pair), null)
		})
	it("bounds and normalizes cookie choices", () => {
		const saved = { ...record(), country: " de ", language: "removed" }
		assert.deepEqual(parseLocalizationRecord(saved), record("DE", "en"))
	})
})

it("rejects late save responses against the newest issued intent, including before its response arrives", () => {
	assert.equal(isCurrentLocalizationResponse({ sequence: 1 }, 2), false)
	assert.equal(isCurrentLocalizationResponse({ sequence: 2 }, 2), true)
	assert.equal(isCurrentLocalizationResponse({ sequence: 3 }, 2), false)
	assert.equal(isCurrentLocalizationResponse({ sequence: NaN }, 2), false)
})

function assertSubset(
	actual: unknown,
	expected: Record<string, unknown>,
): void {
	assert.ok(actual && typeof actual === "object")
	for (const [key, value] of Object.entries(expected)) {
		const observed: unknown = (actual as Record<string, unknown>)[key]
		if (value && typeof value === "object" && !Array.isArray(value))
			assertSubset(observed, value as Record<string, unknown>)
		else assert.deepEqual(observed, value)
	}
}

it("writer sequence round-trips without accepting malformed writer metadata", () => {
	const saved = {
		...record(),
		writer: { clientId: "page-session-id", sequence: 42 },
	}
	assert.deepEqual(
		parseLocalizationCookie(serializeLocalizationCookie(saved)),
		saved,
	)
	for (const writer of [
		{ clientId: "short", sequence: 1 },
		{ clientId: "page-session-id", sequence: -1 },
		{ clientId: "page-session-id", sequence: 1.5 },
		null,
	])
		assert.equal(parseLocalizationRecord({ ...record(), writer }), null)
})
