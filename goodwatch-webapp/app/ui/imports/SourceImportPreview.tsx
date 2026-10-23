import { useState } from "react"
import {
	IMPORT_KINDS,
	type ImportKind,
	type ImportOptions,
	type ImportOutcome,
	type ImportSummary,
} from "~/domain/imports"
import { FocusHeading } from "./FocusHeading"
import { ImportNotes } from "./ImportNotes"
import { sourceImportCopy } from "./SourceImportCopy"
import { SourceOutcomeRow } from "./SourceImportCounts"
import {
	type PreviewUpdate,
	type SourceImportChoices,
	sourceImportRequirements,
} from "./SourceImportPreviewModel"
import { tvtimeProgress } from "./TvTimeMatchCopy"
import {
	TvTimeLookupNotices,
	TvTimeMatchSection,
	type TvTimeMatching,
	TvTimeUpdatedNotice,
	useTvTimeMatching,
} from "./TvTimePreviewParts"
import { WishlistImportPreview } from "./WishlistImportPreview"
import { errorBox, formatCount, primaryButton, secondaryButton } from "./shared"

const KIND_LABELS: Record<ImportKind, string> = {
	rating: "Ratings",
	watch: "Watches",
	want: "Want to See",
	favorite: "Favorites",
	review: "Reviews",
	show_status: "Show statuses",
}
const OUTCOMES: ImportOutcome[] = [
	"new",
	"unchanged",
	"conflict",
	"unmatched",
	"unsupported",
	"invalid",
]

type PreviewProps = {
	summary: ImportSummary
	focus: boolean
	confirming: boolean
	error: string | null
	onConfirm: (options: ImportOptions) => void
	onBack: () => void
	/** Wishlist and TV Time: a new preview replaced this one on screen. */
	onPreviewReplaced?: (next: ImportSummary, update: PreviewUpdate) => void
	updated?: PreviewUpdate
	initialChoices?: SourceImportChoices
	onChoicesChange?: (choices: SourceImportChoices) => void
}

export function SourceImportPreview(props: PreviewProps) {
	const wishlistOnly =
		props.summary.source === "wishlist" &&
		!["rating", "watch", "review", "show_status"].some(
			(kind) => props.summary.kinds[kind as ImportKind] > 0,
		)
	return wishlistOnly ? (
		<WishlistImportPreview {...props} />
	) : props.summary.source === "tvtime" ? (
		<TvTimeImportPreview {...props} />
	) : (
		<GeneralImportPreview {...props} />
	)
}

/** TV Time keeps the general preview and adds movie matching and lookup notices to it. */
function TvTimeImportPreview(props: PreviewProps) {
	const matching = useTvTimeMatching(
		props.summary,
		props.confirming,
		props.onPreviewReplaced,
	)
	return <GeneralImportPreview {...props} matching={matching} />
}

