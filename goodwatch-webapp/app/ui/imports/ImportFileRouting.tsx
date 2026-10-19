// Where a file goes on the Imports page. The drop zone on top names any file's source and hands the file to that
// source's upload panel, which sends it. A source's own panel checks a chosen file too, and offers to import a file
// from another source as that source instead of sending it to the wrong import.
import {
	type Dispatch,
	type ReactNode,
	type SetStateAction,
	createContext,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react"
import {
	type ImportFileRecognition,
	type ImportFileTarget,
	type RecognizedImportFile,
	recognizeImportFile,
} from "./ImportFileRecognition"
import { importAsName, importFileNoun } from "./ImportSources"
import { infoBox, primaryButton, secondaryButton } from "./shared"

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
