import { ArrowUpTrayIcon } from "@heroicons/react/24/solid"
import { type DragEvent, useEffect, useId, useRef, useState } from "react"
import {
	type FileImportSource,
	IMPORT_SOURCE_NAMES,
	IMPORT_SOURCE_UPLOAD,
	type ImportSummary,
} from "~/domain/imports"
import { Spinner } from "~/ui/wait/Spinner"
import {
	type ImportHandoff,
	type MovieLensFiles,
	RecognizedLine,
	useHandoffUpload,
	useMovieLensFiles,
	useWrongSourceCatch,
} from "./ImportFileRouting"
import { usePreviewSourceImport } from "./SourceImportHooks"
import { errorBox, infoBox, primaryButton, stepHeading } from "./shared"

const sourceName = (source: FileImportSource) => IMPORT_SOURCE_NAMES[source]

type PanelProps = {
	source: FileImportSource
	/** The file goes along, so a TV Time preview can run it again without asking for it. */
	onPreview: (summary: ImportSummary, file?: File) => void
	/** A file the page recognized as this source's; it is sent at once. */
	handoff?: ImportHandoff
}

function SingleFileUploadPanel({ source, onPreview, handoff }: PanelProps) {
	const descriptor = IMPORT_SOURCE_UPLOAD[source]
	const fileLabel = descriptor.label
	const id = useId()
	const inputRef = useRef<HTMLInputElement>(null)
	const [dragging, setDragging] = useState(false)
	const preview = usePreviewSourceImport()
	const wrongSource = useWrongSourceCatch(source)
	const upload = (file: File) =>
		preview.mutate(
			{ source, file },
			{ onSuccess: (response) => onPreview(response.import, file) },
		)
	const send = async (file?: File) => {
		if (!file || preview.isPending) return
		if ((await wrongSource.check(file)).send) upload(file)
	}
	useHandoffUpload(handoff, upload)
	const drop = (event: DragEvent<HTMLDivElement>) => {
		event.preventDefault()
		setDragging(false)
		send(event.dataTransfer.files[0])
	}
	return (
		<section aria-labelledby={`${id}-heading`} className="flex flex-col gap-4">
			<h3 id={`${id}-heading`} className={stepHeading}>
				{descriptor.heading ?? `Upload your ${sourceName(source)} export`}
			</h3>
			<UploadInstructions source={source} />
			{handoff && <RecognizedLine handoff={handoff} />}
			<div
				onDragOver={(event) => {
					event.preventDefault()
					setDragging(true)
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={drop}
				className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-8 text-center ${dragging ? "border-indigo-400 bg-indigo-950/60" : "border-slate-600 bg-slate-900/60"}`}
			>
				{preview.isPending ? (
					<Spinner size="medium" />
				) : (
					<ArrowUpTrayIcon className="size-8 text-gray-500" aria-hidden />
				)}
				<p id={`${id}-hint`} aria-live="polite">
					{preview.isPending
						? "Uploading and checking your export. This can take a moment."
						: descriptor.hint}
				</p>
				<button
					type="button"
					className={primaryButton}
					disabled={preview.isPending}
					aria-describedby={`${id}-hint`}
					onClick={() => inputRef.current?.click()}
				>
					Choose {fileLabel} file
				</button>
				<input
					ref={inputRef}
					type="file"
					aria-label={`Choose ${sourceName(source)} export ${fileLabel} file`}
					accept={descriptor.accept}
					className="sr-only"
					onChange={(event) => {
						send(event.target.files?.[0])
						event.target.value = ""
					}}
				/>
			</div>
			{wrongSource.note}
			<p className="text-sm text-gray-400">
				You will review everything before GoodWatch changes your library.
			</p>
			<div aria-live="assertive">
				{preview.isError && <p className={errorBox}>{preview.error.message}</p>}
			</div>
		</section>
	)
}

function UploadInstructions({ source }: { source: FileImportSource }) {
	const descriptor = IMPORT_SOURCE_UPLOAD[source]
	return (
		<>
			{descriptor.instructions.map((instruction) => (
				<p key={instruction} className="text-gray-400">
					{instruction}
				</p>
			))}
			{descriptor.exportUrl && (
				<a
					href={descriptor.exportUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="text-indigo-300 underline hover:text-indigo-200"
				>
					Open {descriptor.exportLabel ?? sourceName(source)} export settings
					(new tab)
				</a>
			)}
			{descriptor.notes && (
				<p className="text-sm text-gray-400">{descriptor.notes}</p>
			)}
		</>
	)
}

export function SourceImportUploadPanel(props: PanelProps) {
	return IMPORT_SOURCE_UPLOAD[props.source].optionalWishlist ? (
		<MovieLensUploadPanel {...props} />
	) : (
		<SingleFileUploadPanel {...props} />
	)
}

type Slot = keyof MovieLensFiles
const SLOT_NAME: Record<Slot, string> = {
	ratings: "ratings",
	wishlist: "wishlist",
}
const other = (slot: Slot): Slot =>
	slot === "ratings" ? "wishlist" : "ratings"

/**
 * MovieLens takes two files. The page keeps them, so a file handed over later fills the empty slot. Each box checks
 * its file: one from another source is offered as that source, and the other MovieLens file is offered to its box.
 */
function MovieLensUploadPanel({ onPreview, handoff }: PanelProps) {
	const id = useId()
	const [files, setFiles] = useMovieLensFiles()
	const [misplaced, setMisplaced] = useState<{ file: File; slot: Slot } | null>(
		null,
	)
	const preview = usePreviewSourceImport()
	const catches = {
		ratings: useWrongSourceCatch("movielens"),
		wishlist: useWrongSourceCatch("movielens"),
	}
	const place = (slot: Slot, file: File | undefined) =>
		setFiles((current) => ({ ...current, [slot]: file }))
	// A handed-off file goes to its slot; the other slot keeps what it has.
	useEffect(() => {
		if (handoff?.recognition.source !== "movielens") return
		const { file, recognition } = handoff
		setFiles((current) => ({
			...current,
			[recognition.wishlist ? "wishlist" : "ratings"]: file,
		}))
	}, [handoff, setFiles])
	const choose = async (slot: Slot, file: File | undefined) => {
		setMisplaced(null)
		if (!file) return place(slot, undefined)
		const { send, recognition } = await catches[slot].check(file)
		if (!send) return
		const belongs =
			recognition?.source === "movielens"
				? recognition.wishlist
					? "wishlist"
					: "ratings"
				: slot
		if (belongs === slot) place(slot, file)
		else setMisplaced({ file, slot: belongs })
	}
	const next = files.ratings
		? files.wishlist
			? "Both files are ready. Preview the import."
			: "Add your wishlist file if you have one, then preview."
		: "Choose your ratings file too, then preview."
	const box = (slot: Slot, label: string) => (
		<>
			<label className="flex flex-col gap-2">
				{label}
				<input
					type="file"
					accept={IMPORT_SOURCE_UPLOAD.movielens.accept}
					disabled={preview.isPending}
					onChange={(event) => {
						choose(slot, event.target.files?.[0])
					}}
				/>
				{files[slot] && (
					<span className="break-all text-sm text-gray-400">
						Chosen: {files[slot].name}
					</span>
				)}
			</label>
			{catches[slot].note}
		</>
	)
	return (
		<section aria-labelledby={`${id}-heading`} className="flex flex-col gap-4">
			<h3 id={`${id}-heading`} className={stepHeading}>
				Upload your MovieLens export
			</h3>
			<UploadInstructions source="movielens" />
			{handoff && <RecognizedLine handoff={handoff} next={next} />}
			{box("ratings", "MovieLens ratings CSV")}
			{box("wishlist", "MovieLens wishlist CSV (optional)")}
			<div aria-live="polite">
				{misplaced && (
					<div className={`${infoBox} flex flex-col gap-3`}>
						<p>
							<span className="break-all font-semibold">
								{misplaced.file.name}
							</span>{" "}
							is your MovieLens {SLOT_NAME[misplaced.slot]}, not your{" "}
							{SLOT_NAME[other(misplaced.slot)]}.
						</p>
						<button
							type="button"
							className={`${primaryButton} self-start`}
							onClick={() => {
								place(misplaced.slot, misplaced.file)
								setMisplaced(null)
							}}
						>
							Use it as the {SLOT_NAME[misplaced.slot]}
						</button>
					</div>
				)}
			</div>
			<button
				type="button"
				className={primaryButton}
				disabled={!files.ratings || preview.isPending}
				onClick={() => {
					if (files.ratings)
						preview.mutate(
							{
								source: "movielens",
								file: files.ratings,
								wishlist: files.wishlist,
							},
							{
								onSuccess: (response) => {
									setFiles({})
									onPreview(response.import)
								},
							},
						)
				}}
			>
				{preview.isPending ? "Checking your export…" : "Preview import"}
			</button>
			<div aria-live="assertive">
				{preview.isError && <p className={errorBox}>{preview.error.message}</p>}
			</div>
		</section>
	)
}
