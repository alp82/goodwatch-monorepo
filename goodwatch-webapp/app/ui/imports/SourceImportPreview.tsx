import { useState } from "react"
import {
	IMPORT_KINDS,
	type ImportKind,
	type ImportOptions,
	type ImportOutcome,
	type ImportSummary,
} from "~/domain/imports"
import { FocusHeading } from "./FocusHeading"
import { SourceOutcomeRow } from "./SourceImportCounts"
import { sourceImportRequirements } from "./SourceImportPreviewModel"
import { errorBox, formatCount, primaryButton, secondaryButton } from "./shared"

const KIND_LABELS: Record<ImportKind, string> = {
	rating: "Ratings",
	watch: "Watches",
	want: "Want to See",
	favorite: "Favorites",
	review: "Reviews",
}
const OUTCOMES: ImportOutcome[] = [
	"new",
	"unchanged",
	"conflict",
	"unmatched",
	"unsupported",
	"invalid",
]

export function SourceImportPreview({
	summary,
	focus,
	confirming,
	error,
	onConfirm,
	onBack,
}: {
	summary: ImportSummary
	focus: boolean
	confirming: boolean
	error: string | null
	onConfirm: (options: ImportOptions) => void
	onBack: () => void
}) {
	const available = IMPORT_KINDS.filter((kind) => summary.kinds[kind] > 0)
	const [kinds, setKinds] = useState<ImportKind[]>(available)
	const [conflictChoice, setConflictChoice] =
		useState<ImportOptions["conflictChoice"]>("keep")
	const [watchDates, setWatchDates] = useState<
		ImportOptions["watchDates"] | null
	>(null)
	const toggle = (kind: ImportKind) =>
		setKinds((current) =>
			current.includes(kind)
				? current.filter((item) => item !== kind)
				: [...current, kind],
		)
	const requirements = sourceImportRequirements(
		summary.kinds.watch,
		kinds,
		watchDates,
	)
	const { importsWatches, canImport } = requirements
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
			{summary.warnings.length > 0 && (
				<div
					className="rounded-lg border border-amber-700 bg-amber-950/50 p-4 text-amber-100"
					// biome-ignore lint/a11y/useSemanticElements: a warning group contains block content
					role="status"
				>
					<p className="font-semibold">Check these export details</p>
					<ul className="mt-2 list-disc space-y-1 pl-5">
						{summary.warnings.map((warning) => (
							<li key={warning}>{warning}</li>
						))}
					</ul>
				</div>
			)}
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
						<span>Rows in your export</span>
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
					onChange={() => setConflictChoice("keep")}
					label="Keep my GoodWatch changes"
					detail="Keeps ratings and reviews you already changed in GoodWatch."
				/>
				<Radio
					name="source-conflict"
					checked={conflictChoice === "source"}
					onChange={() => setConflictChoice("source")}
					label="Use the export instead"
					detail="Replaces conflicting ratings and reviews with the source export."
				/>
			</fieldset>
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
						onChange={() => setWatchDates("preserve")}
						label="Preserve dates from the export"
						detail="Uses each exported watch date with its stated precision."
					/>
					<Radio
						name="watch-dates"
						checked={watchDates === "unknown"}
						onChange={() => setWatchDates("unknown")}
						label="Import watches with unknown dates"
						detail="Imports the watches but stores no date for them."
					/>
					<p className="text-sm text-gray-400">
						Importing a watch can remove that title from Want to See or Not
						interested. Undoing the import later does not restore those earlier
						choices.
					</p>
				</fieldset>
			)}
			{!canImport && (
				<p id="source-import-required" className="text-sm text-gray-300">
					{kinds.length === 0
						? "Select at least one data type."
						: "Choose how to handle watch dates."}
				</p>
			)}
			<div className="flex flex-wrap gap-3">
				<button
					type="button"
					className={primaryButton}
					disabled={!canImport || confirming}
					aria-describedby={!canImport ? "source-import-required" : undefined}
					onClick={() =>
						canImport &&
						onConfirm({
							kinds,
							conflictChoice,
							watchDates: requirements.watchDates,
						})
					}
				>
					{confirming ? "Starting import" : "Start import"}
				</button>
				<button
					type="button"
					className={secondaryButton}
					disabled={confirming}
					onClick={onBack}
				>
					Choose another file
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
