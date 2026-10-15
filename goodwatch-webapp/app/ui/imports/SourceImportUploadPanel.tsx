import { ArrowUpTrayIcon } from "@heroicons/react/24/solid"
import { type DragEvent, useEffect, useRef, useState } from "react"
import {
	type FileImportSource,
	IMPORT_SOURCE_NAMES,
	IMPORT_SOURCE_UPLOAD,
	type ImportSummary,
} from "~/domain/imports"
import { Spinner } from "~/ui/wait/Spinner"
import {
	type ImportHandoff,
	RecognizedLine,
	useWrongSourceCatch,
} from "./ImportFileRouting"
import { usePreviewSourceImport } from "./SourceImportHooks"
import { errorBox, primaryButton, stepHeading } from "./shared"

const sourceName = (source: FileImportSource) => IMPORT_SOURCE_NAMES[source]

type PanelProps = {
	source: FileImportSource
	onPreview: (summary: ImportSummary) => void
	/** A file the page recognized as this source's; it is sent at once. */
	handoff?: ImportHandoff
}

function SingleFileUploadPanel({ source, onPreview, handoff }: PanelProps) {
	const descriptor = IMPORT_SOURCE_UPLOAD[source]
	const fileLabel = descriptor.label
	const inputRef = useRef<HTMLInputElement>(null)
	const [dragging, setDragging] = useState(false)
	const preview = usePreviewSourceImport()
	const wrongSource = useWrongSourceCatch(source)
	const upload = (file: File) =>
		preview.mutate(
			{ source, file },
			{ onSuccess: (response) => onPreview(response.import) },
		)
	const send = async (file?: File) => {
		if (!file || preview.isPending) return
		if (await wrongSource.check(file)) upload(file)
	}
	const handedOff = useRef<File | null>(null)
	useEffect(() => {
		if (!handoff || handedOff.current === handoff.file) return
		handedOff.current = handoff.file
		upload(handoff.file)
	})
	const drop = (event: DragEvent<HTMLDivElement>) => {
		event.preventDefault()
		setDragging(false)
		send(event.dataTransfer.files[0])
	}
	return (
		<section
			aria-labelledby="source-upload-heading"
			className="flex flex-col gap-4"
		>
			<h3 id="source-upload-heading" className={stepHeading}>
				Upload your {sourceName(source)} export
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
				<p id="source-upload-hint" aria-live="polite">
					{preview.isPending
						? "Uploading and checking your export. This can take a moment."
						: descriptor.hint}
				</p>
				<button
					type="button"
					className={primaryButton}
					disabled={preview.isPending}
					aria-describedby="source-upload-hint"
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

/** MovieLens takes two files, so a handed-off file waits in its place for the other one. */
function MovieLensUploadPanel({ onPreview, handoff }: PanelProps) {
	const handedWishlist =
		handoff?.recognition.source === "movielens" && handoff.recognition.wishlist
	const [ratings, setRatings] = useState<File | undefined>(
		handoff && !handedWishlist ? handoff.file : undefined,
	)
	const [wishlist, setWishlist] = useState<File | undefined>(
		handedWishlist ? handoff.file : undefined,
	)
	const preview = usePreviewSourceImport()
	const wrongSource = useWrongSourceCatch("movielens")
	return (
		<section
			aria-labelledby="source-upload-heading"
			className="flex flex-col gap-4"
		>
			<h3 id="source-upload-heading" className={stepHeading}>
				Upload your MovieLens export
			</h3>
			<UploadInstructions source="movielens" />
			{handoff && (
				<p className="text-sm text-emerald-200">
					Recognized {handoff.recognition.label}:{" "}
					<span className="break-all">{handoff.file.name}</span>.{" "}
					{handedWishlist
						? "Choose your ratings file too, then preview."
						: "Add your wishlist file if you have one, then preview."}
				</p>
			)}
			<label className="flex flex-col gap-2">
				MovieLens ratings CSV
				<input
					type="file"
					accept={IMPORT_SOURCE_UPLOAD.movielens.accept}
					disabled={preview.isPending}
					onChange={async (event) => {
						const file = event.target.files?.[0]
						setRatings(
							file && (await wrongSource.check(file)) ? file : undefined,
						)
					}}
				/>
				{ratings && ratings === handoff?.file && (
					<span className="break-all text-sm text-gray-400">
						Chosen: {ratings.name}
					</span>
				)}
			</label>
			{wrongSource.note}
			<label className="flex flex-col gap-2">
				MovieLens wishlist CSV (optional)
				<input
					type="file"
					accept={IMPORT_SOURCE_UPLOAD.movielens.accept}
					disabled={preview.isPending}
					onChange={(event) => setWishlist(event.target.files?.[0])}
				/>
				{wishlist && wishlist === handoff?.file && (
					<span className="break-all text-sm text-gray-400">
						Chosen: {wishlist.name}
					</span>
				)}
			</label>

			<button
				type="button"
				className={primaryButton}
				disabled={!ratings || preview.isPending}
				onClick={() => {
					if (ratings)
						preview.mutate(
							{ source: "movielens", file: ratings, wishlist },
							{ onSuccess: (response) => onPreview(response.import) },
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
