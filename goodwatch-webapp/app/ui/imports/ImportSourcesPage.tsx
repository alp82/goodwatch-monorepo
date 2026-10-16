// The Imports page: one box on top that takes any export file and names its source, then every live source in a
// searchable list, most common first. A source opens in place with its own steps, upload box, and history.
import { ChevronDownIcon, ClockIcon } from "@heroicons/react/20/solid"
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import { useEffect, useId, useState } from "react"
import type { ImdbImportSummary } from "~/domain/imdb-import"
import type { ImportSummary } from "~/domain/imports"
import { useHydrated } from "~/utils/hydrated"
import { ImdbImportFlow } from "./ImdbImportFlow"
import {
	AnyFileBox,
	ImportFileRouting,
	type ImportHandoff,
	type MovieLensFiles,
	MovieLensFilesContext,
} from "./ImportFileRouting"
import {
	IMPORT_SOURCE_LIST,
	type ImportSourceEntry,
	type ImportSourceId,
	importSourceName,
	lastImported,
	searchImportSources,
} from "./ImportSources"
import { SourceImportFlow } from "./SourceImportFlow"
import { useSourceImports } from "./SourceImportHooks"
import { SourceMark } from "./SourceMark"
import { useImdbImports } from "./api"
import { formatDate, stepHeading, textLink } from "./shared"

export interface ImportSourcesPageProps {
	imdbImports: ImdbImportSummary[]
	sourceImports: ImportSummary[]
	initialSource?: ImportSourceId
	connectState?: string
	openImport?: string
}

