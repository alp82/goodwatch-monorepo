import type { MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import {
	IMPORTS_HEADING,
	ImportSourcesPage,
} from "~/ui/imports/ImportSourcesPage"
import { SettingsPage } from "~/ui/settings/SettingsPage"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => [
	{ title: "Imports Settings | GoodWatch" },
	{
		name: "description",
		content:
			"Import ratings, watches and lists from IMDb, Letterboxd, Trakt, TV Time, TMDB, Plex, Kodi, MovieLens, MyAnimeList, Kitsu or CSV into GoodWatch.",
	},
	{ name: "robots", content: "noindex, nofollow" },
]

export { loader } from "~/server/imports/settings-loader.server"
import type { loader } from "~/server/imports/settings-loader.server"

// Settings, Imports: a page of its own, since a source opens in place with its steps and history.
export default function SettingsImports() {
	const data = useLoaderData<typeof loader>()
	return (
		<SettingsPage
			title={IMPORTS_HEADING.title}
			intro={IMPORTS_HEADING.subtitle}
		>
			<ImportSourcesPage
				imdbImports={data.imports}
				sourceImports={data.sourceImports}
				initialSource={data.initialSource}
				connectState={data.connectState}
				openImport={data.openImport}
			/>
		</SettingsPage>
	)
}
