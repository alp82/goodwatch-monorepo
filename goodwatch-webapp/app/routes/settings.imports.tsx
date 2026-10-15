import type { MetaFunction } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { type KeyboardEvent, useId, useState } from "react"
import type { ImportSource } from "~/domain/imports"
import { ImdbImportFlow } from "~/ui/imports/ImdbImportFlow"
import { SourceImportFlow } from "~/ui/imports/SourceImportFlow"

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

type ImportTab = "imdb" | ImportSource
const TABS: { id: ImportTab; label: string }[] = [
	{ id: "imdb", label: "IMDb" },
	{ id: "letterboxd", label: "Letterboxd" },
	{ id: "trakt", label: "Trakt" },
	{ id: "csv", label: "Generic CSV" },
	{ id: "movielens", label: "MovieLens" },
	{ id: "kodi", label: "Kodi" },
	{ id: "tmdb", label: "TMDB" },
	{ id: "plex", label: "Plex" },
	{ id: "myanimelist", label: "MyAnimeList / Kitsu" },
]

export default function SettingsImports() {
	const data = useLoaderData<typeof loader>()
	const [source, setSource] = useState<ImportTab>(data.initialSource ?? "imdb")
	const tabsId = useId()
	const chooseByKey = (
		event: KeyboardEvent<HTMLButtonElement>,
		index: number,
	) => {
		if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
		event.preventDefault()
		const next =
			event.key === "Home"
				? 0
				: event.key === "End"
					? TABS.length - 1
					: (index + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) %
						TABS.length
		setSource(TABS[next].id)
		document.getElementById(`${tabsId}-${TABS[next].id}`)?.focus()
	}
	const activeName = TABS.find((tab) => tab.id === source)?.label
	return (
		<div className="px-2 md:px-4 lg:px-8">
			<div className="flex max-w-2xl flex-col gap-6 text-base text-gray-300">
				<div>
					<h2 className="font-bold tracking-tight text-gray-100 text-base sm:text-lg md:text-xl lg:text-2xl">
						Import your library
					</h2>
					<p className="mt-2 text-gray-400">
						Bring your ratings and activity into GoodWatch. Choose where your
						data comes from, preview it, and decide what to import.
					</p>
				</div>
				<div
					role="tablist"
					aria-label="Import source"
					className="grid grid-cols-2 sm:grid-cols-4 rounded-lg border border-slate-700 bg-slate-900 p-1"
				>
					{TABS.map((tab, index) => (
						<button
							key={tab.id}
							id={`${tabsId}-${tab.id}`}
							type="button"
							role="tab"
							aria-selected={source === tab.id}
							aria-controls={`${tabsId}-panel`}
							tabIndex={source === tab.id ? 0 : -1}
							onKeyDown={(event) => chooseByKey(event, index)}
							onClick={() => setSource(tab.id)}
							className={`min-h-11 cursor-pointer rounded-md px-2 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-indigo-400 ${source === tab.id ? "bg-indigo-700 text-white" : "text-gray-300 hover:bg-slate-800 hover:text-white"}`}
						>
							{tab.label}
						</button>
					))}
				</div>
				<div
					id={`${tabsId}-panel`}
					role="tabpanel"
					aria-label={`${activeName} import`}
				>
					{source === "imdb" ? (
						<ImdbImportFlow initial={{ imports: data.imports }} />
					) : (
						<SourceImportFlow
							key={`${source}:${data.openImport ?? ""}:${data.connectState ?? ""}`}
							source={source}
							initial={{ imports: data.sourceImports }}
							connectState={
								source === data.initialSource ? data.connectState : undefined
							}
							initialId={
								source === data.initialSource ? data.openImport : undefined
							}
						/>
					)}
				</div>
			</div>
		</div>
	)
}
