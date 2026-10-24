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
import {
	ProblemCard,
	dropZoneClass,
	fileProblemTitle,
	headingClass,
} from "./ImportFlowParts"
import {
	ImportRequestError,
	usePreviewSourceImport,
	useSourceImports,
} from "./SourceImportHooks"
import { tvtimeBusyHint } from "./TvTimeMatchCopy"
import { sourceName as flowSourceName } from "./import-flow-model"
import { infoBox, primaryButton } from "./shared"

const sourceName = (source: FileImportSource) => IMPORT_SOURCE_NAMES[source]

type PanelProps = {
	source: FileImportSource
	onPreview: (summary: ImportSummary) => void
	onOpenMatching?: (id: string) => void
	/** A file the page recognized as this source's; it is sent at once. */
	handoff?: ImportHandoff
}

function SingleFileUploadPanel({
	source,
	onPreview,
	handoff,
	onOpenMatching,
}: PanelProps) {
	const descriptor = IMPORT_SOURCE_UPLOAD[source]
	const fileLabel = descriptor.label
	const id = useId()
	const inputRef = useRef<HTMLInputElement>(null)
	const [dragging, setDragging] = useState(false)
	const preview = usePreviewSourceImport()
	const imports = useSourceImports()
	const code =
		preview.error instanceof ImportRequestError ? preview.error.code : null
	const busyHint = source === "tvtime" ? tvtimeBusyHint(code) : null
	const existing =
		code === "tvtime_resolution_member_busy"
			? imports.data?.imports.find(
					(item) => item.source === "tvtime" && item.status === "preview",
				)
			: undefined
	const wrongSource = useWrongSourceCatch(source)
	const upload = (file: File) =>
		preview.mutate(
			{ source, file },
			{
				onSuccess: (response) => onPreview(response.import),
				onError: (error) => {
					if (
						error instanceof ImportRequestError &&
						error.code === "tvtime_resolution_member_busy"
					)
						void imports.refetch()
				},
			},
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
		<section aria-labelledby={`${id}-heading`} className="flex flex-col gap-6">
			{preview.isError && (
				<ProblemCard
					title={
						busyHint
							? "Matching can't start right now"
							: fileProblemTitle(
									preview.error.message,
									preview.error instanceof ImportRequestError
										? preview.error.status
										: undefined,
								)
					}
					fileName={preview.variables?.file.name}
					focus
				>
					<p>
						{preview.error.message}
						{busyHint && ` ${busyHint}`}
					</p>
					{existing && onOpenMatching && (
						<div>
							<button
								type="button"
								className={primaryButton}
								onClick={() => onOpenMatching(existing.id)}
							>
								Open the import that's matching
							</button>
						</div>
					)}
				</ProblemCard>
			)}
			<div
				onDragOver={(event) => {
					event.preventDefault()
					setDragging(true)
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={drop}
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
				<h2 id={`${id}-heading`} className={headingClass}>
					{preview.isPending
						? "Finding your titles"
						: preview.isError
							? "Try another file"
							: (descriptor.heading ??
								`Upload your ${sourceName(source)} export`)}
				</h2>
				{handoff && <RecognizedLine handoff={handoff} />}
				<p
					id={`${id}-hint`}
					aria-live="polite"
					className="max-w-md text-sm text-gray-400"
				>
					{preview.isPending
						? "Looking up your titles in GoodWatch. Nothing changes yet."
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
					tabIndex={-1}
					onChange={(event) => {
						send(event.target.files?.[0])
						event.target.value = ""
					}}
				/>
			</div>
			{wrongSource.note}
			<HowToGet source={source} />
		</section>
	)
}

/** How to get the source's file, under its drop zone. */
function HowToGet({ source }: { source: FileImportSource }) {
	return (
		<div className="flex flex-col gap-3 rounded-2xl bg-gray-900/70 p-5 ring-1 ring-white/10">
			<h3 className="font-semibold text-white">
				How to get your {flowSourceName(source)} file
			</h3>
			<UploadInstructions source={source} />
		</div>
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
			? "Both files are ready. Continue."
			: "Add your wishlist file if you have one, then continue."
		: "Choose your ratings file too, then continue."
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
			{preview.isError && (
				<ProblemCard
					title={fileProblemTitle(
						preview.error.message,
						preview.error instanceof ImportRequestError
							? preview.error.status
							: undefined,
					)}
					fileName={preview.variables?.file.name}
					focus
				>
					<p>{preview.error.message}</p>
				</ProblemCard>
			)}
			<h2 id={`${id}-heading`} className={headingClass}>
				Upload your MovieLens export
			</h2>
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
				{preview.isPending ? "Finding your titles…" : "Continue"}
			</button>
		</section>
	)
}
