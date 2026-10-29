// Settings › Not interested: the titles the member hid, to unhide any of them. The layout (settings.tsx) checks the
// sign-in.
import type { MetaFunction } from "@remix-run/node"
import { NotInterestedPage } from "~/ui/settings/NotInterestedPage"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => [
	{ title: "Not interested | Settings | GoodWatch" },
	{
		name: "description",
		content:
			"The titles you marked Not interested on GoodWatch. Unhide one to see it in your recommendations again.",
	},
	{ name: "robots", content: "noindex, nofollow" },
]

export default function SettingsNotInterested() {
	return <NotInterestedPage />
}
