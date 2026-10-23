// The first thing on the IMDb import page: choose or drop the CSV file. It is read in the browser and sent for a preview.
import { ArrowUpTrayIcon } from "@heroicons/react/24/solid"
import { type DragEvent, useRef, useState } from "react"
import { imdbCsvKind } from "~/domain/imdb-file"
import type { ImdbFileChoice } from "~/domain/imdb-file"
import {
	IMDB_IMPORT_MAX_BYTES,
	type ImdbFileSummary,
} from "~/domain/imdb-import"
import { Spinner } from "~/ui/wait/Spinner"
import {
	type ImportHandoff,
	RecognizedLine,
	useHandoffUpload,
	useWrongSourceCatch,
} from "./ImportFileRouting"
import { usePreviewImdbImport } from "./api"
import { errorBox, primaryButton, stepHeading } from "./shared"

export function ImdbUpload({
	onPreview,
	handoff,
}: {
	onPreview: (summary: ImdbFileSummary) => void
	/** A recognized IMDb file; lists need an explicit Watchlist/custom-list choice. */
	handoff?: ImportHandoff
}) {
	const inputRef = useRef<HTMLInputElement>(null)
	const readSequence = useRef(0)
	const [dragging, setDragging] = useState(false)
	const [listName, setListName] = useState("")
	const [listFile, setListFile] = useState<File | null>(null)
	const [legacyAmbiguous, setLegacyAmbiguous] = useState(false)
	const [listKind, setListKind] = useState<ImdbFileChoice | null>(null)
	const preview = usePreviewImdbImport()
	const wrongSource = useWrongSourceCatch("imdb")

	const upload = async (file: File) => {
		setListFile(null)
		setListKind(null)
		setLegacyAmbiguous(false)
		const sequence = ++readSequence.current
		try {
			if (file.size <= IMDB_IMPORT_MAX_BYTES) {
				const kind = imdbCsvKind(await file.text())
				if (kind === "list" || kind === "legacy-ambiguous") {
					if (sequence === readSequence.current) {
						setListFile(file)
						setListName(file.name.replace(/\.csv$/i, ""))
						setListKind(/watchlist/i.test(file.name) ? "watchlist" : null)
						setLegacyAmbiguous(kind === "legacy-ambiguous")
					}
					return
				}
			}
		} catch {
			/* The mutation presents the existing file-read error. */
		}
		if (sequence !== readSequence.current) return
		preview.mutate(file, {
			onSuccess: (response) => onPreview(response.import),
		})
	}
	const send = async (file: File | undefined) => {
		if (!file || preview.isPending) return
		if ((await wrongSource.check(file)).send) upload(file)
	}
	useHandoffUpload(handoff, upload)

	const onDrop = (event: DragEvent<HTMLDivElement>) => {
		event.preventDefault()
		setDragging(false)
		send(event.dataTransfer.files[0])
	}

	return (
		<section
			aria-labelledby="imdb-upload-heading"
			className="flex flex-col gap-4"
		>
			<h3 id="imdb-upload-heading" className={stepHeading}>
				Upload your file
			</h3>
			{handoff && <RecognizedLine handoff={handoff} />}
			<div
				onDragOver={(event) => {
					event.preventDefault()
					setDragging(true)
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={onDrop}
				className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-8 text-center ${dragging ? "border-indigo-400 bg-indigo-950/60" : "border-slate-600 bg-slate-900/60"}`}
			>
				{preview.isPending ? (
					<Spinner size="medium" />
				) : (
					<ArrowUpTrayIcon className="h-8 w-8 text-gray-500" aria-hidden />
				)}
				<p id="imdb-upload-hint" aria-live="polite">
					{preview.isPending
						? "Reading your file. This can take a moment."
						: "Drop the CSV file from IMDb here, or choose it from your device."}
				</p>
				{/* Stays focusable while the file is read, so keyboard focus isn't lost. */}
				<button
					type="button"
					className={`${primaryButton} ${preview.isPending ? "opacity-60" : ""}`}
					aria-describedby="imdb-upload-hint"
					aria-disabled={preview.isPending}
					onClick={() => {
						if (!preview.isPending) inputRef.current?.click()
					}}
				>
					Choose CSV file
				</button>
				<input
					ref={inputRef}
					type="file"
					accept=".csv,text/csv"
					hidden
					tabIndex={-1}
					aria-hidden
					onChange={(event) => {
						send(event.target.files?.[0])
						// Let the same file be chosen again after an error.
						event.target.value = ""
					}}
				/>
			</div>
			{listFile && (
				<fieldset className="space-y-3">
					<legend className="font-semibold text-gray-100">
						{legacyAmbiguous
							? "Which IMDb export is this?"
							: "Which IMDb list did this file come from?"}
					</legend>
					<p className="text-sm text-gray-400">
						{legacyAmbiguous
							? "This may be an old ratings or Watchlist export. Choose the export you downloaded."
							: "Watchlist and custom lists use the same columns. Choose the list you exported."}
					</p>
					{(legacyAmbiguous
						? ([
								[
									"ratings",
									"Ratings",
									"Imports personal ratings without adding titles to Want to See.",
								],
								[
									"watchlist",
									"My Watchlist",
									"Adds movies and shows to Want to See and imports personal ratings when present.",
								],
							] as const)
						: ([
								[
									"watchlist",
									"My Watchlist",
									"Adds movies and shows to Want to See and imports personal ratings when present.",
								],
								[
									"custom-list",
									"A custom list",
									"Creates a private GoodWatch list with its original order and notes, and imports personal ratings when present.",
								],
							] as const)
					).map(([value, label, detail]) => (
						<label
							key={value}
							className="flex items-start gap-3 rounded-lg border border-slate-700 p-3"
						>
							<input
								type="radio"
								name="imdb-list-kind"
								checked={listKind === value}
								onChange={() => setListKind(value)}
							/>
							<span>
								<span className="block font-semibold">{label}</span>
								<span className="text-sm text-gray-400">{detail}</span>
							</span>
						</label>
					))}
					{listKind === "custom-list" && (
						<label className="block space-y-2">
							<span className="font-semibold text-gray-100">
								List name on IMDb
							</span>
							<input
								name="imdb-list-name"
								className="block w-full rounded border border-slate-600 bg-slate-900 p-2 text-gray-100"
								value={listName}
								maxLength={1000}
								onChange={(event) => setListName(event.target.value)}
							/>
							<span className="block text-sm text-gray-400">
								The filename is filled in as a starting point. Check that it
								matches the original list name on IMDb.
							</span>
						</label>
					)}
					<button
						type="button"
						className={primaryButton}
						disabled={
							!listKind ||
							(listKind === "custom-list" && !listName.trim()) ||
							preview.isPending
						}
						onClick={() =>
							listKind &&
							preview.mutate(
								{
									file: listFile,
									listKind,
									...(listKind === "custom-list"
										? { listName: listName.trim() }
										: {}),
								},
								{ onSuccess: (response) => onPreview(response.import) },
							)
						}
					>
						Preview import
					</button>
				</fieldset>
			)}
			{wrongSource.note}
			<p className="text-sm text-gray-400">
				You'll see what's in the file before anything is saved.
			</p>
			<div aria-live="assertive">
				{preview.isError && <p className={errorBox}>{preview.error.message}</p>}
			</div>
		</section>
	)
}
