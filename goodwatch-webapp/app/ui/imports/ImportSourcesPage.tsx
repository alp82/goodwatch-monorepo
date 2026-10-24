// The Imports page: the four-step import (Bring → Choose → Import → Done) with its stepper on top. Bring is one wide
// drop zone that takes any export file and names its source, the accounts to connect, how to get each source's file,
// and the imports so far. A file, a picked source, a return from connecting TMDB or Plex, or a past import opens that
// source's flow under the stepper, which reports back where it is.
import { useEffect, useRef, useState } from "react"
import type { ImdbImportSummary } from "~/domain/imdb-import"
import type { ImportSummary } from "~/domain/imports"
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
import {
	Disclosure,
	ImportStepReport,
	type ImportStepState,
	ImportStepper,
	ProblemCard,
} from "./ImportFlowParts"
import {
	IMPORT_SOURCE_LIST,
	type ImportSourceEntry,
	type ImportSourceId,
} from "./ImportSources"
import { SourceImportFlow } from "./SourceImportFlow"
import { useSourceImports } from "./SourceImportHooks"
import { SourceMark } from "./SourceMark"
import { useImdbImports } from "./api"
import {
	describeOutcome,
	formatCount,
	formatDate,
	secondaryButton,
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

/** The source open under the stepper, and the import it opens on, if one was chosen. */
type Open = { id: ImportSourceId; importId?: string }

const AT_BRING: ImportStepState = {
	step: 1,
	notes: ["", "", "", ""],
	allDone: false,
}

/** The red card's title for a file the drop zone couldn't name. */
const unknownTitle = (hint: string) =>
	/larger than/i.test(hint)
		? "This file is too big"
		: /damaged/i.test(hint)
			? "This file is damaged"
			: "GoodWatch doesn't know this file"

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
	const [where, setWhere] = useState(false)
	const [reported, setReported] = useState<ImportStepState | null>(null)
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
		files.clear()
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
	const state = open && reported ? reported : AT_BRING
	const atBring = state.step === 1
	const unknown = files.unknown && (
		<ProblemCard
			title={unknownTitle(files.unknown.hint)}
			fileName={files.unknown.fileName}
			focus
		>
			<p>{files.unknown.hint}</p>
			<div>
				<button
					type="button"
					className={textLink}
					onClick={() => {
						setOpen(null)
						setWhere(true)
					}}
				>
					Where do I get my file?
				</button>
			</div>
		</ProblemCard>
	)
	return (
		<ImportFileRouting.Provider value={route}>
			<MovieLensFilesContext.Provider value={movieLensFiles}>
				<ImportStepReport.Provider value={setReported}>
					<div className="flex flex-col gap-8 md:gap-10">
						<PageDrop onFile={files.take} />
						<ImportStepper
							state={{
								...state,
								notes: [
									state.notes[0] || (source && atBring ? source.name : ""),
									state.notes[1],
									state.notes[2],
									state.notes[3],
								],
							}}
						/>
						<div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
							{unknown}
							{open && source ? (
								<section
									ref={card}
									tabIndex={-1}
									aria-label={`${source.name} import`}
									data-open-source={source.name}
									className="w-full scroll-mt-20 text-left outline-none"
								>
									{atBring && (
										<SourceHeader
											source={source}
											onOther={() => {
												setHandoff(null)
												files.clear()
												setOpen(null)
											}}
										/>
									)}
									{open.id === "imdb" ? (
										<ImdbImportFlow
											key={`${handed?.count ?? 0}:${open.importId ?? ""}`}
											initial={{ imports: imdbImports }}
											initialLists={sourceImports}
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
							) : (
								<>
									<StartDropZone reading={files.reading} onFile={files.take} />
									<ConnectRow onConnect={pick} />
									<WhereToGet open={where} onToggle={setWhere} onPick={pick} />
								</>
							)}
							{atBring && (
								<History
									imdbImports={imdbImports}
									sourceImports={sourceImports}
									onOpen={(id, importId) => {
										setHandoff(null)
										files.clear()
										show({ id, importId })
									}}
								/>
							)}
							{atBring && (
								<Notes
									onTvTime={() => pick("tvtime")}
									onTrakt={() => pick("trakt")}
								/>
							)}
						</div>
					</div>
				</ImportStepReport.Provider>
			</MovieLensFilesContext.Provider>
		</ImportFileRouting.Provider>
	)
}

const CONNECTABLE = IMPORT_SOURCE_LIST.filter((source) => source.connect)

/** The accounts GoodWatch connects to instead of a file. */
function ConnectRow({
	onConnect,
}: { onConnect: (id: ImportSourceId) => void }) {
	return (
		<div className="flex flex-col items-center gap-3">
			<p className="text-sm text-gray-400">Or connect an account</p>
			<ul className="flex flex-wrap justify-center gap-3" data-connect-sources>
				{CONNECTABLE.map((source) => (
					<li key={source.id}>
						<button
							type="button"
							className={secondaryButton}
							data-source-mark={source.name}
							onClick={() => onConnect(source.id)}
						>
							<span className="-my-1 scale-75">
								<SourceMark source={source} />
							</span>
							{source.name}
							<span className="sr-only">: connect your account</span>
						</button>
					</li>
				))}
			</ul>
		</div>
	)
}

/** Every source that gives a file: what it brings, how long the file takes, and its how-to on a tap. */
function WhereToGet({
	open,
	onToggle,
	onPick,
}: {
	open: boolean
	onToggle: (open: boolean) => void
	onPick: (id: ImportSourceId) => void
}) {
	return (
		<Disclosure label="Where do I get my file?" open={open} onToggle={onToggle}>
			<ul className="grid gap-2 sm:grid-cols-2" data-file-sources>
				{IMPORT_SOURCE_LIST.filter((source) => !source.connect).map(
					(source) => (
						<li key={source.id}>
							<FileSource source={source} onPick={onPick} />
						</li>
					),
				)}
			</ul>
		</Disclosure>
	)
}

function FileSource({
	source,
	onPick,
}: {
	source: ImportSourceEntry
	onPick: (id: ImportSourceId) => void
}) {
	return (
		<button
			type="button"
			data-source-mark={source.name}
			onClick={() => onPick(source.id)}
			className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg bg-slate-900/60 p-3 text-left ring-1 ring-slate-800 hover:bg-slate-800"
		>
			<SourceMark source={source} />
			<span className="min-w-0">
				<span className="block font-semibold text-white">{source.name}</span>
				<span className="block text-xs text-gray-400">
					{source.gets.slice(0, 3).join(", ")} · {source.wait}
				</span>
			</span>
			<span className="sr-only">: how to get your file</span>
		</button>
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
	const [open, setOpen] = useState(false)
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
				source: item.source === "imdb_list" ? ("imdb" as const) : item.source,
				at: item.finishedAt ?? item.createdAt,
				line: nativeOutcome(item),
			})),
	].sort((a, b) => b.at.localeCompare(a.at))
	if (past.length === 0) return null
	return (
		<section aria-label="Past imports" data-past-imports>
			<Disclosure
				label={`Past imports (${formatCount(past.length)})`}
				open={open}
				onToggle={setOpen}
				keepMounted
			>
				<p className="mb-3 text-sm text-gray-400">
					Open an import to see what it changed, or to undo it.
				</p>
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
										<span
											data-import-date
											className="font-normal text-gray-500"
										>
											· {hydrated ? formatDate(item.at) : "Imported"}
										</span>
									</span>
									<span className="block text-sm text-gray-400">
										{item.line}
									</span>
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
			</Disclosure>
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
				TMDB, Plex, or MDBList, or your anime on MyAnimeList or Kitsu, import it
				from there.
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
