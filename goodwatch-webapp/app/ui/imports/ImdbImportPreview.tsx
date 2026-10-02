// Steps 3 to 5 of the IMDb import: what the file holds, what to do where GoodWatch disagrees, and the confirmation.
import { useState } from "react"
import type {
	ImdbConflictChoice,
	ImdbImportOutcome,
	ImdbImportSummary,
} from "~/domain/imdb-import"
import { FocusHeading } from "./FocusHeading"
import { CountList, CountRow, OutcomeRow } from "./ImdbImportCounts"
import {
	errorBox,
	formatCount,
	primaryButton,
	ratings,
	secondaryButton,
	titles,
} from "./shared"

/** Shown even at zero; the other counts only appear when the file has such rows. */
const ALWAYS_SHOWN: ImdbImportOutcome = "new"
const PREVIEW_ORDER: ImdbImportOutcome[] = [
	"new",
	"update",
	"unchanged",
	"conflict",
	"unmatched",
	"unsupported",
	"invalid",
]

export function ImdbImportPreview({
	summary,
	focus,
	confirming,
	error,
	onConfirm,
	onBack,
}: {
	summary: ImdbImportSummary
	focus: boolean
	confirming: boolean
	error: string | null
	onConfirm: (choice: ImdbConflictChoice) => void
	onBack: () => void
}) {
	const { counts } = summary
	const [choice, setChoice] = useState<ImdbConflictChoice>("keep")
	const toWrite =
		counts.new + counts.update + (choice === "imdb" ? counts.conflict : 0)

	return (
		<section className="flex flex-col gap-5">
			<div className="flex flex-col gap-2">
				<FocusHeading focus={focus}>Check before you import</FocusHeading>
				<p>
					Here is what we found in{" "}
					<span className="font-semibold text-gray-100 break-all">
						{summary.fileName}
					</span>
					. Nothing has been saved yet.
				</p>
			</div>

			<CountList>
				{PREVIEW_ORDER.filter(
					(outcome) => outcome === ALWAYS_SHOWN || counts[outcome] > 0,
				).map((outcome) => (
					<OutcomeRow
						key={outcome}
						importId={summary.id}
						outcome={outcome}
						count={counts[outcome]}
					/>
				))}
				<CountRow label="Rows in your file" count={counts.rows} total />
			</CountList>

			<div className="flex flex-col gap-1 text-sm text-gray-400">
				<p>
					Movies and shows are imported. Episodes, shorts and games are not.
				</p>
				<p>Rated titles count as Seen. No watch date is added.</p>
			</div>

			{counts.conflict > 0 && (
				<fieldset className="flex flex-col gap-2">
					<legend className="mb-2 font-semibold text-gray-100">
						{counts.conflict === 1
							? "1 title has a different rating in GoodWatch. Which one should stay?"
							: `${formatCount(counts.conflict)} titles have a different rating in GoodWatch. Which ones should stay?`}
					</legend>
					<ChoiceOption
						value="keep"
						current={choice}
						onChange={setChoice}
						label="Keep my GoodWatch ratings"
						detail={`${titles(counts.conflict)} ${counts.conflict === 1 ? "stays" : "stay"} as rated in GoodWatch.`}
					/>
					<ChoiceOption
						value="imdb"
						current={choice}
						onChange={setChoice}
						label="Use my IMDb ratings instead"
						detail={`${titles(counts.conflict)} ${counts.conflict === 1 ? "gets" : "get"} the rating from your IMDb file.`}
					/>
				</fieldset>
			)}

			<div className="flex flex-col gap-3">
				{toWrite === 0 && (
					<p id="imdb-import-nothing" className="text-gray-300">
						{counts.conflict > 0
							? `Nothing to import with this choice. Choose your IMDb ratings to import ${ratings(counts.conflict)}.`
							: "There is nothing to import from this file. Every title in it is already in GoodWatch with the same rating, or can't be imported."}
					</p>
				)}
				<div className="flex flex-wrap gap-3">
					<button
						type="button"
						className={primaryButton}
						disabled={toWrite === 0 || confirming}
						aria-describedby={toWrite === 0 ? "imdb-import-nothing" : undefined}
						onClick={() => onConfirm(choice)}
					>
						{confirming ? "Starting import" : `Import ${ratings(toWrite)}`}
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
			</div>
		</section>
	)
}

function ChoiceOption({
	value,
	current,
	onChange,
	label,
	detail,
}: {
	value: ImdbConflictChoice
	current: ImdbConflictChoice
	onChange: (value: ImdbConflictChoice) => void
	label: string
	detail: string
}) {
	const checked = current === value
	return (
		<label
			className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${checked ? "border-indigo-500 bg-indigo-950/50" : "border-slate-700 bg-slate-900/60 hover:border-slate-500"}`}
		>
			<input
				type="radio"
				name="imdb-conflict-choice"
				value={value}
				checked={checked}
				onChange={() => onChange(value)}
				className="mt-1 h-4 w-4 shrink-0 accent-indigo-500"
			/>
			<span className="flex flex-col">
				<span className="font-semibold text-gray-100">{label}</span>
				<span className="text-sm text-gray-400">{detail}</span>
			</span>
		</label>
	)
}
