import type { MetaFunction } from "@remix-run/node"
import { MediaPreferenceProvider } from "~/ui/media-preference/MediaPreference"
import SettingsPair from "~/ui/media-preference/SettingsPair"
import useLocale from "~/utils/locale"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => {
	return [
		{ title: "Country and Titles Settings | GoodWatch" },
		{
			description:
				"Change your GoodWatch country and the language of titles and descriptions. All movie and tv show ratings and streaming providers on the same page",
		},
	]
}

// The country and titles language, saved as one pair (see ui/media-preference/SettingsPair.tsx). The effective pair
// of the request is where the page starts; the private read says what is on record.
export default function SettingsCountry() {
	const { locale } = useLocale()
	return (
		<div className="px-2 md:px-4 lg:px-8">
			<div className="flex flex-col gap-4 text-gray-300">
				<h2 className="font-bold tracking-tight text-gray-100 text-base sm:text-lg md:text-xl lg:text-2xl">
					Country and titles
				</h2>
				<MediaPreferenceProvider country={locale.country}>
					<SettingsPair />
				</MediaPreferenceProvider>
			</div>
		</div>
	)
}
