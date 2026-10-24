// The IMDb Bring step: choose or drop the CSV file. It is read in the browser and sent for a preview. A Watchlist or
// custom list export looks like the other, so the member says which it is, one answer, before the preview.
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline"
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
import {
	Answer,
	BackArrow,
	ProblemCard,
	QuestionCopy,
	StepHeading,
	backClass,
	dropZoneClass,
	fileProblemTitle,
	headingClass,
	useLockIn,
} from "./ImportFlowParts"
import { usePreviewImdbImport } from "./api"
import { primaryButton } from "./shared"

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
	const lock = useLockIn()
	// A file named like a Watchlist suggests that answer; it is never picked for the member.
	const watchlistName = !!listFile && /watchlist/i.test(listFile.name)

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
						setListKind(null)
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
	const options = legacyAmbiguous
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
	const previewList = (kind: ImdbFileChoice) => {
		if (!listFile) return
		preview.mutate(
			{
				file: listFile,
				listKind: kind,
				...(kind === "custom-list" ? { listName: listName.trim() } : {}),
			},
			{ onSuccess: (response) => onPreview(response.import) },
		)
	}
	const pick = (kind: ImdbFileChoice) => {
		setListKind(kind)
		if (kind === "custom-list") return
		lock.lock(kind, () => previewList(kind))
	}

	if (listFile)
		return (
			<section
				aria-labelledby="imdb-upload-heading"
				className="flex flex-col gap-6"
			>
				<button
					type="button"
					className={backClass}
					disabled={preview.isPending}
					onClick={() => {
						lock.cancel()
						setListFile(null)
						setListKind(null)
					}}
				>
					<BackArrow />
					Back
				</button>
				<QuestionCopy value>
					<StepHeading focus id="imdb-upload-heading">
						{legacyAmbiguous
							? "This may be an old ratings or Watchlist export. Which IMDb export is it?"
							: "Watchlist and custom lists look the same. Which IMDb list did this file come from?"}
					</StepHeading>
					<p className="break-all text-sm text-gray-400">{listFile.name}</p>
					<fieldset
						disabled={!!lock.locking || preview.isPending}
						data-locked={lock.locking ? true : undefined}
						className="group/answers flex flex-col gap-3"
					>
						<legend className="sr-only">Your answer</legend>
						{options.map(([value, label, detail]) => (
							<Answer
								key={value}
								selected={listKind === value}
								recommended={value === "watchlist" && watchlistName}
								title={label}
								note={detail}
								onClick={() => pick(value)}
							/>
						))}
					</fieldset>
				</QuestionCopy>
				{listKind === "custom-list" && (
					<div className="flex flex-col gap-3">
						<label className="flex flex-col gap-2">
							<span className="font-semibold text-gray-100">
								List name on IMDb
							</span>
							<input
								name="imdb-list-name"
								className="block min-h-11 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-gray-100"
								value={listName}
								maxLength={1000}
								onChange={(event) => setListName(event.target.value)}
							/>
							<span className="text-sm text-gray-400">
								The filename is filled in as a starting point. Check that it
								matches the original list name on IMDb.
							</span>
						</label>
						<button
							type="button"
							className={`${primaryButton} self-start`}
							disabled={!listName.trim() || preview.isPending}
							onClick={() => previewList("custom-list")}
						>
							{preview.isPending ? "Finding your titles" : "Continue"}
						</button>
					</div>
				)}
				<div aria-live="polite">
					{preview.isPending && listKind !== "custom-list" && (
						<p className="text-gray-300">Finding your titles</p>
					)}
				</div>
				<div aria-live="assertive">
					{preview.isError && (
						<ProblemCard
							title={fileProblemTitle(preview.error.message)}
							fileName={listFile.name}
							focus
						>
							<p>{preview.error.message}</p>
						</ProblemCard>
					)}
				</div>
			</section>
		)

	return (
		<section
			aria-labelledby="imdb-upload-heading"
			className="flex flex-col gap-6"
		>
			{preview.isError && (
				<ProblemCard
					title={fileProblemTitle(preview.error.message)}
					fileName={
						preview.variables && "file" in preview.variables
							? preview.variables.file.name
							: preview.variables?.name
					}
					focus
				>
					<p>{preview.error.message}</p>
				</ProblemCard>
			)}
			<div
				onDragOver={(event) => {
					event.preventDefault()
					setDragging(true)
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={onDrop}
				className={dropZoneClass(dragging)}
			>
				{preview.isPending ? (
					<Spinner size="medium" />
				) : (
					<ArrowUpTrayIcon
						className={`size-12 transition-transform duration-300 ${dragging ? "-translate-y-1 text-amber-300" : "text-gray-400"}`}
						aria-hidden
					/>
				)}
				<h2 id="imdb-upload-heading" className={headingClass}>
					{preview.isPending
						? "Finding your titles"
						: preview.isError
							? "Try another file"
							: "Upload your file"}
				</h2>
				{handoff && <RecognizedLine handoff={handoff} />}
				<p
					id="imdb-upload-hint"
					aria-live="polite"
					className="max-w-md text-sm text-gray-400"
				>
					{preview.isPending
						? "Reading your file. This can take a moment. Nothing changes yet."
						: "Drop the CSV file from IMDb here, or choose it from your device. You'll see what's in it before anything is saved."}
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
			{wrongSource.note}
		</section>
	)
}
