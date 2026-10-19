// Settings, Watching from: the country the member watches from. It decides where to watch each title, which services
// they can pick, what Discover counts as streaming, and the age ratings; it changes no language (that is Show titles in).
import type { MetaFunction } from "@remix-run/node"
import { PairStatus, WatchingFromList } from "~/ui/media-preference/SettingsPair"
import { SettingsPage } from "~/ui/settings/SettingsPage"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => [
	{ title: "Watching from | GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

export default function SettingsCountry() {
	return (
		<SettingsPage
			title="Watching from"
			intro="Your country decides where to watch each title, which streaming services you can pick, and the age ratings you see. It doesn't change the language."
		>
			<div className="flex flex-col gap-2">
				<PairStatus />
				<WatchingFromList />
			</div>
		</SettingsPage>
	)
}
