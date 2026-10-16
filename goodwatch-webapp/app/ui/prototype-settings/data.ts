// PROTOTYPE - throwaway (settings redesign, branch prototype/settings-redesign). Realistic fake data for the member
// Settings variants: nothing here is read from or written to an account.
import type { ConsentApp } from "~/utils/mcp-connect"

/** One localized title, the same sample the media language prototype uses (prototype.media-language-ui.tsx). */
export const TITLE_SAMPLES: { title: { text: string; lang: string }; overview: { text: string; lang: string } }[] = [
	{
		title: { text: "Spirited Away", lang: "en" },
		overview: {
			text: "A young girl, Chihiro, becomes trapped in a strange new world of spirits. When her parents undergo a mysterious transformation, she must call upon the courage she never knew she had to free her family.",
			lang: "en",
		},
	},
	{
		title: { text: "Chihiros Reise ins Zauberland", lang: "de" },
		overview: {
			text: "Als die kleine Chihiro mit ihren Eltern einen dunklen Tunnel durchquert, ahnt sie noch nicht, was sie auf der anderen Seite erwartet: eine für Menschen unsichtbare Stadt der Geister.",
			lang: "de",
		},
	},
	{
		title: { text: "Le Voyage de Chihiro", lang: "fr" },
		overview: {
			text: "Chihiro, dix ans, s'aventure avec ses parents dans un monde peuplé de dieux et de monstres, où les humains sont changés en bêtes.",
			lang: "fr",
		},
	},
	{
		title: { text: "El viaje de Chihiro", lang: "es" },
		overview: {
			text: "Chihiro es una niña de diez años que, camino de su nuevo hogar, queda atrapada en un mundo mágico de espíritus.",
			lang: "es",
		},
	},
	{
		title: { text: "La città incantata", lang: "it" },
		overview: {
			text: "Chihiro, una bambina di dieci anni, si ritrova in un mondo popolato da spiriti e divinità, dove i suoi genitori vengono trasformati in maiali.",
			lang: "it",
		},
	},
	{
		title: { text: "A Viagem de Chihiro", lang: "pt-BR" },
		overview: {
			text: "Chihiro e seus pais estão se mudando para uma nova cidade. Durante a viagem, eles entram em um túnel que leva a um mundo de espíritos.",
			lang: "pt-BR",
		},
	},
	{
		title: { text: "A Viagem de Chihiro", lang: "pt-PT" },
		overview: {
			text: "Chihiro e os pais estão de mudança. Pelo caminho atravessam um túnel que os conduz a um mundo de espíritos.",
			lang: "pt-PT",
		},
	},
	{
		title: { text: "千と千尋の神隠し", lang: "ja" },
		overview: {
			text: "10歳の少女千尋は、両親と共に引っ越し先へ向かう途中、不思議なトンネルの向こうにある神々の世界に迷い込んでしまう。",
			lang: "ja",
		},
	},
	{
		title: { text: "센과 치히로의 행방불명", lang: "ko" },
		overview: {
			text: "열 살 소녀 치히로는 이사 가던 길에 부모님과 함께 신비한 터널을 지나 신들의 세계로 들어가게 된다.",
			lang: "ko",
		},
	},
	{
		title: { text: "千与千寻", lang: "zh-Hans" },
		overview: {
			text: "十岁的少女千寻随父母搬家途中，误入了一个神灵居住的奇异世界，父母因贪吃变成了猪。",
			lang: "zh-Hans",
		},
	},
	{
		title: { text: "神隱少女", lang: "zh-Hant" },
		overview: {
			text: "十歲的少女千尋隨父母搬家途中，誤闖神靈居住的奇異世界，父母因貪吃而變成了豬。",
			lang: "zh-Hant",
		},
	},
	{
		title: { text: "Spirited Away: W krainie bogów", lang: "pl" },
		overview: {
			text: "Dziesięcioletnia Chihiro wraz z rodzicami trafia do tajemniczego świata duchów, w którym ludzie zamieniają się w zwierzęta.",
			lang: "pl",
		},
	},
	{
		title: { text: "Унесённые призраками", lang: "ru" },
		overview: {
			text: "Десятилетняя Тихиро вместе с родителями попадает в таинственный мир духов, где её родители превращаются в свиней.",
			lang: "ru",
		},
	},
	{
		title: { text: "المخطوفة", lang: "ar" },
		overview: {
			text: "تنتقل الفتاة تشيهيرو ذات العشر سنوات مع والديها إلى منزل جديد، فتجد نفسها في عالم غريب تسكنه الأرواح والآلهة، حيث يتحول والداها إلى خنازير.",
			lang: "ar",
		},
	},
]

export const SAMPLE_POSTER = "/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg"

export function sampleFor(language: string) {
	return TITLE_SAMPLES.find((s) => s.title.lang === language) ?? TITLE_SAMPLES[0]
}

export const MEMBER = {
	name: "Alper",
	email: "alper@example.com",
	handle: "alp",
	memberSince: "March 2024",
	signIn: ["email", "google"] as ("email" | "google")[],
}

/** The saved pair as the member sees it today. */
export const START = {
	country: "DE",
	language: "browser",
	browserLanguage: "de",
	/** Netflix, Prime Video, Disney Plus, Crunchyroll: ids from /api/streaming-providers. */
	services: ["8", "9", "337", "283"],
}

export const HIDDEN = [
	{ key: "m-1291595", title: "Insidious: Out of the Further", year: 2026, type: "movie", poster: "/4tTrW9dXCByS5wt2pXVWb58zNjz.jpg", hiddenAt: "2 days ago" },
	{ key: "m-1148365", title: "Matchbox the Movie", year: 2026, type: "movie", poster: "/lFKA4GMz36dImEy3DQPdPF7G4V9.jpg", hiddenAt: "last week" },
	{ key: "m-1101412", title: "Fall 2: Deadpoint", year: 2026, type: "movie", poster: "/fgSm5ylwiXbIHn8UbUXDjk9RRu4.jpg", hiddenAt: "September 30, 2026" },
	{ key: "m-460458", title: "Resident Evil: Welcome to Raccoon City", year: 2021, type: "movie", poster: "/bArhvjRHl535XMaSh9VjInF2mSZ.jpg", hiddenAt: "August 12, 2026" },
]

export const IMPORTS = [
	{ source: "imdb", what: "1,284 ratings", when: "September 2, 2026" },
	{ source: "letterboxd", what: "412 watches, 3 lists", when: "October 1, 2026" },
] as const

const claude: ConsentApp = { name: "Claude", host: "claude.ai", returnsTo: "claude.ai", verified: true, kind: "claude" }
const claudeCode: ConsentApp = { name: "Claude Code", host: "claude.ai", returnsTo: "this computer", verified: true, kind: "claude-code" }
const chatgpt: ConsentApp = { name: "ChatGPT", host: "chatgpt.com", returnsTo: "chatgpt.com", verified: true, kind: "chatgpt" }

export const APPS = [
	{ id: "a1", app: claude, canChange: true, connected: "October 3, 2026", lastUsed: "2 hours ago" },
	{ id: "a2", app: claudeCode, canChange: true, connected: "October 9, 2026", lastUsed: "yesterday" },
	{ id: "a3", app: chatgpt, canChange: false, connected: "October 12, 2026", lastUsed: "Not used yet" },
]