function GeneralImportPreview({
	summary,
	focus,
	confirming,
	error,
	onConfirm,
	onBack,
	updated,
	matching,
	initialChoices,
	onChoicesChange,
}: PreviewProps & { matching?: TvTimeMatching }) {
	const copy = sourceImportCopy(summary.source)
	const unapplied = !!matching?.unapplied
	const locked = !!matching?.locked
	const stillMatching =
		!!matching &&
		!!summary.resolution &&
		tvtimeProgress(summary.resolution).active
	const back = matching ? () => matching.discardPreview(onBack) : onBack
	const available = IMPORT_KINDS.filter((kind) => summary.kinds[kind] > 0)
	const [choices, setChoices] = useState<SourceImportChoices>(
		() =>
			initialChoices ?? {
				kinds: available,
				conflictChoice: "keep",
				watchDates: null,
			},
	)
	const { kinds, conflictChoice, watchDates, wishlistRewatch = false } = choices
	const rewatchCount =
		summary.source === "wishlist"
			? (summary.wishlistRewatchChoiceCount ?? 0)
			: 0
	const choose = (next: SourceImportChoices) => {
		setChoices(next)
		onChoicesChange?.(next)
	}
	const toggle = (kind: ImportKind) =>
		choose({
			...choices,
			kinds: kinds.includes(kind)
				? kinds.filter((item) => item !== kind)
				: [...kinds, kind],
		})
	const requirements = sourceImportRequirements(
		summary.kinds.watch,
		kinds,
		watchDates,
	)
	const { importsWatches } = requirements
	const canImport = requirements.canImport && !unapplied
	return (
		<section className="flex flex-col gap-5">
			<div className="space-y-2">
				<FocusHeading focus={focus}>Check before you import</FocusHeading>
				<p>
					Here is what we found in{" "}
					<span className="break-all font-semibold text-gray-100">
						{summary.fileName}
					</span>
					. Nothing has been saved yet.
				</p>
			</div>
			{matching && updated && <TvTimeUpdatedNotice update={updated} />}
			{matching && (
				<TvTimeLookupNotices summary={summary} matching={matching} />
			)}
			<ImportNotes warnings={summary.warnings} title={copy.details} />
			<fieldset>
				<legend className="mb-2 font-semibold text-gray-100">
					What should GoodWatch import?
				</legend>
				<div className="grid gap-2 sm:grid-cols-2">
					{available.map((kind) => (
						<label
							key={kind}
							className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3"
						>
							<span>
								<span className="font-semibold text-gray-100">
									{KIND_LABELS[kind]}
								</span>
								<span className="ml-2 text-sm text-gray-400">
									{formatCount(summary.kinds[kind])}
								</span>
							</span>
							<input
								type="checkbox"
								checked={kinds.includes(kind)}
								onChange={() => toggle(kind)}
								className="size-4 accent-indigo-500"
							/>
						</label>
					))}
				</div>
			</fieldset>
			{matching && (
				<TvTimeMatchSection
					summary={summary}
					matching={matching}
					onBack={back}
				/>
			)}
			<div>
				<h4 className="mb-2 font-semibold text-gray-100">How rows compare</h4>
				<ul className="divide-y divide-slate-800 rounded-lg border border-slate-700 bg-slate-900/60">
					{OUTCOMES.filter((outcome) => summary.counts[outcome] > 0).map(
						(outcome) => (
							<SourceOutcomeRow
								key={outcome}
								importId={summary.id}
								outcome={outcome}
								count={summary.counts[outcome]}
							/>
						),
					)}
					<li className="flex items-center justify-between border-t-2 border-slate-600 bg-slate-800/60 px-4 py-3 font-semibold">
						<span>Rows in your {copy.data}</span>
						<span className="tabular-nums">
							{formatCount(summary.counts.rows)}
						</span>
					</li>
				</ul>
			</div>
			<fieldset className="space-y-2">
				<legend className="mb-1 font-semibold text-gray-100">
					When GoodWatch already has different data
				</legend>
				<Radio
					name="source-conflict"
					checked={conflictChoice === "keep"}
					onChange={() => choose({ ...choices, conflictChoice: "keep" })}
					label="Keep my GoodWatch changes"
					detail="Keeps ratings and reviews you already changed in GoodWatch."
				/>
				<Radio
					name="source-conflict"
					checked={conflictChoice === "source"}
					onChange={() => choose({ ...choices, conflictChoice: "source" })}
					label={copy.conflict}
					detail={copy.conflictDetail}
				/>
			</fieldset>
			{rewatchCount > 0 && kinds.includes("want") && (
				<fieldset className="space-y-2" disabled={confirming || locked}>
					<legend className="mb-1 font-semibold text-gray-100">
						{formatCount(rewatchCount)}{" "}
						{rewatchCount === 1 ? "title" : "titles"} marked Seen in GoodWatch
						or in this file
					</legend>
					<div className="grid gap-2 sm:grid-cols-2">
						<Radio
							name="wishlist-rewatch"
							checked={!wishlistRewatch}
							onChange={() => choose({ ...choices, wishlistRewatch: false })}
							label="Leave off Wishlist"
							detail={
								rewatchCount === 1
									? "It stays off your Wishlist."
									: "They stay off your Wishlist."
							}
						/>
						<Radio
							name="wishlist-rewatch"
							checked={wishlistRewatch}
							onChange={() => choose({ ...choices, wishlistRewatch: true })}
							label={
								rewatchCount === 1
									? "Add it as Want to rewatch"
									: "Add them as Want to rewatch"
							}
							detail={
								rewatchCount === 1
									? "It goes on your Wishlist to watch again."
									: "They go on your Wishlist to watch again."
							}
						/>
					</div>
				</fieldset>
			)}
			{importsWatches && (
				<fieldset className="space-y-2">
					<legend className="mb-1 font-semibold text-gray-100">
						How should watch dates be handled?
					</legend>
					<p className="text-sm text-gray-400">
						Choose explicitly. GoodWatch never silently changes or invents watch
						dates.
					</p>
					<Radio
						name="watch-dates"
						checked={watchDates === "preserve"}
						onChange={() => choose({ ...choices, watchDates: "preserve" })}
						label={`Preserve dates from the ${copy.data}`}
						detail={copy.watchDates}
					/>
					<Radio
						name="watch-dates"
						checked={watchDates === "unknown"}
						onChange={() => choose({ ...choices, watchDates: "unknown" })}
						label="Import watches with unknown dates"
						detail="Imports the watches but stores no date for them."
					/>
				</fieldset>
			)}
			{(importsWatches || kinds.includes("show_status")) && (
				<p className="text-sm text-gray-400">
					{summary.source === "wishlist"
						? "Importing watches or show statuses can remove titles from Want to See or Not interested. Undo restores the earlier choices when no newer watch or choice remains."
						: "Importing watches or show statuses can remove titles from Want to See or Not interested. Without added watches, Undo restores those choices when it restores the earlier status. Undo of added watches does not restore those choices."}
				</p>
			)}
			{kinds.includes("show_status") && (
				<p className="text-sm text-gray-400">
					Your On hold, Dropped and Seen decisions are kept. Plan to watch
					becomes Want to See. Whole-show completion marks aired regular
					episodes with unknown dates and stays Watching while a season is still
					airing. Completion of a part does not mark the whole show Seen.
				</p>
			)}
			{unapplied && (
				<p id="source-import-unapplied" className="text-sm text-gray-300">
					Your matches aren't in this preview yet. Choose Update preview to add
					them, or Discard changes. Choosing another file or leaving this page
					discards them.
				</p>
			)}
			{!requirements.canImport && (
				<p id="source-import-required" className="text-sm text-gray-300">
					{kinds.length === 0
						? "Select at least one data type."
						: "Choose how to handle watch dates."}
				</p>
			)}
			{stillMatching && (
				<p className="text-sm text-gray-300">
					GoodWatch is still matching. Importing now brings in only what's
					matched so far, and matching stops.
				</p>
			)}
			<div className="flex flex-wrap gap-3">
				<button
					type="button"
					className={primaryButton}
					disabled={!canImport || confirming || locked}
					aria-describedby={
						!requirements.canImport
							? "source-import-required"
							: unapplied
								? "source-import-unapplied"
								: undefined
					}
					onClick={() =>
						canImport &&
						onConfirm({
							kinds,
							conflictChoice,
							watchDates: requirements.watchDates,
							...(summary.source === "wishlist" ? { wishlistRewatch } : {}),
						})
					}
				>
					{confirming
						? "Starting import"
						: stillMatching
							? "Import what's matched so far"
							: "Start import"}
				</button>
				<button
					type="button"
					className={secondaryButton}
					disabled={confirming || locked}
					onClick={back}
				>
					{matching
						? matching.cancel.isPending
							? "Discarding preview"
							: "Discard and choose another file"
						: copy.restart}
				</button>
			</div>
			<div aria-live="assertive">
				{error && <p className={errorBox}>{error}</p>}
			</div>
		</section>
	)
}

function Radio({
	name,
	checked,
	onChange,
	label,
	detail,
}: {
	name: string
	checked: boolean
	onChange: () => void
	label: string
	detail: string
}) {
	return (
		<label
			className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${checked ? "border-indigo-500 bg-indigo-950/50" : "border-slate-700 bg-slate-900/60"}`}
		>
			<input
				type="radio"
				name={name}
				checked={checked}
				onChange={onChange}
				className="mt-1 size-4 accent-indigo-500"
			/>
			<span>
				<span className="block font-semibold text-gray-100">{label}</span>
				<span className="block text-sm text-gray-400">{detail}</span>
			</span>
		</label>
	)
}
