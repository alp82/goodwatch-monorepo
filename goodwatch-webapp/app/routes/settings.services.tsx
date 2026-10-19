// Settings, Your services: the streaming services the member has, from the country they watch from (Watching from).
import type { MetaFunction } from "@remix-run/node"
import { useSettingsPair } from "~/ui/media-preference/SettingsPair"
import { SettingsPage } from "~/ui/settings/SettingsPage"
import { YourServices } from "~/ui/settings/YourServices"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => [
	{ title: "Your services | GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

export default function SettingsServices() {
	const { next } = useSettingsPair()
	return (
		<SettingsPage
			title="Your services"
			intro="On my services keeps the titles on these, and you hear when a title you want lands on one. The list shows the services in your country."
		>
			<YourServices country={next.country} />
		</SettingsPage>
	)
}
