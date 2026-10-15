import type { MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { ImportSourcesPage } from "~/ui/imports/ImportSourcesPage"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => [
	{ title: "Imports Settings | GoodWatch" },
	{
		name: "description",
		content:
			"Import ratings, watches and lists from IMDb, Letterboxd, Trakt, TMDB, Plex, Kodi, MovieLens, MyAnimeList, Kitsu or CSV into GoodWatch.",
	},
	{ name: "robots", content: "noindex, nofollow" },
]

export { loader } from "~/server/imports/settings-loader.server"
import type { loader } from "~/server/imports/settings-loader.server"

export default function SettingsImports() {
	const data = useLoaderData<typeof loader>()
	return (
		<ImportSourcesPage
			imdbImports={data.imports}
			sourceImports={data.sourceImports}
			initialSource={data.initialSource}
			connectState={data.connectState}
			openImport={data.openImport}
		/>
	)
}
