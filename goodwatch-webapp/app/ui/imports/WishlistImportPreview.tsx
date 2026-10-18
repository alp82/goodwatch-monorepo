// The preview of a wishlist import (a Watcharr export or a wishlist file). It only adds Want to See, so it hides the
// general preview's data-type, conflict, and watch-date choices. Its one choice is for titles already watched:
// they stay Seen unless the member adds them as Want to rewatch (conflictChoice "source").
import { useState } from "react"
import type {
	ImportOptions,
	ImportOutcome,
	ImportSummary,
} from "~/domain/imports"
import { FocusHeading } from "./FocusHeading"
import { SourceOutcomeRow } from "./SourceImportCounts"
import { errorBox, formatCount, primaryButton, secondaryButton } from "./shared"

const OUTCOMES: ImportOutcome[] = [
	"new",
	"unchanged",
	"conflict",
	"unmatched",
	"unsupported",
	"invalid",
]

export function WishlistImportPreview({
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
	const [seenChoice, setSeenChoice] =
		useState<ImportOptions["conflictChoice"]>("keep")
	const seen = summary.counts.conflict
	const one = seen === 1
	const rewatch = seen > 0 && seenChoice === "source"
	// No count on the button: the import rechecks each title against the current library as it runs.
	const canImport = summary.counts.new > 0 || rewatch
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
					<p className="font-semibold">About this file</p>
					<ul className="mt-2 list-disc space-y-1 pl-5">
						{summary.warnings.map((warning) => (
							<li key={warning}>{warning}</li>
						))}
					</ul>
				</div>
			)}
			<div className="space-y-1 text-sm text-gray-400">
				<p>
					Importing only adds titles to Want to See. It never removes anything
					from your Wishlist.
				</p>
				<p>
					Adding a title to Want to See takes it off Not interested. Undo takes
					the title off Want to See but doesn't mark it Not interested again.
				</p>
			</div>
			{seen > 0 && (
				<fieldset className="space-y-2">
					<legend className="mb-1 font-semibold text-gray-100">
						{formatCount(seen)} {one ? "title" : "titles"} you've already seen
					</legend>
					<div className="grid gap-2 sm:grid-cols-2">
						<Radio
							checked={seenChoice === "keep"}
							onChange={() => setSeenChoice("keep")}
							label={one ? "Leave it as Seen" : "Leave them as Seen"}
							detail={
								one
									? "It stays off your Wishlist."
									: "They stay off your Wishlist."
							}
						/>
						<Radio
							checked={seenChoice === "source"}
							onChange={() => setSeenChoice("source")}
							label={
								one
									? "Add it as Want to rewatch"
									: "Add them as Want to rewatch"
							}
							detail={
								one
									? "It goes on your Wishlist to watch again. Nothing else changes."
									: "They go on your Wishlist to watch again. Nothing else changes."
							}
						/>
					</div>
				</fieldset>
			)}
			<div>
				<h4 className="mb-2 font-semibold text-gray-100">How titles compare</h4>
				<ul className="divide-y divide-slate-800 rounded-lg border border-slate-700 bg-slate-900/60">
					{OUTCOMES.filter((outcome) => summary.counts[outcome] > 0).map(
						(outcome) => (
							<SourceOutcomeRow
								key={outcome}
								importId={summary.id}
								outcome={outcome}
								count={summary.counts[outcome]}
								wishlist
							/>
						),
					)}
					<li className="flex items-center justify-between border-t-2 border-slate-600 bg-slate-800/60 px-4 py-3 font-semibold">
						<span>Entries in your file</span>
						<span className="tabular-nums">
							{formatCount(summary.counts.rows)}
						</span>
					</li>
				</ul>
			</div>
			{!canImport && (
				<p id="wishlist-import-required" className="text-sm text-gray-300">
					{seen > 0
						? `Nothing new to add. To add the ${one ? "title" : "titles"} you've already seen, choose ${one ? "Add it" : "Add them"} as Want to rewatch.`
						: "Nothing to add. GoodWatch already has the titles in this file, or can't add them."}
				</p>
			)}
			<div className="flex flex-wrap gap-3">
				<button
					type="button"
					className={primaryButton}
					disabled={!canImport || confirming}
					aria-describedby={!canImport ? "wishlist-import-required" : undefined}
					onClick={() =>
						canImport &&
						onConfirm({
							kinds: ["want"],
							conflictChoice: seenChoice,
							watchDates: "preserve",
						})
					}
				>
					{confirming ? "Adding to Want to See" : "Add to Want to See"}
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
	checked,
	onChange,
	label,
	detail,
}: {
	checked: boolean
	onChange: () => void
	label: string
	detail: string
}) {
	return (
		<label
			className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 ${checked ? "border-indigo-500 bg-indigo-950/50" : "border-slate-700 bg-slate-900/60"}`}
		>
			<input
				type="radio"
				name="wishlist-seen"
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
