// The Imports page, built from the Taste start's import step (ui/taste/start): one wide drop zone that takes any
// export file and names its source, with every source's mark inside it. A file, a picked mark, a return from
// connecting TMDB or Plex, or a past import opens that source's own import under the zone: its steps, upload or
// connection, preview, progress, receipt and undo. Under it, every import so far, newest first.
import { useEffect, useRef, useState } from "react"
import type { ImdbImportSummary } from "~/domain/imdb-import"
import type { ImportSummary } from "~/domain/imports"
import { SourceLogoRow } from "~/ui/taste/start/SourceLogoRow"
import {
	PageDrop,
	SourceHeader,
	StartDropZone,
	sourceEntry,
	useFileTaking,
} from "~/ui/taste/start/StartImport"
import { useHydrated } from "~/utils/hydrated"
import { ImdbImportFlow } from "./ImdbImportFlow"
import {
	ImportFileRouting,
	type ImportHandoff,
	type MovieLensFiles,
	MovieLensFilesContext,
} from "./ImportFileRouting"
import type { ImportSourceId } from "./ImportSources"
import { SourceImportFlow } from "./SourceImportFlow"
import { useSourceImports } from "./SourceImportHooks"
import { SourceMark } from "./SourceMark"
import { useImdbImports } from "./api"
import {
	describeOutcome,
	errorBox,
	formatCount,
	formatDate,
	textLink,
} from "./shared"

/** The Imports page's title and what it says under it. */
export const IMPORTS_HEADING = {
	title: "Imports",
	subtitle:
		"Bring your ratings, watches, and Want to See from another site or app. GoodWatch shows you everything before your library changes.",
}

export interface ImportSourcesPageProps {
	imdbImports: ImdbImportSummary[]
	sourceImports: ImportSummary[]
	initialSource?: ImportSourceId
	connectState?: string
	openImport?: string
}

/** The source open under the zone, and the import it opens on, if one was chosen. */
type Open = { id: ImportSourceId; importId?: string }

export function ImportSourcesPage({
	imdbImports,
	sourceImports,
	initialSource,
	connectState,
	openImport,
}: ImportSourcesPageProps) {
	const [open, setOpen] = useState<Open | null>(
		initialSource ? { id: initialSource, importId: openImport } : null,
	)
	// A new address on the same page (a return from connecting) opens what it names.
	useEffect(() => {
		if (initialSource) setOpen({ id: initialSource, importId: openImport })
	}, [initialSource, openImport])
	// The latest file handed to a source; `count` gives each one a fresh flow.
	const [handoff, setHandoff] = useState<
		(ImportHandoff & { count: number }) | null
	>(null)
	// Set by the member's own act, so the opened source takes focus then and not on arrival.
	const [acted, setActed] = useState(0)
	const show = (next: Open) => {
		setOpen(next)
		setActed((n) => n + 1)
	}
	const route = (next: ImportHandoff) => {
		setHandoff({ ...next, count: (handoff?.count ?? 0) + 1 })
		show({ id: next.recognition.source })
	}
	const files = useFileTaking(route)
	const pick = (id: ImportSourceId) => {
		setHandoff(null)
		show({ id })
	}
	const movieLensFiles = useState<MovieLensFiles>({})

	// Focus moves to the source that opened, so it is announced, and the page scrolls to it.
	const card = useRef<HTMLElement>(null)
	useEffect(() => {
		if (!acted) return
		card.current?.focus({ preventScroll: true })
		card.current?.scrollIntoView?.({ block: "start", behavior: "smooth" })
	}, [acted])

	const source = open ? sourceEntry(open.id) : null
	const handed =
		open && handoff?.recognition.source === open.id ? handoff : undefined
	return (
		<ImportFileRouting.Provider value={route}>
			<MovieLensFilesContext.Provider value={movieLensFiles}>
				<div className="flex flex-col gap-10">
					<PageDrop onFile={files.take} />
					{open && source ? (
						<div className="flex flex-col gap-3">
							{files.unknown && (
								<p role="alert" className={errorBox}>
									GoodWatch doesn't recognize{" "}
									<span className="break-all font-semibold">
										{files.unknown.fileName}
									</span>
									. {files.unknown.hint}
								</p>
							)}
							<section
								ref={card}
								tabIndex={-1}
								aria-label={`${source.name} import`}
								data-open-source={source.name}
								className="w-full scroll-mt-20 rounded-2xl bg-gray-900/90 p-5 text-left ring-1 ring-white/10 outline-none md:p-6"
							>
								<SourceHeader
									source={source}
									onOther={() => {
										setHandoff(null)
										files.clear()
										setOpen(null)
									}}
								/>
								{open.id === "imdb" ? (
									<ImdbImportFlow
										key={`${handed?.count ?? 0}:${open.importId ?? ""}`}
										initial={{ imports: imdbImports }}
										handoff={handed}
										initialId={open.importId}
									/>
								) : (
									<SourceImportFlow
										key={`${open.id}:${open.importId ?? ""}:${connectState ?? ""}:${handed?.count ?? 0}`}
										source={open.id}
										handoff={handed}
										initial={{ imports: sourceImports }}
										// Only the source the address names takes its connection.
										connectState={
											open.id === initialSource ? connectState : undefined
										}
										initialId={open.importId}
									/>
								)}
							</section>
						</div>
					) : (
						<StartDropZone
							reading={files.reading}
							unknown={files.unknown}
							onFile={files.take}
						>
							<SourceLogoRow
								prompt="Need the file, or want to connect an account? Pick where your library is"
								pickLabel={(s) => `Import from ${s.name}`}
								onPick={pick}
								onConnect={pick}
							/>
						</StartDropZone>
					)}
					<History
						imdbImports={imdbImports}
						sourceImports={sourceImports}
						onOpen={(id, importId) => {
							setHandoff(null)
							show({ id, importId })
						}}
					/>
					<Notes
						onTvTime={() => pick("tvtime")}
						onTrakt={() => pick("trakt")}
					/>
				</div>
			</MovieLensFilesContext.Provider>
		</ImportFileRouting.Provider>
	)
}

