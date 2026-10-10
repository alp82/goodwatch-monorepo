import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { type KeyboardEvent, useId, useState } from "react"
import type { ImdbImportListResponse } from "~/domain/imdb-import"
import type { ImportSource, ImportSummary } from "~/domain/imports"
import { listImportRows, summarize } from "~/server/imdb-import/store.server"
import { listImports } from "~/server/imports/service.server"
import { ImdbImportFlow } from "~/ui/imports/ImdbImportFlow"
import { SourceImportFlow } from "~/ui/imports/SourceImportFlow"
import { getAuthFromRequest } from "~/utils/auth"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => [
	{ title: "Imports Settings | GoodWatch" },
	{
		name: "description",
		content:
			"Import ratings, watches and lists from IMDb, Letterboxd or Trakt into GoodWatch.",
	},
	{ name: "robots", content: "noindex, nofollow" },
]

// The earlier imports come with the page, so it shows at once. They are an extra: if they can't be read,
// the page still offers the upload.
interface LoaderData extends ImdbImportListResponse {
	sourceImports: ImportSummary[]
}

export async function loader({ request }: LoaderFunctionArgs) {
	const { user, headers } = await getAuthFromRequest({ request })
	headers.set("Cache-Control", "private, no-store")
	if (!user)
		return json<LoaderData>({ imports: [], sourceImports: [] }, { headers })
	const [imdb, native] = await Promise.all([
		listImportRows(user.id)
			.then((rows) => rows.map(summarize))
			.catch((error) => {
				console.error("IMDb import: reading history failed:", error)
				return []
			}),
		listImports(user.id).catch((error) => {
			console.error("Source import: reading history failed:", error)
			return []
		}),
	])
	return json<LoaderData>({ imports: imdb, sourceImports: native }, { headers })
}

type ImportTab = "imdb" | ImportSource
const TABS: { id: ImportTab; label: string }[] = [
	{ id: "imdb", label: "IMDb" },
	{ id: "letterboxd", label: "Letterboxd" },
	{ id: "trakt", label: "Trakt" },
]

export default function SettingsImports() {
	const data = useLoaderData<typeof loader>()
	const [source, setSource] = useState<ImportTab>("imdb")
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
						export comes from, preview it, and decide what to import.
					</p>
				</div>
				<div
					role="tablist"
					aria-label="Import source"
					className="grid grid-cols-3 rounded-lg border border-slate-700 bg-slate-900 p-1"
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
							key={source}
							source={source}
							initial={{ imports: data.sourceImports }}
						/>
					)}
				</div>
			</div>
		</div>
	)
}