export function ImportSourcesPage({
	imdbImports,
	sourceImports,
	initialSource,
	connectState,
	openImport,
}: ImportSourcesPageProps) {
	const imdb = useImdbImports({ imports: imdbImports })
	const native = useSourceImports({ imports: sourceImports })
	const imported = lastImported(
		imdb.data?.imports ?? [],
		native.data?.imports ?? [],
	)
	const [open, setOpen] = useState<ImportSourceId | null>(initialSource ?? null)
	const [query, setQuery] = useState("")
	const found = searchImportSources(query)
	const listId = useId()
	// The latest file handed to a source; `count` gives each one a fresh flow.
	const [handoff, setHandoff] = useState<
		(ImportHandoff & { count: number }) | null
	>(null)
	const route = (next: ImportHandoff) => {
		setQuery("")
		setOpen(next.recognition.source)
		setHandoff({ ...next, count: (handoff?.count ?? 0) + 1 })
	}
	const toggle = (id: ImportSourceId) => {
		setHandoff(null)
		setOpen(open === id ? null : id)
	}
	// Focus moves to the source that took the file, so it is announced, and the page scrolls to it.
	useEffect(() => {
		if (!handoff) return
		const row = document.getElementById(
			`${listId}-${handoff.recognition.source}-row`,
		)
		row?.querySelector("button")?.focus({ preventScroll: true })
		row?.scrollIntoView?.({ block: "start", behavior: "smooth" })
	}, [handoff, listId])
	const movieLensFiles = useState<MovieLensFiles>({})
	// The date follows the member's time zone, which the server doesn't know.
	const hydrated = useHydrated()

	const row = (source: ImportSourceEntry) => {
		const expanded = open === source.id
		const at = imported.get(source.id)
		const label = at
			? hydrated
				? `Imported ${formatDate(at)}`
				: "Imported"
			: source.connect
				? "Connect"
				: null
		const handed =
			handoff?.recognition.source === source.id ? handoff : undefined
		return (
			<li
				key={source.id}
				id={`${listId}-${source.id}-row`}
				className={`scroll-mt-4 ${expanded ? "bg-slate-900" : ""}`}
			>
				<button
					type="button"
					aria-expanded={expanded}
					aria-controls={`${listId}-${source.id}`}
					onClick={() => toggle(source.id)}
					className="flex min-h-14 w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-800/70 focus-visible:outline-2 focus-visible:outline-indigo-400"
				>
					<SourceMark source={source} />
					<span className="min-w-0 flex-1">
						<span className="flex flex-wrap items-center gap-x-2 gap-y-1">
							<span data-source-name className="font-semibold text-gray-100">
								{source.name}
							</span>
							{label && (
								<span
									data-source-label
									className={`rounded-full px-2 py-0.5 text-xs font-semibold ${at ? "bg-slate-700 text-gray-200" : "bg-indigo-900/80 text-indigo-100"}`}
								>
									{label}
								</span>
							)}
						</span>
						{/* Clamped, not truncated: unbreakable text would widen the settings column on a phone. */}
						<span className="line-clamp-1 text-sm text-gray-400">
							{source.gets.join(" · ")}
						</span>
					</span>
					<span className="hidden shrink-0 items-center gap-1 rounded-full border border-slate-700 px-2 py-0.5 text-xs font-semibold text-gray-300 sm:inline-flex">
						<ClockIcon className="size-3.5" aria-hidden />
						{source.wait}
					</span>
					<ChevronDownIcon
						className={`size-5 shrink-0 text-gray-400 ${expanded ? "rotate-180" : ""}`}
						aria-hidden
					/>
				</button>
				{expanded && (
					<div
						id={`${listId}-${source.id}`}
						className="border-t border-slate-800 px-3 pb-6 pt-4 sm:px-4"
					>
						{source.id === "imdb" ? (
							<ImdbImportFlow
								key={handed?.count ?? 0}
								initial={{ imports: imdbImports }}
								handoff={handed}
							/>
						) : (
							<SourceImportFlow
								key={`${source.id}:${openImport ?? ""}:${connectState ?? ""}:${handed?.count ?? 0}`}
								source={source.id}
								handoff={handed}
								initial={{ imports: sourceImports }}
								// Only the source the address names takes its connection and import.
								connectState={
									source.id === initialSource ? connectState : undefined
								}
								initialId={source.id === initialSource ? openImport : undefined}
							/>
						)}
					</div>
				)}
			</li>
		)
	}

	return (
		<ImportFileRouting.Provider value={route}>
			<MovieLensFilesContext.Provider value={movieLensFiles}>
				<div className="px-2 md:px-4 lg:px-8">
					<div className="flex max-w-2xl flex-col gap-6 text-base text-gray-300">
						<div>
							<h2 className="font-bold tracking-tight text-gray-100 text-base sm:text-lg md:text-xl lg:text-2xl">
								Import your library
							</h2>
							<p className="mt-2 text-gray-400">
								Bring your ratings, watches, and Want to See from another site
								or app. GoodWatch shows you everything before your library
								changes.
							</p>
						</div>
						<AnyFileBox />
						<section
							aria-labelledby={`${listId}-heading`}
							className="flex flex-col gap-3"
						>
							<h3 id={`${listId}-heading`} className={stepHeading}>
								Or choose where your library is now
							</h3>
							<label className="relative block">
								<span className="sr-only">Search sources</span>
								<MagnifyingGlassIcon
									className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-500"
									aria-hidden
								/>
								<input
									type="search"
									value={query}
									onChange={(event) => setQuery(event.target.value)}
									placeholder={`Search ${IMPORT_SOURCE_LIST.length} sources, for example Letterboxd`}
									className="min-h-11 w-full rounded-lg border border-slate-600 bg-slate-900 py-2 pl-10 pr-3 text-base text-gray-100 placeholder:text-gray-500 focus:border-indigo-400 focus:outline-none"
								/>
							</label>
							{found.length > 0 && (
								<ul className="divide-y divide-slate-800 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/60">
									{found.map(row)}
								</ul>
							)}
							{found.length === 0 && (
								<p className="text-gray-400">
									No source called "{query.trim()}". If your site can save a CSV
									file, try {importSourceName("csv")}.
								</p>
							)}
							<div className="flex flex-col items-start text-sm text-gray-400">
								<p>
									Coming from TV Time? TV Time closed on July 15, 2026. Trakt
									imports a saved TV Time file: import it on Trakt, then upload
									your Trakt export here.
								</p>
								<button
									type="button"
									className={`${textLink} min-h-11`}
									onClick={() => {
										if (!found.some((source) => source.id === "trakt"))
											setQuery("")
										setOpen("trakt")
									}}
								>
									Open the Trakt import
								</button>
							</div>
							<p className="text-xs text-gray-500">
								The logos show where a file comes from; no source endorses
								GoodWatch. IMDb, IMDbPro, STARmeter, and all related logos are
								trademarks of IMDb.com, Inc. or its affiliates. This product
								uses the TMDB API but is not endorsed or certified by TMDB.
							</p>
						</section>
					</div>
				</div>
			</MovieLensFilesContext.Provider>
		</ImportFileRouting.Provider>
	)
}
