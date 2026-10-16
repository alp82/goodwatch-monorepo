// Where a file goes on the Imports page. The one box on top names any file's source and hands the file to that
// source's upload panel, which sends it. A source's own panel checks a chosen file too, and offers to import a file
// from another source as that source instead of sending it to the wrong import.
import { ArrowUpTrayIcon } from "@heroicons/react/24/solid"
import {
	type Dispatch,
	type DragEvent,
	type ReactNode,
	type SetStateAction,
	createContext,
	useContext,
	useEffect,
	useId,
	useRef,
	useState,
} from "react"
import {
	type ImportFileRecognition,
	type ImportFileTarget,
	type RecognizedImportFile,
	recognizeImportFile,
} from "./ImportFileRecognition"
import {
	IMPORT_SOURCE_LIST,
	importAsName,
	importFileNoun,
} from "./ImportSources"
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

export interface MovieLensFiles {
	ratings?: File
	wishlist?: File
}
/** MovieLens's two files, kept by the page so a file handed over later fills the other slot. */
export const MovieLensFilesContext = createContext<
	[MovieLensFiles, Dispatch<SetStateAction<MovieLensFiles>>] | null
>(null)

/** The MovieLens files: the page's when it keeps them, otherwise the panel's own. */
export function useMovieLensFiles() {
	const shared = useContext(MovieLensFilesContext)
	const own = useState<MovieLensFiles>({})
	return shared ?? own
}

/** "a, b, and c". */
const list = (names: string[]) =>
	names.length < 3
		? names.join(" and ")
		: `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`
/** "a, b, or c". */
const either = (names: string[]) =>
	names.length < 3
		? names.join(" or ")
		: `${names.slice(0, -1).join(", ")}, or ${names.at(-1)}`

const reading = "Reading your file. Nothing is uploaded yet."

export function AnyFileBox() {
	const route = useContext(ImportFileRouting)
	const id = useId()
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
	const connect = IMPORT_SOURCE_LIST.filter((source) => source.connect)
	return (
		<section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
			<h3 id={`${id}-heading`} className={stepHeading}>
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
				<p id={`${id}-hint`} aria-live="polite">
					{busy
						? reading
						: "Drop the file a site gave you here, or choose it from your device. GoodWatch works out where it's from."}
				</p>
				<button
					type="button"
					className={primaryButton}
					disabled={busy}
					aria-describedby={`${id}-hint`}
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
				Reads files from{" "}
				{list(
					IMPORT_SOURCE_LIST.filter((source) => !source.connect).map(
						(source) => source.name,
					),
				)}
				.
				{connect.length > 0 &&
					` To bring ${either(connect.map((source) => source.name))}, open it in the list and connect your account.`}
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
 * For a source's own upload panel. `check` reads a chosen file: `send` is true when it may go to this source's
 * import, and otherwise the file is held back and `note` offers its real source. A file nobody recognizes still goes
 * to the chosen import, whose own check explains what is wrong with it.
 */
export function useWrongSourceCatch(source: ImportFileTarget): {
	check: (
		file: File,
	) => Promise<{ send: boolean; recognition: ImportFileRecognition | null }>
	note: ReactNode
} {
	const route = useContext(ImportFileRouting)
	const [caught, setCaught] = useState<ImportHandoff | null>(null)
	const check = async (file: File) => {
		setCaught(null)
		const recognition = await recognizeImportFile(file).catch(() => null)
		if (!route || !recognition?.source || recognition.source === source)
			return { send: true, recognition }
		setCaught({ file, recognition })
		return { send: false, recognition }
	}
	// The live region stays in place, so the note is announced when it appears.
	const note = (
		<div aria-live="polite">
			{caught && (
				<div className={`${infoBox} flex flex-col gap-3`}>
					<p>
						<span className="break-all font-semibold">{caught.file.name}</span>{" "}
						looks like {article(caught.recognition.label)}, not{" "}
						{importFileNoun(source)}.
					</p>
					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							className={primaryButton}
							onClick={() => route?.(caught)}
						>
							Import it as {importAsName(caught.recognition)}
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

/** "a Trakt export", "an IMDb ratings export". */
const article = (noun: string) =>
	`${/^[AEIOU]/i.test(noun) ? "an" : "a"} ${noun}`

/** Sends a handed-off file once, the first time the panel shows it. */
export function useHandoffUpload(
	handoff: ImportHandoff | undefined,
	upload: (file: File) => void,
) {
	const sent = useRef<File | null>(null)
	useEffect(() => {
		if (!handoff || sent.current === handoff.file) return
		sent.current = handoff.file
		upload(handoff.file)
	})
}

/** The line a panel shows above a file the one box handed it. */
export function RecognizedLine({
	handoff,
	next,
}: { handoff: ImportHandoff; next?: string }) {
	return (
		<p className="text-sm text-emerald-200">
			Recognized {handoff.recognition.label}:{" "}
			<span className="break-all">{handoff.file.name}</span>
			{next && `. ${next}`}
		</p>
	)
}
