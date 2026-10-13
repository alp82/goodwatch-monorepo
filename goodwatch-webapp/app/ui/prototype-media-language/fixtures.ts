// PROTOTYPE - throwaway. The sample data of /prototype/media-language. Titles, taglines, descriptions, episode text,
// image paths and which services carry a title are TMDB's, read once from its public pages on 2026-10-13 and frozen
// (see fixture-text.ts). The "generated" lines, the scores, the one gap marked `mock` and the country to language
// suggestions are made up. Nothing is read from GoodWatch's own services.
import { TMDB_EPISODES, TMDB_TEXT } from "./fixture-text"

export const LANGS = ["en", "de", "fr", "es", "ja", "tr"] as const
export type Lang = (typeof LANGS)[number]

/** The interface stays English, so a language is named in English first and in its own name second. */
export const LANG_NAME: Record<Lang, { name: string; own: string }> = {
	en: { name: "English", own: "English" },
	de: { name: "German", own: "Deutsch" },
	fr: { name: "French", own: "Français" },
	es: { name: "Spanish", own: "Español" },
	ja: { name: "Japanese", own: "日本語" },
	tr: { name: "Turkish", own: "Türkçe" },
}

export const COUNTRIES = [
	{ code: "DE", name: "Germany" },
	{ code: "US", name: "United States" },
	{ code: "GB", name: "United Kingdom" },
	{ code: "FR", name: "France" },
	{ code: "ES", name: "Spain" },
	{ code: "JP", name: "Japan" },
	{ code: "TR", name: "Türkiye" },
	{ code: "SE", name: "Sweden" },
	{ code: "CH", name: "Switzerland" },
] as const
export type Country = (typeof COUNTRIES)[number]["code"]
export const countryName = (code: string) =>
	COUNTRIES.find((c) => c.code === code)?.name ?? code

// A country may suggest a language, never the other way round. Sweden has none GoodWatch offers here; Switzerland has
// two, so nothing can be picked for the visitor. A made-up table: which pairs exist is a product decision.
export const SUGGESTED_LANGS: Record<Country, Lang[]> = {
	DE: ["de"],
	US: ["en"],
	GB: ["en"],
	FR: ["fr"],
	ES: ["es"],
	JP: ["ja"],
	TR: ["tr"],
	SE: [],
	CH: ["de", "fr"],
}

const LOGO: Record<string, string> = {
	Netflix: "/rK1KljqmbvO9HQa1PBFLILWah72.png",
	"HBO Max": "/skypuy7SXuugIQeYg0IglmzoKaS.png",
	"Apple TV": "/qdEGArH3lKfFnAtYXMkSYk5wxuG.png",
	"Google Play": "/aZRENwYILujqs0RVOZutTh0BVGV.png",
	"Amazon Video": "/jn6TLbtaTZntTRX9UYucHJvpQx1.png",
	"Prime Video": "/gMZdpavHmxFNnLpMHwVxfqeux2g.png",
	YouTube: "/5Maob4o5w8oZnNeYpCDyVFD3M7X.png",
	MagentaTV: "/f1uWfExJA6DSAvuTL0YJ9Kyftfg.png",
	"TriArt Play": "/dmt94TXdeHGnA211Lo1tBQO0fXH.png",
	"SF Anytime": "/fVuqy8kmzsULoJjc3ROOcurRH7S.png",
	"Orange VOD": "/73lu1dtE9uJLWK1laXpeaAFh48j.png",
	"Canal VOD": "/51fX3l4yElitnfui0IkbMUmfmgF.png",
	Cinu: "/qmFZGxSNeiv4pDiQRLoiTLF4jIg.png",
	filmingo: "/5b7O8mKPJIirE7oDl2Ex4HMeXYv.png",
	Filmin: "/pQ3G3Ts5SWjy3Ds4Y6QZWoZFAKJ.png",
	"Paramount+": "/pkx3klJlwW5JdtaulvDx6hDNtch.png",
	MUBI: "/k7iSlvgWzZuO4zU5PcBjhABMuia.png",
	"BFI Player": "/waBWwU3aoY1IoypolMtDX4GOVDD.png",
	"Draken Film": "/qfhOpCrVOhUBzS4FU0zz15VElKE.png",
	"TV+": "/ck9ropbn6okqSdtgxGkkvMMgtSe.png",
	"Atres Player": "/sTt38jJ08bqjtnCnHvHtwswm5jb.png",
	"Rakuten TV": "/872dfVu1biZISJ8rO143CZZutPR.png",
}
export const logoOf = (service: string) => LOGO[service] ?? ""

export type OfferKind = "stream" | "rent"
export type Offers = Record<OfferKind, string[]>
const offers = (stream: string[], rent: string[] = []): Offers => ({
	stream,
	rent,
})

export type TitleId = "spirited-away" | "money-heist" | "portrait"

export interface Localized {
	title: string | null
	tagline: string | null
	overview: string | null
	poster: string | null
	/** A sentence GoodWatch writes about the title (FAQ, fingerprint narrative). Made up for this prototype. */
	generated: string | null
	/** True where this prototype removed a field TMDB has, to show a missing description. */
	mock?: boolean
}

