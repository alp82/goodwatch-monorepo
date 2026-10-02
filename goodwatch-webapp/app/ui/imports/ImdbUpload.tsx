// The first thing on the IMDb import page: choose or drop the CSV file. It is read in the browser and sent for a preview.
import { ArrowUpTrayIcon } from "@heroicons/react/24/solid"
import { type DragEvent, useRef, useState } from "react"
import type { ImdbImportSummary } from "~/domain/imdb-import"
import { Spinner } from "~/ui/wait/Spinner"
import { usePreviewImdbImport } from "./api"
import { errorBox, primaryButton, stepHeading } from "./shared"

export function ImdbUpload({
	onPreview,
}: { onPreview: (summary: ImdbImportSummary) => void }) {
	const inputRef = useRef<HTMLInputElement>(null)
	const [dragging, setDragging] = useState(false)
	const preview = usePreviewImdbImport()

	const send = (file: File | undefined) => {
		if (!file || preview.isPending) return
		preview.mutate(file, {
			onSuccess: (response) => onPreview(response.import),
		})
	}

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
			<p className="text-sm text-gray-400">
				You'll see what's in the file before anything is saved.
			</p>
			<div aria-live="assertive">
				{preview.isError && <p className={errorBox}>{preview.error.message}</p>}
			</div>
		</section>
	)
}
