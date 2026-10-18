// The import half of the Taste start. A dropped or chosen file is read in the browser to name its source, then goes
// to that source's own import, the same one Settings → Imports runs: preview, Import, progress, receipt, and undo.
import {
	ArrowTopRightOnSquareIcon,
	ArrowUpTrayIcon,
	ClockIcon,
} from "@heroicons/react/20/solid"
import {
	type DragEvent,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react"
import { IMPORT_SOURCE_UPLOAD } from "~/domain/imports"
import { ImdbExportSteps } from "~/ui/imports/ImdbExportSteps"
import { ImdbImportFlow } from "~/ui/imports/ImdbImportFlow"
import { recognizeImportFile } from "~/ui/imports/ImportFileRecognition"
import {
	ImportFileRouting,
	type ImportHandoff,
	type MovieLensFiles,
	MovieLensFilesContext,
} from "~/ui/imports/ImportFileRouting"
import {
	IMPORT_SOURCE_LIST,
	type ImportSourceEntry,
	type ImportSourceId,
} from "~/ui/imports/ImportSources"
import { SourceImportFlow } from "~/ui/imports/SourceImportFlow"
import type { ImportListResponse } from "~/ui/imports/SourceImportHooks"
import { SourceMark } from "~/ui/imports/SourceMark"
import {
	IMPORTS_PATH,
	errorBox,
	primaryButton,
	secondaryButton,
} from "~/ui/imports/shared"

export const sourceEntry = (id: ImportSourceId) =>
	IMPORT_SOURCE_LIST.find((s) => s.id === id) as ImportSourceEntry

/** Account sources connect on the Imports page, where the connection comes back to. */
export const connectPath = (id: ImportSourceId) =>
	`${IMPORTS_PATH}?source=${id}`

/** Sources whose export takes long enough to rate a few titles meanwhile. */
export const SLOW_EXPORTS: ImportSourceId[] = ["imdb", "trakt"]

export function WaitChip({ source }: { source: ImportSourceEntry }) {
	return (
		<span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-700 px-2 py-0.5 text-xs font-semibold text-gray-300">
			<ClockIcon className="size-3.5" aria-hidden />
			{source.wait}
		</span>
	)
}

/** A file on its way to its source's import; `count` gives each one a fresh flow. */
export type StartHandoff = ImportHandoff & { count: number }

/** Reads a file, names its source, and hands it on; or says why GoodWatch can't read it. */
export function useFileTaking(onHandoff: (handoff: ImportHandoff) => void) {
	const [reading, setReading] = useState(false)
	const [unknown, setUnknown] = useState<{
		fileName: string
		hint: string
	} | null>(null)
	const take = async (file?: File) => {
		if (!file || reading) return
		setReading(true)
		setUnknown(null)
		const recognition = await recognizeImportFile(file).catch(() => null)
		setReading(false)
		if (recognition?.source) onHandoff({ file, recognition })
		else
			setUnknown({
				fileName: file.name,
				hint:
					recognition?.hint ??
					"Upload the file as the site gave it to you, without opening or renaming it.",
			})
	}
	return { take, reading, unknown, clear: () => setUnknown(null) }
}

/** Takes a file dropped anywhere on the page, with a hint over the whole screen while one is dragged. */
export function PageDrop({ onFile }: { onFile: (file?: File) => void }) {
	const [over, setOver] = useState(false)
	const latest = useRef(onFile)
	latest.current = onFile
	useEffect(() => {
		const enter = (e: globalThis.DragEvent) => {
			if (!e.dataTransfer?.types.includes("Files")) return
			e.preventDefault()
			setOver(true)
		}
		const leave = (e: globalThis.DragEvent) => {
			if (!e.relatedTarget) setOver(false)
		}
		const drop = (e: globalThis.DragEvent) => {
			if (!e.dataTransfer?.types.includes("Files")) return
			e.preventDefault()
			setOver(false)
			latest.current(e.dataTransfer.files[0])
		}
		window.addEventListener("dragover", enter)
		window.addEventListener("dragleave", leave)
		window.addEventListener("drop", drop)
		return () => {
			window.removeEventListener("dragover", enter)
			window.removeEventListener("dragleave", leave)
			window.removeEventListener("drop", drop)
		}
	}, [])
	if (!over) return null
	return (
		<div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-gray-950/85 p-4">
			<div className="rounded-3xl border-4 border-dashed border-amber-300 px-10 py-12 text-center text-2xl font-extrabold text-white">
				Drop your export anywhere
				<div className="mt-2 text-base font-normal text-gray-300">
					GoodWatch works out where it's from.
				</div>
			</div>
		</div>
	)
}

/** The wide drop zone at the heart of step 1, with the logo row inside it. */
export function StartDropZone({
	sourceName,
	reading,
	unknown,
	onFile,
	children,
}: {
	sourceName?: string
	reading: boolean
	unknown?: { fileName: string; hint: string } | null
	onFile: (file?: File) => void
	children?: ReactNode
}) {
	const input = useRef<HTMLInputElement>(null)
	const [over, setOver] = useState(false)
	const drop = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault()
		e.stopPropagation()
		setOver(false)
		onFile(e.dataTransfer.files[0])
	}
	return (
		<div
			onDragOver={(e) => {
				e.preventDefault()
				setOver(true)
			}}
			onDragLeave={() => setOver(false)}
			onDrop={drop}
			className={`flex w-full flex-col items-center gap-4 rounded-3xl border-2 border-dashed px-6 py-10 text-center md:py-14 ${over ? "border-amber-300 bg-amber-400/10" : "border-white/20 bg-gray-950/50 hover:border-white/35"}`}
		>
			<ArrowUpTrayIcon
				className={`size-12 transition-transform duration-300 md:size-14 ${over ? "-translate-y-1 text-amber-300" : "text-gray-400"}`}
				aria-hidden
			/>
			<p className="text-xl font-bold text-white md:text-2xl">
				{sourceName
					? `Drop your ${sourceName} file here`
					: "Drop your export here"}
			</p>
			<p
				id="start-drop-hint"
				aria-live="polite"
				className="max-w-md text-sm text-gray-400"
			>
				{reading
					? "Reading your file. Nothing is uploaded yet."
					: "GoodWatch works out where it's from and reads it on your device first. Nothing changes until you check it."}
			</p>
			<button
				type="button"
				className={primaryButton}
				disabled={reading}
				aria-describedby="start-drop-hint"
				onClick={() => input.current?.click()}
			>
				Choose file
			</button>
			<div aria-live="assertive" className="w-full max-w-2xl text-left">
				{unknown && <UnknownFile {...unknown} />}
			</div>
			<input
				ref={input}
				type="file"
				aria-label="Choose an export file from any source"
				className="sr-only"
				tabIndex={-1}
				onChange={(e) => {
					onFile(e.target.files?.[0])
					e.target.value = ""
				}}
			/>
			{children && (
				<div className="mt-6 w-full border-t border-white/10 pt-6">
					{children}
				</div>
			)}
		</div>
	)
}