export interface Episode {
	number: number
	text: Record<Lang, { name: string; overview: string | null }>
}

export interface TitleFixture {
	id: TitleId
	mediaType: "movie" | "show"
	originalLang: Lang
	year: number
	facts: string
	genres: string[]
	backdrop: string
	score: number
	sites: { name: string; value: string }[]
	question: string
	text: Record<Lang, Localized>
	episodes: Episode[]
	offers: Record<Country, Offers>
}

type Raw = {
	title: string | null
	tagline: string | null
	overview: string
	poster: string | null
}

function localized(
	id: TitleId,
	generated: Partial<Record<Lang, string>>,
	mockGaps: Partial<Record<Lang, (keyof Raw)[]>> = {},
) {
	const raw = TMDB_TEXT[id] as Record<Lang, Raw>
	return Object.fromEntries(
		LANGS.map((lang) => {
			const gaps = mockGaps[lang] ?? []
			const field = <K extends keyof Raw>(k: K) =>
				gaps.includes(k) ? null : raw[lang][k]
			return [
				lang,
				{
					title: field("title"),
					tagline: field("tagline"),
					overview: field("overview"),
					poster: field("poster"),
					generated: generated[lang] ?? null,
					mock: gaps.length > 0 || undefined,
				},
			]
		}),
	) as Record<Lang, Localized>
}

const MONEY_HEIST_EPISODES: Episode[] = [0, 1].map((i) => ({
	number: i + 1,
	text: Object.fromEntries(
		LANGS.map((lang) => [lang, TMDB_EPISODES[lang][i]]),
	) as Episode["text"],
}))

export const TITLES: TitleFixture[] = [
	{
		id: "spirited-away",
		mediaType: "movie",
		originalLang: "ja",
		year: 2001,
		facts: "2h 5m",
		genres: ["Animation", "Family", "Fantasy"],
		backdrop: "/6oaL4DP75yABrd5EbC4H2zq5ghc.jpg",
		score: 91,
		sites: [
			{ name: "IMDb", value: "8.6" },
			{ name: "Metacritic", value: "96" },
			{ name: "Rotten Tomatoes", value: "96%" },
		],
		question: "Is it worth watching?",
		text: localized("spirited-away", {
			en: "Yes. It is one of the most loved animated films ever made: strange, warm and a little frightening, with a girl who grows up over one long night.",
			de: "Ja. Er gehört zu den beliebtesten Animationsfilmen überhaupt: seltsam, warm und ein wenig unheimlich, mit einem Mädchen, das in einer langen Nacht erwachsen wird.",
			fr: "Oui. C’est l’un des films d’animation les plus aimés : étrange, chaleureux et un peu inquiétant, avec une fillette qui grandit en une longue nuit.",
			es: "Sí. Es una de las películas de animación más queridas: extraña, cálida y algo inquietante, con una niña que madura en una sola noche.",
			ja: "はい。最も愛されているアニメーション映画のひとつです。不思議で温かく、少し怖い、一夜で成長する少女の物語です。",
		}),
		episodes: [],
		offers: {
			DE: offers(["Netflix"], ["Google Play", "MagentaTV", "YouTube"]),
			US: offers(
				["HBO Max"],
				["Google Play", "YouTube", "Amazon Video", "Apple TV"],
			),
			GB: offers(["Netflix"]),
			FR: offers(["Netflix"], ["Orange VOD", "Canal VOD", "Amazon Video"]),
			ES: offers(["Netflix"]),
			JP: offers([]),
			TR: offers(["Netflix"], ["Amazon Video", "Apple TV", "Google Play"]),
			SE: offers(["Netflix", "TriArt Play"], ["SF Anytime"]),
			CH: offers(["Netflix"], ["Apple TV"]),
		},
	},
	{
		id: "money-heist",
		mediaType: "show",
		originalLang: "es",
		year: 2017,
		facts: "41 Episodes in 3 Seasons",
		genres: ["Crime", "Drama"],
		backdrop: "/xGexTKCJDkl12dTW4YCBDXWb1AD.jpg",
		score: 84,
		sites: [
			{ name: "IMDb", value: "8.2" },
			{ name: "Rotten Tomatoes", value: "94%" },
		],
		question: "How long does it take to get going?",
		text: localized("money-heist", {
			en: "Not long. The heist starts in the first episode, and most people know by the end of the second whether the show is for them.",
			de: "Nicht lange. Der Überfall beginnt in der ersten Folge, und nach der zweiten wissen die meisten, ob die Serie etwas für sie ist.",
			es: "Poco. El atraco empieza en el primer capítulo, y al final del segundo casi todo el mundo sabe si la serie es para él.",
		}),
		episodes: MONEY_HEIST_EPISODES,
		offers: {
			DE: offers(["Netflix"]),
			US: offers(["Netflix"]),
			GB: offers(["Netflix"]),
			FR: offers(["Netflix"]),
			ES: offers(["Netflix", "Atres Player"]),
			JP: offers(["Netflix"]),
			TR: offers(["Netflix"]),
			SE: offers(["Netflix"]),
			CH: offers(["Netflix"]),
		},
	},
	{
		id: "portrait",
		mediaType: "movie",
		originalLang: "fr",
		year: 2019,
		facts: "2h 1m",
		genres: ["Drama", "Romance"],
		backdrop: "/ivJ5UzT6IzucLVfbZwCCwiJJoBz.jpg",
		score: 88,
		sites: [
			{ name: "IMDb", value: "8.1" },
			{ name: "Metacritic", value: "95" },
			{ name: "Rotten Tomatoes", value: "97%" },
		],
		question: "Is it slow?",
		text: localized(
			"portrait",
			{
				en: "It is quiet, not slow. Very little is said and almost every look counts, so it rewards an evening without a phone in reach.",
				fr: "Il est silencieux, pas lent. On y parle peu et presque chaque regard compte : mieux vaut le voir un soir sans téléphone à portée de main.",
			},
			// TMDB has a Turkish description. The prototype drops it to show a description that falls back.
			{ tr: ["overview"] },
		),
		episodes: [],
		offers: {
			DE: offers([], ["Apple TV", "Amazon Video"]),
			US: offers(["HBO Max"], ["Google Play", "Apple TV", "YouTube"]),
			GB: offers(
				["MUBI", "BFI Player"],
				["Google Play", "YouTube", "Apple TV"],
			),
			FR: offers(["Paramount+"], ["Orange VOD", "Canal VOD"]),
			ES: offers(
				["Prime Video", "Filmin"],
				["Google Play", "Rakuten TV", "Apple TV"],
			),
			JP: offers([], ["Google Play", "Amazon Video", "Apple TV"]),
			TR: offers(["TV+", "HBO Max"], ["Apple TV", "Google Play"]),
			SE: offers(["Draken Film"], ["Apple TV", "SF Anytime", "TriArt Play"]),
			CH: offers(["Cinu", "filmingo"]),
		},
	},
]
export const titleOf = (id: TitleId) =>
	TITLES.find((t) => t.id === id) ?? TITLES[0]

