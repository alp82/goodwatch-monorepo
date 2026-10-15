// Where a file goes on the Imports page. The one box on top names any file's source and hands the file to that
// source's upload panel, which sends it. A source's own panel checks a chosen file too, and offers to import a file
// from another source as that source instead of sending it to the wrong import.
import { ArrowUpTrayIcon } from "@heroicons/react/24/solid"
import {
	type DragEvent,
	type ReactNode,
	createContext,
	useContext,
	useRef,
	useState,
} from "react"
import {
	type ImportFileTarget,
	type RecognizedImportFile,
	recognizeImportFile,
} from "./ImportFileRecognition"
import { importSourceName } from "./ImportSources"
import {
	errorBox,
	infoBox,
	primaryButton,
	secondaryButton,
	stepHeading,
} from "./shared"

/** A file the page recognized, on its way to its source's upload panel. */
export interface ImportHandoff {
	file: File
	recognition: RecognizedImportFile
}

/** Opens the recognized source and hands it the file. Provided by the Imports page. */
export const ImportFileRouting = createContext<
	((handoff: ImportHandoff) => void) | null
>(null)

const reading = "Reading your file. Nothing is uploaded yet."

export function AnyFileBox() {
	const route = useContext(ImportFileRouting)
	const inputRef = useRef<HTMLInputElement>(null)
	const [dragging, setDragging] = useState(false)
	const [busy, setBusy] = useState(false)
	const [unknown, setUnknown] = useState<{
		fileName: string
		hint: string
	} | null>(null)
	const take = async (file?: File) => {
		if (!file || busy) return
		setBusy(true)
		setUnknown(null)
		const recognition = await recognizeImportFile(file).catch(() => null)
		setBusy(false)
		if (recognition?.source) route?.({ file, recognition })
		else
			setUnknown({
				fileName: file.name,
				hint:
					recognition?.hint ??
					"Upload the file as the site gave it to you, without opening or renaming it.",
			})
	}
	const drop = (event: DragEvent<HTMLDivElement>) => {
		event.preventDefault()
		setDragging(false)
		take(event.dataTransfer.files[0])
	}
	return (
		<section aria-labelledby="any-file-heading" className="flex flex-col gap-3">
			<h3 id="any-file-heading" className={stepHeading}>
				Upload an export
			</h3>
			<div
				onDragOver={(event) => {
					event.preventDefault()
					setDragging(true)
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={drop}
				className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-10 text-center ${dragging ? "border-indigo-400 bg-indigo-950/60" : "border-slate-600 bg-slate-900/60"}`}
			>
				<ArrowUpTrayIcon className="size-10 text-gray-500" aria-hidden />
				<p id="any-file-hint" aria-live="polite">
					{busy
						? reading
						: "Drop the file a site gave you here, or choose it from your device. GoodWatch works out where it's from."}
				</p>
				<button
					type="button"
					className={primaryButton}
					disabled={busy}
					aria-describedby="any-file-hint"
					onClick={() => inputRef.current?.click()}
				>
					Choose file
				</button>
				<input
					ref={inputRef}
					type="file"
					aria-label="Choose an export file from any source"
					className="sr-only"
					tabIndex={-1}
					onChange={(event) => {
						take(event.target.files?.[0])
						event.target.value = ""
					}}
				/>
			</div>
			<p className="text-sm text-gray-400">
				Reads exports from IMDb, Letterboxd, Trakt, MyAnimeList, Kitsu, Kodi,
				and MovieLens, and CSV files in Letterboxd's import format. For TMDB,
				choose TMDB in the list to connect your account.
			</p>
			<div aria-live="assertive">
				{unknown && (
					<p className={errorBox}>
						GoodWatch doesn't recognize{" "}
						<span className="break-all font-semibold">{unknown.fileName}</span>.{" "}
						{unknown.hint}
					</p>
				)}
			</div>
		</section>
	)
}

/**
 * For a source's own upload panel: `check` resolves true when a chosen file may go to this source's import, and
 * otherwise holds the file back and shows `note`, which offers its real source. A file nobody recognizes still goes
 * to the chosen import, whose own check explains what is wrong with it.
 */
export function useWrongSourceCatch(source: ImportFileTarget): {
	check: (file: File) => Promise<boolean>
	note: ReactNode
} {
	const route = useContext(ImportFileRouting)
	const [caught, setCaught] = useState<ImportHandoff | null>(null)
	const check = async (file: File) => {
		setCaught(null)
		if (!route) return true
		const recognition = await recognizeImportFile(file).catch(() => null)
		if (!recognition?.source || recognition.source === source) return true
		setCaught({ file, recognition })
		return false
	}
	// The live region stays in place, so the note is announced when it appears.
	const note = (
		<div aria-live="polite">
			{caught && (
				<div className={`${infoBox} flex flex-col gap-3`}>
					<p>
						<span className="break-all font-semibold">{caught.file.name}</span>{" "}
						looks like {article(caught.recognition.label)}, not {fileOf(source)}
						.
					</p>
					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							className={primaryButton}
							onClick={() => route?.(caught)}
						>
							Import it as {shortName(caught.recognition)}
						</button>
						<button
							type="button"
							className={secondaryButton}
							onClick={() => setCaught(null)}
						>
							Choose another file
						</button>
					</div>
				</div>
			)}
		</div>
	)
	return { check, note }
}

/** What a file for this source is called in a sentence. */
const fileOf = (source: ImportFileTarget) =>
	source === "csv"
		? "a CSV file in Letterboxd's import format"
		: source === "myanimelist"
			? "a MyAnimeList or Kitsu file"
			: article(`${importSourceName(source)} file`)

/** The source a recognized file belongs to, as a short name. */
const shortName = (recognition: RecognizedImportFile) =>
	recognition.source === "csv"
		? "a CSV file"
		: recognition.source === "myanimelist"
			? recognition.label.startsWith("Kitsu")
				? "Kitsu"
				: "MyAnimeList"
			: importSourceName(recognition.source)

/** "a Trakt export", "an IMDb ratings export". */
const article = (noun: string) =>
	`${/^[AEIOU]/i.test(noun) ? "an" : "a"} ${noun}`

/** The line a panel shows above a file the one box handed it. */
export function RecognizedLine({ handoff }: { handoff: ImportHandoff }) {
	return (
		<p className="text-sm text-emerald-200">
			Recognized {handoff.recognition.label}:{" "}
			<span className="break-all">{handoff.file.name}</span>
		</p>
	)
}