function UnknownFile({ fileName, hint }: { fileName: string; hint: string }) {
	return (
		<p className={`${errorBox} w-full rounded-r-lg`}>
			GoodWatch doesn't recognize{" "}
			<span className="break-all font-semibold">{fileName}</span>. {hint}
		</p>
	)
}

function ExternalButton({
	href,
	children,
}: { href: string; children: ReactNode }) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className={secondaryButton}
		>
			{children}
			<ArrowTopRightOnSquareIcon className="size-4 shrink-0" aria-hidden />
			<span className="sr-only">(opens in a new tab)</span>
		</a>
	)
}

/** How to get the picked source's file, under the drop zone. */
export function SourceSteps({
	source,
	onOther,
	onRateMeanwhile,
}: {
	source: ImportSourceEntry
	onOther: () => void
	onRateMeanwhile: () => void
}) {
	const upload = source.id === "imdb" ? null : IMPORT_SOURCE_UPLOAD[source.id]
	return (
		<div className="w-full rounded-2xl bg-gray-900/85 p-5 text-left text-base text-gray-300 ring-1 ring-white/10 md:p-6">
			<SourceHeader source={source} onOther={onOther} />
			{source.id === "imdb" ? (
				<ImdbExportSteps />
			) : (
				<div className="flex flex-col items-start gap-3">
					{upload?.instructions.map((line) => (
						<p key={line}>{line}</p>
					))}
					{upload && "exportUrl" in upload && upload.exportUrl && (
						<ExternalButton href={upload.exportUrl}>
							Open {upload.exportLabel ?? source.name} export
						</ExternalButton>
					)}
				</div>
			)}
			{SLOW_EXPORTS.includes(source.id) && (
				<div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
					<span className="text-sm text-gray-400">
						{source.name} needs {source.wait.toLowerCase()} to make the file.
					</span>
					<button
						type="button"
						className={ghostButton}
						onClick={onRateMeanwhile}
					>
						Rate a few while you wait
					</button>
				</div>
			)}
		</div>
	)
}

export const ghostButton =
	"inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-gray-700 px-5 font-semibold text-gray-200 hover:border-gray-500 md:min-h-10"

export function SourceHeader({
	source,
	onOther,
}: { source: ImportSourceEntry; onOther: () => void }) {
	return (
		<div className="mb-4 flex flex-wrap items-center gap-3">
			<SourceMark source={source} />
			<span className="text-lg font-bold text-white">{source.name}</span>
			<WaitChip source={source} />
			<button
				type="button"
				className="ml-auto cursor-pointer text-sm font-semibold text-indigo-300 underline underline-offset-4 hover:text-indigo-200"
				onClick={onOther}
			>
				Pick another source
			</button>
		</div>
	)
}

/**
 * The recognized file's own import. A file of another source chosen inside it comes back through `onHandoff`, as on
 * the Imports page.
 */
export function StartImportFlow({
	handoff,
	sourceImports,
	onHandoff,
	onOther,
}: {
	handoff: StartHandoff
	sourceImports: ImportListResponse | undefined
	onHandoff: (handoff: ImportHandoff) => void
	onOther: () => void
}) {
	const movieLensFiles = useState<MovieLensFiles>({})
	const source = sourceEntry(handoff.recognition.source)
	return (
		<ImportFileRouting.Provider value={onHandoff}>
			<MovieLensFilesContext.Provider value={movieLensFiles}>
				<div className="w-full rounded-2xl bg-gray-900/90 p-5 text-left text-base text-gray-300 ring-1 ring-white/10 md:p-6">
					<SourceHeader source={source} onOther={onOther} />
					{source.id === "imdb" ? (
						<ImdbImportFlow key={handoff.count} handoff={handoff} />
					) : sourceImports ? (
						<SourceImportFlow
							key={`${source.id}:${handoff.count}`}
							source={source.id}
							handoff={handoff}
							initial={sourceImports}
						/>
					) : (
						<p className="animate-pulse text-gray-400">
							Getting your import ready…
						</p>
					)}
				</div>
			</MovieLensFilesContext.Provider>
		</ImportFileRouting.Provider>
	)
}