/** One past import, from either kind of history. */
interface Past {
	id: string
	source: ImportSourceId
	at: string
	line: string
}

const nativeOutcome = (item: ImportSummary) =>
	item.status === "undone"
		? "Undone"
		: item.status === "failed"
			? "Didn't finish"
			: item.status === "running"
				? "In progress"
				: `${formatCount(item.applied.added)} added, ${formatCount(item.applied.updated)} updated`

/** Every import so far, newest first. A preview is not an import yet, so it isn't listed. */
function History({
	imdbImports,
	sourceImports,
	onOpen,
}: {
	imdbImports: ImdbImportSummary[]
	sourceImports: ImportSummary[]
	onOpen: (source: ImportSourceId, importId: string) => void
}) {
	const imdb = useImdbImports({ imports: imdbImports })
	const native = useSourceImports({ imports: sourceImports })
	// The date follows the member's time zone, which the server doesn't know.
	const hydrated = useHydrated()
	const past: Past[] = [
		...(imdb.data?.imports ?? [])
			.filter((item) => item.status !== "preview")
			.map((item) => ({
				id: item.id,
				source: "imdb" as const,
				at: item.finishedAt ?? item.createdAt,
				line: describeOutcome(item),
			})),
		...(native.data?.imports ?? [])
			.filter((item) => item.status !== "preview")
			.map((item) => ({
				id: item.id,
				source: item.source,
				at: item.finishedAt ?? item.createdAt,
				line: nativeOutcome(item),
			})),
	].sort((a, b) => b.at.localeCompare(a.at))
	if (past.length === 0) return null
	return (
		<section aria-labelledby="imports-history" className="flex flex-col gap-3">
			<div>
				<h2 id="imports-history" className="text-lg font-bold text-white">
					Brought in so far
				</h2>
				<p className="text-sm text-gray-400">
					Open an import to see what it changed, or to undo it.
				</p>
			</div>
			<ul
				data-import-history
				className="divide-y divide-white/10 overflow-hidden rounded-2xl bg-white/[0.03] ring-1 ring-white/10"
			>
				{past.map((item) => {
					const source = sourceEntry(item.source)
					return (
						<li
							key={item.id}
							className="flex flex-wrap items-center gap-3 px-4 py-3"
						>
							<SourceMark source={source} />
							<span className="min-w-0 flex-1">
								<span className="block font-semibold text-gray-100">
									{source.name}{" "}
									<span data-import-date className="font-normal text-gray-500">
										· {hydrated ? formatDate(item.at) : "Imported"}
									</span>
								</span>
								<span className="block text-sm text-gray-400">{item.line}</span>
							</span>
							<button
								type="button"
								className={`${textLink} min-h-11`}
								onClick={() => onOpen(item.source, item.id)}
							>
								Open
								<span className="sr-only"> the {source.name} import</span>
							</button>
						</li>
					)
				})}
			</ul>
		</section>
	)
}

/** A credit link that opens in a new tab, and says so. */
function NewTab({ href, children }: { href: string; children: string }) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className="underline underline-offset-2 hover:text-gray-300"
		>
			{children}
			<span className="sr-only"> (opens in a new tab)</span>
		</a>
	)
}

/** TV Time, streaming services, and the logos' notices. */
function Notes({
	onTvTime,
	onTrakt,
}: { onTvTime: () => void; onTrakt: () => void }) {
	return (
		<div className="flex max-w-3xl flex-col gap-4 text-sm text-gray-400">
			<div className="flex flex-col items-start">
				<p>
					Coming from TV Time? TV Time closed on July 15, 2026. Upload the
					export you saved: TV Time's own gdpr-data.zip, or a file from the TV
					Time Liberator or TV Time Out extension. If you already moved your
					history to Trakt, import your Trakt export instead.
				</p>
				<div className="flex flex-wrap gap-x-5">
					<button
						type="button"
						className={`${textLink} min-h-11`}
						onClick={onTvTime}
					>
						Open the TV Time import
					</button>
					<button
						type="button"
						className={`${textLink} min-h-11`}
						onClick={onTrakt}
					>
						Open the Trakt import
					</button>
				</div>
			</div>
			<p>
				Netflix, Prime Video, Disney+ and other streaming services don't give
				you a file of your list yet. If you also keep a watchlist on Trakt,
				TMDB, or Plex, or your anime on MyAnimeList or Kitsu, import it from
				there.
			</p>
			<p className="text-xs text-gray-500">
				The logos show where a file comes from; no source endorses GoodWatch.
				IMDb, IMDbPro, STARmeter, and all related logos are trademarks of
				IMDb.com, Inc. or its affiliates. Kodi® is a registered trademark of the
				Kodi Foundation. This product uses the TMDB API but is not endorsed or
				certified by TMDB.
			</p>
			<p className="text-xs text-gray-500">
				TV Time logo: "Logo TV Time" by{" "}
				<NewTab href="https://commons.wikimedia.org/wiki/User:Vegetapple">
					Vegetapple
				</NewTab>
				, from{" "}
				<NewTab href="https://commons.wikimedia.org/wiki/File:Logo_TV_Time.svg">
					Wikimedia Commons
				</NewTab>
				, licensed under{" "}
				<NewTab href="https://creativecommons.org/licenses/by-sa/4.0/">
					CC BY-SA 4.0
				</NewTab>
				. Its styles were moved into its shapes; it looks the same.
			</p>
		</div>
	)
}
