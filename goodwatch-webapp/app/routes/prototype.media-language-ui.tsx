// PROTOTYPE (development only, left out of production builds by PROTOTYPES in vite.config.js): screens for the media
// language UI that a page of real data cannot show yet.
//   ?view=text      every launch language in the places media text sits: a header title (truncate), a card title
//                   (line-clamp-2), a description (line-clamp-3). Hard-coded samples; the last row is Arabic without
//                   MediaText, to compare.
//   ?view=settings  the settings page's country and titles editor, outside the members-only settings layout.
import { useSearchParams } from "@remix-run/react"
import { MediaPreferenceProvider } from "~/ui/media-preference/MediaPreference"
import SettingsPair from "~/ui/media-preference/SettingsPair"
import MediaText, { type MediaTextValue } from "~/ui/media-text/MediaText"

const SAMPLES: { title: MediaTextValue; overview: MediaTextValue }[] = [
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

function Row({
	title,
	overview,
	plain = false,
}: { title: MediaTextValue; overview: MediaTextValue; plain?: boolean }) {
	const T = plain
		? ({
				value,
				as: Tag = "span",
				...rest
			}: {
				value: MediaTextValue
				as?: "h3" | "p" | "span"
				className?: string
			}) => <Tag {...rest}>{value.text}</Tag>
		: MediaText
	return (
		<div
			data-sample={title.lang}
			className="grid grid-cols-[3.5rem_minmax(0,14rem)_minmax(0,9rem)_minmax(0,1fr)] items-start gap-3 border-b border-white/10 py-2 max-md:grid-cols-[3rem_minmax(0,1fr)]"
		>
			<span className="pt-1 text-xs text-gray-500">
				{plain ? `${title.lang} plain` : title.lang}
			</span>
			<T
				as="h3"
				value={title}
				className="truncate text-2xl font-medium text-white"
			/>
			<T
				as="p"
				value={title}
				className="line-clamp-2 text-sm leading-tight font-semibold text-white max-md:col-start-2"
			/>
			<T
				as="p"
				value={overview}
				className="line-clamp-3 text-sm leading-snug text-gray-300 max-md:col-start-2"
			/>
		</div>
	)
}

export default function PrototypeMediaLanguageUi() {
	const [params] = useSearchParams()
	if (params.get("view") === "settings")
		return (
			<div className="mx-auto w-full max-w-5xl px-4 py-6">
				<h2 className="mb-4 text-2xl font-bold text-gray-100">
					Country and titles
				</h2>
				<MediaPreferenceProvider country="DE">
					<SettingsPair />
				</MediaPreferenceProvider>
			</div>
		)
	return (
		<div className="mx-auto w-full max-w-6xl px-4 py-6">
			<h2 className="mb-1 text-xl font-bold text-gray-100">
				Media text in the launch languages
			</h2>
			<p className="mb-3 text-sm text-gray-400">
				Header title (truncate) · card title (line-clamp-2, leading-tight) ·
				description (line-clamp-3). Interface English, left to right.
			</p>
			{SAMPLES.map((s) => (
				<Row key={s.title.lang} {...s} />
			))}
			<Row {...SAMPLES[SAMPLES.length - 1]} plain />
		</div>
	)
}
