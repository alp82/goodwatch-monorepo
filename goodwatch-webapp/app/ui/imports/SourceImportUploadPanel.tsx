import { ArrowUpTrayIcon } from "@heroicons/react/24/solid"
import { type DragEvent, useRef, useState } from "react"
import {
	IMPORT_SOURCE_FILE,
	IMPORT_SOURCE_NAMES,
	type ImportSource,
	type ImportSummary,
} from "~/domain/imports"
import { Spinner } from "~/ui/wait/Spinner"
import { usePreviewSourceImport } from "./SourceImportHooks"
import { errorBox, primaryButton, stepHeading } from "./shared"

const sourceName = (source: ImportSource) => IMPORT_SOURCE_NAMES[source]

function SingleFileUploadPanel({
	source,
	onPreview,
}: { source: ImportSource; onPreview: (summary: ImportSummary) => void }) {
	const fileType = IMPORT_SOURCE_FILE[source]
	const fileLabel = source === "kodi" ? "XML or ZIP" : fileType.toUpperCase()
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
			{source === "kodi" ? (
				<p className="text-gray-400">
					In Kodi, switch the settings level to Advanced, then open Settings →
					Media → Library → Export library → Single file. Upload videodb.xml
					from the kodi_videodb_YYYY-MM-DD folder, alone or zipped. Artwork
					folders are not needed; separate .nfo files are not supported.
					GoodWatch imports movie and show ratings and one watch per played
					movie or episode. Maximum size: 20 MB.
				</p>
			) : source === "csv" ? (
				<p className="text-gray-400">
					Upload a CSV in Letterboxd import format. Include tmdbID, imdbID, or
					Title and Year. Rating uses 0.5–5; Rating10 uses 1–10 and takes
					priority. Only WatchedDate (or Watched Date) creates a dated watch.
					Maximum size: 20 MB.
				</p>
			) : (
				<>
					<p className="text-gray-400">
						{source === "letterboxd" ? (
							<>
								Sign in to Letterboxd, open Settings → Data, and choose Export
								Data.
							</>
						) : (
							<>
								Sign in to Trakt, open Profile → Settings → Data, and choose
								Export now. This export is available to free and VIP members.
							</>
						)}{" "}
						Wait for the download, then upload the ZIP without extracting it.
					</p>
					<a
						href={
							source === "letterboxd"
								? "https://letterboxd.com/user/exportdata/"
								: "https://app.trakt.tv/settings/data"
						}
						target="_blank"
						rel="noopener noreferrer"
						className="text-indigo-300 underline hover:text-indigo-200"
					>
						Open {sourceName(source)} export settings (new tab)
					</a>
					<p className="text-sm text-gray-400">
						GoodWatch reads ratings, watches, your watchlist, favorites, and
						reviews when present. Maximum ZIP size: 20 MB.
					</p>
				</>
			)}
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
						: source === "kodi"
							? "Drop videodb.xml or its ZIP here, or choose it from your device."
							: fileType === "csv"
								? "Drop your CSV file here, or choose it from your device."
								: `Drop the ZIP file from ${sourceName(source)} here, or choose it from your device.`}
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
					accept={
						source === "kodi"
							? ".xml,application/xml,text/xml,.zip,application/zip,application/x-zip-compressed"
							: fileType === "csv"
								? ".csv,text/csv"
								: ".zip,application/zip,application/x-zip-compressed"
					}
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

export function SourceImportUploadPanel(props: {
	source: ImportSource
	onPreview: (summary: ImportSummary) => void
}) {
	return props.source === "movielens" ? (
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
			<p className="text-gray-400">
				Sign in to MovieLens, open Settings → Import or export, and download
				your ratings and, optionally, wishlist. Choose the original CSV files
				below. Combined maximum size: 20 MB.
			</p>
			<a
				href="https://movielens.org/profile/settings/import-export"
				target="_blank"
				rel="noopener noreferrer"
				className="text-indigo-300 underline hover:text-indigo-200"
			>
				Open MovieLens export settings (new tab)
			</a>
			<label className="flex flex-col gap-2">
				MovieLens ratings CSV
				<input
					type="file"
					accept=".csv,text/csv"
					disabled={preview.isPending}
					onChange={(event) => setRatings(event.target.files?.[0])}
				/>
			</label>
			<label className="flex flex-col gap-2">
				MovieLens wishlist CSV (optional)
				<input
					type="file"
					accept=".csv,text/csv"
					disabled={preview.isPending}
					onChange={(event) => setWishlist(event.target.files?.[0])}
				/>
			</label>
			<p className="text-sm text-gray-400">
				Ratings and Want to See are imported without viewing dates. Tags and
				activity logs are not applied. You will review everything before
				GoodWatch changes your library.
			</p>
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
