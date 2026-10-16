// Settings, Where you watch: the country you watch from and your streaming services, together because the country
// decides which services there are. The country also sets where to watch on every title, what Discover counts as
// streaming, and the age ratings; it changes no language (that is Show titles in).
import type { MetaFunction } from "@remix-run/node"
import {
	PairStatus,
	WatchingFromList,
	useSettingsPair,
} from "~/ui/media-preference/SettingsPair"
import { SettingsSheet, SheetSection } from "~/ui/settings/SettingsSheet"
import { YourServices } from "~/ui/settings/YourServices"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => [
	{ title: "Where you watch | GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

export default function SettingsWhereYouWatch() {
	const { next } = useSettingsPair()
	return (
		<SettingsSheet title="Where you watch">
			<div className="flex flex-col gap-8">
				<SheetSection
					title="Watching from"
					subtitle="Your country. It decides where to watch each title, which services you can pick, and the age ratings you see."
				>
					<PairStatus />
					<WatchingFromList className="h-60" />
				</SheetSection>
				<SheetSection
					title="Your services"
					subtitle="On my services keeps the titles on these, and you hear when a title you want lands on one."
				>
					<YourServices country={next.country} />
				</SheetSection>
			</div>
		</SettingsSheet>
	)
}
