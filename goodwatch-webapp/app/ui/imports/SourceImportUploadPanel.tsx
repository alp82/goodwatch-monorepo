import { ArrowUpTrayIcon } from "@heroicons/react/24/solid"
import { type DragEvent, useRef, useState } from "react"
import type { ImportSource, ImportSummary } from "~/domain/imports"
import { Spinner } from "~/ui/wait/Spinner"
import { usePreviewSourceImport } from "./SourceImportHooks"
import { errorBox, primaryButton, stepHeading } from "./shared"

const sourceName = (source: ImportSource) =>
	source === "letterboxd" ? "Letterboxd" : "Trakt"

export function SourceImportUploadPanel({
	source,
	onPreview,
}: { source: ImportSource; onPreview: (summary: ImportSummary) => void }) {
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
			<p className="text-gray-400">
				{source === "letterboxd" ? (
					<>
						Sign in to Letterboxd, open Settings → Data, and choose Export Data.
					</>
				) : (
					<>
						Sign in to Trakt, open Profile → Settings → Data, and choose Export
						now. This export is available to free and VIP members.
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
				GoodWatch reads ratings, watches, your watchlist, favorites, and reviews
				when present. Maximum ZIP size: 20 MB.
			</p>
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
						: `Drop the ZIP file from ${sourceName(source)} here, or choose it from your device.`}
				</p>
				<button
					type="button"
					className={primaryButton}
					disabled={preview.isPending}
					aria-describedby="source-upload-hint"
					onClick={() => inputRef.current?.click()}
				>
					Choose ZIP file
				</button>
				<input
					ref={inputRef}
					type="file"
					aria-label={`Choose ${sourceName(source)} export ZIP file`}
					accept=".zip,application/zip,application/x-zip-compressed"
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
