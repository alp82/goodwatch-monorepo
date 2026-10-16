// Settings, Show titles in: the language that titles, posters, descriptions and taglines show in. Apart from the
// country, which changes no language.
import type { MetaFunction } from "@remix-run/node"
import {
	PairStatus,
	ShowTitlesInList,
} from "~/ui/media-preference/SettingsPair"
import { SettingsSheet } from "~/ui/settings/SettingsSheet"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => [
	{ title: "Show titles in | GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

export default function SettingsLanguage() {
	return (
		<SettingsSheet
			title="Show titles in"
			subtitle="Your language for titles, posters and descriptions."
		>
			<div className="flex flex-col gap-2">
				<PairStatus />
				<ShowTitlesInList className="h-[28rem]" />
			</div>
		</SettingsSheet>
	)
}
