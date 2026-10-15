import { ArrowUpTrayIcon } from "@heroicons/react/24/solid"
import { type DragEvent, useRef, useState } from "react"
import {
	type FileImportSource,
	IMPORT_SOURCE_NAMES,
	IMPORT_SOURCE_UPLOAD,
	type ImportSummary,
} from "~/domain/imports"
import { Spinner } from "~/ui/wait/Spinner"
import { usePreviewSourceImport } from "./SourceImportHooks"
import { errorBox, primaryButton, stepHeading } from "./shared"

const sourceName = (source: FileImportSource) => IMPORT_SOURCE_NAMES[source]

function SingleFileUploadPanel({
	source,
	onPreview,
}: { source: FileImportSource; onPreview: (summary: ImportSummary) => void }) {
	const descriptor = IMPORT_SOURCE_UPLOAD[source]
	const fileLabel = descriptor.label
	const inputRef = useRef<HTMLInputElement>(null)
	const [dragging, setDragging] = useState(false)
	const preview = usePreviewSourceImport()
	const send = (file?: File) => {
		if (!file || preview.isPending) return
		preview.mutate(
			{ source, file },
			{ onSuccess: (response) => onPreview(response.import) },
		)
	}
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

export function SourceImportUploadPanel(props: {
	source: FileImportSource
	onPreview: (summary: ImportSummary) => void
}) {
	return IMPORT_SOURCE_UPLOAD[props.source].optionalWishlist ? (
		<MovieLensUploadPanel onPreview={props.onPreview} />
	) : (
		<SingleFileUploadPanel {...props} />
	)
}

function MovieLensUploadPanel({
	onPreview,
}: { onPreview: (summary: ImportSummary) => void }) {
	const [ratings, setRatings] = useState<File>()
	const [wishlist, setWishlist] = useState<File>()
	const preview = usePreviewSourceImport()
	return (
		<section
			aria-labelledby="source-upload-heading"
			className="flex flex-col gap-4"
		>
			<h3 id="source-upload-heading" className={stepHeading}>
				Upload your MovieLens export
			</h3>
			<UploadInstructions source="movielens" />
			<label className="flex flex-col gap-2">
				MovieLens ratings CSV
				<input
					type="file"
					accept={IMPORT_SOURCE_UPLOAD.movielens.accept}
					disabled={preview.isPending}
					onChange={(event) => setRatings(event.target.files?.[0])}
				/>
			</label>
			<label className="flex flex-col gap-2">
				MovieLens wishlist CSV (optional)
				<input
					type="file"
					accept={IMPORT_SOURCE_UPLOAD.movielens.accept}
					disabled={preview.isPending}
					onChange={(event) => setWishlist(event.target.files?.[0])}
				/>
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
