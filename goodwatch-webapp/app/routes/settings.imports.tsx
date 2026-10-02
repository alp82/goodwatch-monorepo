// Imports settings: bring ratings from IMDb into GoodWatch by uploading the CSV file IMDb exports.
// The settings layout only shows this to a signed-in member. The flow lives in ~/ui/imports.
import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import type { ImdbImportListResponse } from "~/domain/imdb-import"
import { listImportRows, summarize } from "~/server/imdb-import/store.server"
import { ImdbImportFlow } from "~/ui/imports/ImdbImportFlow"
import { getAuthFromRequest } from "~/utils/auth"

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

// The earlier imports come with the page, so it shows at once. They are an extra: if they can't be read,
// the page still offers the upload.
export async function loader({ request }: LoaderFunctionArgs) {
	const { user, headers } = await getAuthFromRequest({ request })
	headers.set("Cache-Control", "private, no-store")
	const rows = user
		? await listImportRows(user.id).catch((error) => {
				console.error("IMDb import: reading the earlier imports failed:", error)
				return []
			})
		: []
	return json<ImdbImportListResponse>({ imports: rows.map(summarize) }, { headers })
}

export default function SettingsImports() {
	const earlier = useLoaderData<typeof loader>()
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
				<ImdbImportFlow initial={earlier} />
			</div>
		</div>
	)
}