// Who is visiting. `browser` is the browser's language list as it would arrive in Accept-Language.
export interface Persona {
	key: string
	label: string
	viewer: "guest" | "member"
	browser: string[]
	guessedCountry: Country
	savedCountry: Country | null
	savedLang: Lang | null
	/** The country a shared link carries, as the sender had it. It arrives as a look, never as a saved value. */
	incomingLook?: Country
	note: string
}

export const PERSONAS: Persona[] = [
	{
		key: "guest-de",
		label: "Guest · German browser · in Germany",
		viewer: "guest",
		browser: ["de-DE", "de", "en"],
		guessedCountry: "DE",
		savedCountry: null,
		savedLang: null,
		note: "Nothing saved. The country is a guess, the language comes from the browser.",
	},
	{
		key: "guest-en-de",
		label: "Guest · English browser · in Germany",
		viewer: "guest",
		browser: ["en-GB", "en"],
		guessedCountry: "DE",
		savedCountry: null,
		savedLang: null,
		note: "Lives in Germany, reads English. Country and language already differ without any setting.",
	},
	{
		key: "member-de",
		label: "Member · country saved · no language chosen",
		viewer: "member",
		browser: ["de-DE", "en"],
		guessedCountry: "DE",
		savedCountry: "DE",
		savedLang: null,
		note: "Today's member: a saved country, and titles follow the browser.",
	},
	{
		key: "member-explicit",
		label: "Member · chose English · German browser",
		viewer: "member",
		browser: ["de-DE", "en"],
		guessedCountry: "DE",
		savedCountry: "US",
		savedLang: "en",
		note: "The saved language wins over the browser's German.",
	},
	{
		key: "guest-sv",
		label: "Guest · Swedish browser · in Sweden",
		viewer: "guest",
		browser: ["sv-SE", "sv"],
		guessedCountry: "SE",
		savedCountry: null,
		savedLang: null,
		note: "Swedish is not offered in this prototype, so the browser default ends at English.",
	},
	{
		key: "recipient-ja",
		label: "Simulated shared link · guest · Japanese browser",
		viewer: "guest",
		browser: ["ja-JP", "ja", "en"],
		guessedCountry: "JP",
		savedCountry: null,
		savedLang: null,
		note: "Simulated, not a real share flow: a guest in Japan with a Japanese browser, as if they had opened a link a German-language member sent. The link carries no language, so the page is in the recipient's.",
	},
	{
		key: "recipient-look",
		label: "Simulated shared link with a country · guest · Japanese browser",
		viewer: "guest",
		browser: ["ja-JP", "ja", "en"],
		guessedCountry: "JP",
		savedCountry: null,
		savedLang: null,
		incomingLook: "DE",
		note: "Simulated: the sender's link carries their country (Germany), as a title link with ?country= does today. It arrives as a look in B and a try in C: German offers, the recipient's Japanese titles, nothing saved. A has no temporary country and drops it.",
	},
]
