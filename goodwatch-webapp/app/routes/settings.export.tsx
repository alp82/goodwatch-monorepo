// Settings › Export: soon, a file of your scores, watches and lists to take elsewhere. A placeholder until then.
import type { MetaFunction } from "@remix-run/node"
import { SettingsPage } from "~/ui/settings/SettingsPage"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => [
	{ title: "Export | Settings | GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

export default function SettingsExport() {
	return (
		<SettingsPage
			title="Export"
			intro="Your scores, watches and lists as a file you can take anywhere."
		>
			<div className="rounded-2xl border border-dashed border-white/15 px-6 py-12 text-center">
				<p className="text-lg font-bold text-gray-100">Coming soon</p>
				<p className="mx-auto mt-2 max-w-md text-sm text-gray-400">
					You'll be able to download everything you've added to GoodWatch here.
				</p>
			</div>
		</SettingsPage>
	)
}
