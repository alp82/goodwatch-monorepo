// Settings, Show titles in: the language that titles, posters, descriptions and taglines show in. Apart from the
// country, which changes no language. A sample title shows the choice.
import type { MetaFunction } from "@remix-run/node"
import { BROWSER } from "~/ui/media-preference/machine"
import { PairStatus, ShowTitlesInList, useSettingsPair } from "~/ui/media-preference/SettingsPair"
import { SampleTitleCard } from "~/ui/settings/SampleTitle"
import { SettingsPage } from "~/ui/settings/SettingsPage"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => [
	{ title: "Show titles in | GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

export default function SettingsLanguage() {
	const { p, next } = useSettingsPair()
	const language = next.language === BROWSER ? p.browserLanguage : next.language
	return (
		<SettingsPage
			title="Show titles in"
			intro="Title names, posters, descriptions and taglines show in this language when a translation exists. Menus stay in English."
		>
			<div className="flex flex-col gap-2">
				<PairStatus />
				<ShowTitlesInList preview={<SampleTitleCard language={language} />} />
			</div>
		</SettingsPage>
	)
}
