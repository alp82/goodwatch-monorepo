// Imports settings: bring ratings from IMDb into GoodWatch by uploading the CSV file IMDb exports.
// The settings layout only shows this to a signed-in member. The flow lives in ~/ui/imports.
import type { MetaFunction } from "@remix-run/node"
import { ImdbImportFlow } from "~/ui/imports/ImdbImportFlow"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => [
	{ title: "Imports Settings | GoodWatch" },
	{
		name: "description",
		content:
			"Import your IMDb ratings into GoodWatch to build your Taste from the movies and shows you have already rated.",
	},
	{ name: "robots", content: "noindex, nofollow" },
]

export default function SettingsImports() {
	return (
		<div className="px-2 md:px-4 lg:px-8">
			<div className="flex max-w-2xl flex-col gap-6 text-base text-gray-300">
				<div>
					<h2 className="font-bold tracking-tight text-gray-100 text-base sm:text-lg md:text-xl lg:text-2xl">
						Import your IMDb ratings
					</h2>
					<p className="mt-2 text-gray-400">
						Bring the ratings you gave on IMDb into GoodWatch to build your
						Taste. You export a file from IMDb, upload it here, and check what
						it holds before anything is saved.
					</p>
				</div>
				<ImdbImportFlow />
			</div>
		</div>
	)
}
